const { jsPDF } = require("jspdf");
const fs = require("fs");

const doc = new jsPDF({ unit: "mm", format: "letter" });
const pw = doc.internal.pageSize.getWidth();
const m = 20;
const mw = pw - m * 2;
let y = 20;

function addText(text, size, bold, color) {
  doc.setFontSize(size || 10);
  doc.setFont("helvetica", bold ? "bold" : "normal");
  doc.setTextColor(color ? color[0] : 30, color ? color[1] : 30, color ? color[2] : 30);
  const lines = doc.splitTextToSize(text, mw);
  for (const line of lines) {
    if (y > 260) { doc.addPage(); y = 20; }
    doc.text(line, m, y);
    y += size ? size * 0.45 : 4.5;
  }
}

function addSection(title) {
  if (y > 235) { doc.addPage(); y = 20; }
  y += 4;
  doc.setFillColor(74, 85, 162);
  doc.rect(m, y - 4, mw, 9, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(title, m + 3, y + 1.5);
  y += 12;
}

// HEADER
doc.setFillColor(74, 85, 162);
doc.rect(0, 0, pw, 45, "F");
doc.setTextColor(255, 255, 255);
doc.setFontSize(22);
doc.setFont("helvetica", "bold");
doc.text("MOTOR ADAPTATIVO DE ESTADO CLINICO", m, 16);
doc.setFontSize(13);
doc.text("Informe tecnico de implementacion", m, 25);
doc.setFontSize(9);
doc.setFont("helvetica", "normal");
doc.text("GlorIA - Universidad Gabriela Mistral | Fecha: 15 de marzo de 2026", m, 35);
y = 55;

// 1
addSection("1. QUE ES EL MOTOR ADAPTATIVO");
addText("El Motor Adaptativo de Estado Clinico es un sistema algoritmico que modela la evolucion interna del paciente virtual durante una sesion de terapia. En vez de que el paciente responda siempre desde un prompt estatico, ahora tiene 5 variables internas que cambian en tiempo real segun las intervenciones del estudiante.", 10);
y += 3;
addText("Esto convierte a GlorIA de un 'chatbot con personalidad' a un 'simulador clinico con evolucion causal verificable' - la diferencia clave que la propuesta ANID describe como resultado tecnologico principal.", 10);
y += 5;

// 2
addSection("2. COMO FUNCIONABA ANTES");
addText("El paciente tenia un system prompt estatico. El LLM intentaba adaptarse de forma implicita, pero no habia un sistema que midiera, registrara ni controlara como cambiaba el paciente.", 10);
y += 2;
addText("Flujo anterior:", 10, true);
addText("  Estudiante escribe -> Prompt estatico + historial -> LLM -> Respuesta", 9);
y += 2;
addText("Problema: Si el estudiante era empatico o agresivo, la diferencia dependia enteramente del LLM, sin garantias de consistencia ni trazabilidad.", 9);
y += 5;

addSection("3. COMO FUNCIONA AHORA");
addText("Cada mensaje pasa por un pipeline de 7 pasos:", 10, true);
y += 1;
addText("1. CLASIFICAR: Determinar tipo de intervencion (pregunta abierta, validacion, etc.)", 9);
addText("2. CARGAR ESTADO: Buscar ultimo estado del paciente en BD", 9);
addText("3. CALCULAR DELTAS: Cuanto cambia cada variable segun la intervencion", 9);
addText("4. APLICAR: Actualizar estado (clamp 0-10)", 9);
addText("5. INYECTAR: Traducir estado a instrucciones naturales para el LLM", 9);
addText("6. GENERAR: LLM responde condicionado por el estado actual", 9);
addText("7. REGISTRAR: Guardar todo en clinical_state_log (trazabilidad)", 9);
y += 5;

// 4
addSection("4. LAS 5 VARIABLES DE ESTADO");
const vars = [
  ["Resistencia (0-10)", "Que tan cerrado esta. Inicia en 7.0. Baja con empatia, sube con directividad."],
  ["Alianza terapeutica (0-10)", "Confianza con el terapeuta. Inicia en 2.0. Sube con validacion y escucha."],
  ["Apertura emocional (0-10)", "Disposicion a hablar de emociones. Inicia en 2.0. Sube gradualmente."],
  ["Sintomatologia (0-10)", "Intensidad de sintomas. Inicia en 7.0. Baja con contencion y normalizacion."],
  ["Disposicion al cambio (0-10)", "Motivacion para cambiar. Inicia en 2.0. Sube con insight y confrontacion oportuna."],
];
vars.forEach(function(v) {
  addText(v[0], 9, true);
  addText(v[1], 9);
  y += 1;
});
y += 3;

// 5
addSection("5. REGLAS DE TRANSICION");
addText("Cada tipo de intervencion tiene un efecto diferente. Algunas son CONDICIONALES:", 10);
y += 2;
const rules = [
  ["Pregunta abierta", "Resistencia -0.5 | Apertura +0.5 | Alianza +0.3"],
  ["Validacion empatica", "Alianza +1.0 | Resistencia -0.8 | Apertura +0.7 | Sintomas -0.5"],
  ["Reformulacion", "Alianza +0.5 | Apertura +0.5 | Resistencia -0.3"],
  ["Confrontacion (alianza >5)", "Apertura +0.8 | Cambio +1.0 (PRODUCTIVA)"],
  ["Confrontacion (alianza <=5)", "Resistencia +1.5 | Alianza -1.0 (CONTRAPRODUCENTE)"],
  ["Directividad", "Resistencia +1.0 | Alianza -0.5 | Cambio -0.5"],
  ["Normalizacion", "Sintomas -0.5 | Alianza +0.5"],
  ["Interpretacion (alianza >6)", "Apertura +0.5 | Cambio +0.8 (OPORTUNA)"],
  ["Interpretacion (alianza <=6)", "Resistencia +1.0 | Alianza -0.5 (PREMATURA)"],
];
rules.forEach(function(r) {
  addText(r[0], 9, true);
  addText("  " + r[1], 8, false, [100, 100, 100]);
});
y += 3;
addText("NOTA: La confrontacion y la interpretacion tienen efectos CONDICIONALES. Su resultado depende del nivel de alianza. Esta es la 'causalidad condicional' descrita en la propuesta ANID.", 9, true, [200, 0, 0]);
y += 5;

// 6
addSection("6. EJEMPLO DE EVOLUCION");
addText("Turno | Intervencion           | Resist | Alianza | Apertura", 8, true);
addText("------+------------------------+--------+---------+---------", 8);
addText("  0   | (inicio)               |  7.0   |   2.0   |   2.0", 8);
addText("  1   | Pregunta abierta       |  6.5   |   2.3   |   2.5", 8);
addText("  2   | Validacion empatica    |  5.7   |   3.3   |   3.2", 8);
addText("  3   | Pregunta abierta       |  5.2   |   3.6   |   3.7", 8);
addText("  4   | Confrontacion (BAJA)   |  6.7   |   2.6   |   2.7", 8, false, [200,0,0]);
addText("  5   | Normalizacion          |  6.7   |   3.1   |   3.0", 8);
addText("  6   | Validacion empatica    |  5.9   |   4.1   |   3.7", 8);
addText("  9   | Validacion empatica    |  4.3   |   5.9   |   5.4", 8, false, [0,128,0]);
addText(" 10   | Confrontacion (ALTA!)  |  4.0   |   5.9   |   6.2", 8, false, [0,128,0]);
y += 2;
addText("Turno 4: Confrontacion FALLA (alianza 2.6 < 5) -> resistencia SUBE", 8, false, [200,0,0]);
addText("Turno 10: Confrontacion FUNCIONA (alianza 5.9 > 5) -> apertura SUBE", 8, false, [0,128,0]);
y += 5;

// 7
addSection("7. TRAZABILIDAD CAUSAL");
addText("Cada turno queda registrado en la tabla clinical_state_log:", 10);
y += 1;
addText("- conversation_id, turn_number, intervention_type, intervention_raw", 9);
addText("- Las 5 variables de estado DESPUES de aplicar los deltas", 9);
addText("- Los 5 deltas (cuanto cambio cada variable)", 9);
addText("- patient_response (la respuesta generada con ese estado)", 9);
y += 3;
addText("Esto permite auditar: 'El paciente se cerro en el turno 4 porque el estudiante confronto prematuramente con alianza baja. Si hubiera esperado, la confrontacion habria sido productiva.'", 9, false, [74,85,162]);
y += 5;

// 8
addSection("8. ARCHIVOS IMPLEMENTADOS");
addText("src/lib/clinical-state-engine.ts - El cerebro del motor", 9, true);
addText("src/app/api/chat/route.ts - Integracion en el flujo del chat", 9, true);
addText("supabase/migrations/20260315000015_clinical_state.sql - Tabla de trazabilidad", 9, true);
y += 5;

// 9
addSection("9. ALINEACION CON PROPUESTA ANID");
addText("Atributos comprometidos en ANID vs estado actual:", 10, true);
y += 1;
addText("[OK] 5+ variables de estado clinico", 9, false, [0,128,0]);
addText("[OK] Reglas de transicion causales documentadas", 9, false, [0,128,0]);
addText("[OK] Trazabilidad 100% (clinical_state_log)", 9, false, [0,128,0]);
addText("[OK] Tiempo respuesta < 3 seg (streaming)", 9, false, [0,128,0]);
addText("[OK] Causalidad condicional (confrontacion depende de alianza)", 9, false, [0,128,0]);
addText("[PENDIENTE] Validacion con 8 sesiones longitudinales", 9, false, [200,128,0]);
addText("[PENDIENTE] Correlacion intervencion-evolucion r>=0.40", 9, false, [200,128,0]);

// Footers
var tp = doc.getNumberOfPages();
for (var i = 1; i <= tp; i++) {
  doc.setPage(i);
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.line(m, 268, pw - m, 268);
  doc.text("GlorIA - Motor Adaptativo - Informe Tecnico - Pagina " + i + " de " + tp, m, 272);
}

var buffer = Buffer.from(doc.output("arraybuffer"));
fs.writeFileSync("public/informe-motor-adaptativo.pdf", buffer);
console.log("PDF generado: " + Math.round(buffer.length/1024) + " KB, " + tp + " paginas");
