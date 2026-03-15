const OpenAI = require("openai");
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const admin = createClient(
  "https://ndwmnxlwbfqfwwtekjun.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kd21ueGx3YmZxZnd3dGVranVuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzQyOTk4OCwiZXhwIjoyMDg5MDA1OTg4fQ.ImxlaY4rFzq9gQrqBitJjzAfZKdFppmT98dpeOU-YSE"
);

const SCRIPTS = [
  // Session 1: First contact
  [
    "Hola, buenas tardes. Tome asiento. Como se encuentra hoy?",
    "Que lo trae por aqui?",
    "Sus hijos lo enviaron. Y usted que piensa al respecto?",
    "Como ha sido su vida estos ultimos meses?",
    "Cuenteme sobre su rutina diaria.",
    "Como duerme por las noches?",
    "Ha dejado de hacer cosas que antes disfrutaba?",
    "Tiene contacto con amigos?",
    "Hay algo que le preocupe especialmente?",
    "Noto que habla de hechos pero poco de como se siente.",
    "Como se siente cuando esta solo en casa?",
    "Es normal sentir dolor ante una perdida asi.",
    "Le gustaria que nos sigamos viendo?",
    "Vamos a cerrar por hoy. Como se va?",
    "Nos vemos la proxima semana.",
  ],
  // Session 2: Building rapport
  [
    "Bienvenido de nuevo. Como estuvo su semana?",
    "Penso en algo de lo que conversamos?",
    "Cuenteme mas sobre Maria. Como era ella?",
    "Que es lo que mas extrana de ella?",
    "Noto que se le humedecen los ojos.",
    "Esta bien sentir eso. No tiene que contenerse aqui.",
    "Como era su relacion con Maria?",
    "Discutian? Sobre que?",
    "Hay algo que le hubiera gustado decirle?",
    "Como fue el proceso de su enfermedad?",
    "Eso suena muy dificil. Como lo vivio usted?",
    "Quien lo acompano durante ese tiempo?",
    "Ha podido llorar por ella?",
    "Que significa para usted llorar?",
    "Lo escucho y lo respeto. Nos vemos la proxima semana.",
  ],
  // Session 3: Exploring grief
  [
    "Buenas tardes. Como ha estado?",
    "La vez pasada hablamos de Maria. Le costo la sesion?",
    "Ha hablado con sus hijos sobre como se siente?",
    "Por que cree que le cuesta hablar de emociones?",
    "Su padre era asi tambien?",
    "Que le ensenaron sobre mostrar emociones de nino?",
    "Parece que hay una creencia de que los hombres no deben llorar.",
    "Que piensa usted de eso ahora?",
    "Esa creencia le ha servido o le ha costado?",
    "Hay momentos que siente ganas de llorar pero se contiene?",
    "Que pasa cuando se contiene?",
    "Ha notado sintomas fisicos? Dolor de cabeza, tension?",
    "A veces el cuerpo expresa lo que la mente no permite.",
    "Como se siente ahora, en este momento?",
    "Gracias por compartir eso. Nos vemos.",
  ],
  // Session 4: Deeper exploration
  [
    "Hola, bienvenido. Como le fue esta semana?",
    "Paso algo diferente?",
    "Menciono que se contiene. Le paso esta semana?",
    "Me gustaria preguntarle algo personal. Esta bien?",
    "Habla con Maria todavia? Con su foto, por ejemplo?",
    "Eso es mas comun de lo que cree. No tiene nada de malo.",
    "Que le dice cuando le habla?",
    "Siente que ella le responde de alguna forma?",
    "Ha sentido su presencia en la casa?",
    "Como es esa sensacion?",
    "Le da miedo o le reconforta?",
    "Ha compartido esto con alguien?",
    "Aqui es un espacio seguro.",
    "Tiene miedo de algo respecto a su duelo?",
    "Lo que me comparte es muy valioso. Nos vemos.",
  ],
  // Session 5: Working through resistance
  [
    "Buenas tardes. Como esta hoy?",
    "Ha pensado en dejar la terapia?",
    "Es completamente normal tener esa duda.",
    "Que le diria Maria si supiera que esta en terapia?",
    "Parece que eso lo conmueve.",
    "Tiene miedo de olvidarla?",
    "Que significaria superar el duelo?",
    "Siente que si deja de sufrir, la traiciona?",
    "El dolor no es la unica forma de recordar a alguien.",
    "Que otras formas de recordarla tiene?",
    "Que cree que ella querria para usted?",
    "Noto que sonrie cuando habla de los buenos recuerdos.",
    "Cuando fue la ultima vez que sonrio asi fuera de aqui?",
    "Le gustaria recuperar esos momentos?",
    "Vamos a seguir trabajando en eso. Nos vemos.",
  ],
  // Session 6: Emotional breakthrough
  [
    "Hola. Como estuvo su semana?",
    "Hizo algo diferente?",
    "Como se sintio?",
    "Usted menciono que sonreir le hacia sentir culpa. Sigue asi?",
    "Que ha cambiado?",
    "Parece que se permite sentir cosas distintas al dolor.",
    "Como es eso para usted?",
    "Ha podido llorar esta semana?",
    "Como fue esa experiencia?",
    "Eso requiere mucho coraje.",
    "Como estan las cosas con sus hijos?",
    "Ha podido hablar con ellos de como se siente?",
    "Que le dijeron?",
    "Como se siente despues de hablar con ellos?",
    "Estamos avanzando mucho. Nos vemos.",
  ],
  // Session 7: Integration
  [
    "Buenas tardes. Como va todo?",
    "Han pasado varias sesiones. Como se siente respecto a cuando empezo?",
    "Que ha sido lo mas dificil de este proceso?",
    "Y lo mas valioso?",
    "Ha retomado alguna actividad social?",
    "Cuenteme mas sobre eso.",
    "Como se siente en esas situaciones?",
    "Todavia habla con la foto de Maria?",
    "Ha cambiado lo que le dice?",
    "Sigue sintiendo su presencia?",
    "Como interpreta eso ahora?",
    "Ha hecho un camino importante.",
    "Hay algo que todavia le pese?",
    "Como le gustaria continuar?",
    "Vamos a pensar en el cierre. Nos vemos.",
  ],
  // Session 8: Closure
  [
    "Hola. Esta es nuestra ultima sesion. Como esta?",
    "Hagamos un recorrido por lo que hemos trabajado.",
    "Recuerda como se sentia cuando llego la primera vez?",
    "Que ha cambiado desde entonces?",
    "Que se lleva de este proceso?",
    "Hay algo que le hubiera gustado trabajar mas?",
    "Como esta su relacion con sus hijos ahora?",
    "Ha recuperado alguna amistad?",
    "Como ve su futuro?",
    "Que le diria a Maria si pudiera tener una ultima conversacion?",
    "Eso es muy profundo. Gracias por compartirlo.",
    "Siente que puede seguir este camino solo?",
    "Si necesita volver, las puertas estan abiertas.",
    "Como se va hoy?",
    "Ha sido un privilegio acompanarlo. Le deseo lo mejor.",
  ],
];

