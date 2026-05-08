/**
 * INF-2026-050 — Simulación 15 pacientes × 2 prompts × 15 turnos.
 * 450 llamadas a gpt-4.1-mini, T=0.7. Concurrencia a nivel de paciente.
 */
const fs = require("fs");
const { OpenAI } = require("openai");

const env = fs.readFileSync(".env.local", "utf8");
const apiKey = env.match(/OPENAI_API_KEY=(\S+)/)[1];
const openai = new OpenAI({ apiKey });

const PATIENTS = JSON.parse(fs.readFileSync("C:/tmp/all-patients.json", "utf8"));
const ENRICHED = JSON.parse(fs.readFileSync("C:/tmp/enriched-blocks.json", "utf8"));

// ─── Mulberry32 PRNG (reproducible) ────────────────────────────
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function pickRandom(arr, n, seed) {
  const rng = mulberry32(seed);
  const indices = arr.map((_, i) => i);
  // Fisher-Yates shuffle
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, n).map(i => arr[i]);
}

const SELECTED = pickRandom(PATIENTS, 15, 42);
console.log("Selección aleatoria (seed=42):");
for (const p of SELECTED) console.log(`  - ${p.name} (${p.country[0]}, ${p.difficulty_level})`);

// ─── Construir prompt enriquecido ──────────────────────────────
function buildEnrichedPrompt(patient) {
  const enriched = ENRICHED.patients.find(e => e.id === patient.id);
  if (!enriched || !enriched.enriched_blocks) {
    throw new Error(`No hay bloques enriquecidos para ${patient.name}`);
  }
  const b = enriched.enriched_blocks;
  let p = patient.system_prompt.replace(/\r\n/g, "\n");

  // Insertar RED SOCIAL + LUGARES + ESTADO CORPORAL antes de "COMPORTAMIENTO EN SESI"
  // Buscar el primer marcador conocido: "COMPORTAMIENTO EN SESIÓN" o "COMPORTAMIENTO EN SESION"
  const before1 = b.red_social_y_vinculos + "\n\n" + b.lugares_significativos + "\n\n" + b.estado_corporal_y_rutina;

  const markers = [
    "\n\nCOMPORTAMIENTO EN SESIÓN:",
    "\n\nCOMPORTAMIENTO EN SESION:",
    "\nCOMPORTAMIENTO EN SESIÓN:",
    "\nCOMPORTAMIENTO EN SESION:",
  ];
  let inserted1 = false;
  for (const m of markers) {
    if (p.includes(m)) {
      p = p.replace(m, "\n\n" + before1 + m);
      inserted1 = true;
      break;
    }
  }
  if (!inserted1) {
    // Fallback: insertar antes de REGLAS (si COMPORTAMIENTO no existe)
    const rmarkers = ["\n\nREGLAS:", "\nREGLAS:"];
    for (const m of rmarkers) {
      if (p.includes(m)) {
        p = p.replace(m, "\n\n" + before1 + m);
        inserted1 = true;
        break;
      }
    }
  }
  if (!inserted1) {
    // Fallback final: agregar al final del prompt
    p = p + "\n\n" + before1;
  }

  // Insertar FRASES TIPO antes de REGLAS
  const rmarkers = ["\n\nREGLAS:", "\nREGLAS:"];
  let inserted2 = false;
  for (const m of rmarkers) {
    if (p.includes(m)) {
      p = p.replace(m, "\n\n" + b.frases_tipo_que_dices + m);
      inserted2 = true;
      break;
    }
  }
  if (!inserted2) {
    p = p + "\n\n" + b.frases_tipo_que_dices;
  }

  return p;
}

