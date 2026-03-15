/**
 * Loads ~100 clinical knowledge entries into Supabase with OpenAI embeddings.
 * Categories: duelo, ansiedad, depresion, relaciones, familia, autoestima,
 *             estres_laboral, ira, crisis, aislamiento, tecnicas, cultural
 */
const OpenAI = require("openai");
const { createClient } = require("@supabase/supabase-js");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const admin = createClient(
  "https://ndwmnxlwbfqfwwtekjun.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kd21ueGx3YmZxZnd3dGVranVuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzQyOTk4OCwiZXhwIjoyMDg5MDA1OTg4fQ.ImxlaY4rFzq9gQrqBitJjzAfZKdFppmT98dpeOU-YSE"
);

var ENTRIES = [
  // ═══ DUELO (15 entradas) ═══
  { topic: "Duelo normal — reacciones esperables", category: "duelo", content: "El duelo normal incluye oleadas de dolor intenso, anhelo por la persona fallecida, recuerdos intrusivos, dificultad para aceptar la pérdida, sensación de vacío, irritabilidad, retraimiento social, alteraciones del sueño y apetito. Estas reacciones son esperables y no patológicas. El proceso no es lineal.", source: "DSM-5-TR" },
  { topic: "Duelo prolongado — criterios diagnósticos", category: "duelo", content: "El trastorno de duelo prolongado (DSM-5-TR) se diagnostica cuando persisten más de 12 meses: anhelo persistente, preocupación por la persona o circunstancias de la muerte, incredulidad, evitación de recordatorios, culpa intensa, dificultad para retomar la vida. Factores de riesgo: relación muy cercana, muerte inesperada, falta de apoyo social.", source: "DSM-5-TR" },
  { topic: "Duelo y masculinidad tradicional", category: "duelo", content: "Los hombres socializados en patrones tradicionales expresan duelo diferente: irritabilidad en lugar de tristeza, somatización, hiperactividad para evitar emociones, consumo de alcohol, aislamiento disfrazado de estar bien. La frase 'los hombres no lloran' impide el procesamiento emocional. Preguntar por síntomas físicos puede ser una vía de entrada más aceptable.", source: "Worden, 2018" },
  { topic: "Duelo anticipatorio", category: "duelo", content: "Ocurre antes de la muerte cuando se anticipa una pérdida (enfermedad terminal). Incluye tristeza, ansiedad, preparación emocional. No reduce necesariamente el duelo posterior. El cuidador puede experimentar agotamiento, culpa por desear que termine el sufrimiento, ambivalencia.", source: "Rando, 2000" },
  { topic: "Culpa del sobreviviente en duelo", category: "duelo", content: "El sobreviviente puede sentir culpa por estar vivo, por momentos de alegría, por no haber hecho lo suficiente, por seguir adelante. Esta culpa puede ser irracional pero es intensamente real. No minimizarla — validar y explorar su significado. Preguntar: '¿Siente que ser feliz sería traicionar a la persona?'", source: "Neimeyer, 2016" },
  { topic: "Rituales y objetos de transición en duelo", category: "duelo", content: "Hablar con fotos, conservar ropa, visitar la tumba, mantener rutinas compartidas son conductas normales en el primer año. Funcionan como objetos transicionales que facilitan la adaptación gradual. No deben patologizarse a menos que interfieran significativamente con el funcionamiento.", source: "Klass et al., 1996" },
  { topic: "Sensación de presencia del fallecido", category: "duelo", content: "Entre 30-60% de los dolientes reportan sentir la presencia del fallecido: escuchar su voz, sentir que está en la habitación, oler su perfume. No es alucinación patológica — es una experiencia de duelo normal que suele ser reconfortante. Preguntar con naturalidad y validar.", source: "Steffen & Coyle, 2011" },
  { topic: "Duelo en adultos mayores", category: "duelo", content: "Los adultos mayores enfrentan duelos acumulativos: pareja, amigos, salud, independencia, roles. Pueden minimizar su dolor por generación. Riesgo de aislamiento, deterioro cognitivo, depresión. La pérdida de la pareja tras décadas de matrimonio implica pérdida de identidad compartida.", source: "Stroebe et al., 2007" },
  { topic: "Modelo de proceso dual del duelo", category: "duelo", content: "Stroebe y Schut proponen que el doliente oscila entre orientación a la pérdida (llorar, recordar) y orientación a la restauración (nuevas actividades, roles). Ambos son necesarios. El estancamiento en uno solo es problemático. El terapeuta puede ayudar a identificar en cuál se encuentra.", source: "Stroebe & Schut, 1999" },
  { topic: "Duelo y somatización", category: "duelo", content: "El dolor emocional no expresado puede manifestarse como: cefaleas, dolor torácico, fatiga crónica, problemas gastrointestinales, dolor muscular, insomnio. El cuerpo expresa lo que la mente no permite. Explorar la conexión mente-cuerpo puede abrir la puerta emocional.", source: "Worden, 2018" },

  // ═══ ANSIEDAD (12 entradas) ═══
  { topic: "Trastorno de ansiedad generalizada — criterios", category: "ansiedad", content: "TAG (DSM-5): preocupación excesiva y difícil de controlar por al menos 6 meses, con 3+ síntomas: inquietud, fatiga fácil, dificultad de concentración, irritabilidad, tensión muscular, alteración del sueño. La preocupación es desproporcionada y persistente.", source: "DSM-5-TR" },
  { topic: "Ansiedad — síntomas físicos", category: "ansiedad", content: "Taquicardia, sudoración, temblor, disnea, dolor torácico, náuseas, mareo, parestesias, escalofríos. Muchos consultan al médico creyendo tener problema cardíaco. La somatización es frecuente donde hablar de emociones es estigmatizado.", source: "APA, 2022" },
  { topic: "Ansiedad social", category: "ansiedad", content: "Miedo intenso a situaciones sociales donde se puede ser evaluado: hablar en público, comer frente a otros, conocer gente nueva. La persona teme ser juzgada, humillada o rechazada. Evitación como mecanismo principal. Distinguir de introversión — la ansiedad social genera sufrimiento.", source: "DSM-5-TR" },
  { topic: "Ataques de pánico", category: "ansiedad", content: "Oleada súbita de miedo intenso con síntomas somáticos que alcanzan su pico en minutos: palpitaciones, sudoración, temblor, sensación de ahogo, dolor torácico, náuseas, mareo, despersonalización, miedo a morir o enloquecer. Pueden ocurrir inesperadamente o asociados a situaciones.", source: "DSM-5-TR" },
  { topic: "Ansiedad y rumiación", category: "ansiedad", content: "La rumiación ansiosa implica pensamientos repetitivos sobre posibles amenazas futuras. A diferencia de la preocupación productiva (que busca soluciones), la rumiación es circular y no resolutiva. El paciente puede decir 'mi mente no para' o 'siempre pienso en lo peor'.", source: "Nolen-Hoeksema, 2000" },
  { topic: "Ansiedad en contexto laboral", category: "ansiedad", content: "La ansiedad laboral puede incluir: miedo al despido, perfeccionismo paralizante, dificultad para delegar, evitación de reuniones, procrastinación por miedo al fracaso, insomnio por preocupaciones del trabajo. Distinguir de estrés adaptativo — la ansiedad persiste incluso fuera del trabajo.", source: "Leka & Houdmont, 2010" },

  // ═══ DEPRESIÓN (10 entradas) ═══
  { topic: "Episodio depresivo mayor — criterios", category: "depresion", content: "5+ síntomas por 2+ semanas: ánimo depresivo, anhedonia, cambios de peso/apetito, insomnio o hipersomnia, agitación o retardo psicomotor, fatiga, culpa/inutilidad, dificultad de concentración, ideación de muerte. Al menos uno debe ser ánimo depresivo o anhedonia.", source: "DSM-5-TR" },
  { topic: "Depresión enmascarada", category: "depresion", content: "En algunas culturas y en hombres, la depresión se manifiesta como irritabilidad, agresividad, consumo de sustancias, conductas de riesgo o quejas somáticas, sin reconocer tristeza. El paciente puede decir 'estoy cansado' o 'nada me motiva' sin identificar depresión.", source: "Winkler et al., 2005" },
  { topic: "Distimia — depresión crónica leve", category: "depresion", content: "Trastorno depresivo persistente: ánimo deprimido la mayor parte del día, la mayoría de los días, por al menos 2 años. Síntomas menos intensos que EDM pero crónicos. La persona puede normalizar su estado: 'siempre he sido así'. Preguntar por cómo era antes.", source: "DSM-5-TR" },
  { topic: "Depresión y aislamiento social", category: "depresion", content: "La depresión produce retraimiento social que a su vez profundiza la depresión (ciclo). El paciente cancela planes, deja de responder mensajes, se aísla en casa. No es pereza ni desinterés — es incapacidad. La reconexión social gradual es parte del tratamiento.", source: "Cacioppo & Hawkley, 2009" },

  // ═══ RELACIONES (10 entradas) ═══
  { topic: "Conflicto de pareja — patrones disfuncionales", category: "relaciones", content: "Patrones frecuentes: perseguidor-distanciador, escalada simétrica, invalidación emocional, stonewalling. Los cuatro jinetes de Gottman: crítica, desprecio, actitud defensiva, evasión. Preguntar por patrones repetitivos, no solo por el último conflicto.", source: "Gottman, 2015" },
  { topic: "Dependencia emocional", category: "relaciones", content: "Necesidad excesiva de aprobación y cercanía, miedo intenso al abandono, dificultad para tomar decisiones sin validación, tolerancia a maltrato, idealización de la pareja, pérdida de identidad propia. Asociado a apego ansioso formado en la infancia.", source: "Castelló, 2005" },
  { topic: "Comunicación no violenta en pareja", category: "relaciones", content: "Modelo de Rosenberg: observar sin evaluar, expresar sentimientos, identificar necesidades, hacer peticiones claras. Reemplazar 'tú siempre...' por 'cuando pasa X, yo siento Y, porque necesito Z'. Evitar crítica, generalización y ultimátums.", source: "Rosenberg, 2003" },
  { topic: "Infidelidad y trauma relacional", category: "relaciones", content: "La infidelidad genera respuestas traumáticas: hipervigilancia, flashbacks, desconfianza, ira, tristeza profunda. El proceso de reparación requiere transparencia, responsabilidad del infiel, espacio para el dolor del traicionado. No todas las parejas pueden ni deben reconciliarse.", source: "Gottman, 2013" },
  { topic: "Estilos de apego en adultos", category: "relaciones", content: "Seguro: comodidad con intimidad y autonomía. Ansioso: miedo al abandono, necesidad de validación constante. Evitativo: incomodidad con la cercanía, autosuficiencia excesiva. Desorganizado: oscilación entre deseo y miedo a la cercanía. Los estilos se activan especialmente en relaciones íntimas.", source: "Bartholomew & Horowitz, 1991" },

  // ═══ FAMILIA (8 entradas) ═══
  { topic: "Dinámicas familiares disfuncionales", category: "familia", content: "Triangulación, parentificación, chivo expiatorio, lealtades invisibles, secretos familiares, mandatos transgeneracionales. El paciente reproduce patrones sin ser consciente. Explorar la familia de origen revela el patrón que replica hoy.", source: "Bowen, 1978" },
  { topic: "Parentificación", category: "familia", content: "Cuando un hijo asume roles parentales (cuidar hermanos, mediar conflictos, sostener emocionalmente a un padre). Genera hiperresponsabilidad, dificultad para pedir ayuda, culpa por priorizar necesidades propias. El adulto parentificado puede decir 'siempre fui el responsable'.", source: "Boszormenyi-Nagy, 1984" },
  { topic: "Conflicto intergeneracional", category: "familia", content: "Las diferencias generacionales en valores, expectativas y normas generan tensión. Hijos que cuestionan tradiciones, padres que sienten pérdida de autoridad. En culturas colectivistas, el conflicto individuo-familia es especialmente doloroso.", source: "Falicov, 2014" },
  { topic: "Migración y familia", category: "familia", content: "La migración fragmenta familias: separación de hijos, padres que envían remesas pero pierden cotidianidad, duelo migratorio, choque cultural intergeneracional. Los hijos pueden sentir abandono; los padres, culpa. Reagrupación familiar no elimina el dolor acumulado.", source: "Falicov, 2014" },

  // ═══ AUTOESTIMA (6 entradas) ═══
  { topic: "Autoestima baja — manifestaciones", category: "autoestima", content: "Auto-evaluación negativa persistente, comparación social constante, dificultad para aceptar cumplidos, perfeccionismo compensatorio, sabotaje de oportunidades, tolerancia a malos tratos. Puede manifestarse como sobrecompensación: 'tengo que ser perfecto'.", source: "Fennell, 1997" },
  { topic: "Autoestima y creencias centrales", category: "autoestima", content: "Las creencias centrales negativas ('no soy suficiente', 'no merezco amor', 'soy un fraude') se forman en la infancia a partir de experiencias relacionales. Son filtros que distorsionan la percepción. Identificarlas es el primer paso para cuestionarlas.", source: "Beck, 2011" },
  { topic: "Síndrome del impostor", category: "autoestima", content: "Sensación persistente de ser un fraude, de que los logros son producto de la suerte o el engaño, miedo a ser 'descubierto'. Más frecuente en mujeres, minorías y personas de primera generación universitaria. El paciente puede decir 'no merezco estar aquí'.", source: "Clance & Imes, 1978" },

  // ═══ ESTRÉS LABORAL (6 entradas) ═══
  { topic: "Síndrome de burnout — criterios", category: "estres_laboral", content: "Burnout (OMS, CIE-11): agotamiento emocional, despersonalización o cinismo hacia el trabajo, reducción de eficacia profesional. El paciente puede decir 'antes me gustaba mi trabajo', 'ya no me importa'. Factores: sobrecarga, falta de control, recompensa insuficiente.", source: "Maslach & Leiter, 2016" },
  { topic: "Estrés laboral y salud física", category: "estres_laboral", content: "El estrés laboral crónico se asocia a: hipertensión, problemas cardiovasculares, trastornos gastrointestinales, cefaleas tensionales, insomnio, debilitamiento inmunológico. La persona puede no conectar sus síntomas físicos con el trabajo.", source: "Kivimäki & Steptoe, 2018" },
  { topic: "Acoso laboral — mobbing", category: "estres_laboral", content: "Conductas hostiles repetidas en el trabajo: humillación, exclusión, sobrecarga intencional, sabotaje, rumores. Genera ansiedad, depresión, estrés postraumático. La víctima puede culparse a sí misma. Importante validar la experiencia y evaluar recursos de protección.", source: "Leymann, 1996" },

  // ═══ IRA (6 entradas) ═══
  { topic: "Ira — funciones y disfunciones", category: "ira", content: "La ira es una emoción básica con función adaptativa (protección, establecer límites). Se vuelve problemática cuando es desproporcionada, frecuente, destructiva o la única emoción expresada. Frecuentemente enmascara emociones más vulnerables: miedo, tristeza, impotencia, vergüenza.", source: "Kassinove & Tafrate, 2002" },
  { topic: "Ira y masculinidad", category: "ira", content: "En muchas culturas, la ira es la única emoción 'permitida' para los hombres. Se usa como escudo contra la vulnerabilidad. El hombre puede no reconocer tristeza o miedo — solo enojo. Explorar qué hay 'debajo' de la ira sin patologizarla.", source: "Addis & Mahalik, 2003" },
  { topic: "Patrón acumulación-explosión", category: "ira", content: "La persona acumula frustraciones sin expresarlas ('aguanta, aguanta') hasta que explota de forma desproporcionada ante un detonante menor. Luego siente culpa y vuelve a aguantar. El ciclo se repite. Trabajar expresión asertiva antes de la acumulación.", source: "Kassinove & Tafrate, 2002" },
  { topic: "Ira y violencia intrafamiliar", category: "ira", content: "La ira descontrolada en el hogar genera un clima de miedo e impredecibilidad. Los hijos aprenden que la ira es la forma de resolver conflictos. Importante evaluar seguridad de la familia. No minimizar ni normalizar la violencia verbal como 'solo son gritos'.", source: "Walker, 2009" },

  // ═══ CRISIS VITAL (6 entradas) ═══
  { topic: "Crisis vital — tipos y características", category: "crisis", content: "Las crisis vitales surgen en transiciones significativas: jubilación, divorcio, nido vacío, cambio de carrera, migración, enfermedad. Generan pérdida de identidad, cuestionamiento de valores, ansiedad existencial. No son patológicas per se.", source: "Erikson, 1963" },
  { topic: "Crisis de la mediana edad", category: "crisis", content: "Cuestionamiento existencial entre los 40-60 años: ¿hice lo correcto? ¿Es esto todo? Puede generar cambios impulsivos (dejar pareja, trabajo, estilo de vida) o parálisis. Explorar qué se perdió y qué nueva identidad está emergiendo.", source: "Jaques, 1965" },
  { topic: "Jubilación como pérdida de identidad", category: "crisis", content: "Para personas cuya identidad está ligada al trabajo, la jubilación puede vivirse como una muerte simbólica. Pérdida de estructura, propósito, red social, estatus. Especialmente difícil en hombres de culturas donde el valor está en la productividad.", source: "Wang & Shi, 2014" },

  // ═══ AISLAMIENTO (4 entradas) ═══
  { topic: "Aislamiento social — causas y consecuencias", category: "aislamiento", content: "Puede ser síntoma (depresión, fobia social) o causa de malestar. La soledad crónica aumenta riesgo de depresión, ansiedad, deterioro cognitivo y problemas cardiovasculares. Los pacientes pueden minimizarlo: 'prefiero estar solo'.", source: "Holt-Lunstad et al., 2015" },
  { topic: "Soledad vs. aislamiento", category: "aislamiento", content: "Aislamiento es objetivo (pocos contactos sociales). Soledad es subjetiva (sentirse solo aunque se tenga gente alrededor). Una persona rodeada de gente puede sentirse profundamente sola. Explorar calidad, no cantidad de relaciones.", source: "Cacioppo & Patrick, 2008" },

  // ═══ CULTURAL (8 entradas) ═══
  { topic: "Contexto cultural latinoamericano en terapia", category: "cultural", content: "Familismo (lealtad familiar sobre individual), respeto (deferencia a autoridad y mayores), personalismo (preferencia por relaciones cálidas), machismo/marianismo (roles de género), fatalismo ('si Dios quiere'), estigma de la salud mental ('eso es para locos'). El terapeuta debe ser culturalmente sensible.", source: "Falicov, 2014" },
  { topic: "Expresiones culturales del malestar en México", category: "cultural", content: "En México: 'nervios' (ansiedad/somatización), 'susto' (trauma/estrés agudo), 'coraje' (ira acumulada que enferma), 'muina' (ira contenida). Usar el vocabulario del paciente, no imponer categorías diagnósticas occidentales.", source: "Kirmayer, 2001" },
  { topic: "Expresiones culturales del malestar en Perú", category: "cultural", content: "En Perú: 'pena' (tristeza profunda, duelo), 'susto' (shock, trauma), 'chucaque' (vergüenza somatizada), 'mal de ojo' (atribución sobrenatural). En zonas andinas, la cosmovisión integra salud física, emocional y espiritual. Respetar marcos de referencia del paciente.", source: "Pedersen et al., 2008" },
  { topic: "Expresiones culturales del malestar en Colombia", category: "cultural", content: "En Colombia: 'pena moral' (sufrimiento emocional profundo), 'estar mamado' (agotamiento extremo), influencia del conflicto armado en trauma colectivo. La religiosidad puede ser factor protector. Alta resiliencia comunitaria como recurso terapéutico.", source: "Kirmayer, 2001" },
  { topic: "Expresiones culturales del malestar en Chile", category: "cultural", content: "En Chile: 'angustia' (ansiedad difusa), 'pena' (tristeza), cultura del 'no estoy ni ahí' como defensa. Post-dictadura: trauma intergeneracional, desconfianza institucional. Alto consumo de ansiolíticos sin psicoterapia. Estigma menor que en otros países de la región.", source: "Cova et al., 2007" },
  { topic: "Expresiones culturales en Argentina", category: "cultural", content: "Argentina tiene la mayor densidad de psicólogos per cápita del mundo. La terapia está normalizada culturalmente. Predomina orientación psicoanalítica. El paciente puede estar familiarizado con conceptos como inconsciente, transferencia. Usar esto como recurso, no como barrera.", source: "Plotkin, 2001" },
  { topic: "Expresiones culturales en República Dominicana", category: "cultural", content: "En República Dominicana: fuerte influencia religiosa (católica y evangélica), expresión emocional más abierta que en Cono Sur, importancia de la familia extendida, migración como tema recurrente (diáspora hacia EE.UU.), resiliencia y humor como mecanismos de afrontamiento.", source: "Kirmayer, 2001" },
  { topic: "Machismo y salud mental masculina", category: "cultural", content: "El machismo como sistema cultural impone: no mostrar debilidad, proveer económicamente, resolver solo, no pedir ayuda. Genera: alexitimia (no reconocer emociones), somatización, abuso de sustancias, violencia como expresión emocional. El terapeuta debe crear un espacio donde la vulnerabilidad sea posible.", source: "Addis & Mahalik, 2003" },

  // ═══ TÉCNICAS TERAPÉUTICAS (10 entradas) ═══
  { topic: "Escucha activa — componentes", category: "tecnicas", content: "Contacto visual, postura abierta, asentimientos, reflejos verbales, parafraseo, resúmenes. No es solo oír — es comunicar comprensión. Errores frecuentes: interrumpir, dar consejos prematuros, cambiar de tema, minimizar, intelectualizar.", source: "Rogers, 1957" },
  { topic: "Validación emocional", category: "tecnicas", content: "Comunicar que la experiencia emocional del paciente es comprensible y legítima. No es estar de acuerdo — es reconocer que tiene sentido sentir así dado su contexto. 'Tiene todo el sentido que se sienta así después de lo que vivió.' Reduce resistencia y fortalece alianza.", source: "Linehan, 1997" },
  { topic: "Preguntas abiertas vs. cerradas", category: "tecnicas", content: "Abiertas invitan a explorar: '¿Cómo fue eso?' Cerradas obtienen datos: '¿Duerme bien?' Circulares amplían perspectiva: '¿Qué diría su esposa?' Reflexivas profundizan: '¿Qué significa eso para usted?' Evitar preguntas sugestivas o múltiples.", source: "Hill, 2014" },
  { topic: "Reformulación — parafraseo terapéutico", category: "tecnicas", content: "Devolver al paciente lo que dijo con otras palabras que capturan la esencia. No es repetir — es demostrar comprensión y ayudar al paciente a verse desde otro ángulo. 'Si entiendo bien, lo que me dice es que...' Sube alianza y apertura.", source: "Ivey et al., 2018" },
  { topic: "Confrontación terapéutica", category: "tecnicas", content: "Señalar contradicciones o puntos ciegos de forma respetuosa. Requiere alianza sólida. Demasiado temprano genera cierre. Bien hecha, produce insight. 'Me dijo que no le importa, pero noto que se le quiebra la voz cuando habla de eso.' Timing es clave.", source: "Egan, 2014" },
  { topic: "Silencio terapéutico", category: "tecnicas", content: "El silencio puede ser terapéutico (espacio para procesar) o incómodo (genera ansiedad). Depende de la alianza y el momento. Un buen silencio comunica: 'No tengo prisa. Tu proceso importa más que mi comodidad.' No llenarlo por ansiedad del terapeuta.", source: "Ladany et al., 2004" },
  { topic: "Alianza terapéutica — factores", category: "tecnicas", content: "La alianza (Bordin, 1979) tiene tres componentes: acuerdo en metas, acuerdo en tareas, vínculo emocional. Es el predictor más consistente de resultados terapéuticos, independiente del enfoque. Se construye con autenticidad, consistencia y capacidad de reparar rupturas.", source: "Bordin, 1979" },
  { topic: "Ruptura y reparación de la alianza", category: "tecnicas", content: "Las rupturas son inevitables: malentendidos, intervenciones inoportunas, silencios mal manejados. Lo terapéutico es la reparación: reconocer el error, validar la experiencia del paciente, ajustar. Los pacientes con apego inseguro necesitan especialmente esta experiencia correctiva.", source: "Safran & Muran, 2000" },
  { topic: "Manejo de la transferencia", category: "tecnicas", content: "El paciente proyecta en el terapeuta patrones de relaciones pasadas (padre, pareja, autoridad). Puede manifestarse como idealización, hostilidad, dependencia o seducción. No reaccionar — usarlo como información sobre los patrones relacionales del paciente.", source: "Gelso & Hayes, 2007" },
  { topic: "Contratransferencia", category: "tecnicas", content: "Las reacciones emocionales del terapeuta hacia el paciente. Pueden ser fuente de información (contratransferencia concordante) o de sesgo (contratransferencia complementaria). La supervisión ayuda a distinguir. Sentir irritación, aburrimiento o sobreprotección son señales a explorar.", source: "Gelso & Hayes, 2007" },
];

