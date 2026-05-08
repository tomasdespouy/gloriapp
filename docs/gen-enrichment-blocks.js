/**
 * INF-2026-050 — Generador de bloques de enriquecimiento para los 34 pacientes.
 *
 * Para cada paciente, llama a gpt-4o pidiendo 4 bloques (RED SOCIAL Y VÍNCULOS,
 * LUGARES SIGNIFICATIVOS, ESTADO CORPORAL Y RUTINA, FRASES TIPO QUE DICES) que
 * sean coherentes con la familia, país, motivo de consulta y dialecto del paciente.
 *
 * Concurrencia: 5. Output: C:/tmp/enriched-blocks.json
 */
const fs = require("fs");
const { OpenAI } = require("openai");

const env = fs.readFileSync(".env.local", "utf8");
const apiKey = env.match(/OPENAI_API_KEY=(\S+)/)[1];
const openai = new OpenAI({ apiKey });

const PATIENTS = JSON.parse(fs.readFileSync("C:/tmp/all-patients.json", "utf8"));
console.log(`Pacientes a procesar: ${PATIENTS.length}`);

const META_PROMPT = `Eres experto en construcción de pacientes simulados para entrenamiento clínico de psicología. Recibes los datos de un paciente IA existente y debes generar 4 bloques de contenido nuevo para enriquecer su prompt sistémico.

OBJETIVO: agregar densidad biográfica concreta sin tocar la estructura clínica del prompt.

REGLAS DURAS:
1. Coherencia absoluta con la familia (family_members) ya definida. Si la familia tiene a "Patricia, 45, madre", úsala con ese nombre y edad.
2. Dialecto del país de origen del paciente (Chile: cachai/igual/po; Perú: pe/pues/oe; Colombia: parcera/vea; México: ándale/órale; Argentina: che/dale; Rep. Dominicana: vaina/loco; etc.).
3. Coherencia con la edad, ocupación, motivo de consulta y barrio.
4. NUNCA inventes contenido que contradiga el prompt original (ej: si el prompt dice que vive solo, no agregues compañeros de piso).
5. NUNCA agregues elementos clínicos nuevos que cambien el cuadro (ej: si no hay ideación suicida en el prompt actual, no la agregues).
6. NO uses emojis.
7. Mantén el formato de líneas con guion (-) y datos concretos, sin generalidades vacías.

LOS 4 BLOQUES:

**BLOQUE 1 — RED SOCIAL Y VÍNCULOS** (5-8 líneas)
- Familia ya conocida (reusar nombres y datos de family_members con nuevos detalles concretos)
- 1-3 personas del círculo cotidiano del paciente (vecinos, compañeros de trabajo/estudio, amigos), con nombre, rol y micro-historia
- Si tiene mascotas, mencionarlas
- Concretar ocupaciones, lugares de trabajo o estudio de los miembros familiares

**BLOQUE 2 — LUGARES SIGNIFICATIVOS** (3-5 líneas)
- Lugares físicos concretos del día a día del paciente
- Cada uno con un detalle sensorial específico (no "el parque" sino "el parque a una cuadra de mi casa, donde voy los domingos")
- Pueden ser de su barrio, su trabajo, lugares con carga emocional

**BLOQUE 3 — ESTADO CORPORAL Y RUTINA** (4-6 líneas)
- Sueño (calidad, cantidad, irregularidades)
- Apetito y alimentación
- Cuerpo (energía, peso, dolores menores)
- Vestimenta o auto-cuidado si es relevante al cuadro
- Rutina diaria desordenada/ordenada según el cuadro
- COHERENTE con el motivo de consulta (un paciente con duelo agudo come distinto que uno con burnout)

**BLOQUE 4 — FRASES TIPO QUE DICES** (6-8 líneas)
- Frases breves entre comillas que el paciente diría en sesión
- Anclas tonales del dialecto del país
- Mostrar el patrón comunicativo: minimización, evasión, racionalización, pesimismo, sarcasmo, lo que sea apropiado al perfil
- NO frases meta-clínicas ("creo que tengo depresión") — frases naturales

FORMATO DE SALIDA: JSON estricto con exactamente estas claves:
{
  "red_social_y_vinculos": "RED SOCIAL Y VÍNCULOS:\\n- línea 1\\n- línea 2\\n...",
  "lugares_significativos": "LUGARES SIGNIFICATIVOS:\\n- línea 1\\n...",
  "estado_corporal_y_rutina": "ESTADO CORPORAL Y RUTINA:\\n- línea 1\\n...",
  "frases_tipo_que_dices": "FRASES TIPO QUE DICES:\\n- \\"frase 1\\"\\n- \\"frase 2\\"\\n..."
}

Cada bloque comienza con su título en mayúsculas seguido de ":". El cuerpo va en líneas con guion.`;