async function runSession(patient, sessionNum, prevSummary) {
  const script = SCRIPTS[sessionNum - 1];
  const memoryBlock = prevSummary
    ? "\n[MEMORIA DE SESION ANTERIOR]\n" + prevSummary + "\n[FIN MEMORIA]\n"
    : "";

  const systemPrompt =
    patient.system_prompt +
    "\n\nEsta es la sesion numero " + sessionNum + " con este terapeuta. La sesion anterior fue hace 1 semana." +
    memoryBlock +
    "\n[ROLES]\nTu eres " + patient.name + ", el PACIENTE. La persona que te escribe es el TERAPEUTA.\n" +
    "\n[REGLA ANTI-REPETICION]\nNUNCA repitas textualmente una respuesta que ya diste.\n";

  const messages = [{ role: "system", content: systemPrompt }];
  const transcript = [];

  for (const line of script) {
    await new Promise((r) => setTimeout(r, 2500)); // Rate limit delay
    messages.push({ role: "user", content: line });
    const res = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      max_tokens: 150,
      temperature: 0.8,
    });
    const reply = res.choices[0].message.content;
    messages.push({ role: "assistant", content: reply });
    transcript.push({ therapist: line, patient: reply });
  }

  // Build summary for next session
  const lastFew = transcript.slice(-5).map((t) => "T: " + t.therapist + "\nP: " + t.patient).join("\n");
  const summary = "Sesion " + sessionNum + ":\n" + lastFew;

  return { sessionNum, transcript, summary };
}

async function main() {
  const { data: patient } = await admin
    .from("ai_patients")
    .select("name, system_prompt")
    .eq("name", "Roberto Salas")
    .single();

  console.log("Paciente:", patient.name);
  console.log("Iniciando 8 sesiones simuladas (15 turnos cada una)...\n");

  const results = [];
  let prevSummary = "";

  for (let i = 1; i <= 8; i++) {
    console.log("=== SESION " + i + "/8 ===");
    const result = await runSession(patient, i, prevSummary);
    prevSummary = result.summary;
    results.push(result);

    const last = result.transcript[result.transcript.length - 1];
    console.log("  Turnos:", result.transcript.length);
    console.log("  Ultimo turno:");
    console.log("    T:", last.therapist);
    console.log("    P:", last.patient);
    console.log("");
  }

  fs.writeFileSync("/tmp/roberto_8sessions.json", JSON.stringify(results, null, 2));
  console.log("Resultados guardados en /tmp/roberto_8sessions.json");
  console.log("=== COMPLETADO ===");
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
