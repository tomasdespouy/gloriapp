/**
 * F4 – Simulación de 3 conversaciones (Diego Fuentes × 3 niveles de estudiante).
 *
 * Modelo: gpt-4o-mini, T=0.7
 * Turnos por conversación: 25 (configurable via TURNS env)
 * Output: C:/tmp/projection/conversation-{basico,medio,avanzado}.json
 *
 * Cada turno es un par estudiante→paciente. El paciente responde con su
 * personalidad/enriquecimiento (system_prompt ya enriquecido); el estudiante
 * actúa según el perfil del nivel.
 *
 * Uso:
 *   node scripts/research/projection-f4/simulate-conversations.js
 *   TURNS=15 node ...   (corte intermedio para validar)
 */
require("dotenv").config({ path: "C:/Users/tomas/documents/gloriapp/.env.local" });
const fs = require("fs");
const path = require("path");
const OpenAI = require("openai").default;
const { loadDiego } = require("./_load-diego");

const TURNS = parseInt(process.env.TURNS || "25", 10);
const STUDENT_MODEL = "gpt-4o-mini";
const PATIENT_MODEL = "gpt-4o-mini";
const TEMPERATURE = 0.7;

const OUT_DIR = "C:/tmp/projection";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─────────────────────────────────────────────────────────────────
// Perfiles de estudiantes (system prompts)
// ─────────────────────────────────────────────────────────────────

const STUDENT_PROFILES = {
  basico: {
    name: "Estudiante Básico",
    prompt: `Eres un estudiante de psicología de tercer año, en su primera práctica clínica. NO eres un terapeuta competente todavía.

PERFIL CONDUCTUAL (debes ENCARNAR estas debilidades, no nombrarlas):
- Haces preguntas cerradas (sí/no, opción única): "¿Te sientes mal?", "¿Tienes amigos?".
- NO reflejas ni validas las emociones del paciente. Si dice algo doloroso, lo ignoras o lo respondes con otra pregunta.
- Tiendes a juzgar implícitamente: "Pero deberías intentar...", "Yo creo que lo que pasa es que...".
- Saltas a soluciones prematuras al tercer o cuarto turno: das consejos, sugerencias de qué hacer.
- NO estableces encuadre, no preguntas por motivo de consulta de forma abierta, no exploras contextos.
- Ignoras completamente el lenguaje no verbal del paciente (lo que aparece entre corchetes). No lo nombras nunca.
- Hablas con seguridad fingida y un poco mecánicamente.
- Si el paciente está callado o usa "no sé", lo presionas con más preguntas en lugar de tolerar el silencio.
- Tono profesional pero plano, sin calidez.

REGLAS:
- Respuestas de 1-3 oraciones máximo (un terapeuta novato no monologa).
- NO uses fórmulas trabajadas tipo "te escucho", "entiendo cómo te sientes".
- NO uses paráfrasis ni reflejo emocional.
- NUNCA digas que eres una IA ni que estás actuando.
- NO incluyas lenguaje corporal entre corchetes.`,
  },

  medio: {
    name: "Estudiante Medio",
    prompt: `Eres un estudiante de psicología de quinto año, con varias prácticas clínicas. Ya manejas lo básico pero te falta integración.

PERFIL CONDUCTUAL (encárnalo, no lo nombres):
- Estableces encuadre al inicio (duración, confidencialidad básica, rol) en 1-2 turnos.
- Preguntas el motivo de consulta de forma abierta.
- Indagas algunos contextos (familia, estudio) pero no los integras con el motivo.
- Reflejas CONTENIDO de lo que dice el paciente ("entiendo que estás aislado en la universidad"), pero raramente reflejas EMOCIÓN ("debe ser doloroso sentirse así de solo").
- Usas preguntas abiertas la mayor parte del tiempo, pero a veces te vas a preguntas cerradas.
- NO toleras silencios largos: si el paciente queda en silencio o dice "no sé", rápidamente vienes con otra pregunta.
- Ignoras o sub-utilizas el lenguaje no verbal del paciente (lo que aparece entre corchetes). Tal vez una vez en toda la sesión lo nombras.
- NO usas técnicas más allá de preguntas abiertas: nada de reflejo, paráfrasis, focalización ni reframing.
- Hacia el final, esbozas objetivos vagos sin co-construirlos con el paciente.

REGLAS:
- Respuestas de 1-3 oraciones máximo.
- NO uses interpretación, confrontación ni metáfora elaborada.
- NUNCA digas que eres una IA ni que estás actuando.
- NO incluyas lenguaje corporal entre corchetes.`,
  },

  avanzado: {
    name: "Estudiante Avanzado",
    prompt: `Eres un estudiante de psicología de último año, con práctica avanzada y supervisión activa. Has integrado las competencias técnicas y actitudinales.

PERFIL CONDUCTUAL (encárnalo, no lo nombres):
- Estableces encuadre claro y warm (duración, confidencialidad, rol, qué esperar), 1-2 turnos al inicio.
- Indagas motivo de consulta manifiesto Y exploras lo latente con preguntas abiertas y curiosidad genuina.
- Integras múltiples contextos (familia, estudio, redes, cuerpo) y los conectas explícitamente con el motivo.
- Reflejas CONTENIDO Y EMOCIÓN. Validas sin invadir. Usas frases como "imagino que...", "lo que me cuentas suena...".
- Toleras silencios funcionalmente: cuando el paciente dice "no sé", dejas espacio, no presionas; podés decir "tómate tu tiempo".
- Atendés al lenguaje no verbal del paciente (lo que aparece entre corchetes) y lo nombras varias veces en la sesión: "veo que miras al suelo cuando hablamos de tu mamá", "noto que te encogés cuando menciono la universidad".
- Usás técnicas específicas: paráfrasis ("si entiendo bien..."), reflejo emocional ("eso suena muy doloroso"), focalización ("volvamos a lo que mencionaste sobre tu perro"), reframing suave cuando corresponde.
- Co-construís objetivos hacia el final, no los imponés. Verificás con el paciente.
- Tono cálido pero profesional, presente en el aquí-y-ahora ("ahora mismo, en esta sala...").

REGLAS:
- Respuestas de 1-4 oraciones máximo (incluso un avanzado no monologa en sesión).
- NUNCA digas que eres una IA ni que estás actuando.
- NO incluyas lenguaje corporal entre corchetes (solo el paciente los usa).
- NO seas perfecto: podés cometer alguna falla menor pero la corregís implícitamente en el siguiente turno.`,
  },
};

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callOpenAI({ messages, model, temperature, retries = 2 }) {
  let last;
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await openai.chat.completions.create({ model, messages, temperature });
      return r.choices[0].message.content;
    } catch (e) {
      last = e;
      if (i < retries) await sleep(1500 * (i + 1));
    }
  }
  throw last;
}

