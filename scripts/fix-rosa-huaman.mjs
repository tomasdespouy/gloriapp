/**
 * Corrige la ficha de Rosa Huamán, que contradecía a la paciente.
 *
 * La ficha que el estudiante lee ANTES de entrar decía "profesora de primaria
 * en Cusco, criada en el campo por sus abuelos". El system_prompt que gobierna
 * a la paciente dice que vive en Lima, que es la menor de cinco hermanos y que
 * sus padres eran maestros. Dos personas distintas.
 *
 * Cuál es la buena no se decidió por gusto: sobre 2.000 mensajes suyos a
 * estudiantes reales, en 191 conversaciones, Rosa contó SIEMPRE la versión del
 * prompt — Lima 30 veces, "mis papás siempre han sido maestros" 33, "yo siempre
 * he sido la menor" 33. Cusco aparece 2 veces y solo para ubicar a sus hermanos.
 * Cambiar el prompt habría contradicho lo que cientos de personas ya leyeron.
 *
 * Se corrige además la corrupción de ñ que dejó un reemplazo automático mal
 * aplicado ("hermaños", "veraños", "maños", "relaciónes"). Impacto observado:
 * ninguno — en 65.496 mensajes de pacientes no aparece ni una vez, el modelo lo
 * escribe bien igual. Se arregla porque está mal, no porque rompa algo.
 *
 * Uso:
 *   node scripts/fix-rosa-huaman.mjs          muestra el cambio, no escribe
 *   node scripts/fix-rosa-huaman.mjs --write  aplica en producción
 */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(import.meta.dirname, "..");
const ESCRIBIR = process.argv.includes("--write");
const cfg = dotenv.parse(fs.readFileSync(path.join(ROOT, ".env.production"), "utf8").replace(/^﻿/, ""));
const s = createClient(cfg.NEXT_PUBLIC_SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const BACKSTORY_NUEVA =
  "Rosa es profesora de primaria en Lima, la menor de cinco hermanos en una familia de maestros, " +
  "y guarda como refugio los veranos de su infancia en la casa de sus abuelos en el campo. Las burlas " +
  "en la secundaria le enseñaron a 'no dar problema'. Calma su ansiedad controlándolo y planificándolo " +
  "todo, y le cuesta muchísimo pedir ayuda. Una ruptura de pareja hace cuatro meses reagudizó su insomnio " +
  "y su preocupación constante por sus alumnos. Teme que, si muestra debilidad, la gente se aleje.";

// Reemplazo automático mal aplicado. Se listan como pares explícitos y no como
// una regla general para no volver a romper algo por barrer de más.
const TYPOS = [
  ["hermaños", "hermanos"],
  ["veraños", "veranos"],
  ["maños", "manos"],
  ["relaciónes", "relaciones"],
];

const { data: rows, error } = await s
  .from("ai_patients")
  .select("id, name, backstory, system_prompt")
  .ilike("name", "%Huam%");

if (error || !rows?.length) {
  console.error("no se encontró la paciente:", error?.message ?? "sin resultados");
  process.exit(1);
}
const p = rows[0];

let promptNuevo = p.system_prompt;
const aplicados = [];
for (const [malo, bueno] of TYPOS) {
  const n = promptNuevo.split(malo).length - 1;
  if (n > 0) {
    promptNuevo = promptNuevo.split(malo).join(bueno);
    aplicados.push(`${malo} → ${bueno} (${n})`);
  }
}

console.log(`Paciente: ${p.name} (${p.id})\n`);
console.log("── FICHA (lo que lee el estudiante)");
console.log("   ANTES  :", p.backstory);
console.log("   DESPUÉS:", BACKSTORY_NUEVA);
console.log();
console.log("── PROMPT — correcciones de escritura");
console.log(aplicados.length ? aplicados.map((x) => "   " + x).join("\n") : "   (ninguna)");
console.log(`   largo: ${p.system_prompt.length} → ${promptNuevo.length}`);
console.log();

if (!ESCRIBIR) {
  console.log("ENSAYO — no se escribió nada. Para aplicar: --write");
  process.exit(0);
}

const { error: e } = await s
  .from("ai_patients")
  .update({ backstory: BACKSTORY_NUEVA, system_prompt: promptNuevo })
  .eq("id", p.id);

if (e) {
  console.error("falló la escritura:", e.message);
  process.exit(1);
}
console.log("APLICADO en producción.");
console.log("Las conversaciones en curso no cambian: usan prompt_snapshot, congelado al iniciarlas.");
console.log("Recuerda regenerar la línea base: node scripts/prompt-baseline.mjs --write");
