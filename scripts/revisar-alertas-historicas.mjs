/**
 * Pasa el detector ACTUAL sobre las alertas ya almacenadas y marca como
 * revisadas las que dejaron de calificar.
 *
 * Por qué marcar y no borrar: chat_alerts tiene reviewed_at y review_notes
 * justamente para esto. Borrar perdería la evidencia de que la regla vieja
 * disparaba, que es lo que justifica el cambio. Marcar deja el rastro y saca
 * el ruido de los conteos, que solo miran las no revisadas.
 *
 * Uso:
 *   node scripts/revisar-alertas-historicas.mjs            (lista, no escribe)
 *   node scripts/revisar-alertas-historicas.mjs --aplicar
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

// El detector real, no una copia: una copia probaría otra cosa que la que corre.
const { detectAlerts } = await import(
  "file://" + path.join(ROOT, "src/lib/chat-alerts.ts").replace(/\\/g, "/")
);

let todas = [];
for (let off = 0; ; off += 1000) {
  const { data } = await s
    .from("chat_alerts")
    .select("id,kind,source,sample,reviewed_at")
    .is("reviewed_at", null)
    .range(off, off + 999);
  if (!data || !data.length) break;
  todas = todas.concat(data);
  if (data.length < 1000) break;
}

const caducas = [];
for (const a of todas) {
  if (!a.sample) continue;
  const sigue = detectAlerts(a.sample, a.source).some((x) => x.kind === a.kind);
  if (!sigue) caducas.push(a);
}

console.log(`alertas sin revisar: ${todas.length}`);
console.log(`ya no califican con la regla actual: ${caducas.length}\n`);
const porTipo = {};
for (const a of caducas) porTipo[`${a.kind}/${a.source}`] = (porTipo[`${a.kind}/${a.source}`] || 0) + 1;
console.log("   ", JSON.stringify(porTipo), "\n");
for (const a of caducas.slice(0, 5)) {
  console.log(`   [${a.kind}] "${String(a.sample).replace(/\s+/g, " ").slice(0, 95)}"`);
}

if (!APLICAR) {
  console.log("\nModo lista. Para marcarlas: agrega --aplicar");
  process.exit(0);
}

const ahora = new Date().toISOString();
let ok = 0;
for (const a of caducas) {
  const { error } = await s
    .from("chat_alerts")
    .update({
      reviewed_at: ahora,
      review_notes: "Falso positivo de la regla anterior: negación explícita o tamizaje del estudiante. Revisado automáticamente al corregir el detector (10-sep-2026).",
    })
    .eq("id", a.id);
  if (!error) ok++;
}
console.log(`\nMarcadas ${ok} de ${caducas.length}.`);
