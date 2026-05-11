/**
 * Aplica el tuning clínico de los 5 pacientes (Valentina, Yamilet, Alejandro,
 * Altagracia, Jimena) en STAGING o PROD.
 *
 * Pasos por paciente:
 *   1) PATCH ai_patients (system_prompt, presenting_problem, tags,
 *      backstory, difficulty_level si aplica)
 *   2) Regenera los 4 bloques de enriquecimiento con gpt-4o usando el
 *      nuevo prompt como contexto
 *   3) PATCH bloques + bump enrichment_version
 *   4) Borra history v previa para los 5 e inserta history nueva
 *
 * Uso:
 *   node docs/apply-clinical-tuning.js staging   # default
 *   node docs/apply-clinical-tuning.js prod
 */
const fs = require("fs");
const { OpenAI } = require("openai");

const TARGET = (process.argv[2] || "staging").toLowerCase();
const BATCH = process.argv[3] || "1"; // 1 = clinical-tuning-data.js (default, los 5 originales); 2 = clinical-tuning-batch2.js (los 4 menos tipificados)
const DATA_FILE = BATCH === "2" ? "./clinical-tuning-batch2.js" : "./clinical-tuning-data.js";
const ENV_FILE = TARGET === "prod" ? ".env.production" : ".env.local";
const EXPECTED_REF = TARGET === "prod" ? "ndwmnxlwbfqfwwtekjun" : "vhkbbpsdiklguxvjrksd";

const env = fs.readFileSync(ENV_FILE, "utf8").replace(/^﻿/, "");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(\S+)/)[1];
const supaKey = env.match(/SUPABASE_SERVICE_ROLE_KEY=(\S+)/)[1];

if (!url.includes(EXPECTED_REF)) {
  console.error(`❌ ERROR: ${ENV_FILE} no apunta al project-ref ${EXPECTED_REF}. Aborto.`);
  process.exit(1);
}

// OpenAI desde .env.local (la prod no expone OPENAI key necesariamente)
const localEnv = fs.readFileSync(".env.local", "utf8");
const openai = new OpenAI({ apiKey: localEnv.match(/OPENAI_API_KEY=(\S+)/)[1] });

console.log(`Target: ${TARGET.toUpperCase()} (${url.match(/https:\/\/(\w+)/)[1]}) · BATCH ${BATCH} (${DATA_FILE})\n`);

const headers = { apikey: supaKey, Authorization: "Bearer " + supaKey, "Content-Type": "application/json" };
const TUNING = require(DATA_FILE);
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

const META_PROMPT = `Eres experto en construcción de pacientes simulados para entrenamiento clínico de psicología. Recibes los datos de un paciente IA existente y debes generar 4 bloques de contenido nuevo para enriquecer su prompt sistémico.

OBJETIVO: agregar densidad biográfica concreta sin tocar la estructura clínica del prompt.

REGLAS DURAS:
1. Coherencia absoluta con la familia (family_members) ya definida.
2. Dialecto del país de origen del paciente.
3. Coherencia con la edad, ocupación, motivo de consulta y barrio.
4. NUNCA inventes contenido que contradiga el prompt original.
5. NUNCA agregues elementos clínicos nuevos que cambien el cuadro (especialmente: NO agregar ideación suicida, plan, medios o autolesión activa si el prompt no los menciona o los atenúa).
6. NO uses emojis.
7. Mantén el formato de líneas con guion (-) y datos concretos.

LOS 4 BLOQUES:
- BLOQUE 1 RED SOCIAL Y VÍNCULOS (5-8 líneas): familia + 1-3 personas del círculo cotidiano con nombre, rol y micro-historia.
- BLOQUE 2 LUGARES SIGNIFICATIVOS (3-5 líneas): lugares físicos del día a día con detalle sensorial.
- BLOQUE 3 ESTADO CORPORAL Y RUTINA (4-6 líneas): sueño, apetito, cuerpo, vestimenta, rutina, COHERENTE con motivo de consulta.
- BLOQUE 4 FRASES TIPO QUE DICES (6-8 líneas): frases entre comillas, dialecto del país.

FORMATO DE SALIDA: JSON estricto:
{
  "red_social_y_vinculos": "RED SOCIAL Y VÍNCULOS:\\n- línea 1\\n...",
  "lugares_significativos": "LUGARES SIGNIFICATIVOS:\\n- línea 1\\n...",
  "estado_corporal_y_rutina": "ESTADO CORPORAL Y RUTINA:\\n- línea 1\\n...",
  "frases_tipo_que_dices": "FRASES TIPO QUE DICES:\\n- \\"frase 1\\"\\n..."
}`;

async function fetchPatient(name) {
  const r = await fetch(
    `${url}/rest/v1/ai_patients?select=id,name,age,occupation,country,country_origin,country_residence,neighborhood,visual_identity,family_members,backstory,system_prompt,presenting_problem,tags,difficulty_level,enrichment_version&order=id.asc`,
    { headers }
  );
  const all = await r.json();
  // Para nombres con duplicados, elegir el row con system_prompt más largo (versión moderna)
  const matching = all.filter(p => norm(p.name) === norm(name));
  matching.sort((a, b) => (b.system_prompt?.length || 0) - (a.system_prompt?.length || 0));
  return matching[0];
}

