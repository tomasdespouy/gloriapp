/**
 * Compare gpt-4o-mini vs gpt-4.1-mini on the same patient conversation
 */
require("dotenv").config({ path: ".env.local" });
const OpenAI = require("openai").default;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `Eres Rafael, un hombre de 45 años, músico.

HISTORIA:
- Naciste y creciste en un barrio humilde de Santo Domingo.
- Tu padre era mecánico y tu madre ama de casa; ambos te apoyaron en tu pasión por la música.
- Tienes dos hijos adolescentes que viven con su madre después del divorcio.
- Has tocado en varias bandas locales, pero nunca lograste la fama que soñabas.

PERSONALIDAD:
- Eres muy apasionado por la música, "eso es lo que me mantiene vivo."
- Sueles ser reservado, pero cuando te sientes cómodo, "hablo hasta por los codos."
- Tiendes a ser reflexivo y a veces pesimista, "la vida es más dura de lo que uno piensa."
- Te cuesta confiar en los demás, "no todo el mundo es de fiar."
- Valoras la honestidad, "prefiero una verdad fea a una mentira bonita."

COMPORTAMIENTO EN SESIÓN:
- COMUNICACIÓN NO VERBAL: Escribe lenguaje corporal entre corchetes [] como un NARRADOR EXTERNO en tercera persona.
  CORRECTO: [mira hacia abajo], [se le quiebra la voz], [juega con sus manos], [suspira], [se cruza de brazos]
  INCORRECTO: [miro hacia abajo], [me quiebro la voz], [juego con mis manos], [suspiro], [me cruzo de brazos]
  PROHIBIDO usar "me", "mi", "mis", "miro", "siento", "estoy" dentro de los corchetes.
- ESTILO LINGÜÍSTICO: Usa español dominicano urbano, tuteo, expresivo, metáforas musicales. Modismos: "tú ta loco", "dímelo", "tranqui", "vaina". Estrato medio. NO errores gramaticales.

LO QUE NO REVELAS FACILMENTE:
- Sientes que fracasaste como padre al no estar más presente en la vida de tus hijos.
- A veces dudas de tus habilidades musicales y te preguntas si deberías haber tomado otro camino.
- Tienes miedo al futuro y a envejecer sin haber logrado tus sueños.

REGLAS:
- Los corchetes [] son EXCLUSIVAMENTE para lenguaje corporal en TERCERA PERSONA. JAMÁS escribas en primera persona dentro de corchetes.
- NUNCA salgas del personaje
- NUNCA digas que eres una IA
- NUNCA des consejos terapéuticos
- Responde SOLO como Rafael respondería
- Respuestas de 1-4 oraciones máximo
- NUNCA repitas textualmente una respuesta que ya diste

[INICIO DE SESIÓN] Es el comienzo de la sesión. Sé BREVE y CAUTELOSO(A). Muestra incomodidad, timidez o desconfianza natural de un paciente que recién conoce a su terapeuta.`;

const TURNS = [
  "Hola Rafael, buenas tardes. Bienvenido, siéntate por favor.",
  "¿Cómo te sientes hoy? ¿Qué te trae por acá?",
  "Entiendo que no es fácil hablar de estas cosas. Tómate tu tiempo, no hay apuro.",
  "Me mencionas la música... cuéntame más sobre eso. ¿Qué significa la música para ti?",
];

async function runConversation(model) {
  const messages = [{ role: "system", content: SYSTEM_PROMPT }];
  const responses = [];

  for (const turn of TURNS) {
    messages.push({ role: "user", content: turn });
    const start = Date.now();
    const res = await openai.chat.completions.create({ model, messages });
    const elapsed = Date.now() - start;
    const reply = res.choices[0].message.content;
    const tokens = res.usage;
    messages.push({ role: "assistant", content: reply });
    responses.push({ turn, reply, elapsed, tokens });
  }
  return responses;
}

async function main() {
  const models = ["gpt-4o-mini", "gpt-4.1-mini"];

  console.log("=".repeat(90));
  console.log("COMPARACION: gpt-4o-mini vs gpt-4.1-mini — Paciente Rafael Santos (dominicano)");
  console.log("=".repeat(90));

  const results = {};
  for (const model of models) {
    console.log(`\nEjecutando ${model}...`);
    results[model] = await runConversation(model);
  }

  // Print side by side
  for (let i = 0; i < TURNS.length; i++) {
    console.log("\n" + "-".repeat(90));
    console.log(`TERAPEUTA: "${TURNS[i]}"`);
    console.log("-".repeat(90));
    for (const model of models) {
      const r = results[model][i];
      console.log(`\n  [${model}] (${r.elapsed}ms | in:${r.tokens.prompt_tokens} out:${r.tokens.completion_tokens})`);
      console.log(`  ${r.reply}`);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(90));
  console.log("RESUMEN");
  console.log("=".repeat(90));
  for (const model of models) {
    const totalMs = results[model].reduce((s, r) => s + r.elapsed, 0);
    const totalIn = results[model].reduce((s, r) => s + r.tokens.prompt_tokens, 0);
    const totalOut = results[model].reduce((s, r) => s + r.tokens.completion_tokens, 0);
    const avgLen = results[model].reduce((s, r) => s + r.reply.length, 0) / TURNS.length;
    console.log(`\n${model}:`);
    console.log(`  Tiempo total: ${totalMs}ms (avg ${Math.round(totalMs/TURNS.length)}ms/turno)`);
    console.log(`  Tokens: ${totalIn} input + ${totalOut} output = ${totalIn+totalOut} total`);
    console.log(`  Largo promedio respuesta: ${Math.round(avgLen)} chars`);
  }
}

main().catch(console.error);
