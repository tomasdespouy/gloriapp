/**
 * GENERA TODOS LOS INFORMES PDF DE GLORIA
 * Con fuente Roboto (tildes, ñ, ¿¡) + logo GlorIA
 */
const { createPDF } = require("./pdf-utils");

console.log("Generando informes PDF con fuente Unicode + logo...\n");

// ═══════════════════════════════════════════
// 1. INFORME DE SENSIBILIDAD — Roberto Salas
// ═══════════════════════════════════════════
function report1() {
  var p = createPDF();
  p.header(
    "Informe de sensibilidad y evolución",
    "Paciente: Roberto Salas (52 años, ingeniero retirado)",
    "8 sesiones simuladas · 15 turnos por sesión (~60 min) · 15 de marzo de 2026"
  );

  p.sec("1. Resumen ejecutivo");
  p.txt("El paciente Roberto Salas muestra una evolución coherente a lo largo de las 8 sesiones simuladas. Los indicadores clave son:", 10);
  p.setY(p.getY() + 2);
  p.txt("• Cero respuestas repetidas textualmente en 120 turnos totales", 9);
  p.txt("• Menciones emocionales: de 4/15 (S1) a 10/15 (S3) — apertura gradual", 9);
  p.txt("• Revelaciones profundas aparecen desde la sesión 4 (foto de María, sentir su presencia)", 9);
  p.txt("• Formalidad consistente (\"usted\", \"doctor\"): 28% de las respuestas", 9);
  p.txt("• Evasión emocional (\"bien, gracias\"): 18% de las respuestas", 9);
  p.setY(p.getY() + 3);

  p.sec("2. Evolución por sesión");
  p.txt("Sesión | Largo prom. | Emocional | Profundo | Formal  | Repetido", 8, true);
  p.txt("-------+-------------+-----------+----------+---------+---------", 8);
  var data = [[1,198,4,1,5,0],[2,462,5,2,6,0],[3,324,10,0,3,0],[4,288,7,4,5,0],[5,233,4,2,5,0],[6,319,10,1,4,0],[7,364,7,3,4,0],[8,417,7,2,7,0]];
  data.forEach(function(d) {
    p.txt("  " + d[0] + "    |    " + d[1] + "     |   " + d[2] + "/15   |   " + d[3] + "/15  |  " + d[4] + "/15  |   " + d[5], 8);
  });
  p.setY(p.getY() + 3);

  p.sec("3. Coherencia del personaje");
  p.txt("Rasgos verificados en 120 turnos:", 10, true);
  p.txt("• Formalidad (\"usted\", \"doctor\"): 33/120 respuestas (28%)", 9);
  p.txt("• Respuestas factuales y cronológicas: 9/120 (8%)", 9);
  p.txt("• Evasión emocional: 22/120 (18%)", 9);
  p.setY(p.getY() + 2);
  p.txt("Evaluación: El paciente mantiene consistentemente su personalidad formal, respetuosa y evasiva a lo largo de las 8 sesiones.", 9);
  p.setY(p.getY() + 3);

  p.sec("4. Apertura progresiva");
  p.txt("Sesiones 1-2: Roberto habla de hechos (\"ella se enfermó en marzo\").", 9);
  p.txt("Sesión 3: Comienza a explorar emociones. Pico emocional: 10/15 menciones.", 9);
  p.txt("Sesión 4: Revela secretos — habla con la foto de María, siente su presencia.", 9);
  p.txt("Sesión 5: Reconoce la culpa de \"dejar de sufrir\" y el miedo a olvidarla.", 9);
  p.txt("Sesión 6: Segundo pico emocional (10/15). Conversa con sus hijos.", 9);
  p.txt("Sesiones 7-8: Integración y cierre reflexivo.", 9);
  p.setY(p.getY() + 3);

  p.sec("5. Fortalezas");
  p.txt("• Cero repeticiones textuales en 120 turnos", 9, false, [0,128,0]);
  p.txt("• Personalidad consistente (formal, respetuoso)", 9, false, [0,128,0]);
  p.txt("• Apertura gradual coherente con perfil clínico", 9, false, [0,128,0]);
  p.txt("• Revela secretos solo en sesiones avanzadas (S4+)", 9, false, [0,128,0]);
  p.txt("• Cierre emocional y reflexivo en la sesión 8", 9, false, [0,128,0]);
  p.setY(p.getY() + 3);

  p.sec("6. Áreas de mejora");
  p.txt("• No usó corchetes para lenguaje no verbal [suspira], [mira al suelo]", 9, false, [200,0,0]);
  p.txt("• Respuestas largas (promedio 325 caracteres vs ideal <200)", 9, false, [200,0,0]);
  p.txt("• Despedida repetitiva en todas las sesiones", 9, false, [200,0,0]);
  p.txt("• Falta variación emocional dentro de una misma sesión", 9, false, [200,0,0]);

  p.footers("GlorIA · Informe de sensibilidad · Roberto Salas");
  p.save("informe-roberto-8sesiones.pdf");
}

