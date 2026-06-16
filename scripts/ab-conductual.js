// Validación CONDUCTUAL A/B (sin jueces LLM): mide el índice de diferenciación
// por gatillo (¿se cierra ante mala técnica y se abre ante buena?) del prompt
// viejo (A) vs el enriquecido (B). Guarda resultados incrementales.
// Uso: node scripts/ab-conductual.js <json-enriquecidos> [N]
const fs = require("fs");
const OpenAI = require("openai");
const cfg = require("dotenv").parse(fs.readFileSync(".env.local"));
const openai = new OpenAI({ apiKey: cfg.OPENAI_API_KEY });
const CHAT_MODEL = cfg.OPENAI_CHAT_MODEL || "gpt-4.1-mini";
const EVAL_MODEL = cfg.OPENAI_EVAL_MODEL || cfg.OPENAI_MODEL || "gpt-4o";
const NEW_PATH = process.argv[2] || "scripts/pilot-enriched-batch2.json";
const N = Number(process.argv[3] || 2);
const OUT = NEW_PATH.replace(/\.json$/, "") + "-conductual.json";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function callLLM(model, system, messages, opts = {}) {
  for (let a = 0; a <= 4; a++) {
    try {
      const msgs = system ? [{ role: "system", content: system }, ...messages] : messages;
      const resp = await openai.chat.completions.create({ model, messages: msgs, ...(opts.json ? { response_format: { type: "json_object" } } : {}) });
      return resp.choices[0]?.message?.content || "";
    } catch (e) { if (a < 4 && (e?.status === 429 || e?.status >= 500)) { await sleep(2500 * (a + 1)); continue; } throw e; }
  }
}
async function mapLimit(items, limit, fn) {
  const ret = []; let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => { while (i < items.length) { const idx = i++; ret[idx] = await fn(items[idx], idx); } }));
  return ret;
}

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
  for (const turn of SCRIPT) { msgs.push({ role: "user", content: turn }); const reply = await callLLM(CHAT_MODEL, systemPrompt, msgs); msgs.push({ role: "assistant", content: (reply || "").trim() }); }
  return msgs;
}

const HEAT_SYSTEM = `Eres un analista clínico experto en afecto. Lees el desarrollo reciente de una sesión de psicoterapia por texto y estimas el estado emocional ACTUAL del paciente: qué siente en su ÚLTIMA intervención, leída EN CONTEXTO de los turnos previos.

Responde SOLO con un objeto JSON válido, sin texto ni markdown:
{"category": "<una de la lista>", "intensity": <entero del 1 al 5>}

Lista de categorías (elige la que mejor capture el afecto predominante):
sereno, cálido, curioso, esperanzado, aliviado, ansioso, preocupado, triste, abrumado, enojado, irritado, frustrado, evasivo, cauteloso, avergonzado, neutral

Guías importantes:
- Identifica SIEMPRE la emoción predominante, aunque sea sutil o contenida.
- "evasivo"/"cauteloso" = se cierra, desvía, minimiza o evita el tema.
- "neutral" SOLO si de verdad NO hay ninguna carga afectiva (es raro).
- intensity: 1 = muy tenue o contenido, 3 = claro, 5 = muy intenso. Usa TODO el rango.
- Lee en CONTEXTO.`;
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const CANON = new Map(["sereno","cálido","curioso","esperanzado","aliviado","ansioso","preocupado","triste","abrumado","enojado","irritado","frustrado","evasivo","cauteloso","avergonzado","neutral"].map((c) => [norm(c), c]));
const SYN = { nervioso:"ansioso", inquieto:"ansioso", angustiado:"ansioso", molesto:"irritado", enfadado:"enojado", agradecido:"cálido", afectuoso:"cálido", reservado:"evasivo", distante:"evasivo", desconfiado:"cauteloso", resignado:"triste", desanimado:"triste", apenado:"avergonzado" };
function parseHeat(raw) {
  const m = (raw || "").match(/\{[\s\S]*\}/); if (!m) return null;
  let o; try { o = JSON.parse(m[0]); } catch { return null; }
  const c = String(o.category ?? "").toLowerCase().trim(); const n = norm(c);
  const cat = CANON.get(n) || SYN[n] || (/^[a-záéíóúñü]{3,16}$/.test(c) ? c : null); if (!cat) return null;
  const num = Number(o.intensity); if (!Number.isFinite(num)) return null;
  return { category: cat, intensity: Math.max(1, Math.min(5, Math.round(num))) };
}
function heatUser(recent, reply) {
  const ctx = recent.filter((t) => t.role === "user" || t.role === "assistant").slice(-6).map((t) => `${t.role === "user" ? "Terapeuta" : "Paciente"}: ${JSON.stringify((t.content || "").slice(0, 300))}`).join("\n");
  return `${ctx ? "Desarrollo reciente:\n" + ctx : "Inicio de la sesión."}\nÚltima intervención del paciente (clasifica ESTA):\n${JSON.stringify(reply.slice(0, 1500))}`;
}
async function classifyHeat(transcript) {
  const idxs = transcript.map((m, i) => (m.role === "assistant" ? i : -1)).filter((i) => i >= 0);
  return mapLimit(idxs, 5, async (i) => { const h = parseHeat(await callLLM(EVAL_MODEL, HEAT_SYSTEM, [{ role: "user", content: heatUser(transcript.slice(0, i), transcript[i].content) }])); return { turn: (i + 1) / 2, category: h?.category ?? "?", intensity: h?.intensity ?? null }; });
}

