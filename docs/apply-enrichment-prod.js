/**
 * Aplica los 34 bloques de enriquecimiento a PROD vía API REST.
 * Variante de apply-enrichment-staging.js apuntada a .env.production.
 *
 * Defensas:
 *   1. Lee .env.production (no .env.local).
 *   2. Aborta si la URL no contiene 'ndwmnxlwbfqfwwtekjun'.
 *   3. Aborta si encuentra duplicados de pacientes (señal de seed inicial mal aplicado).
 *   4. Match por NAME, elige el row con system_prompt más largo si hay duplicados.
 *   5. Idempotente: re-ejecutable sin daño (sobrescribe los bloques con version=1).
 */
const fs = require("fs");

const env = fs.readFileSync(".env.production", "utf8").replace(/^﻿/, "");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(\S+)/)[1];
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(\S+)/)[1];

if (!url.includes("ndwmnxlwbfqfwwtekjun")) {
  console.error("❌ ERROR: .env.production NO apunta al project-ref de PROD esperado. Aborto.");
  process.exit(1);
}
console.log(`Aplicando contra PROD: ${url.match(/https:\/\/(\w+)/)[1]}\n`);

const headers = { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" };
const ENRICHED = JSON.parse(fs.readFileSync("C:/tmp/enriched-blocks.json", "utf8"));

const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

(async () => {
  console.log("1. Cargando todos los pacientes de PROD");
  const allRes = await fetch(
    `${url}/rest/v1/ai_patients?select=id,name,system_prompt,enrichment_version`,
    { headers }
  );
  const all = await allRes.json();
  console.log(`   Total filas en PROD: ${all.length}`);

  // Detectar duplicados
  const byName = {};
  for (const p of all) {
    const n = norm(p.name);
    if (!byName[n]) byName[n] = [];
    byName[n].push(p);
  }
  const dupes = Object.entries(byName).filter(([_, arr]) => arr.length > 1);
  if (dupes.length > 0) {
    console.error("❌ DUPLICADOS DETECTADOS en PROD:");
    for (const [n, arr] of dupes) console.error(`   ${arr[0].name} ×${arr.length}`);
    console.error("Aborto. Limpia los duplicados antes de aplicar.");
    process.exit(1);
  }
  console.log("   ✓ Sin duplicados");

  // Mapa nombre_normalizado → row
  const prodByName = {};
  for (const [n, arr] of Object.entries(byName)) prodByName[n] = arr[0];

  console.log("\n2. Aplicando bloques a los 34 pacientes");
  const ts = new Date().toISOString();
  let applied = 0, skipped = 0, historyOk = 0, errors = [];

  for (const p of ENRICHED.patients) {
    if (!p.enriched_blocks) continue;

    const prodRow = prodByName[norm(p.name)];
    if (!prodRow) {
      skipped++;
      console.log(`   - skip ${p.name} (no está en PROD)`);
      continue;
    }
    const prodId = prodRow.id;

    const b = p.enriched_blocks;
    const blockJson = (text) => ({
      text, version: 1, generated_by: "ai", generated_at: ts, model: "gpt-4o",
    });
    const blocks = {
      red_social: blockJson(b.red_social_y_vinculos),
      lugares: blockJson(b.lugares_significativos),
      estado_corporal: blockJson(b.estado_corporal_y_rutina),
      frases_tipo: blockJson(b.frases_tipo_que_dices),
    };

    const patchRes = await fetch(`${url}/rest/v1/ai_patients?id=eq.${prodId}`, {
      method: "PATCH", headers,
      body: JSON.stringify({
        enrichment_red_social: blocks.red_social,
        enrichment_lugares: blocks.lugares,
        enrichment_estado_corporal: blocks.estado_corporal,
        enrichment_frases_tipo: blocks.frases_tipo,
        enrichment_version: 1,
      }),
    });
    if (!patchRes.ok) {
      errors.push({ name: p.name, step: "PATCH", err: await patchRes.text() });
      continue;
    }

    // Borrar history v=1 previa para idempotencia
    await fetch(`${url}/rest/v1/enrichment_history?patient_id=eq.${prodId}&version=eq.1`, {
      method: "DELETE", headers,
    });

    const historyRows = Object.entries(blocks).map(([block_name, content]) => ({
      patient_id: prodId, block_name, version: 1, content,
      generated_by: "ai", created_at: ts,
    }));
    const insRes = await fetch(`${url}/rest/v1/enrichment_history`, {
      method: "POST", headers, body: JSON.stringify(historyRows),
    });
    if (!insRes.ok) {
      errors.push({ name: p.name, step: "INSERT history", err: await insRes.text() });
      continue;
    }
    historyOk += 4;
    applied++;
    console.log(`   ✓ ${p.name.padEnd(24)} → prod id ${prodId.slice(0, 8)}`);
  }

  console.log("\n=== RESUMEN PROD ===");
  console.log(`   Aplicados: ${applied}/${ENRICHED.patients.length}`);
  console.log(`   Saltados: ${skipped}`);
  console.log(`   Filas history: ${historyOk}`);
  console.log(`   Errores: ${errors.length}`);
  if (errors.length) {
    console.log("\n=== ERRORES ===");
    for (const e of errors.slice(0, 5)) {
      console.log(`   [${e.step}] ${e.name}: ${e.err.slice(0, 200)}`);
    }
  }
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