// ═══════════════════════════════════════════
// 2. MOTOR ADAPTATIVO — Documentación técnica
// ═══════════════════════════════════════════
function report2() {
  var p = createPDF();
  p.header(
    "Motor adaptativo de estado clínico",
    "Informe técnico de implementación",
    "GlorIA · Universidad Gabriela Mistral · 15 de marzo de 2026"
  );

  p.sec("1. ¿Qué es el motor adaptativo?");
  p.txt("El Motor Adaptativo de Estado Clínico es un sistema algorítmico que modela la evolución interna del paciente virtual durante una sesión de terapia. En vez de responder desde un prompt estático, el paciente tiene 5 variables internas que cambian en tiempo real según las intervenciones del estudiante.", 10);
  p.setY(p.getY() + 2);
  p.txt("Esto convierte a GlorIA de un \"chatbot con personalidad\" a un \"simulador clínico con evolución causal verificable\".", 10);
  p.setY(p.getY() + 5);

  p.sec("2. Antes vs. después");
  p.txt("ANTES: Prompt estático → LLM → Respuesta (sin control de estado)", 9, true, [200,0,0]);
  p.txt("AHORA: Clasificar → Cargar estado → Calcular deltas → Inyectar → LLM → Registrar", 9, true, [0,128,0]);
  p.setY(p.getY() + 5);

  p.sec("3. Las 5 variables de estado");
  var vars = [
    ["Resistencia (0-10)", "Qué tan cerrado está. Inicia en 7.0. Baja con empatía."],
    ["Alianza terapéutica (0-10)", "Confianza con el terapeuta. Inicia en 2.0. Sube con validación."],
    ["Apertura emocional (0-10)", "Disposición a hablar de emociones. Inicia en 2.0."],
    ["Sintomatología (0-10)", "Intensidad de síntomas. Inicia en 7.0. Baja con contención."],
    ["Disposición al cambio (0-10)", "Motivación para cambiar. Inicia en 2.0."],
  ];
  vars.forEach(function(v) { p.txt(v[0], 9, true); p.txt(v[1], 9); p.setY(p.getY() + 1); });
  p.setY(p.getY() + 3);

  p.sec("4. Reglas de transición");
  var rules = [
    ["Pregunta abierta", "Resistencia -0.5 · Apertura +0.5 · Alianza +0.3"],
    ["Validación empática", "Alianza +1.0 · Resistencia -0.8 · Apertura +0.7 · Síntomas -0.5"],
    ["Reformulación", "Alianza +0.5 · Apertura +0.5 · Resistencia -0.3"],
    ["Confrontación (alianza >5)", "Apertura +0.8 · Cambio +1.0 (PRODUCTIVA)"],
    ["Confrontación (alianza ≤5)", "Resistencia +1.5 · Alianza -1.0 (CONTRAPRODUCENTE)"],
    ["Directividad", "Resistencia +1.0 · Alianza -0.5 · Cambio -0.5"],
    ["Normalización", "Síntomas -0.5 · Alianza +0.5"],
    ["Interpretación (alianza >6)", "Apertura +0.5 · Cambio +0.8 (OPORTUNA)"],
    ["Interpretación (alianza ≤6)", "Resistencia +1.0 · Alianza -0.5 (PREMATURA)"],
  ];
  rules.forEach(function(r) { p.txt(r[0], 9, true); p.txt("  " + r[1], 8, false, [100,100,100]); });
  p.setY(p.getY() + 2);
  p.txt("Nota: La confrontación y la interpretación tienen efectos CONDICIONALES según el nivel de alianza.", 9, true, [200,0,0]);
  p.setY(p.getY() + 5);

  p.sec("5. Trazabilidad causal");
  p.txt("Cada turno queda registrado en clinical_state_log con:", 10);
  p.txt("• ID de conversación, número de turno, tipo de intervención", 9);
  p.txt("• Las 5 variables de estado después de aplicar los deltas", 9);
  p.txt("• Los 5 deltas (cuánto cambió cada variable)", 9);
  p.txt("• La respuesta del paciente generada con ese estado", 9);
  p.setY(p.getY() + 5);

  p.sec("6. Alineación con propuesta ANID");
  p.txt("[✓] 5+ variables de estado clínico", 9, false, [0,128,0]);
  p.txt("[✓] Reglas de transición causales (14 reglas, 4 condicionales)", 9, false, [0,128,0]);
  p.txt("[✓] Trazabilidad 100% (clinical_state_log)", 9, false, [0,128,0]);
  p.txt("[✓] Causalidad condicional (confrontación depende de alianza)", 9, false, [0,128,0]);
  p.txt("[✓] Tiempo de respuesta < 3 seg (streaming)", 9, false, [0,128,0]);
  p.txt("[Pendiente] Correlación intervención-evolución r≥0.40", 9, false, [200,128,0]);
  p.txt("[Pendiente] Concordancia NLP κ≥0.60 vs jueces expertos", 9, false, [200,128,0]);

  p.footers("GlorIA · Motor Adaptativo · Informe técnico");
  p.save("informe-motor-adaptativo.pdf");
}

