// Extrae toda la data del piloto UBO (Universidad Bernardo O'Higgins)
// y la guarda en informes/ubo-pilot-data.json. Este JSON es la fuente
// unica del generador docx.

// Carga .env.production si existe; si no, cae a .env.local
const fs = require("fs");
if (fs.existsSync(".env.production")) {
  require("dotenv").config({ path: ".env.production" });
  console.log("[env] usando .env.production");
} else {
  require("dotenv").config({ path: ".env.local" });
  console.log("[env] usando .env.local (no se encontro .env.production)");
}
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

async function main() {
  // 1) Encontrar el piloto UBO finalizado
  const { data: pilots, error: pilotsErr } = await supabase
    .from("pilots")
    .select("id, name, institution, country, status, started_at, ended_at, scheduled_at, created_at, contact_name, contact_email, establishment_id")
    .ilike("institution", "%Bernardo%O%Higgins%");
  if (pilotsErr) throw pilotsErr;
  if (!pilots || pilots.length === 0) {
    // fallback: buscar por nombre
    const { data: alt } = await supabase
      .from("pilots")
      .select("id, name, institution, country, status, started_at, ended_at, scheduled_at, created_at, contact_name, contact_email, establishment_id")
      .ilike("name", "%bernard%");
    if (alt && alt.length > 0) pilots.push(...alt);
  }
  if (!pilots || pilots.length === 0) {
    console.error("No se encontro piloto UBO.");
    console.error("Listando todos los pilotos disponibles para ayudar a identificar:");
    const { data: all } = await supabase
      .from("pilots")
      .select("id, name, institution, status, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    console.log(all);
    process.exit(1);
  }
  // Si hay varios, elegir el finalizado o el mas reciente
  const pilot = pilots.find((p) => p.status === "finalizado") || pilots[0];
  console.log(`Piloto encontrado: ${pilot.name} (${pilot.id}) — status=${pilot.status}`);

  // 2) Participantes
  const { data: participants, error: pErr } = await supabase
    .from("pilot_participants")
    .select("id, email, full_name, role, status, user_id, invite_sent_at, first_login_at, sessions_count, last_active_at")
    .eq("pilot_id", pilot.id)
    .order("full_name");
  if (pErr) throw pErr;
  console.log(`${participants.length} participantes.`);

  // 3) Conversaciones de cada participante
  const userIds = participants.filter((p) => p.user_id).map((p) => p.user_id);
  const { data: conversations, error: cErr } = await supabase
    .from("conversations")
    .select("id, student_id, ai_patient_id, status, created_at, ended_at, session_number")
    .in("student_id", userIds);
  if (cErr) throw cErr;
  console.log(`${conversations.length} conversaciones totales.`);

  // 4) Duracion por conversacion (primer y ultimo mensaje)
  const convIds = conversations.map((c) => c.id);
  const { data: messages } = await supabase
    .from("messages")
    .select("conversation_id, role, content, created_at")
    .in("conversation_id", convIds)
    .order("created_at", { ascending: true });

  const convMetrics = new Map();
  for (const m of messages || []) {
    const cur = convMetrics.get(m.conversation_id) || { first: m.created_at, last: m.created_at, msgs: 0, userMsgs: 0, assistantMsgs: 0 };
    cur.last = m.created_at;
    cur.msgs += 1;
    if (m.role === "user") cur.userMsgs += 1;
    if (m.role === "assistant") cur.assistantMsgs += 1;
    convMetrics.set(m.conversation_id, cur);
  }

  // 5) Pacientes IA (para nombre + pacing)
  const patientIds = [...new Set(conversations.map((c) => c.ai_patient_id))];
  const { data: aiPatients } = await supabase
    .from("ai_patients")
    .select("id, name, age, pacing_profile")
    .in("id", patientIds);
  const patientById = new Map((aiPatients || []).map((p) => [p.id, p]));

  // 6) Respuestas de encuesta — el pilot_id vive en `surveys`, NO en
  // `survey_responses`. Hay que traer primero las surveys del piloto y
  // despues las responses cuyo survey_id este en esa lista.
  const { data: pilotSurveys } = await supabase
    .from("surveys")
    .select("id, title, pilot_id, schema")
    .eq("pilot_id", pilot.id);
  console.log(`Surveys del piloto: ${(pilotSurveys || []).length}`);

  const surveyIds = (pilotSurveys || []).map((s) => s.id);
  let surveyResponses = [];
  if (surveyIds.length > 0) {
    const { data } = await supabase
      .from("survey_responses")
      .select("id, user_id, survey_id, status, created_at, answers")
      .in("survey_id", surveyIds);
    surveyResponses = data || [];
  }
  // Fallback: buscar responses por user_id (por si el piloto no tiene surveys asociados)
  if (surveyResponses.length === 0 && userIds.length > 0) {
    const { data } = await supabase
      .from("survey_responses")
      .select("id, user_id, survey_id, status, created_at, answers")
      .in("user_id", userIds);
    surveyResponses = data || [];
    console.log(`Fallback por user_id: ${surveyResponses.length} responses`);
  }
  console.log(`${surveyResponses.length} respuestas de encuesta.`);

  // Tratar de leer survey_responses_answers (esquema detallado si existe)
  let answersDetailed = [];
  try {
    const { data } = await supabase
      .from("survey_responses_answers")
      .select("response_id, question_key, question_text, answer_value, answer_text")
      .in("response_id", surveyResponses.map((r) => r.id));
    answersDetailed = data || [];
  } catch { /* tabla opcional */ }
  console.log(`${answersDetailed.length} filas en survey_responses_answers.`);

  // 7) Competencias evaluadas — schema: una fila por conversation con
  // todas las competencias como columnas (no long-format). Ademas trae
  // evidencias/comentarios estructurados si existen.
  let sessionCompetencies = [];
  try {
    const { data } = await supabase
      .from("session_competencies")
      .select("*")
      .in("conversation_id", convIds);
    sessionCompetencies = data || [];
  } catch (e) {
    console.log("(session_competencies error:", e.message, ")");
  }
  console.log(`${sessionCompetencies.length} filas en session_competencies.`);

  // Si 0, chequear si la tabla tiene DATA en general (para distinguir
  // "tabla vacia globalmente" vs "nuestras conversaciones no estan")
  if (sessionCompetencies.length === 0) {
    const { count } = await supabase
      .from("session_competencies")
      .select("*", { count: "exact", head: true });
    console.log(`(diagnostico) session_competencies total en la tabla: ${count}`);
  }

  // Tambien: session_feedback / session_evaluations como fallback
  let sessionFeedback = [];
  try {
    const { data } = await supabase
      .from("session_feedback")
      .select("*")
      .in("conversation_id", convIds);
    sessionFeedback = data || [];
  } catch { /* opcional */ }
  console.log(`${sessionFeedback.length} filas en session_feedback.`);

  // 8) Session summaries (si existen — util para descripcion de la sesion)
  let summaries = [];
  try {
    const { data } = await supabase
      .from("session_summaries")
      .select("conversation_id, summary, student_id")
      .in("conversation_id", convIds);
    summaries = data || [];
  } catch { /* opcional */ }

  // 9) Guardar todo
  const out = {
    extractedAt: new Date().toISOString(),
    pilot,
    participants,
    conversations: conversations.map((c) => ({
      ...c,
      metrics: convMetrics.get(c.id) || null,
      patient: patientById.get(c.ai_patient_id) || null,
    })),
    messagesByConversation: (() => {
      const m = {};
      for (const msg of messages || []) {
        (m[msg.conversation_id] ||= []).push({ role: msg.role, content: msg.content, created_at: msg.created_at });
      }
      return m;
    })(),
    aiPatients,
    pilotSurveys,
    surveyResponses,
    answersDetailed,
    sessionCompetencies,
    sessionFeedback,
    summaries,
  };

  fs.mkdirSync("informes", { recursive: true });
  fs.writeFileSync("informes/ubo-pilot-data.json", JSON.stringify(out, null, 2));
  console.log(`\nEscrito: informes/ubo-pilot-data.json (${(JSON.stringify(out).length / 1024).toFixed(1)} KB)`);

  // Resumen rapido para validar
  console.log("\n=== Resumen ===");
  console.log(`Piloto: ${pilot.name}`);
  console.log(`Institucion: ${pilot.institution}`);
  console.log(`Estado: ${pilot.status}`);
  console.log(`Participantes: ${participants.length}`);
  console.log(`  - Con user_id (creados): ${userIds.length}`);
  console.log(`  - Con first_login_at (conectados): ${participants.filter((p) => p.first_login_at).length}`);
  console.log(`  - Status=activo: ${participants.filter((p) => p.status === "activo").length}`);
  console.log(`Conversaciones: ${conversations.length}`);
  console.log(`  - Completadas: ${conversations.filter((c) => c.status === "completed").length}`);
  console.log(`Mensajes totales: ${(messages || []).length}`);
  console.log(`Encuestas respondidas: ${(surveyResponses || []).filter((r) => r.status === "completed").length}`);
  console.log(`Filas en survey_responses_answers: ${answersDetailed.length}`);
  console.log(`Filas en session_competencies: ${sessionCompetencies.length}`);
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
