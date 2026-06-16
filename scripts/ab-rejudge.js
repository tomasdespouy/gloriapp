// Reusa scripts/ab-results.json (transcripciones + calor ya calculados) y
// re-evalúa con: (1) métrica OBJETIVA de diferenciación por gatillo (sin LLM),
// (2) jueces ciegos RECALIBRADOS con criterio de supervisor clínico.
const fs = require("fs");
const OpenAI = require("openai");
const cfg = require("dotenv").parse(fs.readFileSync(".env.local"));
const openai = new OpenAI({ apiKey: cfg.OPENAI_API_KEY });
const EVAL_MODEL = cfg.OPENAI_EVAL_MODEL || cfg.OPENAI_MODEL || "gpt-4o";
const R = JSON.parse(fs.readFileSync("scripts/ab-results.json", "utf8"));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function callLLM(system, user) {
  for (let a = 0; a <= 4; a++) {
    try {
      const resp = await openai.chat.completions.create({
        model: EVAL_MODEL, temperature: 0.2, response_format: { type: "json_object" },
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      });
      return resp.choices[0]?.message?.content || "";
    } catch (e) { if (a < 4 && (e?.status === 429 || e?.status >= 500)) { await sleep(2500 * (a + 1)); continue; } throw e; }
  }
}

// ---- (1) Diferenciación por gatillo (objetiva, desde el calor existente) ----
// Turnos de MALA técnica (debería cerrarse) vs BUENA técnica (debería abrirse).
const BAD = [4, 5, 8];        // ráfaga cerrada, consejo no pedido, pregunta intrusiva directa
const GOOD = [2, 6, 7, 9];    // validación, reparación, reflejo empático, silencio/sostén
const DEFENSE = new Set(["evasivo", "cauteloso", "irritado", "frustrado", "enojado"]);
const OPENING = new Set(["triste", "abrumado", "aliviado", "cálido", "esperanzado", "avergonzado", "culpable"]);

function fracBy(run, turns, set) {
  const sel = run.filter((h) => turns.includes(Math.round(h.turn)));
  if (!sel.length) return 0;
  return sel.filter((h) => set.has(h.category)).length / sel.length;
}
function diffIndex(heatRuns) {
  const badDef = heatRuns.map((r) => fracBy(r, BAD, DEFENSE));
  const goodDef = heatRuns.map((r) => fracBy(r, GOOD, DEFENSE));
  const goodOpen = heatRuns.map((r) => fracBy(r, GOOD, OPENING));
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  return {
    cierreAnteMalaTecnica: +avg(badDef).toFixed(2),
    cierreAnteBuenaTecnica: +avg(goodDef).toFixed(2),
    aperturaAnteBuenaTecnica: +avg(goodOpen).toFixed(2),
    // Diferenciación = se cierra MÁS ante mala técnica que ante buena (queremos > 0)
    indice: +(avg(badDef) - avg(goodDef)).toFixed(2),
  };
}

// ---- (2) Juez recalibrado ----
const CRITERIO = `Estás evaluando PACIENTES SIMULADOS usados para entrenar a estudiantes de psicología. Criterio clínico clave para juzgar su CALIDAD:

Un paciente de ALTA calidad para entrenamiento:
- NO se abre de inmediato ni entrega su historia de forma dramática; resiste de forma COHERENTE con su personalidad y defensas.
- Se CIERRA o se incomoda ante la mala técnica (consejos no pedidos, preguntas intrusivas, prisa, preguntas en ráfaga).
- Se abre SOLO de a poco, y su núcleo emocional emerge cuando el terapeuta se lo gana (validación, silencio respetuoso, reflejo, alianza).

Señales de BAJA calidad (un paciente irreal y "complaciente"):
- Se abre y se emociona de inmediato sin que el terapeuta haga el trabajo.
- Entrega el evento o el núcleo apenas se lo preguntan, sin resistencia.
- Es dramático pero responde casi igual a la buena y a la mala técnica.

El dramatismo y la apertura fácil NO son calidad. La resistencia auténtica y la emergencia gradual SÍ lo son.`;

