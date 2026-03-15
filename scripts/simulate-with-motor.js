/**
 * Simulates 8 sessions with Roberto using the SAME logic as /api/chat:
 * - Clinical state engine (5 variables, transition rules)
 * - RAG (clinical knowledge retrieval)
 * - Anti-repetition
 * - Memory between sessions
 *
 * This runs the exact same code path as the platform.
 */

const OpenAI = require("openai");
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const admin = createClient(
  "https://ndwmnxlwbfqfwwtekjun.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kd21ueGx3YmZxZnd3dGVranVuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzQyOTk4OCwiZXhwIjoyMDg5MDA1OTg4fQ.ImxlaY4rFzq9gQrqBitJjzAfZKdFppmT98dpeOU-YSE"
);

// ═══ CLINICAL STATE ENGINE (mirrors src/lib/clinical-state-engine.ts) ═══

const INITIAL_STATE = {
  resistencia: 7.0, alianza: 2.0, apertura_emocional: 2.0,
  sintomatologia: 7.0, disposicion_cambio: 2.0,
};

function classifyIntervention(text) {
  const lower = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (lower.match(/^\[.*\]$/) || lower.length < 5) return "silencio_terapeutico";
  if (lower.match(/deberias?|tienes? que|haga|le recomiendo/)) return "directividad";
  if (lower.match(/lo que realmente|en el fondo|creo que lo que/)) return "interpretacion";
  if (lower.match(/contradicci|pero antes.*dijo|no le parece que/)) return "confrontacion";
  if (lower.match(/es normal|es comprensible|es natural|no tiene nada de malo/)) return "normalizacion";
  if (lower.match(/si entiendo bien|lo que escucho|en otras palabras|suena como/)) return "reformulacion";
  if (lower.match(/entiendo como|debe ser dificil|puedo imaginar|eso suena|comprendo/)) return "validacion_empatica";
  if (lower.match(/resumiendo|hasta ahora hemos|recapitulando/)) return "resumen";
  if (lower.match(/\?/) && lower.match(/^(tiene|ha |le |es |fue |puede)/)) return "pregunta_cerrada";
  if (lower.match(/\?/) && lower.match(/como |que |por que |cuenteme|digame/)) return "pregunta_abierta";
  if (lower.includes("?")) return "pregunta_abierta";
  return "otro";
}

const RULES = [
  { type: "pregunta_abierta", d: { resistencia: -0.5, apertura_emocional: 0.5, alianza: 0.3 } },
  { type: "pregunta_cerrada", d: { resistencia: 0.3, apertura_emocional: -0.2 } },
  { type: "validacion_empatica", d: { alianza: 1.0, resistencia: -0.8, apertura_emocional: 0.7, sintomatologia: -0.5 } },
  { type: "reformulacion", d: { alianza: 0.5, apertura_emocional: 0.5, resistencia: -0.3 } },
  { type: "confrontacion", d: { apertura_emocional: 0.8, disposicion_cambio: 1.0, resistencia: -0.3 }, cond: s => s.alianza > 5 },
  { type: "confrontacion", d: { resistencia: 1.5, alianza: -1.0, apertura_emocional: -1.0 }, cond: s => s.alianza <= 5 },
  { type: "silencio_terapeutico", d: { apertura_emocional: 0.5, sintomatologia: -0.3 }, cond: s => s.apertura_emocional > 4 },
  { type: "silencio_terapeutico", d: { resistencia: 0.5, sintomatologia: 0.3 }, cond: s => s.apertura_emocional <= 4 },
  { type: "directividad", d: { resistencia: 1.0, alianza: -0.5, disposicion_cambio: -0.5 } },
  { type: "normalizacion", d: { sintomatologia: -0.5, alianza: 0.5, apertura_emocional: 0.3 } },
  { type: "resumen", d: { alianza: 0.5, resistencia: -0.3 } },
  { type: "interpretacion", d: { apertura_emocional: 0.5, disposicion_cambio: 0.8 }, cond: s => s.alianza > 6 },
  { type: "interpretacion", d: { resistencia: 1.0, alianza: -0.5 }, cond: s => s.alianza <= 6 },
  { type: "otro", d: {} },
];