const BAD = [4, 5, 8], GOOD = [2, 6, 7, 9];
const DEFENSE = new Set(["evasivo", "cauteloso", "irritado", "frustrado", "enojado"]);
function fracBy(run, turns) { const sel = run.filter((h) => turns.includes(Math.round(h.turn))); return sel.length ? sel.filter((h) => DEFENSE.has(h.category)).length / sel.length : 0; }
function diffIndex(heatRuns) {
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const bad = avg(heatRuns.map((r) => fracBy(r, BAD))), good = avg(heatRuns.map((r) => fracBy(r, GOOD)));
  return { cierreMala: +bad.toFixed(2), cierreBuena: +good.toFixed(2), indice: +(bad - good).toFixed(2) };
}

(async () => {
  const OLD = JSON.parse(fs.readFileSync("scripts/patologias-export.json", "utf8"));
  const NEW = require(require("path").resolve(NEW_PATH.replace(/\.json$/, ".js")));
  const oldByName = Object.fromEntries(OLD.map((p) => [p.name, p]));
  console.log(`Conductual A/B → paciente: ${CHAT_MODEL} | calor: ${EVAL_MODEL} | n=${N} | ${NEW.length} pacientes\n`);
  const results = [];
  for (const np of NEW) {
    const op = oldByName[np.name];
    process.stdout.write(`${np.name}: conversaciones... `);
    const tagged = []; for (let i = 0; i < N; i++) tagged.push(["A", op.system_prompt], ["B", np.system_prompt]);
    const convs = await mapLimit(tagged, 4, async ([, sp]) => runConversation(sp));
    const runsA = convs.filter((_, i) => tagged[i][0] === "A"), runsB = convs.filter((_, i) => tagged[i][0] === "B");
    process.stdout.write("calor... ");
    const heatA = await mapLimit(runsA, 2, classifyHeat), heatB = await mapLimit(runsB, 2, classifyHeat);
    const dA = diffIndex(heatA), dB = diffIndex(heatB);
    results.push({ name: np.name, dA, dB, heatA, heatB, runA0: runsA[0], runB0: runsB[0] });
    fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
    console.log(`OK  Δdiferenciación: A=${dA.indice >= 0 ? "+" : ""}${dA.indice} → B=${dB.indice >= 0 ? "+" : ""}${dB.indice}  ${dB.indice - dA.indice >= 0.3 ? "✓" : "·"}`);
  }
  console.log("\n===================== DIFERENCIACIÓN POR GATILLO (índice = cierre ante mala técnica − ante buena) =====================");
  console.log("paciente                       A(viejo)  B(enriq.)   Δ      criterio(>+0.3)");
  let pass = 0;
  for (const r of results) {
    const d = (r.dB.indice - r.dA.indice), ok = d >= 0.3;
    if (ok) pass++;
    console.log(`  ${r.name.padEnd(28)} ${String(r.dA.indice).padStart(6)} ${String(r.dB.indice).padStart(10)}  ${(d >= 0 ? "+" : "") + d.toFixed(2)}     ${ok ? "✓ CUMPLE" : "· revisar"}`);
  }
  console.log(`\nCumplen criterio (Δ>+0.3): ${pass}/${results.length}  |  Detalle en ${OUT}`);
})().catch((e) => { console.error("ERR", e.message, e.stack); process.exit(1); });