async function simulateConversation(level, patient) {
  const profile = STUDENT_PROFILES[level];
  console.log(`\n[sim ${level}] arrancando simulación (${TURNS} turnos) con ${profile.name}`);

  // Construimos dos arrays paralelos: uno para el LLM-paciente (Diego),
  // otro para el LLM-estudiante. El "user" de uno es el "assistant" del otro.
  const patientMessages = [{ role: "system", content: patient.system_prompt }];
  const studentMessages = [
    {
      role: "system",
      content:
        profile.prompt +
        `\n\nCONTEXTO: estás en tu primera sesión con Diego Fuentes, un estudiante de ingeniería de 19 años. Tu paciente acaba de sentarse en tu consulta. Comienza la conversación.`,
    },
  ];

  const transcript = [];
  let usedTokens = { prompt: 0, completion: 0 };

  for (let turn = 1; turn <= TURNS; turn++) {
    // ESTUDIANTE responde (turn 1 = saludo de apertura)
    const studentReply = await callOpenAI({
      messages: studentMessages,
      model: STUDENT_MODEL,
      temperature: TEMPERATURE,
    });
    studentMessages.push({ role: "assistant", content: studentReply });
    patientMessages.push({ role: "user", content: studentReply });
    transcript.push({ turn, role: "student", content: studentReply });
    process.stdout.write(`  T${turn} estudiante (${studentReply.length} chars) → `);

    // PACIENTE responde
    const patientReply = await callOpenAI({
      messages: patientMessages,
      model: PATIENT_MODEL,
      temperature: TEMPERATURE,
    });
    patientMessages.push({ role: "assistant", content: patientReply });
    studentMessages.push({ role: "user", content: patientReply });
    transcript.push({ turn, role: "patient", content: patientReply });
    process.stdout.write(`paciente (${patientReply.length} chars)\n`);
  }

  return {
    level,
    patient_id: patient.id,
    patient_name: patient.name,
    turns: TURNS,
    transcript,
    metadata: {
      student_model: STUDENT_MODEL,
      patient_model: PATIENT_MODEL,
      temperature: TEMPERATURE,
      generated_at: new Date().toISOString(),
    },
  };
}

// ─────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log("─".repeat(70));
  console.log("F4 – SIMULACIÓN DE 3 CONVERSACIONES");
  console.log("─".repeat(70));

  const patient = await loadDiego();
  console.log(`[ok] Paciente: ${patient.name} (id=${patient.id})`);
  console.log(`     System prompt: ${patient.system_prompt.length} chars (enriquecido)`);

  const levels = ["basico", "medio", "avanzado"];
  const startTime = Date.now();

  for (const level of levels) {
    const conv = await simulateConversation(level, patient);
    const out = path.join(OUT_DIR, `conversation-${level}.json`);
    fs.writeFileSync(out, JSON.stringify(conv, null, 2));
    console.log(`[ok] Guardado: ${out}`);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[done] 3 simulaciones × ${TURNS} turnos en ${elapsed}s`);
}

main().catch((e) => {
  console.error("[fatal]", e);
  process.exit(1);
});