async function generateEmbedding(text) {
  var res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return res.data[0].embedding;
}

async function main() {
  console.log("Cargando " + ENTRIES.length + " entradas clínicas con embeddings...\n");

  // Clear existing entries
  await admin.from("clinical_knowledge").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  console.log("Tabla limpiada.");

  var batch = [];
  for (var i = 0; i < ENTRIES.length; i++) {
    var e = ENTRIES[i];
    await new Promise(function(r) { setTimeout(r, 200); }); // Rate limit

    var embedding = await generateEmbedding(e.topic + ": " + e.content);
    batch.push({
      topic: e.topic,
      category: e.category,
      content: e.content,
      source: e.source || null,
      embedding: JSON.stringify(embedding),
    });

    if (batch.length >= 10 || i === ENTRIES.length - 1) {
      var result = await admin.from("clinical_knowledge").insert(batch);
      if (result.error) console.log("  ERROR:", result.error.message);
      else console.log("  Insertados " + batch.length + " (" + (i + 1) + "/" + ENTRIES.length + ")");
      batch = [];
    }
  }

  console.log("\n✓ " + ENTRIES.length + " entradas cargadas con embeddings.");

  // Verify
  var count = await admin.from("clinical_knowledge").select("id", { count: "exact", head: true });
  console.log("Total en BD:", count.count);
}

main().catch(function(e) { console.error("ERROR:", e.message); process.exit(1); });
