/**
 * Seed 7 completed sessions with summaries for 5 patients (1 student)
 * This creates the data needed to test session 8 with multi-session memory.
 *
 * Usage: node scripts/seed-session-summaries.js
 */
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const STUDENT_ID = "f7c48ddc-68b4-455a-8e12-10301ecf9e01"; // Francisco Paolo

const PATIENTS = [
  {
    id: "190feafa-3f56-49d0-b966-dee7e948eab5",
    name: "Lucía Mendoza",
    sessions: [
      {
        summary: "Le conté al terapeuta que llevo semanas sin dormir bien. Me preguntó sobre mi trabajo freelance y le dije que perdí un cliente grande, Estudio Brava, hace un mes. No quise hablar mucho de mi familia, pero mencioné que mi mamá me llama todos los días y eso me agobia. Me sentí un poco incómoda cuando me preguntó si estaba triste.",
        revelations: ["Perdió un cliente importante (Estudio Brava)", "La madre la llama diariamente y le genera agobio"],
        progress: "Algo desconfiada pero dispuesta a volver. Habló poco de emociones.",
        state: { resistencia: 6.0, alianza: 3.0, apertura_emocional: 2.5, sintomatologia: 7.0, disposicion_cambio: 2.5 },
      },
      {
        summary: "Hoy hablé más del insomnio. El terapeuta fue paciente y no me presionó. Le conté que Tomás, mi ex novio, me escribió hace una semana y eso me desestabilizó. También mencioné que mi compañera de depto, la Cata, me dijo que me veía mal. Me costó admitir que sí estoy afectada por la ruptura.",
        revelations: ["Ex novio Tomás la contactó recientemente", "Compañera de depto Cata nota su deterioro"],
        progress: "Más abierta que la sesión anterior. Empezó a nombrar emociones.",
        state: { resistencia: 5.0, alianza: 4.0, apertura_emocional: 3.5, sintomatologia: 6.5, disposicion_cambio: 3.0 },
      },
      {
        summary: "Sesión difícil. El terapeuta me preguntó directamente sobre la ruptura con Tomás y me enojé un poco, le dije que no todo tiene que ver con eso. Pero después reconocí que sí me afecta que él ya esté con alguien más. Lloré por primera vez en terapia. También hablé de que mi papá nunca validaba mis emociones cuando chica.",
        revelations: ["El ex Tomás ya tiene nueva pareja", "Padre invalidaba emociones en la infancia", "Lloró por primera vez en sesión"],
        progress: "Momento de quiebre emocional. La alianza se fortaleció después del llanto.",
        state: { resistencia: 3.5, alianza: 5.5, apertura_emocional: 5.0, sintomatologia: 6.0, disposicion_cambio: 4.0 },
      },
      {
        summary: "Llegué más tranquila. Le conté que empecé a dibujar de nuevo, algo que no hacía desde la universidad. El terapeuta me preguntó qué significaba el dibujo para mí y le dije que es lo único que me hace sentir yo misma. Hablamos de cómo el perfeccionismo me paraliza en el trabajo. Mencioné que mi hermano Matías me llamó para mi cumpleaños y fue lindo.",
        revelations: ["Retomó el dibujo como actividad personal", "Perfeccionismo como patrón laboral", "Hermano Matías mantiene contacto"],
        progress: "Sesión más fluida. Paciente empezó a conectar patrones por sí misma.",
        state: { resistencia: 3.0, alianza: 6.0, apertura_emocional: 5.5, sintomatologia: 5.5, disposicion_cambio: 5.0 },
      },
      {
        summary: "Hoy hablé de algo que nunca había dicho. En la universidad tuve un episodio de pánico en un examen final y desde ahí evito situaciones de mucha presión. El terapeuta lo conectó con mi miedo a perder clientes y me hizo sentido. También le conté que mi mamá se enfermó, tiene problemas al corazón, y que me siento culpable por no visitarla más seguido.",
        revelations: ["Episodio de pánico en la universidad (evento fundante)", "Madre tiene problemas cardíacos", "Culpa por no visitarla"],
        progress: "Sesión de revelaciones profundas. Alto nivel de confianza.",
        state: { resistencia: 2.5, alianza: 7.0, apertura_emocional: 6.5, sintomatologia: 5.0, disposicion_cambio: 5.5 },
      },
      {
        summary: "Hablamos sobre qué haría si pudiera dejar de preocuparme por lo que otros piensan. Le dije que me gustaría montar mi propia marca de diseño pero me da miedo fracasar. El terapeuta me ayudó a ver que el miedo al fracaso viene de las expectativas de mi papá. Terminé la sesión sintiéndome más liviana. Mencioné que esta semana dormí mejor, 3 noches de corrido.",
        revelations: ["Sueño de tener marca propia de diseño", "Miedo al fracaso vinculado al padre", "Mejora del sueño (3 noches)"],
        progress: "Paciente proyectando futuro. Síntomas de insomnio en reducción.",
        state: { resistencia: 2.0, alianza: 7.5, apertura_emocional: 7.0, sintomatologia: 4.0, disposicion_cambio: 6.5 },
      },
      {
        summary: "La sesión más importante hasta ahora. Le conté que hablé con mi mamá y le dije que necesitaba que dejara de llamarme todos los días. Fue difícil pero lo hice. El terapeuta me felicitó de forma sutil y hablamos de cómo poner límites es nuevo para mí. También mencioné que acepté un proyecto pequeño de branding para una cafetería del barrio, el Café Olivia.",
        revelations: ["Puso límites a la madre (redujo llamadas diarias)", "Aceptó proyecto nuevo (Café Olivia)", "Primera vez poniendo límites familiares"],
        progress: "Cambios conductuales concretos. Paciente actuando fuera de sesión.",
        state: { resistencia: 1.8, alianza: 8.0, apertura_emocional: 7.5, sintomatologia: 3.5, disposicion_cambio: 7.0 },
      },
    ],
  },
  {
    id: "4de02b24-5203-4cb8-8b82-55f7357ab021",
    name: "Roberto Salas",
    sessions: [
      {
        summary: "No sé bien por qué vine. Mi señora Marta insistió. Le dije al terapeuta que estoy bien, que solo estoy un poco aburrido desde que me jubilé. No quise hablar mucho. Le conté que fui ingeniero en CODELCO por 28 años.",
        revelations: ["Esposa Marta lo envió a terapia", "Trabajó 28 años en CODELCO", "Minimiza su malestar"],
        progress: "Muy resistente. Asistió por presión de la esposa.",
        state: { resistencia: 8.0, alianza: 1.5, apertura_emocional: 1.5, sintomatologia: 6.0, disposicion_cambio: 1.5 },
      },
      {
        summary: "El terapeuta no me presionó y eso me gustó. Hablamos de cómo es mi día a día ahora. Le conté que me levanto tarde, veo las noticias, almuerzo con Marta y después no sé qué hacer. Mencioné que extraño a los muchachos de la mina, especialmente al Gordo Sepúlveda que era mi compañero.",
        revelations: ["Rutina vacía post-jubilación", "Extraña compañero Gordo Sepúlveda", "Se levanta tarde sin propósito"],
        progress: "Menos resistente. Habló de su rutina sin que se lo pidieran.",
        state: { resistencia: 6.5, alianza: 3.0, apertura_emocional: 2.5, sintomatologia: 6.0, disposicion_cambio: 2.0 },
      },
      {
        summary: "Hoy se me salió algo que no esperaba. Hablando del Gordo Sepúlveda, mencioné que él murió hace 6 meses de un infarto. No lloré pero se me apretó la garganta. El terapeuta se quedó en silencio y eso me ayudó. Le dije que no fui al funeral porque no me gustan esas cosas.",
        revelations: ["Gordo Sepúlveda falleció hace 6 meses (infarto)", "No asistió al funeral", "Duelo no procesado"],
        progress: "Primera apertura emocional significativa. El silencio del terapeuta fue clave.",
        state: { resistencia: 5.0, alianza: 4.5, apertura_emocional: 4.0, sintomatologia: 6.5, disposicion_cambio: 3.0 },
      },
      {
        summary: "El terapeuta me preguntó por mi papá y le conté que don Luis fue carabinero, hombre de pocas palabras. Nunca nos abrazó. Murió cuando yo tenía 40, de cáncer, y tampoco lloré en ese funeral. Me di cuenta de que tengo un patrón ahí. Marta dice que soy igual a él.",
        revelations: ["Padre don Luis era carabinero, distante emocionalmente", "Padre murió de cáncer", "Nunca ha llorado en un funeral", "Esposa lo compara con su padre"],
        progress: "Conectando patrones intergeneracionales. Sesión significativa.",
        state: { resistencia: 4.0, alianza: 5.5, apertura_emocional: 5.0, sintomatologia: 6.0, disposicion_cambio: 4.0 },
      },
      {
        summary: "Llegué enojado porque Marta y yo discutimos. Le dije que ella quiere que yo hable más de mis sentimientos y yo no sé cómo. El terapeuta me preguntó si quería aprender y le dije que sí, pero que me cuesta. Hablamos de que en la mina los hombres no hablan de esas cosas.",
        revelations: ["Conflicto con Marta por falta de comunicación emocional", "Reconoce que quiere aprender a expresarse", "Masculinidad minera como barrera"],
        progress: "Motivación al cambio emergiendo. Conflicto como catalizador.",
        state: { resistencia: 3.5, alianza: 6.0, apertura_emocional: 5.5, sintomatologia: 5.5, disposicion_cambio: 5.0 },
      },
      {
        summary: "Hoy le conté al terapeuta que el fin de semana salí a caminar al cerro San Cristóbal, solo. Hace meses que no hacía algo así. Me acordé de cuando llevaba a mis hijos chicos ahí. Mi hijo mayor, el Rodrigo, vive en Canadá y casi no hablamos. Me puse triste hablando de eso.",
        revelations: ["Retomó caminatas (cerro San Cristóbal)", "Hijo Rodrigo vive en Canadá, relación distante", "Nostalgia por la paternidad activa"],
        progress: "Expresando tristeza abiertamente. Progreso notable.",
        state: { resistencia: 2.5, alianza: 7.0, apertura_emocional: 6.5, sintomatologia: 5.0, disposicion_cambio: 5.5 },
      },
      {
        summary: "Le conté que llamé al Rodrigo a Canadá. Hablamos 20 minutos, la conversación más larga en años. Le pregunté por sus hijos, mis nietos que casi no conozco. El terapeuta me dijo que eso era valiente y me dio vergüenza pero también me sentí bien. También le mencioné que empecé a arreglar cosas en la casa, arreglé la puerta del patio que llevaba un año mala.",
        revelations: ["Llamó al hijo Rodrigo en Canadá (20 min)", "Tiene nietos que apenas conoce", "Arreglando cosas en la casa (activación conductual)"],
        progress: "Cambios conductuales concretos: reconexión familiar y activación.",
        state: { resistencia: 2.0, alianza: 7.5, apertura_emocional: 7.0, sintomatologia: 4.0, disposicion_cambio: 6.5 },
      },
    ],
  },
  {
    id: "e6e6f099-6285-43aa-8ba1-e1ea1b218add",
    name: "Carmen Torres",
    sessions: [
      {
        summary: "Vine porque mi jefa me lo sugirió después de un incidente en la oficina. No le voy a contar los detalles al terapeuta todavía. Solo le dije que trabajo en una agencia de marketing, Brandhouse, y que llevo 15 años ahí. Le hice varias preguntas al terapeuta para evaluar si es competente.",
        revelations: ["Trabaja en agencia Brandhouse hace 15 años", "Incidente laboral no revelado", "Evalúa competencia del terapeuta"],
        progress: "Extremadamente controladora. Intentó dirigir la sesión.",
        state: { resistencia: 8.5, alianza: 1.0, apertura_emocional: 1.0, sintomatologia: 7.0, disposicion_cambio: 1.0 },
      },
      {
        summary: "El terapeuta no se dejó intimidar por mis preguntas y eso me generó algo de respeto. Le conté que el incidente fue que le grité a una practicante frente a todo el equipo. No me arrepiento pero sé que estuvo mal. Mencioné que mi ex marido Andrés decía que soy demasiado intensa.",
        revelations: ["Gritó a una practicante frente al equipo", "Ex marido Andrés la calificaba de intensa", "No muestra arrepentimiento genuino"],
        progress: "Algo más abierta. Respeta que el terapeuta no se intimide.",
        state: { resistencia: 7.0, alianza: 2.5, apertura_emocional: 2.0, sintomatologia: 7.0, disposicion_cambio: 1.5 },
      },
      {
        summary: "Hoy le conté que me divorcié hace 3 años y que fue idea mía. Andrés era bueno pero yo me aburría con él. El terapeuta me preguntó si eso me pasa seguido, aburrirme de las personas, y me molestó la pregunta pero después pensé que tiene razón. Hablé de mi hija Isidora, tiene 12 años, vive conmigo.",
        revelations: ["Divorcio hace 3 años, iniciado por ella", "Patrón de aburrirse de las personas", "Hija Isidora de 12 años"],
        progress: "Primera grieta en la armadura. Reconoció un patrón.",
        state: { resistencia: 5.5, alianza: 3.5, apertura_emocional: 3.0, sintomatologia: 6.5, disposicion_cambio: 2.5 },
      },
      {
        summary: "El terapeuta me preguntó por mi infancia y le dije que crecí en Vitacura, colegio Villa María, todo perfecto. Pero después de un silencio largo admití que mi mamá Constanza era muy exigente y que nunca era suficiente para ella. Dije que eso me hizo fuerte pero el terapeuta me miró como dudando y me dio rabia.",
        revelations: ["Creció en Vitacura, colegio Villa María", "Madre Constanza extremadamente exigente", "Narrativa de fortaleza como defensa"],
        progress: "Revela historia familiar dolorosa. Rabia como defensa ante vulnerabilidad.",
        state: { resistencia: 4.5, alianza: 4.0, apertura_emocional: 4.0, sintomatologia: 6.5, disposicion_cambio: 3.0 },
      },
      {
        summary: "Llegué agotada. Por primera vez no intenté controlar la sesión. Le dije que la Isidora me dijo que le da miedo cuando me enojo y eso me destruyó por dentro. El terapeuta me preguntó si veía algo de su mamá en esa escena y lloré. Le dije que no quiero ser como Constanza.",
        revelations: ["Isidora le tiene miedo cuando se enoja", "Reconoce patrón intergeneracional con la madre", "Lloró en sesión (primera vez)"],
        progress: "Momento de quiebre fundamental. La hija como espejo.",
        state: { resistencia: 3.0, alianza: 6.0, apertura_emocional: 6.0, sintomatologia: 6.0, disposicion_cambio: 5.0 },
      },
      {
        summary: "Le conté que le pedí disculpas a la practicante, se llama Sofía, y que ella se largó a llorar y me abrazó. Me sentí incómoda pero también aliviada. El terapeuta me preguntó cómo se sintió pedir perdón y le dije que horrible pero necesario. Hablamos de que el control es mi forma de protegerme.",
        revelations: ["Pidió disculpas a la practicante Sofía", "El control como mecanismo protector", "Disculparse le resultó difícil pero liberador"],
        progress: "Cambios conductuales fuera de sesión. Insight sobre control.",
        state: { resistencia: 2.5, alianza: 7.0, apertura_emocional: 6.5, sintomatologia: 5.0, disposicion_cambio: 6.0 },
      },
      {
        summary: "Hoy hablamos de cómo quiero ser con la Isidora. Le dije que este fin de semana la llevé a patinar y no revisé el celular en toda la tarde. Fue raro pero lindo. También le conté que mi mamá Constanza me llamó y por primera vez no sentí que tenía que demostrarle nada. El terapeuta dijo que estoy empezando a soltar y creo que tiene razón.",
        revelations: ["Tarde con Isidora sin celular (presencia)", "Cambio en la relación con la madre Constanza", "Empezando a soltar el control"],
        progress: "Transformación visible. Integrando cambios en múltiples relaciones.",
        state: { resistencia: 2.0, alianza: 7.5, apertura_emocional: 7.0, sintomatologia: 4.0, disposicion_cambio: 7.0 },
      },
    ],
  },
  {
    id: "9ed3247f-4243-40cc-a133-a6dc2e7f5ead",
    name: "Diego Fuentes",
    sessions: [
      {
        summary: "No quería venir. Mi vieja me obligó. Le dije al terapeuta que estudio ingeniería en la Chile pero no me gusta. Que paso todo el día en la pieza jugando. No hablé mucho más.",
        revelations: ["Estudia ingeniería en U. de Chile sin vocación", "Pasa el día encerrado jugando videojuegos", "Madre lo obligó a asistir"],
        progress: "Monosilábico. Solo respondió lo mínimo.",
        state: { resistencia: 8.0, alianza: 1.0, apertura_emocional: 1.0, sintomatologia: 7.5, disposicion_cambio: 1.0 },
      },
      {
        summary: "El terapeuta me preguntó qué juego y le conté que juego Valorant y que soy bastante bueno, estoy en Diamante. Ahí hablé un poco más. Le dije que online tengo amigos pero en la universidad no hablo con nadie. Mencioné que mi compañero de carrera Felipe es el único que me saluda.",
        revelations: ["Juega Valorant competitivamente (rango Diamante)", "Sin amigos presenciales en la universidad", "Compañero Felipe es su único contacto"],
        progress: "Abrió un canal a través de sus intereses. Gaming como zona segura.",
        state: { resistencia: 6.5, alianza: 2.5, apertura_emocional: 2.0, sintomatologia: 7.0, disposicion_cambio: 1.5 },
      },
      {
        summary: "El terapeuta me preguntó desde cuándo me siento así y le dije que desde que entré a la universidad. En el colegio, el Instituto Nacional, tenía un grupo de amigos pero todos se fueron a otras carreras. Hablé un poco de mi papá que se fue de la casa cuando yo tenía 10. No quise profundizar en eso.",
        revelations: ["Estudió en el Instituto Nacional", "Grupo de amigos del colegio se dispersó", "Padre abandonó el hogar a los 10 años"],
        progress: "Reveló abandono paterno. No quiso profundizar pero lo nombró.",
        state: { resistencia: 5.5, alianza: 3.5, apertura_emocional: 3.0, sintomatologia: 7.0, disposicion_cambio: 2.5 },
      },
      {
        summary: "Hoy fue raro. Le conté que a veces pienso que nada tiene sentido y que si desapareciera nadie se daría cuenta. El terapeuta se puso serio y me preguntó si he pensado en hacerme daño. Le dije que no, que son solo pensamientos. Pero la verdad es que una vez, en segundo medio, me corté los brazos. No se lo conté.",
        revelations: ["Ideación pasiva: piensa que nadie notaría su ausencia", "Niega autolesión activa (pero miente)", "Autolesiones en segundo medio (no revelado aún)"],
        progress: "Sesión delicada. Ideación pasiva emergente. Secreto guardado.",
        state: { resistencia: 5.0, alianza: 4.0, apertura_emocional: 3.5, sintomatologia: 8.0, disposicion_cambio: 2.5 },
      },
      {
        summary: "Le conté al terapeuta que me congelé la carrera. Mi mamá se enojó mucho pero yo sentí alivio. El terapeuta me preguntó qué quiero hacer en vez de ingeniería y le dije que me gusta la música, toco guitarra desde los 12. Fue la primera vez que me sentí un poco bien en una sesión.",
        revelations: ["Congeló la carrera de ingeniería", "Toca guitarra desde los 12 años", "Conflicto con la madre por la decisión"],
        progress: "Alivio post-decisión. Primer momento positivo en terapia.",
        state: { resistencia: 4.0, alianza: 5.0, apertura_emocional: 4.5, sintomatologia: 6.5, disposicion_cambio: 4.0 },
      },
      {
        summary: "Hoy le conté lo de los cortes en segundo medio. El terapeuta no reaccionó exageradamente y eso me alivió. Me preguntó si sigue pasando y le dije que no, que fue solo esa vez después de que mi papá me prometió que iba a venir a mi cumpleaños y no llegó. También le dije que estoy pensando en estudiar producción musical.",
        revelations: ["Reveló autolesiones en segundo medio", "Gatillante: padre no cumplió promesa de cumpleaños", "Interés en producción musical como carrera"],
        progress: "Revelación del secreto más guardado. Confianza alta.",
        state: { resistencia: 2.5, alianza: 6.5, apertura_emocional: 6.0, sintomatologia: 5.5, disposicion_cambio: 5.5 },
      },
      {
        summary: "Le conté que empecé a subir covers a YouTube, tengo un canal que se llama 'dfuentes music' y ya tengo 47 suscriptores. Me da vergüenza pero también me gusta. El terapeuta me preguntó si Felipe sabía y le dije que sí, que fue el primero en suscribirse. También salí a caminar esta semana, dos veces, al parque que está cerca de mi depto.",
        revelations: ["Canal de YouTube 'dfuentes music' con 47 suscriptores", "Felipe lo apoya con su música", "Empezó a salir a caminar"],
        progress: "Activación conductual múltiple. Identidad emergiendo.",
        state: { resistencia: 2.0, alianza: 7.0, apertura_emocional: 6.5, sintomatologia: 4.5, disposicion_cambio: 6.5 },
      },
    ],
  },
  {
    id: "f9517a4b-673f-4d02-9e92-96a3d8d2db09",
    name: "Marcos Herrera",
    sessions: [
      {
        summary: "Vine porque mi jefa de UTP me lo sugirió. Soy profesor de historia en el Liceo Bicentenario de Maipú y últimamente no estoy rindiendo. Le dije al terapeuta que estoy cansado, nada más. No quiero que piensen que estoy loco.",
        revelations: ["Profesor de historia en Liceo Bicentenario de Maipú", "Jefa de UTP sugirió terapia", "Estigma sobre salud mental"],
        progress: "Resistente por estigma. Minimiza todo.",
        state: { resistencia: 7.5, alianza: 2.0, apertura_emocional: 1.5, sintomatologia: 7.0, disposicion_cambio: 2.0 },
      },
      {
        summary: "Le conté que llevo 10 años haciendo clases y que antes me encantaba pero ahora siento que los cabros no me pescan. El terapeuta me preguntó qué cambió y le dije que desde la pandemia todo se fue al carajo. Mencioné que mi señora Camila trabaja en enfermería y casi no nos vemos.",
        revelations: ["10 años de docencia, antes con vocación", "Desmotivación post-pandemia", "Esposa Camila trabaja en enfermería, poco tiempo juntos"],
        progress: "Habló de su agotamiento laboral con algo más de detalle.",
        state: { resistencia: 6.0, alianza: 3.5, apertura_emocional: 2.5, sintomatologia: 7.0, disposicion_cambio: 2.5 },
      },
      {
        summary: "Hoy exploté. Le conté que un apoderado me amenazó porque le puse un 2 a su hijo y la directora no me respaldó. Me sentí solo y traicionado. El terapeuta validó mi rabia y fue la primera vez que alguien me dijo que tenía derecho a estar enojado. Eso me descolocó.",
        revelations: ["Apoderado lo amenazó por una nota", "Directora no lo respaldó", "Se siente traicionado por la institución"],
        progress: "Validación emocional como punto de inflexión. Primera conexión real.",
        state: { resistencia: 4.0, alianza: 5.0, apertura_emocional: 4.5, sintomatologia: 7.0, disposicion_cambio: 3.5 },
      },
      {
        summary: "Le conté que mi papá don Eduardo también fue profesor y murió enseñando, literalmente le dio un ACV en la sala de clases. Yo tenía 22. El terapeuta me preguntó si siento que voy por el mismo camino y me quedé callado un rato largo. La respuesta es sí.",
        revelations: ["Padre don Eduardo murió de ACV dando clases", "Miedo de repetir el destino del padre", "Silencio significativo como respuesta"],
        progress: "Conexión intergeneracional profunda. Miedo existencial.",
        state: { resistencia: 3.0, alianza: 6.0, apertura_emocional: 5.5, sintomatologia: 6.5, disposicion_cambio: 4.0 },
      },
      {
        summary: "Hoy le dije que estoy pensando en dejar la docencia y me costó decirlo porque siento que traiciono a mi papá. El terapeuta me preguntó si mi papá hubiera querido que yo fuera infeliz y eso me hizo llorar. Mencioné que Camila me apoya en lo que decida pero yo no sé qué haría si no soy profesor.",
        revelations: ["Considera dejar la docencia", "Culpa por traicionar el legado del padre", "Crisis de identidad: no sabe quién es sin ser profesor"],
        progress: "Crisis de identidad como tema central. Llanto genuino.",
        state: { resistencia: 2.5, alianza: 7.0, apertura_emocional: 6.5, sintomatologia: 6.0, disposicion_cambio: 5.0 },
      },
      {
        summary: "Le conté que un alumno, el Bastián, se me acercó después de clases y me dijo 'profe, usted es el único que nos trata como personas'. Eso me pegó fuerte. Le dije al terapeuta que quizás no quiero dejar de ser profesor sino dejar de ser este profesor agotado. Hablamos de qué necesitaría para renovarse.",
        revelations: ["Alumno Bastián le dio retroalimentación positiva", "Reformuló: no quiere dejar la docencia sino el agotamiento", "Buscando renovación, no abandono"],
        progress: "Reformulación del problema. De 'dejar todo' a 'cambiar algo'.",
        state: { resistencia: 2.0, alianza: 7.5, apertura_emocional: 7.0, sintomatologia: 5.0, disposicion_cambio: 6.5 },
      },
      {
        summary: "Le conté que me inscribí en un diplomado de innovación pedagógica en la UDP, los sábados. Camila me dijo que me vio entusiasmado por primera vez en mucho tiempo. También le hablé al terapeuta de que quiero hacer un taller de historia con películas para los alumnos, algo distinto. Me siento mejor pero sé que todavía hay cosas que resolver.",
        revelations: ["Se inscribió en diplomado de innovación pedagógica (UDP)", "Camila nota cambio positivo", "Proyecto de taller de historia con cine"],
        progress: "Acción concreta. Recuperando vocación con enfoque renovado.",
        state: { resistencia: 1.5, alianza: 8.0, apertura_emocional: 7.5, sintomatologia: 4.0, disposicion_cambio: 7.5 },
      },
    ],
  },
];

