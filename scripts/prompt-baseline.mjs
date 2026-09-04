/**
 * Línea base de los prompts de pacientes — prueba de regresión.
 *
 * Renderiza el prompt FINAL de cada paciente activo usando la función real de
 * producción (`buildEnrichedPrompt`), no una copia: si se copiara la lógica,
 * la prueba dejaría de probar lo que corre de verdad.
 *
 * Uso:
 *   node scripts/prompt-baseline.mjs --write      guarda la línea base
 *   node scripts/prompt-baseline.mjs              compara contra la guardada
 *
 * Por qué existe: se va a separar la capa de país/cultura del caso clínico.
 * Ese refactor toca la composición del prompt, y el único modo de saber que un
 * paciente que NO se tocó sigue idéntico es comparar byte a byte contra esto.
 * Si cambia un solo carácter de un paciente que no estabas migrando, es un bug.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { buildEnrichedPrompt } from "../src/lib/build-system-prompt.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const DESTINO = path.join(ROOT, "scripts", "prompt-baseline.json");
const ESCRIBIR = process.argv.includes("--write");

const cfg = dotenv.parse(
  fs.readFileSync(path.join(ROOT, ".env.production"), "utf8").replace(/^﻿/, ""),
);
const s = createClient(cfg.NEXT_PUBLIC_SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const sha = (t) => crypto.createHash("sha256").update(t, "utf8").digest("hex").slice(0, 16);

const { data: pacientes, error } = await s
  .from("ai_patients")
  .select(
    "id, name, country, difficulty_level, is_active, system_prompt, enrichment_red_social, enrichment_lugares, enrichment_estado_corporal, enrichment_frases_tipo",
  )
  .order("name");

if (error) {
  console.error("no se pudieron leer los pacientes:", error.message);
  process.exit(1);
}

// La composición depende de la bandera de entorno; se deja explícita en el
// archivo para que una línea base tomada con la bandera apagada no se compare
// en silencio contra una tomada con la bandera encendida.
const bandera = process.env.ENABLE_ENRICHMENT_BLOCKS ?? "(sin definir → activo)";

const actual = {
  generado: new Date().toISOString(),
  bandera_enriquecimiento: bandera,
  total: pacientes.length,
  pacientes: pacientes.map((p) => {
    const prompt = buildEnrichedPrompt(p);
    return {
      id: p.id,
      nombre: p.name,
      pais: (p.country || []).join(","),
      nivel: p.difficulty_level,
      activo: p.is_active,
      bloques: [
        p.enrichment_red_social && "red_social",
        p.enrichment_lugares && "lugares",
        p.enrichment_estado_corporal && "estado_corporal",
        p.enrichment_frases_tipo && "frases_tipo",
      ].filter(Boolean),
      largo: prompt.length,
      sha256: sha(prompt),
      prompt,
    };
  }),
};

if (ESCRIBIR) {
  fs.writeFileSync(DESTINO, JSON.stringify(actual, null, 1), "utf8");
  console.log(`línea base escrita: ${path.relative(ROOT, DESTINO)}`);
  console.log(`  ${actual.total} pacientes · bandera: ${bandera}`);
  const largos = actual.pacientes.map((p) => p.largo);
  console.log(`  largo del prompt: ${Math.min(...largos)}–${Math.max(...largos)} caracteres`);
  console.log(`  con enriquecimiento: ${actual.pacientes.filter((p) => p.bloques.length).length}`);
  process.exit(0);
}

if (!fs.existsSync(DESTINO)) {
  console.error("no hay línea base guardada. Corre primero: node scripts/prompt-baseline.mjs --write");
  process.exit(1);
}

const base = JSON.parse(fs.readFileSync(DESTINO, "utf8"));
if (base.bandera_enriquecimiento !== bandera) {
  console.warn(
    `AVISO: la línea base se tomó con la bandera "${base.bandera_enriquecimiento}" y ahora es "${bandera}". La comparación no es válida.`,
  );
}

const antes = new Map(base.pacientes.map((p) => [p.id, p]));
const despues = new Map(actual.pacientes.map((p) => [p.id, p]));

const cambiados = [];
const nuevos = [];
const faltantes = [];

for (const [id, p] of despues) {
  const b = antes.get(id);
  if (!b) nuevos.push(p);
  else if (b.sha256 !== p.sha256) cambiados.push({ nombre: p.nombre, antes: b, despues: p });
}
for (const [id, b] of antes) if (!despues.has(id)) faltantes.push(b);

console.log(`comparados ${despues.size} pacientes contra la línea base del ${base.generado.slice(0, 10)}`);
console.log(`  sin cambios : ${despues.size - cambiados.length - nuevos.length}`);
console.log(`  cambiados   : ${cambiados.length}`);
console.log(`  nuevos      : ${nuevos.length}`);
console.log(`  desaparecidos: ${faltantes.length}`);

for (const c of cambiados) {
  console.log(`\n── ${c.nombre} — el prompt CAMBIÓ`);
  console.log(`   largo ${c.antes.largo} → ${c.despues.largo}`);
  // Primer punto de divergencia, para no imprimir dos prompts completos.
  const a = c.antes.prompt, d = c.despues.prompt;
  let i = 0;
  while (i < a.length && i < d.length && a[i] === d[i]) i++;
  console.log(`   diverge en el carácter ${i}:`);
  console.log(`     antes  : …${JSON.stringify(a.slice(Math.max(0, i - 60), i + 90))}`);
  console.log(`     después: …${JSON.stringify(d.slice(Math.max(0, i - 60), i + 90))}`);
}
for (const n of nuevos) console.log(`\n+ nuevo: ${n.nombre}`);
for (const f of faltantes) console.log(`\n- desaparecido: ${f.nombre}`);

process.exit(cambiados.length || faltantes.length ? 1 : 0);