// ═══════════════════════════════════════════
// 3. COMPARATIVO — Sin motor vs con motor
// ═══════════════════════════════════════════
function report3() {
  var p = createPDF();
  p.header(
    "Informe comparativo",
    "Roberto Salas: sin motor vs. con motor adaptativo + RAG",
    "8 sesiones simuladas · 15 turnos (~60 min) · GlorIA · UGM · 15 marzo 2026"
  );

  p.sec("1. Objetivo");
  p.txt("Comparar el comportamiento del paciente Roberto Salas en dos condiciones:", 10);
  p.txt("A) Sin motor adaptativo: prompt estático, sin variables de estado, sin RAG.", 9);
  p.txt("B) Con motor adaptativo + RAG: 5 variables, reglas causales, conocimiento clínico.", 9);
  p.setY(p.getY() + 5);

  p.sec("2. Evolución del estado clínico (condición B)");
  p.txt("Sesión | Resistencia | Alianza | Apertura", 8, true);
  p.txt("-------+-------------+---------+---------", 8);
  var states = [[1,3.9,4.9,5.7],[2,2.5,5.5,7.5],[3,2.6,5.0,6.6],[4,4.2,4.9,5.5],[5,4.4,4.1,4.9],[6,2.6,5.0,6.6],[7,2.6,5.0,6.6],[8,3.3,4.5,6.8]];
  states.forEach(function(s) {
    var color = s[0] === 4 || s[0] === 5 ? [200,0,0] : s[0] === 2 ? [0,128,0] : null;
    p.txt("  " + s[0] + "    |    " + s[1].toFixed(1) + "     |  " + s[2].toFixed(1) + "   |  " + s[3].toFixed(1), 8, false, color);
  });
  p.setY(p.getY() + 2);
  p.txt("• S2: Pico de apertura (7.5) y mínima resistencia (2.5)", 9, false, [0,128,0]);
  p.txt("• S4-S5: Regresión natural — revelaciones profundas generan ansiedad", 9, false, [200,0,0]);
  p.txt("• S6-S7: Recuperación — el terapeuta reconstruye la alianza", 9, false, [0,128,0]);
  p.setY(p.getY() + 5);

  p.sec("3. Comparación");
  p.txt("                     | Sin motor  | Con motor  | Diferencia", 8, true);
  p.txt("---------------------+------------+------------+-----------", 8);
  p.txt("Respuestas repetidas |     0      |     0      | Igual", 8);
  p.txt("Regresión en S4-S5   | No visible | Sí (R sube)| Más realista", 8, false, [0,128,0]);
  p.txt("Recuperación en S6-7 | No visible | Sí (R baja)| Más realista", 8, false, [0,128,0]);
  p.txt("Trazabilidad causal  |     No     | Sí (100%)  | Nuevo", 8, false, [0,128,0]);
  p.txt("RAG clínico          |     No     | Sí         | Nuevo", 8, false, [0,128,0]);
  p.setY(p.getY() + 3);
  p.txt("Conclusión: El motor adaptativo produce un paciente más realista con regresiones naturales cuando se tocan temas sensibles.", 10, true);

  p.footers("GlorIA · Informe comparativo · Motor adaptativo");
  p.save("informe-comparativo-motor.pdf");
}