async function regenerateBlocks(patient) {
  const country = Array.isArray(patient.country) ? patient.country.join("/") : patient.country;
  const family = (patient.family_members || []).map(f =>
    `${f.name} (${f.age}, ${f.relationship})${f.notes ? ` — ${f.notes}` : ""}`
  ).join("; ");
  const v = patient.visual_identity || {};
  const userMsg = `DATOS DEL PACIENTE
- Nombre: ${patient.name}
- Edad: ${patient.age}
- Ocupación: ${patient.occupation}
- País: ${country}
- Barrio: ${patient.neighborhood || "(no especificado)"}
- Motivo de consulta: ${patient.presenting_problem}
- Dificultad: ${patient.difficulty_level}
- Tags: ${(patient.tags || []).join(", ")}
- Backstory: ${patient.backstory}
- Familia: ${family || "(no especificada)"}
- Identidad visual: ${v.etnia || "?"}, ${v.gesto || "?"}, ${v.ropa_tipo || "?"} ${v.ropa_color || ""}

PROMPT ACTUAL DEL PACIENTE (mantener coherencia tonal y NO agregar elementos clínicos no presentes):
${patient.system_prompt}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.7,
    messages: [
      { role: "system", content: META_PROMPT },
      { role: "user", content: userMsg },
    ],
    response_format: { type: "json_object" },
    max_tokens: 2000,
  });
  return JSON.parse(completion.choices[0].message.content);
}

(async () => {
  const ts = new Date().toISOString();
  const errors = [];

  for (const tuning of TUNING) {
    console.log(`\n═══ ${tuning.name} ═══`);

    // 1) Fetch current patient
    const before = await fetchPatient(tuning.name);
    if (!before) {
      console.log(`   ✗ no encontrado en ${TARGET}`);
      errors.push({ name: tuning.name, step: "fetch", err: "not found" });
      continue;
    }
    console.log(`   - id ${before.id.slice(0, 8)}, prompt antes: ${before.system_prompt.length} chars, version=${before.enrichment_version}`);

    // 2) Build PATCH payload con los campos modificados
    const patchBody = {
      system_prompt: tuning.system_prompt,
      presenting_problem: tuning.presenting_problem,
      tags: tuning.tags,
      backstory: tuning.backstory,
    };
    if (tuning.difficulty_level) patchBody.difficulty_level = tuning.difficulty_level;

    const patchRes = await fetch(`${url}/rest/v1/ai_patients?id=eq.${before.id}`, {
      method: "PATCH", headers, body: JSON.stringify(patchBody),
    });
    if (!patchRes.ok) {
      console.log(`   ✗ PATCH falló: ${await patchRes.text()}`);
      errors.push({ name: tuning.name, step: "PATCH metadata", err: await patchRes.text() });
      continue;
    }
    console.log(`   ✓ Metadata clínica actualizada (system_prompt: ${tuning.system_prompt.length} chars)`);

    // 3) Re-fetch para regenerar bloques con datos actualizados
    const after = await fetchPatient(tuning.name);

    // 4) Regenerar bloques con gpt-4o usando el nuevo prompt
    console.log(`   ⟳ Regenerando 4 bloques con gpt-4o...`);
    let blocks;
    try {
      blocks = await regenerateBlocks(after);
      console.log(`   ✓ Bloques generados (${Object.values(blocks).map(t => t.length).join(", ")} chars)`);
    } catch (e) {
      console.log(`   ✗ Generación falló: ${e.message}`);
      errors.push({ name: tuning.name, step: "regenerate blocks", err: e.message });
      continue;
    }

    // 5) PATCH bloques + bump version
    const newVersion = (after.enrichment_version || 0) + 1;
    const blockJson = (text) => ({ text, version: newVersion, generated_by: "ai", generated_at: ts, model: "gpt-4o" });
    const blocksPayload = {
      enrichment_red_social: blockJson(blocks.red_social_y_vinculos),
      enrichment_lugares: blockJson(blocks.lugares_significativos),
      enrichment_estado_corporal: blockJson(blocks.estado_corporal_y_rutina),
      enrichment_frases_tipo: blockJson(blocks.frases_tipo_que_dices),
      enrichment_version: newVersion,
    };
    const patchBlocksRes = await fetch(`${url}/rest/v1/ai_patients?id=eq.${before.id}`, {
      method: "PATCH", headers, body: JSON.stringify(blocksPayload),
    });
    if (!patchBlocksRes.ok) {
      console.log(`   ✗ PATCH bloques falló: ${await patchBlocksRes.text()}`);
      errors.push({ name: tuning.name, step: "PATCH blocks", err: await patchBlocksRes.text() });
      continue;
    }

    // 6) Borrar history previa de version <= 1 y reinsertar con la nueva
    await fetch(`${url}/rest/v1/enrichment_history?patient_id=eq.${before.id}`, {
      method: "DELETE", headers,
    });
    const historyRows = ["red_social", "lugares", "estado_corporal", "frases_tipo"].map((bn, i) => ({
      patient_id: before.id, block_name: bn, version: newVersion,
      content: Object.values(blocksPayload)[i], generated_by: "ai", created_at: ts,
    }));
    const insRes = await fetch(`${url}/rest/v1/enrichment_history`, {
      method: "POST", headers, body: JSON.stringify(historyRows),
    });
    if (!insRes.ok) {
      console.log(`   ⚠ history failed: ${await insRes.text()}`);
    } else {
      console.log(`   ✓ Bloques aplicados, version=${newVersion}, history reseteada`);
    }
  }

  console.log(`\n=== RESUMEN ===`);
  console.log(`   Pacientes procesados: ${TUNING.length}`);
  console.log(`   Errores: ${errors.length}`);
  if (errors.length) {
    for (const e of errors) console.log(`   [${e.step}] ${e.name}: ${e.err.slice(0, 200)}`);
  }
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
