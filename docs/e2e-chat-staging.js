/**
 * Test E2E: simula el flujo del /api/chat para verificar que un paciente
 * enriquecido en STAGING produce una respuesta del LLM que usa los nuevos
 * bloques (no solo que el prompt los incluye, sino que el modelo los activa).
 *
 * Pasa el system_prompt compuesto + 2 turnos de prueba a gpt-4.1-mini y verifica:
 *  - El prompt enviado contiene los 4 bloques en sus posiciones canónicas
 *  - La respuesta del LLM menciona al menos un elemento del bloque enriquecido
 *    (nombres de personajes, lugares, frases tipo)
 */
const fs = require("fs");
const { OpenAI } = require("openai");

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(\S+)/)[1];
const supaKey = env.match(/SUPABASE_SERVICE_ROLE_KEY=(\S+)/)[1];
const openaiKey = env.match(/OPENAI_API_KEY=(\S+)/)[1];

if (!url.includes("vhkbbps")) {
  console.error("❌ ERROR: .env.local NO apunta a STAGING. Aborto.");
  process.exit(1);
}

const headers = { apikey: supaKey, Authorization: "Bearer " + supaKey };
const openai = new OpenAI({ apiKey: openaiKey });

// Replica buildEnrichedPrompt (versión JS — coincide con src/lib/build-system-prompt.ts)
function buildEnrichedPrompt(patient) {
  let prompt = patient.system_prompt.replace(/\r\n/g, "\n");
  const rs = patient.enrichment_red_social?.text?.trim();
  const lu = patient.enrichment_lugares?.text?.trim();
  const ec = patient.enrichment_estado_corporal?.text?.trim();
  const ft = patient.enrichment_frases_tipo?.text?.trim();
  const earlyBlocks = [rs, lu, ec].filter(Boolean).join("\n\n");
  const compMarkers = ["\n\nCOMPORTAMIENTO EN SESIÓN:", "\n\nCOMPORTAMIENTO EN SESION:"];
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

// Extrae nombres propios de los bloques enriquecidos (heurística simple: capitalizadas largas)
const STOP = new Set([
  "RED","SOCIAL","Y","VÍNCULOS","LUGARES","SIGNIFICATIVOS","ESTADO","CORPORAL","RUTINA","FRASES","TIPO","QUE","DICES",
  "El","La","Los","Las","Un","Una","Mi","Su","Tu","De","En","Con","Sin","Para","Por","Hace",
  "Está","Estás","Hay","Tiene","Tienes","Veces","Diego","Patricia","Como","Cuando","Donde","Aunque",
]);
function extractEntities(blocks) {
  const text = Object.values(blocks).map(b => b?.text || "").join(" ");
  const tokens = text.match(/[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+/g) || [];
  return Array.from(new Set(tokens.filter(t => !STOP.has(t) && t.length >= 4)));
}

const TEST_TURNS = [
  "Hola, soy estudiante de psicología. Cuéntame, ¿quiénes son las personas más importantes para ti hoy?",
  "Y de tu familia, ¿con quién hablas más seguido y de qué hablan?",
];

(async () => {
  // 1) Pick 3 pacientes representativos: Diego (Chile), Andrés Castillo (Colombia, recién sembrado), Yesenia (Rep. Dom)
  const targetNames = ["Diego Fuentes", "Andrés Castillo", "Yesenia De Los Santos"];
  console.log(`Test E2E con: ${targetNames.join(", ")}\n`);

  for (const name of targetNames) {
    console.log("═".repeat(70));
    console.log(`PACIENTE: ${name}`);
    console.log("═".repeat(70));

    // Cargar paciente con bloques (versión moderna, version > 0)
    const r = await fetch(
      `${url}/rest/v1/ai_patients?name=eq.${encodeURIComponent(name)}&enrichment_version=gt.0&select=id,name,system_prompt,enrichment_red_social,enrichment_lugares,enrichment_estado_corporal,enrichment_frases_tipo,enrichment_version`,
      { headers }
    );
    const d = await r.json();
    if (!Array.isArray(d) || !d[0]) { console.log("   ✗ no encontrado o no enriquecido\n"); continue; }
    const patient = d[0];

    const composed = buildEnrichedPrompt(patient);
    console.log(`Prompt original: ${patient.system_prompt.length} chars`);
    console.log(`Prompt compuesto: ${composed.length} chars (delta: +${composed.length - patient.system_prompt.length})`);

    // Verificar marcadores en el prompt compuesto
    const checkBlocks = ["RED SOCIAL Y VÍNCULOS", "LUGARES SIGNIFICATIVOS", "ESTADO CORPORAL Y RUTINA", "FRASES TIPO QUE DICES"];
    for (const b of checkBlocks) {
      const idx = composed.indexOf(b);
      console.log(`   ${idx > 0 ? "✓" : "✗"} "${b}" en posición ${idx}`);
    }

    const entities = extractEntities({
      rs: patient.enrichment_red_social, lu: patient.enrichment_lugares,
      ec: patient.enrichment_estado_corporal, ft: patient.enrichment_frases_tipo,
    });
    console.log(`   Entidades extraídas del bloque (top 8): ${entities.slice(0, 8).join(", ")}`);

    // 2) Llamar al LLM con el prompt compuesto + 2 turnos
    const messages = [{ role: "system", content: composed }];
    for (let i = 0; i < TEST_TURNS.length; i++) {
      messages.push({ role: "user", content: TEST_TURNS[i] });
      const c = await openai.chat.completions.create({
        model: "gpt-4.1-mini", temperature: 0.7, messages, max_tokens: 400,
      });
      const reply = c.choices[0].message.content;
      messages.push({ role: "assistant", content: reply });

      const used = entities.filter((e) => reply.includes(e));
      console.log(`\n   T${i + 1} > ${TEST_TURNS[i]}`);
      console.log(`   ${name}: ${reply.replace(/\n/g, " ").slice(0, 280)}${reply.length > 280 ? "…" : ""}`);
      console.log(`   → entidades del prompt usadas: ${used.length ? used.join(", ") : "(ninguna)"}`);
    }
    console.log();
  }
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