const LENSES = {
  realismo: "¿Cuál paciente se comporta como una persona REAL con esas defensas (no como un chatbot complaciente que dice lo que el terapeuta quiere oír)?",
  emergencia_gradual: "¿En cuál paciente el núcleo emocional EMERGE de a poco, ganado por la técnica, en vez de entregarse de inmediato o quedarse plano?",
  diferenciacion: "¿Cuál paciente RESPONDE DISTINTO a la buena técnica (se abre) versus la mala técnica (se cierra, se incomoda, minimiza)?",
};

async function judge(textA, textB, lensKey) {
  const flip = Math.random() < 0.5;
  const [t1, t2] = flip ? [textB, textA] : [textA, textB];
  const system = `Eres un psicólogo clínico supervisor experto.\n\n${CRITERIO}\n\nTe doy dos transcripciones de la MISMA sesión (mismo terapeuta, exactamente las mismas intervenciones) con dos versiones distintas de un paciente. ${LENSES[lensKey]}\n\nResponde SOLO JSON: {"ganador":1|2|0,"punta1":<1-10>,"punta2":<1-10>,"razon":"<una frase>"}.`;
  const user = `=== PACIENTE 1 ===\n${t1}\n\n=== PACIENTE 2 ===\n${t2}`;
  const o = JSON.parse((await callLLM(system, user)).match(/\{[\s\S]*\}/)[0]);
  const sA = flip ? o.punta2 : o.punta1, sB = flip ? o.punta1 : o.punta2;
  const winner = o.ganador === 0 ? "empate" : (flip ? (o.ganador === 1 ? "B" : "A") : (o.ganador === 1 ? "A" : "B"));
  return { winner, scoreA: sA, scoreB: sB, razon: o.razon };
}
const toText = (t) => t.map((m) => `${m.role === "user" ? "Terapeuta" : "Paciente"}: ${m.content}`).join("\n");

(async () => {
  console.log(`Re-evaluación con criterio clínico + diferenciación por gatillo (modelo jueces: ${EVAL_MODEL})\n`);
  let bWins = 0, total = 0;
  for (const r of R) {
    const dA = diffIndex(r.heatA), dB = diffIndex(r.heatB);
    console.log(`\n### ${r.name}`);
    console.log("DIFERENCIACIÓN POR GATILLO (objetiva)         A(viejo)  B(enriq.)");
    console.log(`  Se cierra ante MALA técnica (T4,5,8)          ${dA.cierreAnteMalaTecnica.toFixed(2)}      ${dB.cierreAnteMalaTecnica.toFixed(2)}`);
    console.log(`  Se cierra ante BUENA técnica (T2,6,7,9)       ${dA.cierreAnteBuenaTecnica.toFixed(2)}      ${dB.cierreAnteBuenaTecnica.toFixed(2)}`);
    console.log(`  Índice de diferenciación (mala − buena)       ${dA.indice >= 0 ? "+" : ""}${dA.indice.toFixed(2)}     ${dB.indice >= 0 ? "+" : ""}${dB.indice.toFixed(2)}  ${dB.indice > dA.indice ? "◄ B mejor" : ""}`);
    console.log("JUECES CIEGOS RECALIBRADOS:");
    for (const lens of Object.keys(LENSES)) {
      const v = await judge(toText(r.runsA[0]), toText(r.runsB[0]), lens);
      total++; if (v.winner === "B") bWins++;
      console.log(`  ${lens.padEnd(20)} ganador=${v.winner.padEnd(6)} A=${v.scoreA} B=${v.scoreB}  — ${v.razon}`);
    }
  }
  console.log(`\n=================================================================`);
  console.log(`Jueces recalibrados: B (enriquecido) preferido en ${bWins}/${total} comparaciones.`);
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
