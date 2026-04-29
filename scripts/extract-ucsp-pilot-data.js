// Extrae la data CONSOLIDADA de los dos pilotos UCSP (Universidad Católica
// San Pablo, Arequipa) y la guarda en informes/ucsp-pilot-data.json. Cada
// participant/conversation/response queda etiquetado con `cohort: 1` o
// `cohort: 2` segun el piloto al que pertenece.
//
//   Cohorte 1: pilot_id 0838ee2a... (status=cancelado, scheduled 22-abr 13:00 UTC)
//   Cohorte 2: pilot_id 037c2c99... (status=finalizado, scheduled 22-abr 22:41 UTC)
//
// Ambas cohortes son grupos distintos de 44 estudiantes cada una (sin
// solapamiento de emails). Confirmado via SELECT en prod 2026-04-28.

const fs = require("fs");
if (fs.existsSync(".env.production")) {
  require("dotenv").config({ path: ".env.production" });
  console.log("[env] usando .env.production");
} else {
  require("dotenv").config({ path: ".env.local" });
  console.log("[env] usando .env.local — OJO: si apunta a staging no encontrara los pilotos UCSP de prod");
}
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const COHORTS = [
  { id: "0838ee2a-bd00-40f3-9b2d-3786b9b23e3b", cohort: 1 },
  { id: "037c2c99-9da3-4716-be8c-d1401e8a7961", cohort: 2 },
];

async function extractCohort({ id, cohort }) {
  console.log(`\n=== Cohorte ${cohort} (${id}) ===`);

  // 1) Piloto
  const { data: pilot, error: pilotErr } = await supabase
    .from("pilots")
    .select("id, name, institution, country, status, started_at, ended_at, scheduled_at, created_at, contact_name, contact_email, establishment_id, is_anonymous")
    .eq("id", id)
    .single();
  if (pilotErr) throw pilotErr;
  console.log(`Piloto: ${pilot.name} — status=${pilot.status}`);

  // 2) Participantes
  const { data: participants, error: pErr } = await supabase
    .from("pilot_participants")
    .select("id, email, full_name, role, status, user_id, invite_sent_at, first_login_at, sessions_count, last_active_at")
    .eq("pilot_id", id)
    .order("full_name");
  if (pErr) throw pErr;
  console.log(`Participantes: ${participants.length}`);

  // 3) Conversaciones
  const userIds = participants.filter((p) => p.user_id).map((p) => p.user_id);
  const { data: conversations, error: cErr } = await supabase
    .from("conversations")
    .select("id, student_id, ai_patient_id, status, created_at, ended_at, session_number")
    .in("student_id", userIds);
  if (cErr) throw cErr;
  console.log(`Conversaciones: ${conversations.length}`);

  // 4) Mensajes (para metrics y duracion). PostgREST limita a 1000 filas
  // por default — paginamos hasta agotar para no truncar las metricas.
  const convIds = conversations.map((c) => c.id);
  const messages = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error: msgErr } = await supabase
      .from("messages")
      .select("conversation_id, role, content, created_at")
      .in("conversation_id", convIds)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (msgErr) {
      console.log(`(messages page ${from} error: ${msgErr.message})`);
      break;
    }
    if (!data || data.length === 0) break;
    messages.push(...data);
    if (data.length < PAGE) break;
  }

  const convMetrics = new Map();
  for (const m of messages || []) {
    const cur = convMetrics.get(m.conversation_id) || {
      first: m.created_at, last: m.created_at, msgs: 0, userMsgs: 0, assistantMsgs: 0,
    };
    cur.last = m.created_at;
    cur.msgs += 1;
    if (m.role === "user") cur.userMsgs += 1;
    if (m.role === "assistant") cur.assistantMsgs += 1;
    convMetrics.set(m.conversation_id, cur);
  }
  console.log(`Mensajes: ${(messages || []).length}`);

  // 5) Pacientes IA
  const patientIds = [...new Set(conversations.map((c) => c.ai_patient_id))];
  const { data: aiPatients } = patientIds.length > 0
    ? await supabase.from("ai_patients").select("id, name, age, pacing_profile").in("id", patientIds)
    : { data: [] };

  // 6) Encuesta — patron del endpoint supradmin /survey-responses:
  // traemos responses directamente por user_id (cubre tanto la survey
  // del piloto como cualquier global). Filtramos a status=completed
  // porque las 'not_taken' tienen answers=null. La columna `schema`
  // que tenia la query antigua no existe en surveys → daba array
  // vacio en silencio y el resto del informe se quedaba sin datos.
  const { data: pilotSurveys, error: surveysErr } = await supabase
    .from("surveys")
    .select("id, title, pilot_id, form_version")
    .eq("pilot_id", id);
  if (surveysErr) console.log(`(surveys query error: ${surveysErr.message})`);

  let surveyResponses = [];
  if (userIds.length > 0) {
    const { data, error: respErr } = await supabase
      .from("survey_responses")
      .select("id, user_id, survey_id, status, created_at, answers")
      .in("user_id", userIds)
      .eq("status", "completed");
    if (respErr) console.log(`(survey_responses query error: ${respErr.message})`);
    surveyResponses = data || [];
  }
  console.log(`Encuestas respondidas: ${surveyResponses.length} (status=completed; surveys del piloto: ${(pilotSurveys || []).length})`);

  // 7) Detalle de respuestas (si existe la tabla larga)
  let answersDetailed = [];
  try {
    const { data } = await supabase
      .from("survey_responses_answers")
      .select("response_id, question_key, question_text, answer_value, answer_text")
      .in("response_id", surveyResponses.map((r) => r.id));
    answersDetailed = data || [];
  } catch { /* opcional */ }

  // 8) Competencias
  let sessionCompetencies = [];
  try {
    const { data } = await supabase
      .from("session_competencies")
      .select("*")
      .in("conversation_id", convIds);
    sessionCompetencies = data || [];
  } catch (e) {
    console.log(`(session_competencies error: ${e.message})`);
  }
  console.log(`Competencias evaluadas: ${sessionCompetencies.length}`);

  // 9) Fallbacks (feedback / summaries)
  let sessionFeedback = [];
  try {
    const { data } = await supabase
      .from("session_feedback")
      .select("*")
      .in("conversation_id", convIds);
    sessionFeedback = data || [];
  } catch { /* opcional */ }

  let summaries = [];
  try {
    const { data } = await supabase
      .from("session_summaries")
      .select("conversation_id, summary, student_id")
      .in("conversation_id", convIds);
    summaries = data || [];
  } catch { /* opcional */ }

  // Tagear todo con cohort. La cohort se usa despues por el generador
  // para todas las tablas/charts comparativos.
  return {
    pilot: { ...pilot, cohort },
    participants: participants.map((p) => ({ ...p, cohort })),
    conversations: conversations.map((c) => ({
      ...c,
      cohort,
      metrics: convMetrics.get(c.id) || null,
      patient: aiPatients.find((p) => p.id === c.ai_patient_id) || null,
    })),
    messages: (messages || []).map((m) => ({ ...m, cohort })),
    aiPatients: aiPatients || [],
    pilotSurveys: (pilotSurveys || []).map((s) => ({ ...s, cohort })),
    surveyResponses: surveyResponses.map((r) => ({ ...r, cohort })),
    answersDetailed: answersDetailed.map((a) => ({ ...a, cohort })),
    sessionCompetencies: sessionCompetencies.map((r) => ({ ...r, cohort })),
    sessionFeedback: sessionFeedback.map((r) => ({ ...r, cohort })),
    summaries: summaries.map((s) => ({ ...s, cohort })),
  };
}

