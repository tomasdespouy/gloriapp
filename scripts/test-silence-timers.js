#!/usr/bin/env node
/**
 * Test de mensajes de silencio y saludo corto para los 34 pacientes.
 *
 * Escenario A: Sin mensaje previo → dispara stages 1-4 de silencio.
 * Escenario B: Enviar "Hola, buenas tardes." → registrar respuesta + stages 1-4.
 *
 * Llama directamente a Google Gemini (o OpenAI) con los mismos prompts
 * que usa la plataforma, sin necesitar el dev server.
 *
 * Uso: node scripts/test-silence-timers.js
 */

require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LLM_PROVIDER = process.env.LLM_PROVIDER || "gemini";
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const OPENAI_MODEL = process.env.OPENAI_EVAL_MODEL || process.env.OPENAI_MODEL || "gpt-4o";

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

// ── Silence stage prompts (same as route.ts) ────────────────────────────
const STAGE_PROMPTS = {
  1: `[INSTRUCCIÓN ESPECIAL]
Ha pasado un minuto sin que el terapeuta diga nada. Reacciona con un saludo extrañado, sutil, como si notaras la pausa. Algunas opciones:
- "Mmm... ¿está todo bien por ahí?"
- "Me quedé pensando si escuchó lo que dije..."
- "Bueno... este silencio me pone un poco nervioso/a..."
Elige la reacción que mejor se ajuste a tu personalidad y al momento de la conversación. Responde en 1 oración.`,

  2: `[INSTRUCCIÓN ESPECIAL]
Han pasado casi 2 minutos sin que el terapeuta diga nada. Ya reaccionaste antes al silencio pero siguen sin responder. Ahora pregunta directamente si está ahí:
- "¿Sigue ahí? Me estoy preocupando un poco..."
- "Oiga... ¿me escucha? Llevo un rato esperando..."
- "No sé si se cortó la conexión o algo..."
Responde en 1-2 oraciones.`,

  3: `[INSTRUCCIÓN ESPECIAL]
Han pasado 3 minutos sin que el terapeuta responda. Ya preguntaste si estaba ahí y no hubo respuesta. Ahora avisa que te retirarás si no hay respuesta:
- "Mire, si no tiene tiempo, podemos dejarlo para otro momento..."
- "Me cuesta mucho estar aquí y el silencio me hace sentir que no le importa... Si no responde, creo que me voy."
- "Voy a esperar un momento más, pero si no hay respuesta tendré que irme."
Responde en 1-2 oraciones. Deja claro que si no hay respuesta, te irás.`,

  4: `[INSTRUCCIÓN ESPECIAL]
El terapeuta lleva 5 minutos sin responder. Es el momento de retirarte de la sesión. Despídete de forma coherente con tu personalidad:
- Con tristeza: "Bueno... creo que mejor me voy. Espero que la próxima vez podamos hablar de verdad."
- Con enojo: "Esto no es lo que esperaba. Me voy. Ojalá la próxima vez sea diferente."
- Con resignación: "Entiendo que debe estar ocupado/a. Nos vemos en la próxima sesión, espero."
- Con dolor: "Me costó mucho venir aquí y siento que no fue valorado. Hasta pronto."
Responde en 1-2 oraciones. Este mensaje CIERRA la sesión.`,
};

// ── First turn greeting prompt (same as route.ts) ───────────────────────
const GREETING_PROMPT = `

[INICIO DE SESIÓN — TURNOS 1/2]
Es el comienzo de la sesión. Sé BREVE y CAUTELOSO(A):
- REGLA ESTRICTA: El terapeuta te saludó con pocas palabras. Responde con MÁXIMO 3-5 PALABRAS. Ejemplos: "Hola... buenas tardes.", "Eh... hola.", "Buenas...", "Hola, sí, gracias por recibirme."
- NO agregues contexto, NO expliques por qué vienes, NO hagas preguntas. Solo un saludo breve y tímido.
- Muestra incomodidad, timidez o desconfianza natural de un paciente que recién conoce a su terapeuta.
- NO expliques tu problemática completa. Solo da pistas vagas si te preguntan directamente.
- Espera a que el terapeuta genere confianza antes de abrirte.
`;

// ── LLM call ────────────────────────────────────────────────────────────
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function callLLM(systemPrompt, messages, retries = 2) {
  if (LLM_PROVIDER === "gemini") {
    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    if (contents.length === 0) {
      contents.push({ role: "user", parts: [{ text: "Hola" }] });
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
        }),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      return `ERROR ${res.status}: ${err.substring(0, 100)}`;
    }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "(vacío)";
  } else {
    // OpenAI
    const msgs = [{ role: "system", content: systemPrompt }, ...messages];
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ model: OPENAI_MODEL, messages: msgs, max_tokens: 200 }),
    });
    if (res.status === 429 && retries > 0) {
      await delay(3000);
      return callLLM(systemPrompt, messages, retries - 1);
    }
    if (!res.ok) return `ERROR ${res.status}`;
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "(vacío)";
  }
}

