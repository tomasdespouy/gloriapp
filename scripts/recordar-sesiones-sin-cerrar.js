/**
 * Envío puntual del recordatorio "dejaste la sesión sin cerrar".
 *
 * El cron (/api/cron/remind-unclosed-sessions) solo mira las últimas 48 horas,
 * a propósito: no queremos que una primera corrida despierte a todo el
 * historial de la plataforma. Los rezagos viejos —como las 18 sesiones de UPC
 * del 3 de septiembre— se mandan desde acá, mirando la lista antes.
 *
 * El HTML NO se copia acá: se carga de src/lib/emails/unclosed-session.ts, el
 * mismo archivo que usa el cron. Si hubiera dos copias, una se quedaría atrás
 * sin que nadie se diera cuenta hasta que un estudiante recibiera el texto
 * viejo. Ese archivo no importa nada justamente para poder cargarlo así.
 *
 * Uso:
 *   node scripts/recordar-sesiones-sin-cerrar.js --est <uuid>              (solo lista)
 *   node scripts/recordar-sesiones-sin-cerrar.js --est <uuid> --prueba <correo>
 *   node scripts/recordar-sesiones-sin-cerrar.js --est <uuid> --enviar
 *
 * --prueba manda UN correo a la dirección indicada, armado con los datos
 * reales de la primera sesión de la lista. No le escribe a ningún estudiante
 * ni marca nada en la base.
 * --enviar es el único modo que le escribe a los estudiantes.
 */
const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

const args = process.argv.slice(2);
const flag = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : null;
};
const EST = flag("--est");
const PRUEBA = flag("--prueba");
const ENVIAR = args.includes("--enviar");
// Solo para --prueba: fuerza la variante del correo ("sin_cerrar" o
// "sin_reflexion") aunque los datos reales sean del otro caso. Sirve para
// revisar el texto de una variante que hoy no tiene casos.
const TIPO = flag("--tipo");
const MIN_MSGS = 6;

if (!EST) {
  console.error("Falta --est <uuid del establecimiento>");
  process.exit(1);
}

