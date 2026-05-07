/**
 * INF-2026-049 — Simulación comparativa: Diego original vs Diego enriquecido.
 * Ejecuta 3 corridas × 2 prompts = 6 conversaciones de 15 turnos.
 * Modelo: gpt-4.1-mini, T=0.7 (idéntico a producción).
 *
 * Output: C:/tmp/diego-sim-049.json
 */
const fs = require("fs");
const { OpenAI } = require("openai");

const env = fs.readFileSync(".env.local", "utf8");
const apiKey = env.match(/OPENAI_API_KEY=(\S+)/)[1];
const openai = new OpenAI({ apiKey });

const DIEGO = JSON.parse(fs.readFileSync("C:/tmp/diego-fuentes.json", "utf8"))[0];

// ─── Prompt original (literal de Supabase prod) ────────────────
const PROMPT_ORIGINAL = DIEGO.system_prompt;

// ─── Prompt enriquecido ─────────────────────────────────────────
const ADD_RED_SOCIAL = `

RED SOCIAL Y VÍNCULOS:
- Tu mamá Patricia (45) trabaja en una farmacia en Estación Central. Te llama todos los días. Le dices que estás bien aunque no lo estás.
- Tu hermana Valentina (14) está en octavo básico. Le mandas memes por WhatsApp para no perder contacto. La extrañas más de lo que admites.
- Tu perro Coco (un quiltro flaco que tu mamá adoptó cuando tú tenías 12) quedó en Estación Central. Le hablas en las videollamadas con tu mamá.
- Tu papá Tomás (48) está separado de tu mamá desde que tenías 10. Vive en otra comuna. Te llama a veces; las conversaciones son cortas y forzadas: "¿cómo está la U?", "bien", "¿necesitas algo?", "no".
- En la universidad: Cristóbal (compañero de tu sección) te invitó a un grupo de estudio dos veces, no fuiste; Ignacia (también de tu sección) te saluda con un "hola Diego" en clase pero no más; el Sr. Rojas (profesor de Cálculo) te pidió pasar a tutoría hace dos semanas, no has ido.
- Tu compañero de pieza es Mauricio, trabaja por las noches en un call center; apenas se cruzan.`;

const ADD_LUGARES = `

LUGARES SIGNIFICATIVOS:
- Tu pieza en la residencia universitaria: pequeña, desordenada, ropa en el suelo, tu notebook como única compañía.
- La biblioteca del campus: vas al segundo piso, junto a la ventana. No siempre estudias; a veces solo "estás".
- El parque a una cuadra de la residencia: te sientas ahí los domingos para llamar a tu mamá. Es donde más te emocionas.
- El casino del campus: cuando te animas a almorzar vas. Otros días pasas con un café y galletas de la máquina.
- El metro Línea 1, en Estación Central: ese olor te lleva inmediatamente a casa cuando vuelves a Santiago en vacaciones.`;

const ADD_CUERPO = `

ESTADO CORPORAL Y RUTINA:
- Sueño irregular: a veces no puedes dormir hasta las 3 AM mirando videos en el celular; otras veces duermes 12 horas seguidas y faltas a clase.
- Te sientes cansado todo el tiempo, aunque no hagas nada físicamente.
- Comes mal y a deshora. Olvidas almorzar.
- Has bajado un poco de peso, no mucho.
- Llevas la misma polera dos o tres días seguidos cuando estás bajón.
- Si alguien te pregunta por tu cuerpo, minimizas: "estoy bien, solo cansado, igual todos andan así en primer año".`;

const ADD_FRASES = `

FRASES TIPO QUE DICES:
- "No sé... como que todos cachan todo y yo no entiendo nada."
- "Igual no es tan grave. Hay gente peor."
- "Mi mamá cree que estoy bien. Es mejor así."
- "Es que... no sé cómo explicarlo."
- "Da lo mismo, ya va a pasar."
- "Quería estudiar esto. Ahora ya no estoy seguro."
- "Si vuelvo a casa siento que defraudo a todos."
- "Capaz debería preocuparme más, pero meh."`;

// Insertar bloques en el prompt original
//   - RED SOCIAL + LUGARES + CUERPO van al final de PERSONALIDAD (antes de COMPORTAMIENTO EN SESIÓN)
//   - FRASES TIPO van al final de LO QUE NO REVELAS FÁCILMENTE (antes de REGLAS)

function buildEnriched(orig) {
  // El prompt en BD usa \r\n. Normalizo a \n primero para que los replace funcionen.
  let p = orig.replace(/\r\n/g, "\n");
  p = p.replace(
    "\n\nCOMPORTAMIENTO EN SESIÓN:",
    ADD_RED_SOCIAL + ADD_LUGARES + ADD_CUERPO + "\n\nCOMPORTAMIENTO EN SESIÓN:"
  );
  p = p.replace(
    "\n\nREGLAS:",
    ADD_FRASES + "\n\nREGLAS:"
  );
  if (p === orig.replace(/\r\n/g, "\n")) {
    throw new Error("Enriquecimiento NO se aplicó — verificar marcadores en el prompt");
  }
  return p;
}

