/**
 * Borra la marca de retiro en las sesiones cortadas por el bug del nombre.
 *
 * Las 7 rupturas por name_evasion de toda la plataforma eran falsos positivos:
 * la presentación se salía de la ventana de 50 mensajes y el paciente "olvidaba"
 * que se la habían dado. Ver el fix en conversation-pacing.
 *
 * Por qué borrar la marca y no dejarla: no es un dato histórico, es una
 * acusación falsa. El panel del docente muestra hoy "El paciente se retiró: el
 * terapeuta nunca se presentó" sobre 7 alumnas que sí se presentaron, y el
 * informe al cliente cuenta 4 retiros que no ocurrieron.
 *
 * La transcripción NO se toca: lo que el paciente dijo sigue ahí. Lo único que
 * se quita es la etiqueta que la plataforma dedujo mal.
 *
 * Solo toca las que se pueden verificar: se exige que la estudiante se haya
 * presentado en sus primeros mensajes. Una ruptura legítima se queda.
 *
 * Uso:
 *   node scripts/limpiar-retiros-falsos.mjs            (lista)
 *   node scripts/limpiar-retiros-falsos.mjs --aplicar
 */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.join(import.meta.dirname, "..");
const APLICAR = process.argv.includes("--aplicar");

const cfg = dotenv.parse(fs.readFileSync(path.join(ROOT, ".env.production"), "utf8").replace(/^﻿/, ""));
const s = createClient(cfg.NEXT_PUBLIC_SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// El detector real de presentación, no una heurística de este script.
const { hasStudentIntroducedName } = await import(
  "file://" + path.join(ROOT, ".rubrica-tmp/conversation-pacing.ts").replace(/\\/g, "/")
);

const { data: retiros } = await s
  .from("conversations")
  .select("id, student_id, end_reason, created_at")
  .like("end_reason", "name_evasion%");

console.log(`rupturas por name_evasion: ${retiros.length}\n`);

const falsas = [];
for (const c of retiros) {
  const { data: prof } = await s.from("profiles").select("full_name").eq("id", c.student_id).maybeSingle();
  const { data: m } = await s
    .from("messages").select("role,content").eq("conversation_id", c.id).order("created_at");
  const suyos = (m || []).filter((x) => x.role === "user").map((x) => x.content);
  const sePresento = hasStudentIntroducedName(suyos, prof?.full_name || null);
  console.log(`   ${sePresento ? "FALSO POSITIVO" : "ruptura legítima"} · ${c.created_at.slice(0,10)} · ${m?.length || 0} msgs · ${prof?.full_name || "?"}`);
  if (sePresento) {
    console.log(`      → "${String(suyos.slice(0,3).join(" | ")).replace(/\s+/g," ").slice(0,110)}"`);
    falsas.push(c.id);
  }
}

console.log(`\nfalsos positivos: ${falsas.length} de ${retiros.length}`);
if (!APLICAR) {
  console.log("\nModo lista. Para limpiar la marca: agrega --aplicar");
  process.exit(0);
}

const { error } = await s.from("conversations").update({ end_reason: null }).in("id", falsas);
if (error) { console.error("Error:", error.message); process.exit(1); }

const { data: quedan } = await s.from("conversations").select("id").like("end_reason", "name_evasion%");
console.log(`\nMarca borrada en ${falsas.length}. Quedan ${quedan?.length || 0} rupturas por nombre.`);
console.log("ids limpiados:", falsas.join(", "));