const raiz = path.join(__dirname, "..");
const cfg = dotenv.parse(fs.readFileSync(path.join(raiz, ".env.production"), "utf8").replace(/^﻿/, ""));
const s = createClient(cfg.NEXT_PUBLIC_SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
// .env.production trae la base de producción pero no siempre la clave de
// Resend; en esta máquina vive en .env.local. Se busca en ese orden.
function claveResend() {
  if (cfg.RESEND_API_KEY) return cfg.RESEND_API_KEY;
  const local = path.join(raiz, ".env.local");
  if (fs.existsSync(local)) {
    const l = dotenv.parse(fs.readFileSync(local, "utf8").replace(/^﻿/, ""));
    if (l.RESEND_API_KEY) return l.RESEND_API_KEY;
  }
  console.error("No hay RESEND_API_KEY ni en .env.production ni en .env.local");
  process.exit(1);
}
const RESEND = claveResend();
const APP = "https://www.glor-ia.com";
const LOGO = `${APP}/branding/gloria-side-logo.png`;

async function enviar(to, asunto, cuerpo, idem) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND}`,
      "Content-Type": "application/json",
      ...(idem ? { "Idempotency-Key": idem } : {}),
    },
    body: JSON.stringify({ from: "GlorIA <noreply@glor-ia.com>", to, subject: asunto, html: cuerpo }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

(async () => {
  // La misma plantilla del cron, cargada directo desde el .ts.
  const plantilla = await import(
    "file://" + path.join(raiz, "src/lib/emails/unclosed-session.ts").replace(/\\/g, "/")
  );
  const { unclosedSessionHtml, unclosedSessionSubject } = plantilla;

  const { data: al } = await s
    .from("profiles")
    .select("id, full_name, email, is_disabled")
    .eq("establishment_id", EST)
    .eq("role", "student");
  const alumnos = (al || []).filter((a) => !/tomasdespouy|smoketest/.test(a.email || ""));
  const porId = new Map(alumnos.map((a) => [a.id, a]));

  const COLS = "id, student_id, ai_patient_id, created_at, status";
  let { data: cs, error: errConv } = await s
    .from("conversations")
    .select(`${COLS}, student_reminder_sent_at`)
    .in("student_id", alumnos.map((a) => a.id))
    .in("status", ["abandoned", "completed"]);

  // La columna student_reminder_sent_at solo existe después de aplicar la
  // migración 20260907120000. Sin ella se puede LISTAR y previsualizar (no
  // toca nada), pero no enviar: sin la marca no habría forma de garantizar
  // que a nadie le llegue el mismo correo dos veces.
  if (errConv && /student_reminder_sent_at/.test(errConv.message || "")) {
    if (ENVIAR) {
      console.error("\nNo se puede enviar todavía: falta aplicar la migración");
      console.error("supabase/migrations/20260907120000_conversations_student_reminder.sql");
      console.error("Sin la columna de marca, una segunda corrida reenviaría todo.");
      process.exit(1);
    }
    console.log("\n(La migración aún no está aplicada: modo lectura, sin marcas.)");
    ({ data: cs, error: errConv } = await s
      .from("conversations")
      .select(COLS)
      .in("student_id", alumnos.map((a) => a.id))
      .in("status", ["abandoned", "completed"]));
  }

  // Sin este chequeo, un error de consulta se veía igual que "no hay nada que enviar".
  if (errConv) {
    console.error("\nError al consultar conversaciones:", errConv.message);
    process.exit(1);
  }

  const ids = (cs || []).map((c) => c.id);
  if (!ids.length) return console.log("No hay sesiones en este establecimiento.");

  const { data: evals } = await s
    .from("session_competencies").select("conversation_id").in("conversation_id", ids);
  const evaluada = new Set((evals || []).map((x) => x.conversation_id));

  // Con autorreflexión guardada el alumno ya hizo su parte: si falta la
  // evaluación, el problema es nuestro y no corresponde escribirle.
  const { data: refl } = await s
    .from("session_feedback").select("conversation_id").in("conversation_id", ids);
  const reflexionada = new Set((refl || []).map((x) => x.conversation_id));

  // Paginado explícito: un .in() pelado se corta en 1000 filas sin avisar, y
  // un conteo bajo por error dejaría fuera a estudiantes que sí deben recibir
  // el correo. Misma lógica que src/lib/message-counts.ts.
  const cuenta = {};
  for (const id of ids) cuenta[id] = 0;
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    let desde = 0;
    for (;;) {
      const { data, error } = await s
        .from("messages").select("conversation_id")
        .in("conversation_id", chunk)
        .range(desde, desde + 999);
      if (error) { console.error("Error contando mensajes:", error.message); process.exit(1); }
      for (const m of data || []) cuenta[m.conversation_id]++;
      if (!data || data.length < 1000) break;
      desde += 1000;
    }
  }

  const { data: pacs } = await s
    .from("ai_patients").select("id, name")
    .in("id", [...new Set((cs || []).map((c) => c.ai_patient_id).filter(Boolean))]);
  const paciente = new Map((pacs || []).map((p) => [p.id, p.name]));

  const objetivo = (cs || []).filter((c) => {
    const a = porId.get(c.student_id);
    return (
      a && a.email && !a.is_disabled &&
      !evaluada.has(c.id) &&
      !reflexionada.has(c.id) &&
      !c.student_reminder_sent_at &&
      (cuenta[c.id] || 0) >= MIN_MSGS
    );
  });

  const datos = (c) => {
    const a = porId.get(c.student_id);
    return {
      // "abandoned" = quedó abierta y hay que retomarla. "completed" sin
      // reflexión = solo le faltan las preguntas, no debe volver al chat.
      kind: c.status === "completed" ? "sin_reflexion" : "sin_cerrar",
      studentName: a.full_name || "",
      patientName: paciente.get(c.ai_patient_id) || "tu paciente",
      sessionDate: c.created_at,
      messageCount: cuenta[c.id] || 0,
      appUrl: APP,
      logoUrl: LOGO,
    };
  };

  console.log(`\n${objetivo.length} sesiones de ${new Set(objetivo.map((c) => c.student_id)).size} estudiantes\n`);
  for (const c of objetivo) {
    const a = porId.get(c.student_id);
    console.log(
      `   ${(a.full_name || "").padEnd(34).slice(0, 34)} ` +
        `${(c.status === "completed" ? "sin reflexión" : "sin cerrar  ").padEnd(14)} ` +
        `${String(cuenta[c.id]).padStart(3)} msgs  ${c.created_at.slice(0, 10)}  ${a.email}`,
    );
  }

  if (PRUEBA) {
    const c = objetivo[0];
    if (!c) return console.log("\nNada que previsualizar.");
    const d = { ...datos(c), ...(TIPO ? { kind: TIPO } : {}) };
    await enviar(PRUEBA, `[PRUEBA ${d.kind}] ${unclosedSessionSubject(d.kind, d.patientName)}`, unclosedSessionHtml(d), null);
    console.log(`\nCorreo de prueba enviado a ${PRUEBA} (con los datos de ${d.studentName}).`);
    console.log("Ningún estudiante recibió nada y no se marcó ninguna conversación.");
    return;
  }

  if (!ENVIAR) {
    console.log("\nModo lista. Para enviar de verdad: agrega --enviar");
    return;
  }

  let ok = 0, mal = 0;
  for (const c of objetivo) {
    const d = datos(c);
    const a = porId.get(c.student_id);
    try {
      await enviar(
        a.email,
        unclosedSessionSubject(d.kind, d.patientName),
        unclosedSessionHtml(d),
        `unclosed-session-${c.id}`,
      );
      await s.from("conversations")
        .update({ student_reminder_sent_at: new Date().toISOString() })
        .eq("id", c.id);
      await s.from("email_log").insert({
        type: "unclosed_session", recipient: a.email, success: true, user_id: a.id,
      });
      ok++;
      console.log(`   ✓ ${a.email}`);
    } catch (e) {
      mal++;
      console.log(`   ✗ ${a.email} — ${String(e.message).slice(0, 90)}`);
    }
    // Resend: 10 req/s. Un respiro entre correos.
    await new Promise((r) => setTimeout(r, 150));
  }
  console.log(`\nEnviados ${ok}, fallidos ${mal}`);
})();