// ═══════════════════════════════════════════
// 4. COMPARACIÓN GPT-4o vs GPT-4o-mini
// ═══════════════════════════════════════════
function report4() {
  var p = createPDF();
  p.header(
    "Comparación GPT-4o vs. GPT-4o-mini",
    "Realismo clínico y autenticidad cultural mexicana",
    "Paciente: Jorge Ramírez (58, obrero, México) · 8 sesiones × 15 turnos · GlorIA"
  );

  p.sec("1. Objetivo");
  p.txt("Determinar si GPT-4o-mini puede reemplazar a GPT-4o como modelo base, manteniendo calidad clínica y autenticidad cultural. Se evaluó con un paciente mexicano de 58 años, obrero de construcción, con manejo de ira.", 10);
  p.setY(p.getY() + 5);

  p.sec("2. Resultados comparativos");
  p.txt("Métrica                 | GPT-4o     | GPT-4o-mini | Veredicto", 8, true);
  p.txt("------------------------+------------+-------------+----------", 8);
  p.txt("Mexicanismos detectados |     15     |     25      | Mini mejor", 8, false, [0,128,0]);
  p.txt("Corchetes [no verbal]   |   118/120  |   120/120   | Mini mejor", 8, false, [0,128,0]);
  p.txt("Respuestas repetidas    |      0     |      0      | Igual", 8);
  p.txt("Largo promedio (chars)  |    178     |    193      | Similar", 8);
  p.txt("Menciones emocionales   |   88/120   |   97/120    | Mini mejor", 8, false, [0,128,0]);
  p.setY(p.getY() + 3);
  p.txt("Hallazgo: GPT-4o-mini supera a GPT-4o en autenticidad cultural mexicana, uso de lenguaje no verbal y expresión emocional.", 10, true, [0,128,0]);
  p.setY(p.getY() + 5);

  p.sec("3. Evolución del estado clínico");
  p.txt("Ambos modelos producen patrones de estado idénticos (el motor adaptativo es determinístico para las mismas intervenciones).", 10);
  p.setY(p.getY() + 5);

  p.sec("4. Costos comparativos");
  p.txt("                       | GPT-4o      | GPT-4o-mini | Ahorro", 8, true);
  p.txt("-----------------------+-------------+-------------+-------", 8);
  p.txt("Costo/sesión 60 min    | USD 0.090   | USD 0.005   |  94%", 8);
  p.txt("100 estudiantes/mes    | USD 108.00  | USD 6.49    |  94%", 8);
  p.txt("1.000 est./semestre    | USD 5.408   | USD 324     |  94%", 8);
  p.setY(p.getY() + 5);

  p.sec("5. Recomendación");
  p.txt("GPT-4o-mini es viable como modelo base para las sesiones de chat.", 10, true, [0,128,0]);
  p.txt("La calidad clínica es comparable —e incluso superior en autenticidad cultural— con un ahorro del 94% en costos.", 10);
  p.setY(p.getY() + 2);
  p.txt("Estrategia recomendada:", 10, true);
  p.txt("• GPT-4o-mini para sesiones de chat con pacientes (rápido, barato)", 9);
  p.txt("• GPT-4o para evaluaciones post-sesión (precisión analítica)", 9);
  p.txt("• Resultado: ~85% de ahorro total manteniendo calidad de retroalimentación", 9);

  p.footers("GlorIA · Comparación de modelos · Jorge Ramírez");
  p.save("informe-comparacion-modelos.pdf");
}

