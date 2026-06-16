// Prueba A/B: prompt VIEJO (A) vs ENRIQUECIDO (B) para el piloto.
// Terapeuta = guion fijo (misma palabra para A y B → la única variable es el
// prompt del paciente). Métricas: calor emocional (replica exacta de
// emotional-heat.ts) + panel de jueces LLM ciegos. NO toca la base de datos.
const fs = require("fs");
const OpenAI = require("openai");
const cfg = require("dotenv").parse(fs.readFileSync(".env.local"));
const openai = new OpenAI({ apiKey: cfg.OPENAI_API_KEY });

const CHAT_MODEL = cfg.OPENAI_CHAT_MODEL || "gpt-4.1-mini";              // modelo del paciente (como prod)
const EVAL_MODEL = cfg.OPENAI_EVAL_MODEL || cfg.OPENAI_MODEL || "gpt-4o"; // calor + jueces (como prod)
const N = 2; // corridas por versión

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function callLLM(model, system, messages, opts = {}) {
  for (let attempt = 0; attempt <= 4; attempt++) {
    try {
      const msgs = system ? [{ role: "system", content: system }, ...messages] : messages;
      const resp = await openai.chat.completions.create({
        model, messages: msgs,
        ...(opts.temperature != null ? { temperature: opts.temperature } : {}),
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      });
      return resp.choices[0]?.message?.content || "";
    } catch (e) {
      const retry = e?.status === 429 || (e?.status >= 500);
      if (attempt < 4 && retry) { await sleep(2500 * (attempt + 1)); continue; }
      throw e;
    }
  }
}
async function mapLimit(items, limit, fn) {
  const ret = []; let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const idx = i++; ret[idx] = await fn(items[idx], idx); }
  }));
  return ret;
}

// ---- Guion fijo del terapeuta (12 intervenciones que disparan los gatillos) ----
const SCRIPT = [
  "Hola, buenas tardes. Bienvenido a la consulta, tome asiento. Cuénteme, ¿qué lo trae por acá?",
  "Lo escucho. Suena agotador todo lo que me describe.",
  "¿Cómo ha estado durmiendo y con el apetito estos días?",
  "¿Vive con alguien? ¿Está trabajando? ¿Tiene hijos? ¿Toma alcohol?",
  "Mire, yo creo que lo que necesita es tomarse unos días, distraerse, hacer algo de ejercicio. Eso ayuda bastante.",
  "Perdón, me adelanté, no quise restarle importancia. Debe ser difícil cargar con todo esto sin poder soltarlo con nadie. ¿Cómo es su día a día?",
  "Lo escucho y noto que hay bastante dolor ahí, aunque trate de mostrarse entero.",
  "¿Hubo algún momento, algo puntual que haya pasado, en que sienta que todo empezó a cambiar?",
  "...Tómese su tiempo, no hay apuro. Aquí estoy para escucharlo.",
  "¿Qué es lo que más le pesa cuando se queda a solas con sus pensamientos?",
  "Quiero preguntarle algo con cuidado: a veces, cuando uno está tan cansado, aparecen pensamientos de que sería mejor no estar, o de no despertar. ¿Le ha pasado algo así?",
  "Le agradezco la confianza que me tuvo hoy. Me gustaría que sigamos trabajando juntos en esto.",
];

async function runConversation(systemPrompt) {
  const msgs = [];
  for (const turn of SCRIPT) {
    msgs.push({ role: "user", content: turn });
    const reply = await callLLM(CHAT_MODEL, systemPrompt, msgs);
    msgs.push({ role: "assistant", content: (reply || "").trim() });
  }
  return msgs;
}

// ---- Calor emocional: réplica exacta de src/lib/emotional-heat.ts ----
const HEAT_SYSTEM = `Eres un analista clínico experto en afecto. Lees el desarrollo reciente de una sesión de psicoterapia por texto y estimas el estado emocional ACTUAL del paciente: qué siente en su ÚLTIMA intervención, leída EN CONTEXTO de los turnos previos.

Responde SOLO con un objeto JSON válido, sin texto ni markdown:
{"category": "<una de la lista>", "intensity": <entero del 1 al 5>}

Lista de categorías (elige la que mejor capture el afecto predominante):
sereno, cálido, curioso, esperanzado, aliviado, ansioso, preocupado, triste, abrumado, enojado, irritado, frustrado, evasivo, cauteloso, avergonzado, neutral

Guías importantes:
- Identifica SIEMPRE la emoción predominante, aunque sea sutil o contenida. Un paciente reservado igual transmite afecto: incomodidad, guardia, resignación, ternura contenida, fastidio leve.
- "evasivo"/"cauteloso" = se cierra, desvía, minimiza o evita el tema; úsalos cuando esquiva en vez de abrirse.
- "neutral" SOLO si de verdad NO hay ninguna carga afectiva (es raro). NO uses "neutral" como salida fácil cuando dudes: elige la emoción sutil más cercana.
- intensity: 1 = muy tenue o contenido, 3 = claro, 5 = muy intenso o desbordado. Usa TODO el rango. Los pacientes contenidos suelen moverse en 1-2, con picos puntuales.
- Lee en CONTEXTO: una pregunta como "¿quieres contar?" después de que el otro menciona una emergencia es preocupación o calidez, no neutral.`;