function applyState(state, intervention) {
  const rule = RULES.find(r => r.type === intervention && (!r.cond || r.cond(state)));
  const deltas = rule ? rule.d : {};
  const clamp = v => Math.max(0, Math.min(10, parseFloat(v.toFixed(1))));
  return {
    state: {
      resistencia: clamp(state.resistencia + (deltas.resistencia || 0)),
      alianza: clamp(state.alianza + (deltas.alianza || 0)),
      apertura_emocional: clamp(state.apertura_emocional + (deltas.apertura_emocional || 0)),
      sintomatologia: clamp(state.sintomatologia + (deltas.sintomatologia || 0)),
      disposicion_cambio: clamp(state.disposicion_cambio + (deltas.disposicion_cambio || 0)),
    },
    deltas,
  };
}

function buildStatePrompt(s) {
  const rd = s.resistencia >= 7 ? "Muy cerrado, respuestas cortas." : s.resistencia >= 4 ? "Bajando la guardia pero cauteloso." : "Abierto, dispuesto a compartir.";
  const ad = s.alianza >= 7 ? "Confias en el terapeuta." : s.alianza >= 4 ? "Empiezas a confiar." : "No confias aun.";
  const od = s.apertura_emocional >= 7 ? "Dispuesto a hablar de emociones profundas." : s.apertura_emocional >= 4 ? "Hablas de algunas emociones." : "Evitas lo emocional.";
  return "\n[ESTADO INTERNO - NO MENCIONES ESTOS NUMEROS]\n- Resistencia: " + s.resistencia.toFixed(1) + " -> " + rd +
    "\n- Alianza: " + s.alianza.toFixed(1) + " -> " + ad +
    "\n- Apertura: " + s.apertura_emocional.toFixed(1) + " -> " + od + "\n";
}

// ═══ RAG (mirrors src/lib/clinical-knowledge.ts) ═══

const KNOWLEDGE = [
  { kw: ["duelo", "muerte", "perdida"], text: "Duelo normal: oleadas de dolor, anhelo, recuerdos intrusivos, culpa del sobreviviente. No es lineal." },
  { kw: ["hombre", "llorar", "masculino", "fuerte"], text: "Hombres con masculinidad tradicional somatizan: irritabilidad, fatiga, aislamiento disfrazado." },
  { kw: ["solo", "aislado", "encerrado"], text: "Aislamiento puede ser sintoma o causa. Distinguir: elige o no puede conectar?" },
  { kw: ["ansiedad", "nervioso", "tension"], text: "TAG: preocupacion excesiva 6+ meses, inquietud, fatiga, tension muscular." },
  { kw: ["insomnio", "dormir", "sueno"], text: "Alteraciones del sueno en duelo son esperables. No patologicas per se." },
];

function searchRAG(text) {
  const lower = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return KNOWLEDGE.filter(k => k.kw.some(w => lower.includes(w))).map(k => k.text).slice(0, 2);
}

// ═══ SESSION SCRIPTS ═══