async function main() {
  console.log("=== Seeding 7 sessions x 5 patients ===\n");

  for (const patient of PATIENTS) {
    console.log(`\n${patient.name} (${patient.sessions.length} sessions)`);

    for (let i = 0; i < patient.sessions.length; i++) {
      const s = patient.sessions[i];
      const sessionNum = i + 1;
      const daysAgo = (patient.sessions.length - i) * 2; // sessions every 2 days
      const sessionDate = new Date(Date.now() - daysAgo * 86400000);

      // Create completed conversation
      const { data: conv, error: convErr } = await sb.from("conversations").insert({
        student_id: STUDENT_ID,
        ai_patient_id: patient.id,
        session_number: sessionNum,
        status: "completed",
        started_at: sessionDate.toISOString(),
        ended_at: new Date(sessionDate.getTime() + 30 * 60000).toISOString(),
        active_seconds: 1500 + Math.floor(Math.random() * 600),
      }).select("id").single();

      if (convErr) { console.error(`  Conv ${sessionNum} error:`, convErr.message); continue; }

      // Create session summary
      const { error: sumErr } = await sb.from("session_summaries").insert({
        conversation_id: conv.id,
        student_id: STUDENT_ID,
        ai_patient_id: patient.id,
        session_number: sessionNum,
        summary: s.summary,
        key_revelations: s.revelations,
        therapeutic_progress: s.progress,
        final_clinical_state: s.state,
        created_at: sessionDate.toISOString(),
      });

      if (sumErr) console.error(`  Summary ${sessionNum} error:`, sumErr.message);
      else process.stdout.write(`  S${sessionNum}`);
    }
  }

  console.log("\n\n=== Done! 35 sessions seeded ===");
  console.log(`Student: ${STUDENT_ID} (Francisco Paolo)`);
  console.log("Now login as Francisco Paolo and start session 8 with any of the 5 patients.");
}

main().catch(console.error);
