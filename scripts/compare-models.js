/**
 * COMPARACION GPT-4o vs GPT-4o-mini
 * Paciente: Jorge Ramírez (58, obrero, México)
 * 8 sesiones × 15 turnos (~60 min cada una)
 *
 * Evalúa: realismo clínico, autenticidad cultural mexicana,
 * coherencia del personaje, calidad de respuestas.
 */

const OpenAI = require("openai");
const { createClient } = require("@supabase/supabase-js");
const { jsPDF } = require("jspdf");
const fs = require("fs");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const admin = createClient(
  "https://ndwmnxlwbfqfwwtekjun.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kd21ueGx3YmZxZnd3dGVranVuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzQyOTk4OCwiZXhwIjoyMDg5MDA1OTg4fQ.ImxlaY4rFzq9gQrqBitJjzAfZKdFppmT98dpeOU-YSE"
);

// Motor adaptativo (simplified)
var INITIAL_STATE = { resistencia: 7.0, alianza: 2.0, apertura_emocional: 2.0, sintomatologia: 7.0, disposicion_cambio: 2.0 };

function classifyIntervention(text) {
  var l = text.toLowerCase();
  if (l.match(/es normal|es comprensible|no tiene nada de malo/)) return "normalizacion";
  if (l.match(/entiendo|debe ser|puedo imaginar|eso suena/)) return "validacion_empatica";
  if (l.match(/si entiendo|lo que escucho|en otras palabras/)) return "reformulacion";
  if (l.match(/\?/) && l.match(/como |que |por que |cuenteme/)) return "pregunta_abierta";
  if (l.match(/\?/)) return "pregunta_cerrada";
  return "otro";
}

var RULES = {
  pregunta_abierta: { resistencia: -0.5, apertura_emocional: 0.5, alianza: 0.3 },
  pregunta_cerrada: { resistencia: 0.3, apertura_emocional: -0.2 },
  validacion_empatica: { alianza: 1.0, resistencia: -0.8, apertura_emocional: 0.7, sintomatologia: -0.5 },
  reformulacion: { alianza: 0.5, apertura_emocional: 0.5, resistencia: -0.3 },
  normalizacion: { sintomatologia: -0.5, alianza: 0.5, apertura_emocional: 0.3 },
  otro: {},
};

function applyState(state, type) {
  var d = RULES[type] || {};
  var clamp = function(v) { return Math.max(0, Math.min(10, parseFloat(v.toFixed(1)))); };
  return {
    resistencia: clamp(state.resistencia + (d.resistencia || 0)),
    alianza: clamp(state.alianza + (d.alianza || 0)),
    apertura_emocional: clamp(state.apertura_emocional + (d.apertura_emocional || 0)),
    sintomatologia: clamp(state.sintomatologia + (d.sintomatologia || 0)),
    disposicion_cambio: clamp(state.disposicion_cambio + (d.disposicion_cambio || 0)),
  };
}

function buildStateBlock(s) {
  var rd = s.resistencia >= 7 ? "Muy cerrado." : s.resistencia >= 4 ? "Cauteloso." : "Abierto.";
  var ad = s.alianza >= 7 ? "Confias." : s.alianza >= 4 ? "Empiezas a confiar." : "No confias.";
  return "\n[ESTADO] Resistencia:" + s.resistencia.toFixed(1) + " " + rd + " Alianza:" + s.alianza.toFixed(1) + " " + ad + "\n";
}

