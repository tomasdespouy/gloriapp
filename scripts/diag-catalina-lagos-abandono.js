// READ-ONLY: reconstruye la 3ª sesión de Catalina Lagos (UGM) para ver por qué
// la paciente se retiró. Replica los tres detectores de cierre que corren en
// src/app/api/chat/route.ts (hostilidad, evasión de nombre, antiprofesional).
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
const cfg = dotenv.parse(fs.readFileSync(".env.production", "utf8").replace(/^﻿/, ""));
const s = createClient(cfg.NEXT_PUBLIC_SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const normalize = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Réplica EXACTA de DIRECTED_THREAT_RE (src/lib/chat-alerts.ts)
const DIRECTED_THREAT_RE =
  /\bte\s+(?:voy\s+a\s+|quiero\s+|deberia(?:n)?\s+)?(?:mat(?:ar|o)|peg(?:ar|o)|golpe(?:ar|o)|apu[nñ]al|acuchill|viol(?:ar|o)|revent|destroz|lastim|hacer\s+da[nñ]o)|\b(?:voy\s+a\s+)?(?:matarte|pegarte|golpearte|apu[nñ]alarte|violarte|lastimarte|reventarte|destrozarte|hacerte\s+da[nñ]o)\b/i;

(async () => {
  const { data: prof } = await s
    .from("profiles")
    .select("id, email, full_name, establishment_id")
    .ilike("email", "%catalina.lagos%");
  if (!prof || !prof.length) return console.log("NO PROFILE");
  for (const p of prof) console.log(`PERFIL ${p.full_name} <${p.email}> ${p.id}`);
  const ids = prof.map((p) => p.id);

  const { data: convs } = await s
    .from("conversations")
    .select("*")
    .in("student_id", ids)
    .order("created_at");
  console.log(`\nConversaciones: ${convs.length}`);
  for (const c of convs) {
    const { data: pat } = await s
      .from("ai_patients").select("name, difficulty_level").eq("id", c.ai_patient_id).maybeSingle();
    const { count } = await s
      .from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", c.id);
    console.log(
      `  #${c.session_number} ${c.id} | ${pat?.name} (${pat?.difficulty_level}) | ${c.status} | ${c.created_at} → ${c.ended_at || c.updated_at} | ${count} msgs`,
    );
  }

  // Detalle de la última conversación (la del reclamo, 13-ago)
  const target = convs.filter((c) => c.created_at >= "2026-08-12").pop() || convs[convs.length - 1];
  console.log(`\n===== DETALLE conversación ${target.id} =====`);
  console.log(JSON.stringify(target, null, 2));

  const { data: msgs } = await s
    .from("messages").select("role, content, created_at").eq("conversation_id", target.id).order("created_at");
  console.log(`\n--- TRANSCRIPCIÓN (${msgs.length}) ---`);
  for (const m of msgs) {
    const who = m.role === "user" ? "ALUMNA " : "PACIENTE";
    console.log(`[${m.created_at.slice(11, 19)}] ${who}: ${m.content.replace(/\n/g, " ")}`);
    if (m.role === "user") {
      const n = normalize(m.content);
      const hit = n.match(DIRECTED_THREAT_RE);
      if (hit) console.log(`        >>> DIRECTED_THREAT_RE DISPARA: "${hit[0]}"`);
    }
  }

  const { data: alerts } = await s
    .from("chat_alerts").select("*").eq("conversation_id", target.id).order("created_at");
  console.log(`\n--- chat_alerts (${alerts?.length || 0}) ---`);
  for (const a of alerts || []) console.log(`  ${a.kind} | ${a.severity} | ${a.matched_terms} | ${a.sample}`);
})();
