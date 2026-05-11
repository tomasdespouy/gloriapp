/**
 * Aplica los 4 bloques de enriquecimiento a STAGING vía API REST.
 * Match por NAME (no ID, porque cada base tiene UUIDs distintos).
 * Si hay duplicados de un mismo paciente, elige el row con system_prompt más largo
 * (la versión moderna post-INF-037).
 *
 * Idempotente. Reportar al final cuántos aplicados/saltados/errores.
 */
const fs = require("fs");

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(\S+)/)[1];
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(\S+)/)[1];

if (!url.includes("vhkbbps")) {
  console.error("❌ ERROR: .env.local NO apunta a STAGING. Aborto.");
  process.exit(1);
}
console.log(`Aplicando contra: ${url.match(/https:\/\/(\w+)/)[1]}\n`);

const headers = { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" };
const ENRICHED = JSON.parse(fs.readFileSync("C:/tmp/enriched-blocks.json", "utf8"));

// Normalizador para comparar nombres (quita acentos, lowercase)
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

(async () => {
  // 1) Cargar TODOS los pacientes de staging con su system_prompt para detectar duplicados y elegir el moderno
  console.log("1. Cargando todos los pacientes de staging con su prompt");
  const allRes = await fetch(
    `${url}/rest/v1/ai_patients?select=id,name,system_prompt,enrichment_version`,
    { headers }
  );
  const all = await allRes.json();
  console.log(`   Total filas en staging: ${all.length}`);

  // Agrupar por nombre normalizado y elegir el moderno (prompt más largo)
  const byName = {};
  for (const p of all) {
    const n = norm(p.name);
    if (!byName[n]) byName[n] = [];
    byName[n].push(p);
  }
  const dupes = Object.entries(byName).filter(([_, arr]) => arr.length > 1);
  console.log(`   Pacientes duplicados: ${dupes.length}`);
  for (const [n, arr] of dupes) {
    arr.sort((a, b) => (b.system_prompt?.length || 0) - (a.system_prompt?.length || 0));
    console.log(`     ${arr[0].name}: usaré el moderno (${arr[0].system_prompt.length} chars), descarto ${arr.length - 1} viejo(s)`);
  }

  // Mapa nombre_normalizado → patient row moderno
  const stagingByName = {};
  for (const [n, arr] of Object.entries(byName)) {
    arr.sort((a, b) => (b.system_prompt?.length || 0) - (a.system_prompt?.length || 0));
    stagingByName[n] = arr[0];
  }

  // 2) Limpieza de cualquier patient con version > 0 sin bloques (residuo de tests)
  console.log("\n2. Limpieza de tests residuales");
  const dirty = all.filter(p => p.enrichment_version > 0);
  for (const d of dirty) {
    const r = await fetch(`${url}/rest/v1/ai_patients?id=eq.${d.id}&select=enrichment_red_social`, { headers });
    const rj = await r.json();
    if (Array.isArray(rj) && rj[0] && rj[0].enrichment_red_social === null) {
      await fetch(`${url}/rest/v1/ai_patients?id=eq.${d.id}`, {
        method: "PATCH", headers,
        body: JSON.stringify({ enrichment_version: 0, enrichment_approved_by: null, enrichment_approved_at: null }),
      });
      console.log(`     ✓ Reset ${d.name} (${d.id.slice(0,8)}) a version=0`);
    }
  }

  // 3) Aplicar bloques + history para cada paciente del JSON cuyo nombre exista en staging
  console.log("\n3. Aplicando bloques");
  const ts = new Date().toISOString();
  let applied = 0, skipped = 0, historyOk = 0, errors = [];

  for (const p of ENRICHED.patients) {
    if (!p.enriched_blocks) continue;

    const stagingRow = stagingByName[norm(p.name)];
    if (!stagingRow) {
      skipped++;
      console.log(`   - skip ${p.name} (no está en staging)`);
      continue;
    }
    const stagingId = stagingRow.id;

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

    // PATCH ai_patients
    const patchRes = await fetch(`${url}/rest/v1/ai_patients?id=eq.${stagingId}`, {
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

    // Borrar primero las filas de history previas para este patient (idempotencia)
    await fetch(`${url}/rest/v1/enrichment_history?patient_id=eq.${stagingId}&version=eq.1`, {
      method: "DELETE", headers,
    });

    // INSERT 4 rows en enrichment_history (un POST con array)
    const historyRows = Object.entries(blocks).map(([block_name, content]) => ({
      patient_id: stagingId, block_name, version: 1, content,
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
    console.log(`   ✓ ${p.name.padEnd(24)} → staging id ${stagingId.slice(0,8)}`);
  }

  console.log("\n=== RESUMEN ===");
  console.log(`   Aplicados: ${applied}/${ENRICHED.patients.length}`);
  console.log(`   Saltados (no existen en staging): ${skipped}`);
  console.log(`   Filas de enrichment_history: ${historyOk}`);
  console.log(`   Errores: ${errors.length}`);
  if (errors.length) {
    console.log("\n=== ERRORES ===");
    for (const e of errors.slice(0, 5)) {
      console.log(`   [${e.step}] ${e.name}: ${e.err.slice(0, 200)}`);
    }
  }
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