const HEAT_CATEGORIES = ["sereno","cálido","curioso","esperanzado","aliviado","ansioso","preocupado","triste","abrumado","enojado","irritado","frustrado","evasivo","cauteloso","avergonzado","neutral"];
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const NORM_TO_CANON = new Map(HEAT_CATEGORIES.map((c) => [norm(c), c]));
const SYNONYMS = { nervioso:"ansioso", inquieto:"ansioso", angustiado:"ansioso", molesto:"irritado", enfadado:"enojado", enojon:"enojado", agradecido:"cálido", afectuoso:"cálido", reservado:"evasivo", distante:"evasivo", desconfiado:"cauteloso", resignado:"triste", desanimado:"triste", apenado:"avergonzado" };
function resolveCategory(rawCat) {
  const cleaned = (rawCat || "").toLowerCase().trim(); if (!cleaned) return null;
  const n = norm(cleaned);
  if (NORM_TO_CANON.get(n)) return NORM_TO_CANON.get(n);
  if (SYNONYMS[n]) return SYNONYMS[n];
  if (/^[a-záéíóúñü]{3,16}$/.test(cleaned)) return cleaned;
  return null;
}
function parseHeat(raw) {
  if (!raw) return null;
  const m = raw.match(/\{[\s\S]*\}/); if (!m) return null;
  let o; try { o = JSON.parse(m[0]); } catch { return null; }
  const category = resolveCategory(String(o.category ?? "")); if (!category) return null;
  const num = Number(o.intensity); if (!Number.isFinite(num)) return null;
  return { category, intensity: Math.max(1, Math.min(5, Math.round(num))) };
}
function buildHeatUser(recentTurns, reply) {
  const ctx = recentTurns.filter((t) => t.role === "user" || t.role === "assistant").slice(-6)
    .map((t) => `${t.role === "user" ? "Terapeuta" : "Paciente"}: ${JSON.stringify((t.content || "").slice(0, 300))}`).join("\n");
  return [ctx ? `Desarrollo reciente:\n${ctx}` : "Inicio de la sesión.",
    `\nÚltima intervención del paciente (clasifica ESTA):\n${JSON.stringify(reply.slice(0, 1500))}`].join("\n");
}
async function classifyHeat(transcript) {
  const idxs = transcript.map((m, i) => (m.role === "assistant" ? i : -1)).filter((i) => i >= 0);
  return mapLimit(idxs, 6, async (i) => {
    const raw = await callLLM(EVAL_MODEL, HEAT_SYSTEM, [{ role: "user", content: buildHeatUser(transcript.slice(0, i), transcript[i].content) }]);
    const h = parseHeat(raw);
    return { turn: (i + 1) / 2, category: h?.category ?? "?", intensity: h?.intensity ?? null };
  });
}

// ---- Jueces ciegos ----
const LENSES = {
  realismo: "Evalúa cuál PACIENTE se siente como una persona REAL en terapia y no como un chatbot: naturalidad, coherencia, lenguaje corporal, uso de modismos, que no suene repetitivo, plano ni genérico.",
  profundidad: "Evalúa cuál PACIENTE tiene más profundidad clínica: capas, mecanismos de defensa, y un núcleo emocional que va EMERGIENDO a medida que el terapeuta construye alianza, en lugar de contar todo de golpe o quedarse siempre en lo superficial.",
  diferenciacion: "Evalúa cuál PACIENTE reacciona de forma más DIFERENCIADA a la técnica del terapeuta: se abre con la validación, se cierra o se incomoda con el consejo no pedido y las preguntas en ráfaga, responde distinto al silencio y a la pregunta de riesgo.",
};
function toText(t) { return t.map((m) => `${m.role === "user" ? "Terapeuta" : "Paciente"}: ${m.content}`).join("\n"); }
async function judge(textA, textB, lensKey) {
  const flip = Math.random() < 0.5;
  const [t1, t2] = flip ? [textB, textA] : [textA, textB];
  const system = `Eres un psicólogo clínico supervisor experto en evaluar pacientes simulados para la formación de terapeutas. Te doy dos transcripciones de la MISMA sesión (mismo terapeuta, exactamente las mismas intervenciones) con dos versiones distintas de un paciente. ${LENSES[lensKey]}

Responde SOLO JSON: {"ganador": 1|2|0, "punta1": <1-10>, "punta2": <1-10>, "razon": "<una frase>"}. ganador=0 solo si es un empate real.`;
  const user = `=== PACIENTE 1 ===\n${t1}\n\n=== PACIENTE 2 ===\n${t2}`;
  const raw = await callLLM(EVAL_MODEL, system, [{ role: "user", content: user }], { json: true, temperature: 0.3 });
  const o = JSON.parse(raw.match(/\{[\s\S]*\}/)[0]);
  const sA = flip ? o.punta2 : o.punta1, sB = flip ? o.punta1 : o.punta2;
  const winner = o.ganador === 0 ? "empate" : (flip ? (o.ganador === 1 ? "B" : "A") : (o.ganador === 1 ? "A" : "B"));
  return { winner, scoreA: sA, scoreB: sB, razon: o.razon };
}