// ─── 15 intervenciones del estudiante (mismas que INF-049) ────
const STUDENT_TURNS = [
  "Hola, soy estudiante de psicología. Esto es un espacio confidencial donde puedes hablar de lo que necesites. ¿Cómo llegas hoy?",
  "¿Qué fue lo que te trajo a buscar ayuda?",
  "Tiene sentido lo que dices. Debe ser difícil estar pasando por esto.",
  "Lo que escucho es que te sientes solo o fuera de lugar. ¿Te identifica eso?",
  "Cuéntame un poco cómo te ha ido en lo cotidiano.",
  "¿Y tu familia, cómo está? ¿Hablas con ellos?",
  "¿Tienes personas cercanas con las que puedas hablar de lo que te pasa?",
  "Mmm... [se queda en silencio un momento]. Tómate tu tiempo.",
  "¿Y cómo está tu sueño últimamente? ¿Has podido descansar bien?",
  "¿Cómo es un día normal tuyo? Desde que te despiertas.",
  "Cuando piensas en cómo te sentías hace un año versus ahora, ¿qué notas distinto?",
  "¿Qué cosas extrañas o has perdido en este tiempo?",
  "Me parece que hay mucho que estás guardando. Está bien ir con calma. ¿Hay algo que te cueste decir aquí?",
  "Para esta primera sesión hemos hablado de varias cosas. Has compartido bastante.",
  "Vamos a ir cerrando. Antes de irte, ¿hay algo que quieras agregar o que te haya quedado dando vueltas?",
];

// ─── Runner por paciente (1 corrida × 2 prompts) ────────────────
async function runPatient(patient) {
  const tag = patient.name.split(" ")[0].slice(0, 8);
  async function runOne(systemPrompt, mode) {
    const messages = [{ role: "system", content: systemPrompt }];
    const turns = [];
    for (let i = 0; i < STUDENT_TURNS.length; i++) {
      const studentMsg = STUDENT_TURNS[i];
      messages.push({ role: "user", content: studentMsg });
      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        temperature: 0.7,
        messages,
        max_tokens: 400,
      });
      const reply = completion.choices[0].message.content;
      messages.push({ role: "assistant", content: reply });
      turns.push({ turn: i + 1, student: studentMsg, reply });
    }
    return turns;
  }

  let originalTurns = null, enrichedTurns = null, error = null;
  try {
    originalTurns = await runOne(patient.system_prompt, "ORIG");
    const enrichedPrompt = buildEnrichedPrompt(patient);
    enrichedTurns = await runOne(enrichedPrompt, "ENRI");
    process.stdout.write(`  ✓ ${tag.padEnd(8)} - ${patient.country[0].slice(0,3)}\n`);
  } catch (e) {
    error = e.message;
    process.stdout.write(`  ✗ ${tag.padEnd(8)} - ${e.message.slice(0, 50)}\n`);
  }

  return {
    id: patient.id,
    name: patient.name,
    country: patient.country[0],
    difficulty: patient.difficulty_level,
    age: patient.age,
    occupation: patient.occupation,
    presenting_problem: patient.presenting_problem,
    original_prompt_chars: patient.system_prompt.length,
    enriched_prompt_chars: error ? null : buildEnrichedPrompt(patient).length,
    original_turns: originalTurns,
    enriched_turns: enrichedTurns,
    error,
  };
}

// ─── Concurrent runner ──────────────────────────────────────────
async function runWithConcurrency(items, fn, concurrency = 3) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

(async () => {
  console.log("\n=== Simulación 15 pacientes × 2 prompts × 15 turnos ===");
  console.log("Modelo: gpt-4.1-mini · Temperature: 0.7 · Concurrencia: 3\n");

  const t0 = Date.now();
  const results = await runWithConcurrency(SELECTED, runPatient, 3);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  const ok = results.filter(r => !r.error).length;
  console.log(`\n✓ Completado en ${elapsed}s · OK: ${ok}/${SELECTED.length}`);

  const out = {
    generated_at: new Date().toISOString(),
    seed: 42,
    total_selected: SELECTED.length,
    successes: ok,
    student_turns: STUDENT_TURNS,
    model: "gpt-4.1-mini",
    temperature: 0.7,
    patients: results,
  };
  fs.writeFileSync("C:/tmp/sim-050.json", JSON.stringify(out, null, 2));
  console.log("✓ Guardado en C:/tmp/sim-050.json");

  // Stats agregadas
  console.log("\n=== Métricas agregadas ===");
  for (const r of results) {
    if (r.error) continue;
    const oC = r.original_turns.reduce((s,t)=>s+t.reply.length,0);
    const eC = r.enriched_turns.reduce((s,t)=>s+t.reply.length,0);
    const delta = ((eC-oC)/oC*100).toFixed(0);
    console.log(`  ${r.name.padEnd(22)} ${r.country.slice(0,3)} ${r.difficulty.slice(0,4)} | orig:${oC} enri:${eC} delta:${delta}%`);
  }
})().catch(e => { console.error("FATAL:", e); process.exit(1); });
