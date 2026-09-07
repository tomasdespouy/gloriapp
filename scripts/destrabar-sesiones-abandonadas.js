/**
 * Destraba sesiones abandonadas que quedaron sin autorreflexión.
 *
 * El problema: "Finalizar sesión" llevaba al formulario sin cerrar la
 * conversación, y el cron de limpieza la marcaba "abandonada" mientras el
 * alumno respondía. Una sesión abandonada, en el historial, abre "Retomar
 * conversación" en vez del formulario — así que la autorreflexión quedaba
 * fuera de alcance. Y la ficha del docente exige status completed, o sea que
 * tampoco se podía evaluar.
 *
 * Lo que hace: pasa esas conversaciones de "abandoned" a "completed". Es la
 * misma transición que ya hace /api/sessions/[id]/leave-reflection. Con eso,
 * un clic en el historial abre las preguntas directamente y el docente puede
 * abrir la ficha.
 *
 * NO toca ended_at a propósito: dejar la fecha original las mantiene fuera de
 * la ventana de 48 h del cron de recordatorios, para que el aviso lo mande el
 * script de envío puntual y no el cron por su cuenta.
 *
 * Uso:
 *   node scripts/destrabar-sesiones-abandonadas.js --est <uuid>            (solo lista)
 *   node scripts/destrabar-sesiones-abandonadas.js --conv <uuid>           (una sola)
 *   node scripts/destrabar-sesiones-abandonadas.js --est <uuid> --aplicar
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
const CONV = flag("--conv");
const APLICAR = args.includes("--aplicar");
const MIN_MSGS = 6;

if (!EST && !CONV) {
  console.error("Falta --est <uuid> o --conv <uuid>");
  process.exit(1);
}

const raiz = path.join(__dirname, "..");
const cfg = dotenv.parse(fs.readFileSync(path.join(raiz, ".env.production"), "utf8").replace(/^﻿/, ""));
const s = createClient(cfg.NEXT_PUBLIC_SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Señales de que la entrevista llegó a un cierre y no se cortó a mitad. Si no
// las tiene, conviene mirarla antes de cerrarla: pasarla a "completed" le
// quita al alumno la posibilidad de retomar la conversación.
const DESPEDIDA = /\b(hasta luego|hasta la pr[oó]xima|nos vemos|que est[eé] bien|c[uú]idese|c[uú]idate|gracias por (venir|su tiempo|tu tiempo)|adi[oó]s|chau|nos hablamos|buenas tardes|que le vaya bien)\b/i;
const CITA = /\b(pr[oó]xima (sesi[oó]n|cita|semana)|la pr[oó]xima|nos vemos el|quedamos (as[ií]|el)|agendar|el jueves|el viernes|el lunes|el martes|el mi[eé]rcoles)\b/i;

(async () => {
  let convs;
  if (CONV) {
    const { data } = await s
      .from("conversations")
      .select("id, student_id, status, created_at, ended_at, ai_patients(name)")
      .eq("id", CONV);
    convs = data || [];
  } else {
    const { data: al } = await s
      .from("profiles").select("id, full_name, email")
      .eq("establishment_id", EST).eq("role", "student");
    const alumnos = (al || []).filter((a) => !/tomasdespouy|smoketest/.test(a.email || ""));
    const { data } = await s
      .from("conversations")
      .select("id, student_id, status, created_at, ended_at, ai_patients(name)")
      .in("student_id", alumnos.map((a) => a.id))
      .eq("status", "abandoned");
    convs = data || [];
  }

  if (!convs.length) return console.log("No hay sesiones abandonadas que revisar.");

  const ids = convs.map((c) => c.id);
  const { data: evals } = await s
    .from("session_competencies").select("conversation_id").in("conversation_id", ids);
  const evaluada = new Set((evals || []).map((x) => x.conversation_id));

  const { data: prof } = await s
    .from("profiles").select("id, full_name").in("id", [...new Set(convs.map((c) => c.student_id))]);
  const nombre = new Map((prof || []).map((p) => [p.id, p.full_name]));

  const filas = [];
  for (const c of convs) {
    if (evaluada.has(c.id)) continue;
    // Paginado no hace falta acá: se piden los mensajes de UNA conversación.
    const { data: msgs } = await s
      .from("messages").select("role, content, created_at")
      .eq("conversation_id", c.id).order("created_at");
    const total = (msgs || []).length;
    if (total < MIN_MSGS) continue;
    const ultimosDelAlumno = (msgs || []).filter((m) => m.role === "user").slice(-3).map((m) => m.content).join("  ");
    const cerroBien = DESPEDIDA.test(ultimosDelAlumno) || CITA.test(ultimosDelAlumno);
    filas.push({ c, total, cerroBien });
  }

  const conCierre = filas.filter((f) => f.cerroBien);
  const sinCierre = filas.filter((f) => !f.cerroBien);

  console.log(`\n${filas.length} sesiones abandonadas, sin evaluar, con ${MIN_MSGS}+ mensajes\n`);
  console.log(`   con despedida o próxima cita: ${conCierre.length}`);
  console.log(`   sin señal de cierre:          ${sinCierre.length}   (la entrevista pudo cortarse a mitad)\n`);

  for (const f of filas) {
    console.log(
      `   ${f.cerroBien ? "cerró bien " : "SIN CIERRE "} ` +
        `${String(nombre.get(f.c.student_id) || "").padEnd(36).slice(0, 36)} ` +
        `${String(f.total).padStart(3)} msgs  ${f.c.created_at.slice(0, 10)}  ${f.c.ai_patients?.name || ""}`,
    );
  }

  if (!APLICAR) {
    console.log("\nModo lista. Para aplicar el cambio de estado: agrega --aplicar");
    return;
  }

  const aCambiar = filas.map((f) => f.c.id);
  const { error } = await s
    .from("conversations")
    .update({ status: "completed" })
    .in("id", aCambiar);

  if (error) {
    console.error("\nError al actualizar:", error.message);
    process.exit(1);
  }

  // Verificación explícita: un update sin error no garantiza que las filas
  // hayan quedado como se espera (un filtro mal puesto no falla, no hace nada).
  const { data: check } = await s
    .from("conversations").select("id, status").in("id", aCambiar);
  const ok = (check || []).filter((x) => x.status === "completed").length;
  console.log(`\nActualizadas ${ok} de ${aCambiar.length} a "completed".`);
  if (ok !== aCambiar.length) {
    console.error("¡Revisar! Alguna no quedó en el estado esperado.");
    process.exit(1);
  }
})();
