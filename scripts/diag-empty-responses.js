/**
 * DIAGNÓSTICO (solo lectura): analiza las alertas de "Respuesta truncada" con
 * respuesta vacía del paciente (retry_failed: first=empty; retry=empty) para
 * distinguir FILTRO DE CONTENIDO vs GLITCH transitorio.
 *
 * Por cada alerta imprime: cuándo, paciente (+dificultad), alumna, turno, y el
 * ÚLTIMO mensaje del alumno ANTES del vacío (el que gatilló la no-respuesta).
 * Si los vacíos se concentran en pacientes de riesgo / mensajes sensibles →
 * filtro de contenido. Si son benignos y dispersos → glitch del proveedor.
 *
 * Uso: node scripts/diag-empty-responses.js
 */
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
const cfg = dotenv.parse(fs.readFileSync(".env.production"));
const s = createClient(cfg.NEXT_PUBLIC_SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

(async () => {
  // 1) Alertas de respuesta vacía
  const { data: alerts, error } = await s
    .from("chat_alerts")
    .select("id, conversation_id, student_id, ai_patient_id, matched_terms, turn_number, created_at")
    .eq("kind", "short_response")
    .eq("source", "assistant")
    .ilike("matched_terms", "%empty%")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  console.log(`\n=== ${alerts.length} alertas de respuesta VACÍA (first/retry empty) ===\n`);
  if (alerts.length === 0) return;

  // 2) Lookups de paciente y alumna
  const patIds = [...new Set(alerts.map((a) => a.ai_patient_id).filter(Boolean))];
  const stuIds = [...new Set(alerts.map((a) => a.student_id).filter(Boolean))];
  const { data: pats } = await s.from("ai_patients").select("id, name, difficulty_level").in("id", patIds);
  const { data: stus } = await s.from("profiles").select("id, full_name, email").in("id", stuIds);
  const P = Object.fromEntries((pats || []).map((p) => [p.id, p]));
  const U = Object.fromEntries((stus || []).map((u) => [u.id, u]));

  // 3) Por conversación, cargar mensajes una vez
  const convIds = [...new Set(alerts.map((a) => a.conversation_id))];
  const msgsByConv = {};
  for (const cid of convIds) {
    const { data: msgs } = await s
      .from("messages")
      .select("role, content, created_at")
      .eq("conversation_id", cid)
      .order("created_at", { ascending: true });
    msgsByConv[cid] = msgs || [];
  }

  // 4) Reporte + agregados
  const byPatient = {};
  const byDifficulty = {};
  for (const a of alerts) {
    const p = P[a.ai_patient_id] || {};
    const u = U[a.student_id] || {};
    const msgs = msgsByConv[a.conversation_id] || [];
    // Último mensaje del alumno anterior (o igual) al timestamp de la alerta
    const priorUser = [...msgs]
      .filter((m) => m.role === "user" && new Date(m.created_at) <= new Date(a.created_at))
      .pop();
    const when = new Date(a.created_at).toLocaleString("es-CL", { timeZone: "America/Santiago" });
    const trigger = priorUser ? priorUser.content.replace(/\s+/g, " ").slice(0, 160) : "(sin mensaje previo)";
    console.log(`• ${when} | ${p.name || "?"} [${p.difficulty_level || "?"}] | ${u.full_name || u.email || "?"} | turno ${a.turn_number}`);
    console.log(`    último msg alumna → "${trigger}"`);
    byPatient[p.name || "?"] = (byPatient[p.name || "?"] || 0) + 1;
    byDifficulty[p.difficulty_level || "?"] = (byDifficulty[p.difficulty_level || "?"] || 0) + 1;
  }

  console.log(`\n=== AGREGADOS ===`);
  console.log("Por paciente:", JSON.stringify(byPatient, null, 0));
  console.log("Por dificultad:", JSON.stringify(byDifficulty, null, 0));
  const students = new Set(alerts.map((a) => a.student_id));
  console.log(`Alumnas distintas afectadas: ${students.size} | Conversaciones distintas: ${convIds.length}`);
})().catch((e) => { console.error("FATAL", e.message); process.exit(1); });
