/**
 * F4 – Evaluador B: PECT-extendido (44 ítems evaluables vía chat).
 *
 * Usa el prompt de build-pect-prompt.js. Modelo: gpt-4o (mismo que V3 para
 * comparabilidad inter-evaluador).
 *
 * Salida: C:/tmp/projection/eval-pect-{level}.json
 */
require("dotenv").config({ path: "C:/Users/tomas/documents/gloriapp/.env.local" });
const fs = require("fs");
const path = require("path");
const OpenAI = require("openai").default;
const { buildPectExtendedPrompt, flattenItems } = require("./build-pect-prompt");

const MODEL = process.env.OPENAI_EVAL_MODEL || "gpt-4o";
const OUT_DIR = "C:/tmp/projection";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function renderTranscript(transcript) {
  return transcript
    .map((t) => {
      const role = t.role === "student" ? "Terapeuta" : "Paciente";
      return `[${t.turn} – ${role}] ${t.content}`;
    })
    .join("\n");
}

function buildUserMessage(transcript) {
  const header =
    "CONTEXTO: PRIMERA sesión con el paciente. No existen sesiones previas. " +
    "Las competencias de Estructura siempre aplican (no marcar 0 por 'seguimiento').\n\n";
  return `${header}Conversación a evaluar:\n\n${renderTranscript(transcript)}`;
}

async function evaluateOne(level, prompt) {
  const inPath = path.join(OUT_DIR, `conversation-${level}.json`);
  const outPath = path.join(OUT_DIR, `eval-pect-${level}.json`);
  const conv = JSON.parse(fs.readFileSync(inPath, "utf8"));

  const userMessage = buildUserMessage(conv.transcript);
  console.log(`[eval-pect ${level}] llamando ${MODEL} (transcript ${userMessage.length} chars)`);

  const start = Date.now();
  const res = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: userMessage },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  const raw = JSON.parse(res.choices[0].message.content);

  // Calcular overall PECT: promedio aritmético de scores 1-4, excluyendo 0 (NA).
  // Esto es comparable con V3 (que también excluye NA).
  const items = flattenItems();
  const numericScores = items
    .map((it) => raw.scores?.[it.key])
    .filter((v) => typeof v === "number" && v >= 1 && v <= 4);
  const overall =
    numericScores.length > 0
      ? Math.round((numericScores.reduce((a, b) => a + b, 0) / numericScores.length) * 100) / 100
      : 0;

  // Conteo por sección para el análisis
  const sectionStats = {};
  for (const it of items) {
    const s = it.section;
    sectionStats[s] = sectionStats[s] || { total: 0, na: 0, sum: 0, count: 0, items: {} };
    sectionStats[s].total++;
    const score = raw.scores?.[it.key];
    sectionStats[s].items[it.key] = score;
    if (typeof score !== "number") continue;
    if (score === 0) sectionStats[s].na++;
    else {
      sectionStats[s].sum += score;
      sectionStats[s].count++;
    }
  }
  for (const s of Object.keys(sectionStats)) {
    sectionStats[s].avg =
      sectionStats[s].count > 0
        ? Math.round((sectionStats[s].sum / sectionStats[s].count) * 100) / 100
        : null;
  }

  const out = {
    level,
    evaluator: "pect-extended-v1",
    model: MODEL,
    elapsed_seconds: parseFloat(elapsed),
    tokens: res.usage,
    raw,
    overall,
    items_count: items.length,
    numeric_count: numericScores.length,
    section_stats: sectionStats,
  };
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(
    `[ok] ${level}: overall=${overall} (n=${numericScores.length}/${items.length}), ` +
      `tokens=${res.usage.total_tokens}, elapsed=${elapsed}s → ${outPath}`,
  );
  return out;
}

async function main() {
  console.log("─".repeat(70));
  console.log("F4 – EVALUADOR B: PECT-extendido (44 ítems)");
  console.log("─".repeat(70));

  const prompt = buildPectExtendedPrompt();
  console.log(`[ok] prompt PECT-extendido: ${prompt.length} chars`);

  for (const level of ["basico", "medio", "avanzado"]) {
    await evaluateOne(level, prompt);
  }
}

main().catch((e) => {
  console.error("[fatal]", e);
  process.exit(1);
});