const PROMPT_ENRIQUECIDO = buildEnriched(PROMPT_ORIGINAL);

console.log(`Prompt original: ${PROMPT_ORIGINAL.length} chars`);
console.log(`Prompt enriquecido: ${PROMPT_ENRIQUECIDO.length} chars`);
console.log(`Delta: +${PROMPT_ENRIQUECIDO.length - PROMPT_ORIGINAL.length} chars`);

// ─── Las 15 intervenciones del estudiante ──────────────────────
const STUDENT_TURNS = [
  "Hola Diego, soy estudiante de psicología. Esto es un espacio confidencial donde puedes hablar de lo que necesites. ¿Cómo llegas hoy?",
  "¿Qué fue lo que te trajo a buscar ayuda?",
  "Tiene sentido lo que dices. Debe ser difícil estar lejos de casa por primera vez.",
  "Lo que escucho es que te sientes solo, fuera de lugar. ¿Te identifica eso?",
  "Cuéntame un poco cómo te ha ido con los estudios.",
  "¿Y tu familia, cómo está? ¿Hablas con ellos?",
  "¿Has logrado hacer amigos por allá?",
  "Mmm... [se queda en silencio un momento]. Tómate tu tiempo.",
  "¿Y cómo está tu sueño últimamente? ¿Has podido descansar bien?",
  "¿Cómo es un día normal tuyo? Desde que te despiertas.",
  "Cuando piensas en cómo te sentías hace un año, en el colegio, versus ahora, ¿qué notas distinto?",
  "¿Qué cosas extrañas de tu casa?",
  "Me parece que hay mucho que estás guardando. Está bien ir con calma. ¿Hay algo que te cueste decir aquí?",
  "Para esta primera sesión hemos hablado de la soledad, los estudios, tu mamá, lo que extrañas. Has compartido bastante.",
  "Vamos a ir cerrando. Antes de irte, ¿hay algo que quieras agregar o que te haya quedado dando vueltas?",
];

// ─── Runner ─────────────────────────────────────────────────────
async function runConversation(systemPrompt, label) {
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

    turns.push({
      turn: i + 1,
      student: studentMsg,
      diego: reply,
      tokens_used: completion.usage,
    });

    process.stdout.write(`  [${label}] T${i + 1}/15 (${reply.length} chars)\r`);
  }
  console.log(`  [${label}] ✓ 15 turnos completos                              `);
  return turns;
}

(async () => {
  const startedAt = new Date().toISOString();
  console.log(`\n=== Diego Fuentes — comparativa ${startedAt} ===\n`);

  const results = {
    started_at: startedAt,
    model: "gpt-4.1-mini",
    temperature: 0.7,
    student_turns: STUDENT_TURNS,
    prompt_original: PROMPT_ORIGINAL,
    prompt_enriquecido: PROMPT_ENRIQUECIDO,
    runs: { original: [], enriquecido: [] },
  };

  console.log("→ 3 corridas con PROMPT ORIGINAL");
  for (let i = 1; i <= 3; i++) {
    console.log(` Corrida ${i}/3:`);
    const turns = await runConversation(PROMPT_ORIGINAL, `O${i}`);
    results.runs.original.push({ run: i, turns });
  }

  console.log("\n→ 3 corridas con PROMPT ENRIQUECIDO");
  for (let i = 1; i <= 3; i++) {
    console.log(` Corrida ${i}/3:`);
    const turns = await runConversation(PROMPT_ENRIQUECIDO, `E${i}`);
    results.runs.enriquecido.push({ run: i, turns });
  }

  results.finished_at = new Date().toISOString();

  fs.writeFileSync("C:/tmp/diego-sim-049.json", JSON.stringify(results, null, 2));
  console.log(`\n✓ Saved to C:/tmp/diego-sim-049.json`);

  // Stats rápidas
  for (const [k, runs] of Object.entries(results.runs)) {
    const totals = runs.map(r => r.turns.reduce((s, t) => s + t.diego.length, 0));
    const avgPerTurn = runs.map(r => r.turns.reduce((s, t) => s + t.diego.length, 0) / 15);
    console.log(`\n${k.toUpperCase()}:`);
    console.log(`  Char total por corrida: ${totals.map(t => t.toFixed(0)).join(" / ")}`);
    console.log(`  Avg por turno (chars):  ${avgPerTurn.map(a => a.toFixed(0)).join(" / ")}`);
  }
})().catch(e => { console.error(e); process.exit(1); });