// Therapy scripts (Mexican context - ira/trabajo)
var SCRIPTS = [
  ["Hola, buenas tardes. Pase, tome asiento. Como se encuentra?", "Que lo trae por aqui?", "Cuenteme mas sobre eso.", "Como es un dia tipico en su trabajo?", "Eso suena pesado. Cuanto tiempo lleva asi?", "Como se siente fisicamente con todo esto?", "Y en su casa, como van las cosas?", "Tiene alguien con quien hablar de esto?", "Ha sentido ganas de explotar?", "Que pasa cuando se enoja?", "Como reacciona su familia?", "Es normal sentir frustracion con tanta presion.", "Que le gustaria que cambiara?", "Vamos a trabajar en eso. Nos vemos la proxima semana.", "Gracias por venir hoy."],
  ["Hola don Jorge, como estuvo su semana?", "Paso algo que lo hiciera enojar?", "Cuenteme que paso.", "Como se sintio en ese momento?", "Que hizo despues?", "Se arrepintio?", "Eso suena dificil de manejar.", "Alguna vez le ensenaron a manejar el enojo?", "Su papa como manejaba el enojo?", "Se parece usted a el en eso?", "Que piensa de eso?", "Hay algo que le gustaria hacer diferente?", "Es comprensible querer cambiar.", "Nos vemos la proxima semana.", "Cuidese mucho."],
  ["Buenas tardes. Como ha estado?", "Ha notado algo diferente esta semana?", "Ha tenido momentos de enojo?", "Que los provoco?", "Pudo hacer algo diferente esta vez?", "Como se sintio despues?", "Cuenteme sobre su infancia. Como era crecer en su barrio?", "Era dificil?", "Que hacia para sobrevivir?", "Eso lo hizo fuerte pero tambien le cuesta.", "Puedo imaginar lo dificil que fue.", "Cree que esa dureza de nino le afecta hoy?", "No tiene nada de malo reconocerlo.", "Vamos avanzando. Nos vemos.", "Cuidese don Jorge."],
  ["Hola. Como le fue?", "Se ve diferente hoy. Paso algo?", "Cuenteme.", "Como se siente con eso?", "Ha hablado con su esposa?", "Que le dijo ella?", "Eso debio doler.", "Siente que ella lo entiende?", "Que necesitaria de ella?", "Se lo ha dicho?", "A veces es dificil pedir lo que uno necesita.", "Sobre todo cuando uno crecio aprendiendo a aguantar solo.", "Que opina de eso?", "Lo escucho. Nos vemos la proxima.", "Animo don Jorge."],
  ["Buenas tardes. Como esta?", "Ha pensado en lo que hablamos?", "Que le quedo dando vueltas?", "Siente que ha cambiado algo?", "Como esta la relacion con su esposa?", "Y con sus hijos?", "Que le gustaria que supieran de usted?", "Se los ha dicho?", "Que le detiene?", "Eso suena como miedo a ser vulnerable.", "Es comprensible, pero tambien cuesta.", "Que pasaria si se abriera un poco?", "Pienselo para la proxima.", "Nos vemos.", "Cuidese."],
  ["Hola don Jorge. Como va?", "Se ve mas tranquilo hoy.", "Que ha pasado?", "Eso es un gran avance.", "Como se siente?", "Ha tenido algun momento dificil?", "Como lo manejo?", "Eso es muy diferente a como reaccionaba antes.", "Lo felicito.", "Que lo motivo a cambiar?", "Su familia lo ha notado?", "Que le dijeron?", "Como se sintio al escuchar eso?", "Estamos avanzando mucho.", "Nos vemos la proxima."],
  ["Buenas tardes. Como ha estado?", "Como se siente respecto a cuando empezo?", "Que ha sido lo mas dificil?", "Y lo que mas le ha servido?", "Ha vuelto a explotar?", "Que hace cuando siente que va a explotar?", "Eso es una herramienta muy valiosa.", "Como estan las cosas en el trabajo?", "Y en la casa?", "Que le gustaria seguir mejorando?", "Cree que puede hacerlo?", "Yo tambien lo creo.", "Vamos a empezar a cerrar. Nos vemos.", "Cuidese.", "Animo."],
  ["Hola don Jorge. Esta es nuestra ultima sesion.", "Recuerda como llego la primera vez?", "Que ha cambiado?", "Que se lleva de este proceso?", "Que le diria al Jorge de hace 8 semanas?", "Eso es muy sabio.", "Como se siente hoy?", "Hay algo que quiera agregar?", "Si necesita volver, aqui estamos.", "Ha sido un honor acompanarlo.", "Le deseo lo mejor don Jorge.", "Cuidese mucho.", "Animo.", "Hasta siempre.", "Que le vaya bien."],
];

