/**
 * F4 – Evaluador A: motor V3 actual (master, NO la rama fix/v3-fidelity-pect).
 *
 * Importamos EVALUATION_PROMPT y normalizeEvaluation de src/lib/evaluation-prompt.ts
 * via ts-node-equivalent (compilamos a JS al vuelo con una pequeña shim).
 *
 * IMPORTANTE: como este script es JS puro, no podemos hacer require de un .ts.
 * En su lugar replicamos el EVALUATION_PROMPT desde una lectura literal del archivo
 * y la rúbrica desde competency-rubric.ts. Esto garantiza que evaluemos con el
 * MISMO prompt que producción.
 *
 * Salida: C:/tmp/projection/eval-v3-{level}.json
 */
require("dotenv").config({ path: "C:/Users/tomas/documents/gloriapp/.env.local" });
const fs = require("fs");
const path = require("path");
const OpenAI = require("openai").default;
const { execSync } = require("child_process");

const MODEL = process.env.OPENAI_EVAL_MODEL || "gpt-4o";
const OUT_DIR = "C:/tmp/projection";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─────────────────────────────────────────────────────────────────
// Cargar el EVALUATION_PROMPT exactamente como en master.
// ─────────────────────────────────────────────────────────────────

function loadMasterEvaluationPrompt() {
  // Confirmamos que estamos en master (o en una rama derivada) y leemos el
  // archivo de master directamente vía git show.
  const tsRaw = execSync(
    "git show master:src/lib/evaluation-prompt.ts",
    { cwd: "C:/Users/tomas/documents/gloriapp", encoding: "utf8" },
  );
  const rubricRaw = execSync(
    "git show master:src/lib/competency-rubric.ts",
    { cwd: "C:/Users/tomas/documents/gloriapp", encoding: "utf8" },
  );
  return { tsRaw, rubricRaw };
}

// ─────────────────────────────────────────────────────────────────
// Parseo (puerto JS de las funciones de master).
// ─────────────────────────────────────────────────────────────────

const COMPETENCY_KEYS_V2 = [
  "setting_terapeutico",
  "motivo_consulta",
  "datos_contextuales",
  "objetivos",
  "escucha_activa",
  "actitud_no_valorativa",
  "optimismo",
  "presencia",
  "conducta_no_verbal",
  "contencion_afectos",
];

function parseScore(v) {
  if (v === "NA" || v === null || v === undefined) return null;
  if (typeof v === "number" && v >= 0 && v <= 4) return v;
  if (typeof v === "string") {
    const t = v.trim().toUpperCase();
    if (t === "NA" || t === "N/A") return null;
    const n = Number(t);
    if (Number.isFinite(n) && n >= 0 && n <= 4) return n;
  }
  return null;
}