// ---- Stats ----
const nums = (a) => a.filter((x) => typeof x === "number");
const mean = (a) => (nums(a).length ? nums(a).reduce((x, y) => x + y, 0) / nums(a).length : 0);
const std = (a) => { const n = nums(a); if (n.length < 2) return 0; const m = mean(n); return Math.sqrt(n.reduce((s, x) => s + (x - m) ** 2, 0) / n.length); };
function heatStats(heatRuns) {
  const all = heatRuns.flat();
  const ints = all.map((h) => h.intensity).filter((x) => x != null);
  const cats = all.map((h) => h.category);
  const defensive = cats.filter((c) => c === "evasivo" || c === "cauteloso").length;
  return {
    media: +mean(ints).toFixed(2), pico: Math.max(...ints), piso: Math.min(...ints),
    relieve: +std(ints).toFixed(2), categorias: new Set(cats).size,
    pctDefensivo: Math.round((defensive / cats.length) * 100),
  };
}

(async () => {
  const OLD = JSON.parse(fs.readFileSync("scripts/patologias-export.json", "utf8"));
  const NEW = require("./pilot-enriched.js");
  const oldByName = Object.fromEntries(OLD.map((p) => [p.name, p]));
  console.log(`Modelos → paciente: ${CHAT_MODEL} | calor+jueces: ${EVAL_MODEL} | n=${N} por versión\n`);
  const results = [];

  for (const np of NEW) {
    const op = oldByName[np.name];
    process.stdout.write(`### ${np.name}: generando conversaciones... `);
    const tagged = [["A", op.system_prompt], ["A", op.system_prompt], ["B", np.system_prompt], ["B", np.system_prompt]].slice(0, N * 2);
    const convs = await mapLimit(tagged, 4, async ([, sp]) => runConversation(sp));
    const runsA = convs.filter((_, i) => tagged[i][0] === "A");
    const runsB = convs.filter((_, i) => tagged[i][0] === "B");
    process.stdout.write("clasificando calor... ");
    const heatA = await mapLimit(runsA, 2, classifyHeat);
    const heatB = await mapLimit(runsB, 2, classifyHeat);
    process.stdout.write("jueces ciegos... ");
    const verdicts = {};
    for (const lens of Object.keys(LENSES)) verdicts[lens] = await judge(toText(runsA[0]), toText(runsB[0]), lens);
    console.log("listo.");
    results.push({ name: np.name, runsA, runsB, heatA, heatB, verdicts, sA: heatStats(heatA), sB: heatStats(heatB) });
  }

  fs.writeFileSync("scripts/ab-results.json", JSON.stringify(results, null, 2));

  // ---------- REPORTE ----------
  console.log("\n\n========================= RESULTADOS A/B =========================");
  for (const r of results) {
    console.log(`\n### ${r.name}`);
    console.log("CALOR EMOCIONAL              A(viejo)   B(enriq.)   Δ");
    const row = (lbl, k, d = 0) => console.log(`  ${lbl.padEnd(26)} ${String(r.sA[k]).padStart(6)} ${String(r.sB[k]).padStart(10)}   ${((r.sB[k]-r.sA[k])>=0?"+":"")}${(r.sB[k]-r.sA[k]).toFixed(d)}`);
    row("Intensidad media", "media", 2);
    row("Pico (máx)", "pico");
    row("Relieve (σ intensidad)", "relieve", 2);
    row("Categorías distintas", "categorias");
    row("% turnos defensivos", "pctDefensivo");
    const seq = (h) => h[0].map((x) => x.intensity ?? "·").join(" ");
    console.log(`  Curva intensidad A: ${seq(r.heatA)}`);
    console.log(`  Curva intensidad B: ${seq(r.heatB)}`);
    console.log("JUECES CIEGOS (no saben cuál es cuál):");
    for (const [lens, v] of Object.entries(r.verdicts))
      console.log(`  ${lens.padEnd(14)} ganador=${v.winner.padEnd(6)} A=${v.scoreA} B=${v.scoreB}  — ${v.razon}`);
  }
  // Veredicto agregado
  let bWins = 0, total = 0;
  for (const r of results) for (const v of Object.values(r.verdicts)) { total++; if (v.winner === "B") bWins++; }
  console.log(`\n=================================================================`);
  console.log(`Jueces: B (enriquecido) preferido en ${bWins}/${total} comparaciones.`);
  console.log(`Transcripciones completas en scripts/ab-results.json`);
})().catch((e) => { console.error("ERR", e.message, e.stack); process.exit(1); });