function buildContext(p) {
  const country = Array.isArray(p.country) ? p.country.join("/") : p.country;
  const family = (p.family_members || []).map(f =>
    `${f.name} (${f.age}, ${f.relationship})${f.notes ? ` — ${f.notes}` : ""}`
  ).join("; ");
  const visual = p.visual_identity || {};
  return `DATOS DEL PACIENTE
- Nombre: ${p.name}
- Edad: ${p.age}
- Ocupación: ${p.occupation}
- País: ${country}${p.country_origin && p.country_origin !== country ? ` (origen: ${p.country_origin}, residencia: ${p.country_residence})` : ""}
- Barrio: ${p.neighborhood || "(no especificado)"}
- Cita: "${p.quote}"
- Motivo de consulta: ${p.presenting_problem}
- Dificultad pedagógica: ${p.difficulty_level}
- Tags: ${(p.tags || []).join(", ")}
- Backstory: ${p.backstory}
- Familia conocida: ${family || "(no especificada)"}
- Identidad visual: ${visual.etnia || "?"}, ${visual.gesto || "?"}, ${visual.ropa_tipo || "?"} ${visual.ropa_color || ""}

PROMPT ACTUAL DEL PACIENTE (para mantener coherencia tonal):
${p.system_prompt}`;
}

async function generateBlocks(patient) {
  const ctx = buildContext(patient);
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.7,
    messages: [
      { role: "system", content: META_PROMPT },
      { role: "user", content: ctx },
    ],
    response_format: { type: "json_object" },
    max_tokens: 2000,
  });
  const json = JSON.parse(completion.choices[0].message.content);
  return {
    blocks: json,
    tokens: completion.usage,
  };
}

// ─── Concurrent runner ──────────────────────────────────────────
async function runWithConcurrency(items, fn, concurrency = 5) {
  const results = new Array(items.length);
  let next = 0;
  let completed = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      try {
        results[i] = { ok: true, value: await fn(items[i], i) };
      } catch (e) {
        results[i] = { ok: false, error: e.message };
      }
      completed++;
      process.stdout.write(`  Completado ${completed}/${items.length}\r`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  console.log("");
  return results;
}

(async () => {
  console.log("Generando bloques enriquecidos para los 34 pacientes (gpt-4o, concurrencia=5)...\n");
  const t0 = Date.now();
  const results = await runWithConcurrency(PATIENTS, async (p, i) => {
    const r = await generateBlocks(p);
    return { id: p.id, name: p.name, ...r };
  }, 5);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const failed = results.filter(r => !r.ok);
  const ok = results.filter(r => r.ok);

  console.log(`\n✓ Completado en ${elapsed}s · OK: ${ok.length} · Fallos: ${failed.length}`);

  if (failed.length) {
    console.log("\nFallos:");
    for (const f of failed) console.log("  -", f.error);
  }

  // Compilar resultado completo
  const out = {
    generated_at: new Date().toISOString(),
    model: "gpt-4o",
    temperature: 0.7,
    total_patients: PATIENTS.length,
    successes: ok.length,
    failures: failed.length,
    patients: PATIENTS.map((p, i) => ({
      id: p.id,
      name: p.name,
      country: Array.isArray(p.country) ? p.country[0] : p.country,
      difficulty: p.difficulty_level,
      original_prompt_chars: p.system_prompt.length,
      enriched_blocks: results[i].ok ? results[i].value.blocks : null,
      error: results[i].ok ? null : results[i].error,
      tokens: results[i].ok ? results[i].value.tokens : null,
    })),
  };

  fs.writeFileSync("C:/tmp/enriched-blocks.json", JSON.stringify(out, null, 2));
  console.log("\n✓ Guardado en C:/tmp/enriched-blocks.json");

  // Stats
  const totalIn = results.filter(r=>r.ok).reduce((s,r)=>s+r.value.tokens.prompt_tokens,0);
  const totalOut = results.filter(r=>r.ok).reduce((s,r)=>s+r.value.tokens.completion_tokens,0);
  console.log(`Tokens: ${totalIn} input + ${totalOut} output`);
  console.log(`Costo aprox: $${(totalIn/1e6*2.50 + totalOut/1e6*10).toFixed(3)} (gpt-4o)`);
})().catch(e => { console.error("FATAL:", e); process.exit(1); });