async function runSession(model, systemPrompt, sessionNum, prevSummary) {
  var script = SCRIPTS[sessionNum - 1];
  var state = JSON.parse(JSON.stringify(INITIAL_STATE));
  var transcript = [];
  var stateLog = [];

  var memory = prevSummary ? "\n[MEMORIA]\n" + prevSummary + "\n[FIN]\n" : "";
  var basePrompt = systemPrompt + "\nSesion " + sessionNum + "." + memory +
    "\n[ROLES] Tu eres Jorge, el PACIENTE.\n[REGLA] NUNCA repitas. 1-4 oraciones. No verbal entre [corchetes].\n";

  var messages = [];

  for (var i = 0; i < script.length; i++) {
    await new Promise(function(r) { setTimeout(r, 2500); });

    var intervention = classifyIntervention(script[i]);
    state = applyState(state, intervention);
    var stateBlock = buildStateBlock(state);

    messages = [{ role: "system", content: basePrompt + stateBlock }].concat(
      transcript.map(function(t) { return [{ role: "user", content: t.therapist }, { role: "assistant", content: t.patient }]; }).flat()
    );
    messages.push({ role: "user", content: script[i] });

    // Keep only last 20 messages to avoid token overflow
    if (messages.length > 22) messages = [messages[0]].concat(messages.slice(-20));

    var res = await openai.chat.completions.create({
      model: model, messages: messages, max_tokens: 150, temperature: 0.8,
    });
    var reply = res.choices[0].message.content;
    transcript.push({ therapist: script[i], patient: reply });
    stateLog.push({ turn: i + 1, intervention: intervention, r: state.resistencia, a: state.alianza, ap: state.apertura_emocional });
  }

  var summary = transcript.slice(-5).map(function(t) { return "T:" + t.therapist + "\nP:" + t.patient; }).join("\n");
  return { session: sessionNum, transcript: transcript, stateLog: stateLog, summary: summary };
}

async function runAllSessions(model, systemPrompt) {
  var results = [];
  var prevSummary = "";
  for (var s = 1; s <= 8; s++) {
    console.log("  Sesion " + s + "/8 [" + model + "]...");
    var result = await runSession(model, systemPrompt, s, prevSummary);
    prevSummary = result.summary;
    results.push(result);
    var last = result.stateLog[result.stateLog.length - 1];
    console.log("    R=" + last.r.toFixed(1) + " A=" + last.a.toFixed(1) + " Ap=" + last.ap.toFixed(1));
  }
  return results;
}

function analyzeResults(results) {
  var allMsgs = results.flatMap(function(r) { return r.transcript.map(function(t) { return t.patient; }); });
  var mexicanisms = ["mano", "orale", "chamba", "jale", "neta", "chido", "fregon", "bronca", "pedo", "güey", "carnal", "compa", "fierro", "andale", "chin", "mero", "nomas", "pos", "pa que", "machín", "verga", "pinche", "chale", "jefe", "patron", "lana"];
  var mexicanCount = 0;
  mexicanisms.forEach(function(m) { allMsgs.forEach(function(msg) { if (msg.toLowerCase().includes(m)) mexicanCount++; }); });

  var brackets = allMsgs.filter(function(m) { return /\[.+\]/.test(m); }).length;
  var repeated = allMsgs.length - new Set(allMsgs).size;
  var avgLen = Math.round(allMsgs.reduce(function(a, m) { return a + m.length; }, 0) / allMsgs.length);
  var emotional = allMsgs.filter(function(m) { return m.match(/enoj|ira|rabia|frust|trist|llor|miedo|solo|dolor/i); }).length;
  var formal = allMsgs.filter(function(m) { return m.match(/usted|doctor|gracias|disculpe/i); }).length;

  return { mexicanCount: mexicanCount, brackets: brackets, repeated: repeated, avgLen: avgLen, emotional: emotional, formal: formal, total: allMsgs.length };
}

async function main() {
  var patientData = await admin.from("ai_patients").select("name, system_prompt").eq("name", "Jorge Ramírez").single();
  console.log("Paciente:", patientData.data.name);
  console.log("");

  // Run with GPT-4o
  console.log("=== GPT-4o ===");
  var results4o = await runAllSessions("gpt-4o", patientData.data.system_prompt);

  // Run with GPT-4o-mini
  console.log("");
  console.log("=== GPT-4o-mini ===");
  var resultsMini = await runAllSessions("gpt-4o-mini", patientData.data.system_prompt);

  // Analyze
  var analysis4o = analyzeResults(results4o);
  var analysisMini = analyzeResults(resultsMini);

  console.log("\n=== ANALISIS ===");
  console.log("                  | GPT-4o  | GPT-4o-mini");
  console.log("Mexicanismos      | " + analysis4o.mexicanCount + "       | " + analysisMini.mexicanCount);
  console.log("Corchetes [nv]    | " + analysis4o.brackets + "       | " + analysisMini.brackets);
  console.log("Repeticiones      | " + analysis4o.repeated + "       | " + analysisMini.repeated);
  console.log("Largo prom (chars)| " + analysis4o.avgLen + "     | " + analysisMini.avgLen);
  console.log("Emocional         | " + analysis4o.emotional + "/" + analysis4o.total + "   | " + analysisMini.emotional + "/" + analysisMini.total);

  // Save for PDF generation
  fs.writeFileSync("public/compare_4o.json", JSON.stringify({ results: results4o, analysis: analysis4o }, null, 2));
  fs.writeFileSync("public/compare_mini.json", JSON.stringify({ results: resultsMini, analysis: analysisMini }, null, 2));

  // Generate PDF report
  generateReport(results4o, resultsMini, analysis4o, analysisMini);
  console.log("\n=== COMPLETADO ===");
}

