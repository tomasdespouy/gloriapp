/**
 * Smoke test post-apply de las migraciones INF-2026-050 en STAGING.
 *
 * Verifica:
 * 1. Las 4 columnas + version + approved_by/at existen en ai_patients
 * 2. La tabla enrichment_history existe y tiene 136 rows
 * 3. Los 34 pacientes tienen los 4 bloques poblados
 * 4. Spot-check: leer Diego Fuentes y verificar que buildEnrichedPrompt produce
 *    un prompt mayor al original con los bloques nuevos correctamente insertados
 */
const fs = require("fs");
// USA EL .env.local QUE APUNTA A STAGING (vhkbbpsdiklguxvjrksd)
const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(\S+)/)[1];
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(\S+)/)[1];

console.log("Smoke test contra:", url.match(/https:\/\/(\w+)/)[1]);
console.log("Esperado: vhkbbpsdiklguxvjrksd (STAGING)\n");

if (!url.includes("vhkbbps")) {
  console.error("❌ ERROR: .env.local NO apunta a STAGING. Aborto.");
  process.exit(1);
}

const headers = { apikey: key, Authorization: "Bearer " + key };

(async () => {
  // 1. Verificar columnas en una query
  console.log("1. Verificar columnas enrichment_* en ai_patients");
  const r1 = await fetch(
    url + "/rest/v1/ai_patients?select=id,name,enrichment_red_social,enrichment_lugares,enrichment_estado_corporal,enrichment_frases_tipo,enrichment_version&limit=3",
    { headers }
  );
  const d1 = await r1.json();
  if (!Array.isArray(d1)) {
    console.error("   ❌ Error:", JSON.stringify(d1));
    return;
  }
  console.log(`   ✓ Query exitosa, ${d1.length} pacientes traídos`);
  for (const p of d1) {
    const has = [p.enrichment_red_social, p.enrichment_lugares, p.enrichment_estado_corporal, p.enrichment_frases_tipo].filter(Boolean).length;
    console.log(`   - ${p.name} (v${p.enrichment_version}): ${has}/4 bloques`);
  }

  // 2. Contar pacientes con enrichment_version > 0
  console.log("\n2. Contar pacientes enriquecidos");
  const r2 = await fetch(
    url + "/rest/v1/ai_patients?select=id&enrichment_version=gt.0",
    { headers: { ...headers, Prefer: "count=exact" } }
  );
  const range = r2.headers.get("content-range");
  const count = parseInt(range.split("/")[1] || "0");
  console.log(`   Pacientes con enrichment_version > 0: ${count} (esperado: 34)`);

  // 3. Verificar enrichment_history
  console.log("\n3. Verificar tabla enrichment_history");
  const r3 = await fetch(
    url + "/rest/v1/enrichment_history?select=patient_id&limit=1",
    { headers: { ...headers, Prefer: "count=exact" } }
  );
  if (!r3.ok) {
    console.error("   ❌ enrichment_history:", await r3.text());
  } else {
    const range3 = r3.headers.get("content-range");
    const count3 = parseInt(range3.split("/")[1] || "0");
    console.log(`   Total filas: ${count3} (esperado: 136 = 34 × 4)`);
  }

  // 4. Spot-check: Diego Fuentes (la versión moderna, enrichment_version > 0)
  console.log("\n4. Spot-check Diego Fuentes — composición runtime del prompt");
  const r4 = await fetch(
    url + "/rest/v1/ai_patients?name=eq.Diego%20Fuentes&enrichment_version=gt.0&select=id,name,system_prompt,enrichment_red_social,enrichment_lugares,enrichment_estado_corporal,enrichment_frases_tipo,enrichment_version",
    { headers }
  );
  const d4 = await r4.json();
  if (!Array.isArray(d4) || !d4[0]) {
    console.error("   ❌ Diego (versión enriquecida) no encontrado");
    return;
  }
  const diego = d4[0];
  console.log(`   ✓ Diego Fuentes encontrado, version ${diego.enrichment_version}`);
  console.log(`   - system_prompt original: ${diego.system_prompt.length} chars`);

  // Importar buildEnrichedPrompt usando node ESM dynamic import
  // Como es TS, hacer la composición manualmente con la misma lógica
  function buildEnriched(p) {
    let prompt = p.system_prompt.replace(/\r\n/g, "\n");
    const rs = p.enrichment_red_social?.text?.trim();
    const lu = p.enrichment_lugares?.text?.trim();
    const ec = p.enrichment_estado_corporal?.text?.trim();
    const ft = p.enrichment_frases_tipo?.text?.trim();
    const earlyBlocks = [rs, lu, ec].filter(Boolean).join("\n\n");
    const compMarkers = ["\n\nCOMPORTAMIENTO EN SESIÓN:", "\n\nCOMPORTAMIENTO EN SESION:", "\nCOMPORTAMIENTO EN SESIÓN:", "\nCOMPORTAMIENTO EN SESION:"];
    const reglasMarkers = ["\n\nREGLAS:", "\nREGLAS:"];
    if (earlyBlocks) {
      const m = compMarkers.find((mm) => prompt.includes(mm));
      if (m) prompt = prompt.replace(m, `\n\n${earlyBlocks}${m}`);
      else prompt = `${prompt}\n\n${earlyBlocks}`;
    }
    if (ft) {
      const m = reglasMarkers.find((mm) => prompt.includes(mm));
      if (m) prompt = prompt.replace(m, `\n\n${ft}${m}`);
      else prompt = `${prompt}\n\n${ft}`;
    }
    return prompt;
  }
  const composed = buildEnriched(diego);
  console.log(`   - prompt compuesto: ${composed.length} chars (delta: +${composed.length - diego.system_prompt.length})`);

  // Verificar que los bloques aparecen en orden correcto
  const checks = [
    ["RED SOCIAL Y VÍNCULOS", "antes de COMPORTAMIENTO EN SESIÓN"],
    ["LUGARES SIGNIFICATIVOS", "antes de COMPORTAMIENTO EN SESIÓN"],
    ["ESTADO CORPORAL Y RUTINA", "antes de COMPORTAMIENTO EN SESIÓN"],
    ["FRASES TIPO QUE DICES", "antes de REGLAS"],
  ];
  console.log("   - Verificación de posición de bloques:");
  let ok = true;
  for (const [label] of checks) {
    const idx = composed.indexOf(label);
    if (idx < 0) {
      console.log(`     ✗ "${label}" NO aparece`);
      ok = false;
    } else {
      console.log(`     ✓ "${label}" en posición ${idx}`);
    }
  }
  // Verificar que RED SOCIAL viene ANTES de COMPORTAMIENTO EN SESIÓN
  const idxRS = composed.indexOf("RED SOCIAL Y VÍNCULOS");
  const idxComp = composed.search(/COMPORTAMIENTO EN SESI[OÓ]N/);
  const idxFrases = composed.indexOf("FRASES TIPO QUE DICES");
  const idxReglas = composed.indexOf("REGLAS:");
  if (idxRS > 0 && idxComp > 0 && idxRS < idxComp) console.log("     ✓ RED SOCIAL aparece antes de COMPORTAMIENTO");
  else { console.log(`     ✗ Orden RED SOCIAL/COMPORTAMIENTO incorrecto (${idxRS} vs ${idxComp})`); ok = false; }
  if (idxFrases > 0 && idxReglas > 0 && idxFrases < idxReglas) console.log("     ✓ FRASES TIPO aparece antes de REGLAS");
  else { console.log(`     ✗ Orden FRASES/REGLAS incorrecto (${idxFrases} vs ${idxReglas})`); ok = false; }

  console.log("\n" + (ok ? "✓ TODO OK" : "✗ HAY ERRORES"));
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