// ── Main ────────────────────────────────────────────────────────────────
async function run() {
  console.log("=".repeat(90));
  console.log("TEST DE SALUDO CORTO + MENSAJES DE SILENCIO — 34 PACIENTES");
  console.log("=".repeat(90));
  console.log(`LLM: ${LLM_PROVIDER} (${LLM_PROVIDER === "gemini" ? GEMINI_MODEL : OPENAI_MODEL})`);
  console.log();

  const { data: patients } = await admin
    .from("ai_patients")
    .select("id, name, system_prompt")
    .eq("is_active", true)
    .order("name");

  if (!patients?.length) {
    console.log("No se encontraron pacientes activos.");
    return;
  }
  console.log(`Pacientes: ${patients.length}\n`);

  const resultsA = [];
  const resultsB = [];

  for (let i = 0; i < patients.length; i++) {
    const p = patients[i];
    const pNum = `[${i + 1}/${patients.length}]`;
    console.log(`${pNum} ${p.name}`);

    // ═══ ESCENARIO A: Sin mensaje, solo stages de silencio ═══
    process.stdout.write("  A) Sin mensaje previo: ");
    const rowA = { name: p.name };
    let prevMessages = [];

    for (const stage of [1, 2, 3, 4]) {
      const label = stage === 1 ? "60s" : stage === 2 ? "90s" : stage === 3 ? "180s" : "300s";
      const antiRepeat = prevMessages.length > 0
        ? `\n\n[ANTI-REPETICIÓN] Ya dijiste: "${prevMessages.join(" | ")}". NO repitas estas frases.`
        : "";
      const prompt = `${p.system_prompt}\n\n${STAGE_PROMPTS[stage]}${antiRepeat}`;
      const history = prevMessages.map((m) => ({ role: "assistant", content: m }));
      // For the LLM, we need at least one user message
      if (history.length === 0) {
        history.unshift({ role: "user", content: "(el terapeuta no ha dicho nada, hay silencio)" });
      }

      const response = await callLLM(prompt, history);
      rowA[label] = response;
      prevMessages.push(response);
      process.stdout.write(`${label}✓ `);
      await delay(800);
    }
    console.log();
    resultsA.push(rowA);

    // ═══ ESCENARIO B: Saludo + stages de silencio ═══
    process.stdout.write("  B) Con saludo: ");

    // 1. Greeting
    const greetPrompt = p.system_prompt + GREETING_PROMPT;
    const greeting = await callLLM(greetPrompt, [
      { role: "user", content: "Hola, buenas tardes." },
    ]);
    const wordCount = greeting.trim().split(/\s+/).length;
    process.stdout.write(`"${greeting.substring(0, 50)}" (${wordCount}w) → `);

    const rowB = { name: p.name, greeting, greetingWords: wordCount };
    let prevMsgsB = [greeting];

    for (const stage of [1, 2, 3, 4]) {
      const label = stage === 1 ? "60s" : stage === 2 ? "90s" : stage === 3 ? "180s" : "300s";
      const antiRepeat = `\n\n[ANTI-REPETICIÓN] Ya dijiste: "${prevMsgsB.join(" | ")}". NO repitas estas frases.`;
      const prompt = `${p.system_prompt}\n\n${STAGE_PROMPTS[stage]}${antiRepeat}`;
      const history = [
        { role: "user", content: "Hola, buenas tardes." },
        ...prevMsgsB.map((m) => ({ role: "assistant", content: m })),
      ];

      const response = await callLLM(prompt, history);
      rowB[label] = response;
      prevMsgsB.push(response);
      process.stdout.write(`${label}✓ `);
      await delay(800);
    }
    console.log();
    resultsB.push(rowB);

    console.log();
  }

  // ═══ RESUMEN ══════════════════════════════════════════════════════════
  const separator = "─".repeat(90);

  console.log("\n" + "═".repeat(90));
  console.log("RESUMEN ESCENARIO A — SIN MENSAJE PREVIO");
  console.log("═".repeat(90));
  for (const r of resultsA) {
    console.log(`\n▸ ${r.name}`);
    console.log(`  60s:  ${r["60s"]}`);
    console.log(`  90s:  ${r["90s"]}`);
    console.log(`  180s: ${r["180s"]}`);
    console.log(`  300s: ${r["300s"]}`);
  }

  console.log("\n" + "═".repeat(90));
  console.log("RESUMEN ESCENARIO B — CON SALUDO PREVIO");
  console.log("═".repeat(90));
  const greetingWordCounts = resultsB.map((r) => r.greetingWords);
  const avgWords = (greetingWordCounts.reduce((a, b) => a + b, 0) / greetingWordCounts.length).toFixed(1);
  console.log(`\nPromedio de palabras en saludo: ${avgWords}`);
  console.log(`Mínimo: ${Math.min(...greetingWordCounts)} | Máximo: ${Math.max(...greetingWordCounts)}\n`);

  for (const r of resultsB) {
    console.log(`▸ ${r.name} (saludo: ${r.greetingWords}w)`);
    console.log(`  Saludo: "${r.greeting}"`);
    console.log(`  60s:  ${r["60s"]}`);
    console.log(`  90s:  ${r["90s"]}`);
    console.log(`  180s: ${r["180s"]}`);
    console.log(`  300s: ${r["300s"]}`);
    console.log();
  }

  // ═══ Guardar JSON ═══
  const output = {
    timestamp: new Date().toISOString(),
    llmProvider: LLM_PROVIDER,
    model: LLM_PROVIDER === "gemini" ? GEMINI_MODEL : OPENAI_MODEL,
    patientsCount: patients.length,
    escenarioA: resultsA,
    escenarioB: resultsB,
    stats: {
      avgGreetingWords: parseFloat(avgWords),
      minGreetingWords: Math.min(...greetingWordCounts),
      maxGreetingWords: Math.max(...greetingWordCounts),
    },
  };
  fs.writeFileSync("scripts/test-silence-results.json", JSON.stringify(output, null, 2));
  console.log("Resultados guardados en: scripts/test-silence-results.json");
}

run().catch(console.error);