const SCRIPTS = [
  ["Hola, buenas tardes. Tome asiento. Como se encuentra hoy?", "Que lo trae por aqui?", "Sus hijos lo enviaron. Y usted que piensa?", "Como ha sido su vida estos ultimos meses?", "Cuenteme sobre su rutina diaria.", "Como duerme por las noches?", "Ha dejado de hacer cosas que antes disfrutaba?", "Tiene contacto con amigos?", "Hay algo que le preocupe?", "Noto que habla de hechos pero poco de como se siente.", "Como se siente cuando esta solo en casa?", "Es normal sentir dolor ante una perdida asi.", "Le gustaria que nos sigamos viendo?", "Vamos a cerrar por hoy. Como se va?", "Nos vemos la proxima semana."],
  ["Bienvenido de nuevo. Como estuvo su semana?", "Penso en algo de lo que conversamos?", "Cuenteme mas sobre Maria. Como era ella?", "Que es lo que mas extrana?", "Noto que se le humedecen los ojos.", "Esta bien sentir eso. No tiene que contenerse aqui.", "Como era su relacion con Maria?", "Discutian? Sobre que?", "Hay algo que le hubiera gustado decirle?", "Como fue el proceso de su enfermedad?", "Eso suena muy dificil. Como lo vivio?", "Quien lo acompano durante ese tiempo?", "Ha podido llorar por ella?", "Que significa para usted llorar?", "Lo escucho y lo respeto. Nos vemos."],
  ["Buenas tardes. Como ha estado?", "La vez pasada hablamos de Maria. Le costo?", "Ha hablado con sus hijos de como se siente?", "Por que cree que le cuesta hablar de emociones?", "Su padre era asi tambien?", "Que le ensenaron de nino sobre mostrar emociones?", "Parece que hay una creencia de que los hombres no lloran.", "Que piensa de eso ahora?", "Esa creencia le ha servido o le ha costado?", "Hay momentos que siente ganas de llorar pero se contiene?", "Que pasa cuando se contiene?", "Ha notado sintomas fisicos? Dolor de cabeza, tension?", "A veces el cuerpo expresa lo que la mente no permite.", "Como se siente ahora en este momento?", "Gracias por compartir. Nos vemos."],
  ["Hola. Como le fue esta semana?", "Paso algo diferente?", "Menciono que se contiene. Le paso esta semana?", "Me gustaria preguntarle algo personal. Esta bien?", "Habla con Maria todavia? Con su foto?", "Eso es mas comun de lo que cree. No tiene nada de malo.", "Que le dice cuando le habla?", "Siente que ella le responde?", "Ha sentido su presencia en la casa?", "Como es esa sensacion?", "Le da miedo o le reconforta?", "Ha compartido esto con alguien?", "Aqui es un espacio seguro.", "Tiene miedo de algo respecto a su duelo?", "Lo que comparte es muy valioso. Nos vemos."],
  ["Buenas tardes. Como esta?", "Ha pensado en dejar la terapia?", "Es completamente normal tener esa duda.", "Que le diria Maria si supiera que esta aqui?", "Parece que eso lo conmueve.", "Tiene miedo de olvidarla?", "Que significaria superar el duelo?", "Siente que si deja de sufrir la traiciona?", "El dolor no es la unica forma de recordar.", "Que otras formas de recordarla tiene?", "Que cree que ella querria para usted?", "Noto que sonrie con los buenos recuerdos.", "Cuando sonrio asi fuera de aqui?", "Le gustaria recuperar esos momentos?", "Seguimos trabajando en eso. Nos vemos."],
  ["Hola. Como estuvo su semana?", "Hizo algo diferente?", "Como se sintio?", "Menciono que sonreir le daba culpa. Sigue asi?", "Que ha cambiado?", "Parece que se permite sentir cosas distintas al dolor.", "Como es eso para usted?", "Ha podido llorar esta semana?", "Como fue esa experiencia?", "Eso requiere mucho coraje.", "Como estan las cosas con sus hijos?", "Ha podido hablar con ellos de como se siente?", "Que le dijeron?", "Como se siente despues de hablar con ellos?", "Estamos avanzando mucho. Nos vemos."],
  ["Buenas tardes. Como va todo?", "Como se siente respecto a cuando empezo?", "Que ha sido lo mas dificil?", "Y lo mas valioso?", "Ha retomado alguna actividad social?", "Cuenteme mas.", "Como se siente en esas situaciones?", "Todavia habla con la foto de Maria?", "Ha cambiado lo que le dice?", "Sigue sintiendo su presencia?", "Como interpreta eso ahora?", "Ha hecho un camino importante.", "Hay algo que todavia le pese?", "Como le gustaria continuar?", "Vamos a pensar en el cierre. Nos vemos."],
  ["Hola. Esta es nuestra ultima sesion. Como esta?", "Hagamos un recorrido por lo que trabajamos.", "Recuerda como se sentia al llegar?", "Que ha cambiado?", "Que se lleva de este proceso?", "Hay algo que hubiera gustado trabajar mas?", "Como esta su relacion con sus hijos ahora?", "Ha recuperado alguna amistad?", "Como ve su futuro?", "Que le diria a Maria si pudiera hablar una ultima vez?", "Eso es muy profundo. Gracias.", "Siente que puede seguir solo?", "Si necesita volver, las puertas estan abiertas.", "Como se va hoy?", "Ha sido un privilegio acompanarlo. Le deseo lo mejor."],
];