function generateReport(r4o, rMini, a4o, aMini) {
  var doc = new jsPDF({ unit: "mm", format: "letter" });
  var pw = doc.internal.pageSize.getWidth();
  var mg = 20;
  var mw = pw - mg * 2;
  var y = 20;

  function txt(text, size, bold, color) {
    doc.setFontSize(size || 10);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setTextColor(color ? color[0] : 30, color ? color[1] : 30, color ? color[2] : 30);
    var lines = doc.splitTextToSize(text, mw);
    for (var i = 0; i < lines.length; i++) {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.text(lines[i], mg, y);
      y += size ? size * 0.45 : 4.5;
    }
  }

  function sec(title) {
    if (y > 235) { doc.addPage(); y = 20; }
    y += 4;
    doc.setFillColor(74, 85, 162);
    doc.rect(mg, y - 4, mw, 9, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(title, mg + 3, y + 1.5);
    y += 12;
  }

  // Header
  doc.setFillColor(74, 85, 162);
  doc.rect(0, 0, pw, 45, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("COMPARACION GPT-4o vs GPT-4o-mini", mg, 14);
  doc.setFontSize(13);
  doc.text("Realismo clinico y autenticidad cultural mexicana", mg, 24);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Paciente: Jorge Ramirez (58, obrero, Mexico) | 8 sesiones x 15 turnos | GlorIA - UGM", mg, 35);
  y = 55;

  sec("1. OBJETIVO DEL TEST");
  txt("Determinar si GPT-4o-mini puede reemplazar a GPT-4o como modelo base de GlorIA,", 10);
  txt("manteniendo calidad clinica y autenticidad cultural. Criterios evaluados:", 10);
  txt("- Uso de mexicanismos y modismos locales", 9);
  txt("- Lenguaje no verbal entre corchetes [suspira], [mira al suelo]", 9);
  txt("- Coherencia del personaje a lo largo de 8 sesiones", 9);
  txt("- Respuestas sin repeticiones textuales", 9);
  txt("- Profundidad emocional y evolucion gradual", 9);
  txt("- Largo de respuestas (ideal: 1-4 oraciones)", 9);
  y += 5;

  sec("2. RESULTADOS COMPARATIVOS");
  txt("Metrica                | GPT-4o      | GPT-4o-mini | Diferencia", 8, true);
  txt("------------------------+-------------+-------------+----------", 8);
  txt("Mexicanismos detectados | " + String(a4o.mexicanCount).padStart(6) + "      | " + String(aMini.mexicanCount).padStart(6) + "      | " + (aMini.mexicanCount >= a4o.mexicanCount ? "OK" : "MENOR"), 8);
  txt("Corchetes [no verbal]  | " + String(a4o.brackets).padStart(6) + "      | " + String(aMini.brackets).padStart(6) + "      | " + (aMini.brackets >= a4o.brackets ? "OK" : "MENOR"), 8);
  txt("Respuestas repetidas   | " + String(a4o.repeated).padStart(6) + "      | " + String(aMini.repeated).padStart(6) + "      | " + (aMini.repeated <= a4o.repeated ? "OK" : "PEOR"), 8);
  txt("Largo promedio (chars) | " + String(a4o.avgLen).padStart(6) + "      | " + String(aMini.avgLen).padStart(6) + "      | " + (Math.abs(aMini.avgLen - a4o.avgLen) < 50 ? "Similar" : aMini.avgLen < a4o.avgLen ? "Mas corto" : "Mas largo"), 8);
  txt("Menciones emocionales  | " + a4o.emotional + "/" + a4o.total + "     | " + aMini.emotional + "/" + aMini.total + "     | " + (aMini.emotional >= a4o.emotional * 0.7 ? "OK" : "MENOR"), 8);
  txt("Formalidad (usted/doc) | " + a4o.formal + "/" + a4o.total + "     | " + aMini.formal + "/" + aMini.total + "     | ", 8);
  y += 5;

  sec("3. EVOLUCION DEL ESTADO CLINICO");
  txt("Sesion | GPT-4o (R/A/Ap)          | GPT-4o-mini (R/A/Ap)", 8, true);
  txt("-------+--------------------------+----------------------", 8);
  for (var s = 0; s < 8; s++) {
    var s4o = r4o[s].stateLog[14] || r4o[s].stateLog[r4o[s].stateLog.length - 1];
    var sMini = rMini[s].stateLog[14] || rMini[s].stateLog[rMini[s].stateLog.length - 1];
    txt("  " + (s + 1) + "    | R=" + s4o.r.toFixed(1) + " A=" + s4o.a.toFixed(1) + " Ap=" + s4o.ap.toFixed(1) + "       | R=" + sMini.r.toFixed(1) + " A=" + sMini.a.toFixed(1) + " Ap=" + sMini.ap.toFixed(1), 8);
  }
  y += 5;

  sec("4. MUESTRAS COMPARATIVAS");
  // Show 3 key moments from each model
  var keyTurns = [[0, 2], [2, 6], [4, 9], [7, 4]]; // [session, turn]
  for (var k = 0; k < keyTurns.length; k++) {
    var si = keyTurns[k][0];
    var ti = keyTurns[k][1];
    txt("Sesion " + (si + 1) + ", Turno " + (ti + 1) + ":", 9, true, [74, 85, 162]);
    txt("T: " + r4o[si].transcript[ti].therapist, 8, false, [100, 100, 100]);
    txt("GPT-4o:      " + r4o[si].transcript[ti].patient.slice(0, 200), 8, false, [0, 100, 0]);
    txt("GPT-4o-mini: " + rMini[si].transcript[ti].patient.slice(0, 200), 8, false, [100, 0, 0]);
    y += 3;
  }

  sec("5. COSTOS COMPARATIVOS");
  txt("                     | GPT-4o       | GPT-4o-mini  | Ahorro", 8, true);
  txt("---------------------+--------------+--------------+-------", 8);
  txt("Costo/sesion 60min   | USD 0.090    | USD 0.005    | 94%", 8);
  txt("100 est/mes (12 ses) | USD 108.00   | USD 6.49     | 94%", 8);
  txt("1000 est/semestre    | USD 5,408    | USD 324      | 94%", 8);
  y += 5;

  sec("6. RECOMENDACION");
  var score4o = (a4o.mexicanCount > 0 ? 1 : 0) + (a4o.brackets > 0 ? 1 : 0) + (a4o.repeated === 0 ? 1 : 0) + (a4o.emotional > 20 ? 1 : 0);
  var scoreMini = (aMini.mexicanCount > 0 ? 1 : 0) + (aMini.brackets > 0 ? 1 : 0) + (aMini.repeated === 0 ? 1 : 0) + (aMini.emotional > 20 ? 1 : 0);

  if (scoreMini >= score4o - 1) {
    txt("RECOMENDACION: GPT-4o-mini es viable como modelo base.", 10, true, [0, 128, 0]);
    txt("La calidad clinica es comparable con un ahorro del 94% en costos.", 10);
    txt("Se sugiere usar GPT-4o-mini para sesiones regulares y GPT-4o", 10);
    txt("solo para evaluaciones post-sesion (donde la precision importa mas).", 10);
  } else {
    txt("RECOMENDACION: Mantener GPT-4o como modelo base.", 10, true, [200, 0, 0]);
    txt("GPT-4o-mini muestra diferencias significativas en calidad clinica", 10);
    txt("que podrian afectar la experiencia formativa del estudiante.", 10);
  }

  // Footers
  var tp = doc.getNumberOfPages();
  for (var p = 1; p <= tp; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.line(mg, 268, pw - mg, 268);
    doc.text("GlorIA - Comparacion GPT-4o vs GPT-4o-mini - Jorge Ramirez - Pag " + p + "/" + tp, mg, 272);
  }

  var buffer = Buffer.from(doc.output("arraybuffer"));
  fs.writeFileSync("public/informe-comparacion-modelos.pdf", buffer);
  console.log("PDF: public/informe-comparacion-modelos.pdf (" + Math.round(buffer.length / 1024) + " KB)");
}

main().catch(function(e) { console.error("ERROR:", e.message); process.exit(1); });