function computeOverall(scores) {
  const nums = Object.values(scores).filter((v) => typeof v === "number");
  if (nums.length === 0) return 0;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

function normalizeEvaluation(raw) {
  const r = raw || {};
  const src = r.scores || r;
  const scores = {};
  for (const k of COMPETENCY_KEYS_V2) scores[k] = parseScore(src[k]);

  const naJustRaw = r.na_justifications || {};
  const na_justifications = {};
  for (const k of COMPETENCY_KEYS_V2) {
    if (scores[k] === null && typeof naJustRaw[k] === "string") {
      na_justifications[k] = naJustRaw[k];
    }
  }

  return {
    scores,
    overall_score_v2: computeOverall(scores),
    na_justifications,
    commentary: typeof r.commentary === "string" ? r.commentary : "",
    strengths: Array.isArray(r.strengths) ? r.strengths : [],
    areas_to_improve: Array.isArray(r.areas_to_improve) ? r.areas_to_improve : [],
    evidence: r.evidence || {},
  };
}

// ─────────────────────────────────────────────────────────────────
// Extracción del EVALUATION_PROMPT como string ejecutable.
// El archivo TS exporta `EVALUATION_PROMPT = `...${rubricToPromptSection()}...``
// Para reproducirlo exacto, ejecutamos un require de los símbolos compilados.
// Estrategia: usamos tsc temporalmente para emitir un módulo CJS.
// ─────────────────────────────────────────────────────────────────

function buildPromptFromMaster() {
  // Más simple: compilamos el TS de master a una carpeta temporal y lo importamos.
  const fs2 = require("fs");
  const os = require("os");
  const tmp = fs2.mkdtempSync(path.join(os.tmpdir(), "v3eval-"));
  // Escribimos los 3 archivos relevantes de master
  const { tsRaw, rubricRaw } = loadMasterEvaluationPrompt();
  const gamificationRaw = execSync(
    "git show master:src/lib/gamification.ts",
    { cwd: "C:/Users/tomas/documents/gloriapp", encoding: "utf8" },
  );
  fs2.writeFileSync(path.join(tmp, "gamification.ts"), gamificationRaw);
  fs2.writeFileSync(path.join(tmp, "competency-rubric.ts"), rubricRaw);
  fs2.writeFileSync(path.join(tmp, "evaluation-prompt.ts"), tsRaw);

  // Generamos un index minimal y lo compilamos
  const indexTs = `
    export { EVALUATION_PROMPT } from "./evaluation-prompt";
  `;
  fs2.writeFileSync(path.join(tmp, "index.ts"), indexTs);

  // Compilamos con tsc (instalado en node_modules)
  const tscBin = "C:/Users/tomas/documents/gloriapp/node_modules/.bin/tsc";
  execSync(
    `"${tscBin}" --module commonjs --target es2019 --outDir "${tmp}/out" ` +
      `--esModuleInterop --skipLibCheck "${tmp}/index.ts"`,
    { stdio: "inherit" },
  );
  const mod = require(path.join(tmp, "out", "index.js"));
  return mod.EVALUATION_PROMPT;
}

// ─────────────────────────────────────────────────────────────────
// Render transcript
// ─────────────────────────────────────────────────────────────────

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
    "CONTEXTO DE LA SESIÓN: esta es la PRIMERA sesión entre el estudiante y el paciente. No existen sesiones previas. " +
    "Por lo tanto, las competencias de Estructura (setting_terapeutico, motivo_consulta, datos_contextuales) NO PUEDEN marcarse como 'NA' por motivo de 'seguimiento' o 'ya consensuado'. " +
    "En primera sesión esas tres competencias siempre aplican y deben recibir un score 0-4.\n\n";
  return `${header}Conversación a evaluar:\n\n${renderTranscript(transcript)}`;
}

// ─────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────

async function evaluateOne(level, prompt) {
  const inPath = path.join(OUT_DIR, `conversation-${level}.json`);
  const outPath = path.join(OUT_DIR, `eval-v3-${level}.json`);
  const conv = JSON.parse(fs.readFileSync(inPath, "utf8"));

  const userMessage = buildUserMessage(conv.transcript);
  console.log(`[eval-v3 ${level}] llamando ${MODEL} (transcript ${userMessage.length} chars)`);

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
  const normalized = normalizeEvaluation(raw);

  const out = {
    level,
    evaluator: "v3-master",
    model: MODEL,
    elapsed_seconds: parseFloat(elapsed),
    tokens: res.usage,
    raw,
    normalized,
  };
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(
    `[ok] ${level}: overall=${normalized.overall_score_v2}, ` +
      `tokens=${res.usage.total_tokens}, elapsed=${elapsed}s → ${outPath}`,
  );
  return out;
}

async function main() {
  console.log("─".repeat(70));
  console.log("F4 – EVALUADOR A: V3 (master)");
  console.log("─".repeat(70));

  console.log("[build] compilando EVALUATION_PROMPT desde master...");
  const prompt = buildPromptFromMaster();
  console.log(`[ok] prompt length: ${prompt.length} chars`);

  for (const level of ["basico", "medio", "avanzado"]) {
    await evaluateOne(level, prompt);
  }
}

main().catch((e) => {
  console.error("[fatal]", e);
  process.exit(1);
});