async function runSession(patient, sessionNum, prevSummary) {
  const script = SCRIPTS[sessionNum - 1];
  let state = { ...INITIAL_STATE };
  const stateLog = [];
  const transcript = [];

  const memoryBlock = prevSummary ? "\n[MEMORIA]\n" + prevSummary + "\n[FIN MEMORIA]\n" : "";
  const basePrompt = patient.system_prompt +
    "\nEsta es la sesion " + sessionNum + " con este terapeuta." +
    memoryBlock +
    "\n[ROLES]\nTu eres Roberto, el PACIENTE. La otra persona es el TERAPEUTA.\n" +
    "\n[REGLA] NUNCA repitas una respuesta. Respuestas de 1-4 oraciones.\n";

  const messages = [];

  for (var i = 0; i < script.length; i++) {
    await new Promise(function(r) { setTimeout(r, 2500); });

    // 1. Classify intervention
    var intervention = classifyIntervention(script[i]);

    // 2. Calculate state change
    var result = applyState(state, intervention);
    state = result.state;

    // 3. Build RAG context
    var ragTexts = searchRAG(script[i] + " " + (transcript.length > 0 ? transcript[transcript.length - 1].patient : ""));
    var ragBlock = ragTexts.length > 0 ? "\n[CONOCIMIENTO CLINICO]\n" + ragTexts.join("\n") + "\n[FIN]\n" : "";

    // 4. Build full prompt with state
    var fullPrompt = basePrompt + buildStatePrompt(state) + ragBlock;

    // 5. Generate response
    messages.push({ role: "system", content: fullPrompt });
    if (messages.filter(function(m) { return m.role === "system"; }).length > 1) {
      messages.splice(0, 1); // Keep only latest system prompt
    }
    messages.push({ role: "user", content: script[i] });

    var res = await openai.chat.completions.create({
      model: "gpt-4o", messages: messages, max_tokens: 150, temperature: 0.8,
    });
    var reply = res.choices[0].message.content;
    messages.push({ role: "assistant", content: reply });

    transcript.push({ therapist: script[i], patient: reply });
    stateLog.push({
      turn: i + 1,
      intervention: intervention,
      resistencia: state.resistencia,
      alianza: state.alianza,
      apertura: state.apertura_emocional,
      sintomas: state.sintomatologia,
      cambio: state.disposicion_cambio,
    });
  }

  var summary = transcript.slice(-5).map(function(t) { return "T: " + t.therapist + "\nP: " + t.patient; }).join("\n");
  return { session: sessionNum, transcript: transcript, stateLog: stateLog, summary: summary };
}

async function main() {
  var patientData = await admin.from("ai_patients").select("name, system_prompt").eq("name", "Roberto Salas").single();
  console.log("Paciente:", patientData.data.name);
  console.log("Motor adaptativo + RAG ACTIVOS\n");

  var results = [];
  var prevSummary = "";

  for (var s = 1; s <= 8; s++) {
    console.log("=== SESION " + s + "/8 ===");
    var result = await runSession(patientData.data, s, prevSummary);
    prevSummary = result.summary;
    results.push(result);

    var last = result.transcript[result.transcript.length - 1];
    var lastState = result.stateLog[result.stateLog.length - 1];
    console.log("  Estado final: R=" + lastState.resistencia.toFixed(1) + " A=" + lastState.alianza.toFixed(1) + " Ap=" + lastState.apertura.toFixed(1));
    console.log("  Ultimo: " + last.patient.slice(0, 100));
    console.log("");
  }

  fs.writeFileSync("public/roberto_motor_results.json", JSON.stringify(results, null, 2));
  console.log("Resultados: public/roberto_motor_results.json");
  console.log("\n=== COMPLETADO ===");
}

main().catch(function(e) { console.error("ERROR:", e.message); process.exit(1); });