async function main() {
  const datasets = [];
  for (const c of COHORTS) {
    datasets.push(await extractCohort(c));
  }

  // Combinar. Los aiPatients pueden repetirse entre cohortes (mismo
  // catalogo de pacientes); de-duplicamos por id.
  const aiPatientsById = new Map();
  for (const ds of datasets) {
    for (const p of ds.aiPatients) aiPatientsById.set(p.id, p);
  }

  // messagesByConversation: indice rapido para el generador.
  const messagesByConversation = {};
  for (const ds of datasets) {
    for (const m of ds.messages) {
      (messagesByConversation[m.conversation_id] ||= []).push({
        role: m.role,
        content: m.content,
        created_at: m.created_at,
      });
    }
  }

  const out = {
    extractedAt: new Date().toISOString(),
    pilots: datasets.map((d) => d.pilot),
    participants: datasets.flatMap((d) => d.participants),
    conversations: datasets.flatMap((d) => d.conversations),
    messagesByConversation,
    aiPatients: [...aiPatientsById.values()],
    pilotSurveys: datasets.flatMap((d) => d.pilotSurveys),
    surveyResponses: datasets.flatMap((d) => d.surveyResponses),
    answersDetailed: datasets.flatMap((d) => d.answersDetailed),
    sessionCompetencies: datasets.flatMap((d) => d.sessionCompetencies),
    sessionFeedback: datasets.flatMap((d) => d.sessionFeedback),
    summaries: datasets.flatMap((d) => d.summaries),
  };

  fs.mkdirSync("informes", { recursive: true });
  const outPath = "informes/ucsp-pilot-data.json";
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  const sizeKB = (JSON.stringify(out).length / 1024).toFixed(1);
  console.log(`\nEscrito: ${outPath} (${sizeKB} KB)`);

  // Resumen consolidado para validar
  console.log("\n=== Resumen consolidado ===");
  for (const c of [1, 2]) {
    const parts = out.participants.filter((p) => p.cohort === c);
    const convs = out.conversations.filter((cv) => cv.cohort === c);
    const responses = out.surveyResponses.filter((r) => r.cohort === c);
    const competencies = out.sessionCompetencies.filter((r) => r.cohort === c);
    console.log(`Cohorte ${c}: ${parts.length} participantes · ${convs.length} sesiones · ${responses.filter((r) => r.status === "completed").length} encuestas · ${competencies.length} competencias evaluadas`);
  }
  console.log(`Total: ${out.participants.length} participantes · ${out.conversations.length} sesiones · ${out.surveyResponses.filter((r) => r.status === "completed").length} encuestas`);
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
