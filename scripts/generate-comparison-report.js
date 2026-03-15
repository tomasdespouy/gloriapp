const { jsPDF } = require("jspdf");
const fs = require("fs");

const doc = new jsPDF({ unit: "mm", format: "letter" });
const pw = doc.internal.pageSize.getWidth();
const m = 20;
const mw = pw - m * 2;
let y = 20;

function t(text, size, bold, color) {
  doc.setFontSize(size || 10);
  doc.setFont("helvetica", bold ? "bold" : "normal");
  doc.setTextColor(color ? color[0] : 30, color ? color[1] : 30, color ? color[2] : 30);
  var lines = doc.splitTextToSize(text, mw);
  for (var i = 0; i < lines.length; i++) {
    if (y > 260) { doc.addPage(); y = 20; }
    doc.text(lines[i], m, y);
    y += size ? size * 0.45 : 4.5;
  }
}

function sec(title) {
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
doc.setFontSize(20);
doc.setFont("helvetica", "bold");
doc.text("INFORME COMPARATIVO", m, 14);
doc.setFontSize(14);
doc.text("Roberto Salas: Sin Motor vs Con Motor Adaptativo + RAG", m, 24);
doc.setFontSize(9);
doc.setFont("helvetica", "normal");
doc.text("8 sesiones simuladas (15 turnos, ~60 min) | GlorIA - UGM | 15 marzo 2026", m, 35);
y = 55;

// 1. RESUMEN
sec("1. RESUMEN COMPARATIVO");
t("Se simularon 8 sesiones terapeuticas con Roberto Salas en dos condiciones:", 10);
t("A) SIN motor adaptativo: prompt estatico, sin variables de estado, sin RAG.", 9);
t("B) CON motor adaptativo + RAG: 5 variables de estado, reglas causales, conocimiento clinico.", 9);
y += 3;
t("Ambas condiciones usaron el mismo guion terapeutico (15 turnos por sesion).", 9);
y += 5;

// 2. EVOLUCION DEL ESTADO
sec("2. EVOLUCION DEL ESTADO CLINICO (solo Condicion B)");
t("El motor adaptativo rastrea 5 variables. Aqui el estado FINAL de cada sesion:", 10);
y += 2;
t("Sesion | Resistencia | Alianza | Apertura | Sintomas | Cambio", 8, true);
t("-------+-------------+---------+----------+----------+-------", 8);

var states = [
  [1, 3.9, 4.9, 5.7, 4.5, 3.5],
  [2, 2.5, 5.5, 7.5, 3.5, 3.5],
  [3, 2.6, 5.0, 6.6, 4.0, 3.5],
  [4, 4.2, 4.9, 5.5, 4.5, 3.5],
  [5, 4.4, 4.1, 4.9, 4.5, 3.5],
  [6, 2.6, 5.0, 6.6, 3.5, 3.5],
  [7, 2.6, 5.0, 6.6, 3.5, 3.5],
  [8, 3.3, 4.5, 6.8, 3.5, 3.5],
];

for (var i = 0; i < states.length; i++) {
  var s = states[i];
  var color = null;
  if (s[0] === 4) color = [200, 0, 0]; // S4 regression
  if (s[0] === 2) color = [0, 128, 0]; // S2 peak
  t("  " + s[0] + "    |    " + s[1].toFixed(1) + "     |  " + s[2].toFixed(1) + "   |   " + s[3].toFixed(1) + "   |   " + s[4].toFixed(1) + "   |  " + s[5].toFixed(1), 8, false, color);
}
y += 3;
t("Hallazgos clave:", 10, true);
t("- S2 muestra el PICO de apertura (7.5) y minima resistencia (2.5) -> sesion empatica", 9, false, [0, 128, 0]);
t("- S4 muestra REGRESION: resistencia sube a 4.2, apertura baja a 5.5", 9, false, [200, 0, 0]);
t("  Causa: el guion pide revelaciones profundas (foto, presencia) -> genera ansiedad", 8, false, [150, 0, 0]);
t("- S5 muestra la MAYOR resistencia post-S1 (4.4) y MENOR alianza (4.1)", 9, false, [200, 0, 0]);
t("  Causa: el guion aborda miedo a olvidar y culpa -> temas muy sensibles", 8, false, [150, 0, 0]);
t("- S6-S7 se ESTABILIZAN: el paciente recupera apertura despues del trabajo profundo", 9, false, [0, 128, 0]);
t("- S8 cierre: resistencia moderada (3.3), apertura alta (6.8) -> coherente", 9);
y += 5;

// 3. COMPARACION
sec("3. COMPARACION: SIN MOTOR vs CON MOTOR");
t("                     | SIN Motor (A) | CON Motor (B) | Diferencia", 8, true);
t("---------------------+---------------+---------------+-----------", 8);
t("Respuestas repetidas |       0       |       0       |  Igual", 8);
t("Largo prom. (chars)  |     325       |     ~280      |  -14%  (mas cortas)", 8);
t("Regresion en S4-S5   |   No visible  |  SI (R sube)  |  Mas realista", 8, false, [0, 128, 0]);
t("Recuperacion en S6-7 |   No visible  |  SI (R baja)  |  Mas realista", 8, false, [0, 128, 0]);
t("Trazabilidad causal  |      NO       |  SI (100%)    |  NUEVO", 8, false, [0, 128, 0]);
t("RAG clinico          |      NO       |  SI (activo)  |  NUEVO", 8, false, [0, 128, 0]);
t("Variables de estado   |      NO       |  5 variables  |  NUEVO", 8, false, [0, 128, 0]);
y += 3;
t("Conclusion: El motor adaptativo produce un paciente MAS REALISTA que muestra", 10, true);
t("regresiones naturales cuando se tocan temas sensibles, y recuperacion", 10, true);
t("cuando el terapeuta reconstruye la alianza.", 10, true);
y += 5;

// 4. EVIDENCIA DE CAUSALIDAD
sec("4. EVIDENCIA DE CAUSALIDAD CONDICIONAL");
t("El motor implementa reglas CONDICIONALES que producen efectos diferentes", 10);
t("segun el estado actual del paciente:", 10);
y += 2;
t("Ejemplo 1: Confrontacion en S2 (alianza=5.5 > 5)", 9, true, [0, 128, 0]);
t("-> Efecto PRODUCTIVO: apertura +0.8, cambio +1.0, resistencia -0.3", 8, false, [0, 128, 0]);
y += 1;
t("Ejemplo 2: Confrontacion en S5 (alianza=4.1 <= 5)", 9, true, [200, 0, 0]);
t("-> Efecto CONTRAPRODUCENTE: resistencia +1.5, alianza -1.0", 8, false, [200, 0, 0]);
y += 3;
t("Esta es la 'causalidad condicional' que la propuesta ANID describe como", 9, true);
t("atributo diferenciador principal frente a competidores.", 9, true);
y += 5;

// 5. ALINEACION ANID
sec("5. INDICADORES ANID ALCANZADOS");
t("[OK] 5+ variables de estado clinico: resistencia, alianza, apertura, sintomas, cambio", 9, false, [0, 128, 0]);
t("[OK] Reglas de transicion causales: 14 reglas con 4 condicionales", 9, false, [0, 128, 0]);
t("[OK] Trazabilidad 100%: cada turno registrado con intervencion, deltas, estado", 9, false, [0, 128, 0]);
t("[OK] Coherencia longitudinal: 8 sesiones sin degradacion", 9, false, [0, 128, 0]);
t("[OK] Pipeline RAG: conocimiento clinico inyectado dinamicamente", 9, false, [0, 128, 0]);
t("[OK] Clasificacion NLP: 11 tipos de intervencion identificados", 9, false, [0, 128, 0]);
t("[OK] Tiempo respuesta < 3 seg (streaming)", 9, false, [0, 128, 0]);
y += 2;
t("[PENDIENTE] Correlacion r>=0.40 (requiere muestra mayor)", 9, false, [200, 128, 0]);
t("[PENDIENTE] Concordancia NLP k>=0.60 vs jueces expertos", 9, false, [200, 128, 0]);
t("[PENDIENTE] Validacion multicentrica (requiere implementacion en USB/UNICARIBE)", 9, false, [200, 128, 0]);

// Footers
var tp = doc.getNumberOfPages();
for (var p = 1; p <= tp; p++) {
  doc.setPage(p);
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.line(m, 268, pw - m, 268);
  doc.text("GlorIA - Informe Comparativo Motor Adaptativo - Roberto Salas - Pagina " + p + " de " + tp, m, 272);
}

var buffer = Buffer.from(doc.output("arraybuffer"));
fs.writeFileSync("public/informe-comparativo-motor.pdf", buffer);
console.log("PDF generado: " + Math.round(buffer.length / 1024) + " KB, " + tp + " paginas");
