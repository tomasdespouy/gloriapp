/**
 * Simulates 8 therapy sessions with Roberto Salas
 * through GlorIA's /api/chat endpoint (motor adaptativo + RAG active).
 *
 * Each session: 15 turns (~60 min simulated).
 * Waits between turns to respect rate limits.
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const GLORIA_BASE = "http://localhost:3000";
const SUPABASE_URL = "https://ndwmnxlwbfqfwwtekjun.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kd21ueGx3YmZxZnd3dGVranVuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzQyOTk4OCwiZXhwIjoyMDg5MDA1OTg4fQ.ImxlaY4rFzq9gQrqBitJjzAfZKdFppmT98dpeOU-YSE";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kd21ueGx3YmZxZnd3dGVranVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0Mjk5ODgsImV4cCI6MjA4OTAwNTk4OH0.jCn4UZWuLKC3ebYVnkEErWbXNUN17yZ58l9XXXcHv_g";

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

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

async function getAuthToken() {
  // Sign in as test student (Tomas)
  const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await supabaseAnon.auth.signInWithPassword({
    email: "tomasdespouy@gmail.com",
    password: "Admin2026!",
  });
  if (error) throw new Error("Auth failed: " + error.message);
  return data.session.access_token;
}

async function sendMessage(token, patientId, conversationId, message) {
  const res = await fetch(GLORIA_BASE + "/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": "sb-ndwmnxlwbfqfwwtekjun-auth-token=" + token,
    },
    body: JSON.stringify({
      patientId,
      conversationId: conversationId || undefined,
      message,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error("Chat API error " + res.status + ": " + text);
  }

  // Parse SSE stream
  const text = await res.text();
  let convId = conversationId;
  let fullResponse = "";

  const events = text.split("\n\n").filter(Boolean);
  for (const event of events) {
    if (!event.startsWith("data: ")) continue;
    try {
      const data = JSON.parse(event.slice(6));
      if (data.type === "conversation_id") convId = data.value;
      if (data.type === "token") fullResponse += data.value;
    } catch {}
  }

  return { conversationId: convId, response: fullResponse };
}

async function main() {
  // Get Roberto's patient ID
  const { data: roberto } = await admin
    .from("ai_patients")
    .select("id, name")
    .eq("name", "Roberto Salas")
    .single();

  console.log("Paciente:", roberto.name, "ID:", roberto.id);

  // Get auth token
  let token;
  try {
    token = await getAuthToken();
    console.log("Auth OK");
  } catch (e) {
    console.error("Auth failed:", e.message);
    console.log("Trying to set password...");
    await admin.auth.admin.updateUserById(
      (await admin.from("profiles").select("id").eq("email", "tomasdespouy@gmail.com").single()).data.id,
      { password: "Admin2026!" }
    );
    token = await getAuthToken();
    console.log("Auth OK (after password reset)");
  }

  console.log("Iniciando 8 sesiones via API de GlorIA (motor adaptativo + RAG activos)...\n");

  const results = [];

  for (let s = 0; s < 8; s++) {
    console.log("=== SESION " + (s + 1) + "/8 ===");
    const script = SCRIPTS[s];
    let conversationId = null;
    const transcript = [];

    for (let t = 0; t < script.length; t++) {
      await new Promise((r) => setTimeout(r, 3000)); // Rate limit

      try {
        const result = await sendMessage(token, roberto.id, conversationId, script[t]);
        conversationId = result.conversationId;
        transcript.push({ therapist: script[t], patient: result.response });

        if (t === script.length - 1) {
          console.log("  Turnos:", transcript.length);
          console.log("  ConvID:", conversationId);
          console.log("  Ultimo:");
          console.log("    T:", script[t]);
          console.log("    P:", result.response.slice(0, 120));
        }
      } catch (e) {
        console.log("  ERROR turno " + (t + 1) + ":", e.message);
        break;
      }
    }

    results.push({
      session: s + 1,
      conversationId,
      transcript,
    });
    console.log("");
  }

  // Save results
  fs.writeFileSync("public/roberto_8sessions_motor.json", JSON.stringify(results, null, 2));
  console.log("Resultados guardados en public/roberto_8sessions_motor.json");

  // Check clinical state logs
  for (const r of results) {
    if (!r.conversationId) continue;
    const { data: logs } = await admin
      .from("clinical_state_log")
      .select("turn_number, intervention_type, resistencia, alianza, apertura_emocional")
      .eq("conversation_id", r.conversationId)
      .order("turn_number");

    console.log("\nSesion " + r.session + " - Estado clinico:");
    if (logs && logs.length > 0) {
      console.log("  Turn | Intervencion         | Resist | Alianza | Apertura");
      logs.forEach(function(l) {
        console.log(
          "  " + String(l.turn_number).padStart(2) + "   | " +
          l.intervention_type.padEnd(20) + " | " +
          Number(l.resistencia).toFixed(1).padStart(5) + "  | " +
          Number(l.alianza).toFixed(1).padStart(5) + "   | " +
          Number(l.apertura_emocional).toFixed(1).padStart(5)
        );
      });
    } else {
      console.log("  Sin logs de estado (motor no se activo?)");
    }
  }

  console.log("\n=== COMPLETADO ===");
}

main().catch(function(e) {
  console.error("FATAL:", e.message);
  process.exit(1);
});