// ═══════════════════════════════════════════
// 5. COBERTURA ANID — Estado de implementación
// ═══════════════════════════════════════════
function report5() {
  var p = createPDF();
  p.header(
    "Cobertura de la propuesta ANID IT 2026",
    "Estado de implementación técnica de GlorIA",
    "Universidad Gabriela Mistral · 15 de marzo de 2026"
  );

  p.sec("1. Resumen");
  p.txt("La plataforma GlorIA cubre aproximadamente el 90% de lo propuesto en la postulación ANID IT 2026. Los componentes técnicos principales están implementados y funcionales.", 10);
  p.setY(p.getY() + 5);

  p.sec("2. Componentes implementados");
  var done = [
    ["Simulación clínica con chat en tiempo real", "16 pacientes activos, 6 países"],
    ["Motor adaptativo de estado clínico", "5 variables, 14 reglas causales, 4 condicionales"],
    ["Pipeline RAG", "15 entradas de conocimiento clínico (DSM-5, técnicas)"],
    ["Clasificador NLP de actos comunicativos", "11 categorías, heurístico + LLM"],
    ["Trazabilidad causal", "clinical_state_log con registro por turno"],
    ["Memoria longitudinal (MCP)", "Memoria de sesión anterior integrada"],
    ["Retroalimentación automatizada", "Evaluación por competencias con aprobación docente"],
    ["Dashboard analítico docente", "Métricas por estudiante, paciente, competencia"],
    ["Métricas en vivo", "Sesiones activas, latencia, tipos de intervención"],
    ["Sistema multi-institucional", "Instituciones → Asignaturas → Secciones"],
    ["Encuestas NPS", "Creación, distribución, análisis de resultados"],
    ["Generación de perfiles clínicos", "IA + validador + ficha PDF exportable"],
    ["Generación de imagen y video", "DALL-E 3 + Luma AI, almacenado en Supabase Storage"],
    ["CI/CD + observabilidad", "GitHub Actions, logger estructurado, health check"],
  ];
  done.forEach(function(d) {
    p.txt("[✓] " + d[0], 9, true, [0,128,0]);
    p.txt("    " + d[1], 8, false, [100,100,100]);
  });
  p.setY(p.getY() + 5);

  p.sec("3. Pendientes de validación empírica");
  var pending = [
    "Correlación intervención-evolución r≥0.40 (requiere muestra experimental)",
    "Concordancia NLP κ≥0.60 vs. jueces expertos (requiere corpus anotado)",
    "Validación multicéntrica en USB Cali y UNICARIBE",
    "Publicación peer-reviewed con diseño experimental controlado",
    "Registro de propiedad intelectual ante INAPI",
  ];
  pending.forEach(function(d) {
    p.txt("[Pendiente] " + d, 9, false, [200,128,0]);
  });
  p.setY(p.getY() + 5);

  p.sec("4. Indicadores ANID alcanzados");
  p.txt("Indicador                                    | Meta ANID  | Estado", 8, true);
  p.txt("---------------------------------------------+------------+--------", 8);
  p.txt("Variables de estado clínico                   |    ≥5      |  5 ✓", 8, false, [0,128,0]);
  p.txt("Reglas de transición documentadas             |    Sí      |  14 ✓", 8, false, [0,128,0]);
  p.txt("Trazabilidad causal                           |   100%     | 100% ✓", 8, false, [0,128,0]);
  p.txt("Tiempo de respuesta                           |   <3 seg   |  <3s ✓", 8, false, [0,128,0]);
  p.txt("Sesiones sin degradación                      |    ≥5      |   8 ✓", 8, false, [0,128,0]);
  p.txt("Categorías de actos comunicativos              |    ≥8      |  11 ✓", 8, false, [0,128,0]);
  p.txt("Usuarios concurrentes sin error               |    ≥50     |  Por validar", 8, false, [200,128,0]);
  p.txt("Concordancia NLP-jueces                       |   κ≥0.60  |  Por validar", 8, false, [200,128,0]);

  p.footers("GlorIA · Cobertura ANID IT 2026");
  p.save("informe-cobertura-anid.pdf");
}

// ═══ EJECUTAR TODOS ═══
report1();
report2();
report3();
report4();
report5();
console.log("\n✓ Todos los informes generados con éxito.");
