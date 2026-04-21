import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chatStream } from "@/lib/ai";
import { Resend } from "resend";

// ════════════════════════════════════════════
// System prompts by role
// ════════════════════════════════════════════

const STUDENT_PROMPT = `Eres GlorIA, la tutora virtual de una plataforma de entrenamiento clínico con pacientes simulados por IA para estudiantes de psicología.

TU PERSONALIDAD:
- Cálida, cercana, profesional pero no rígida
- Hablas en español, con tildes correctas
- Usas un tono de supervisora clínica empática: acompañas sin juzgar
- Eres concisa — respondes en 2-4 oraciones a menos que te pidan más detalle
- Tuteas al estudiante

LO QUE PUEDES HACER:
- Orientar sobre la plataforma: cómo practicar, ver historial, entender evaluaciones
- Explicar competencias terapéuticas (Pauta de Valdés & Gómez, 2023)
- Interpretar scores (escala 0-4): 0=no aplicaba, 1=deficiente, 2=básico, 3=adecuado, 4=excelente
- Motivar y acompañar emocionalmente al estudiante
- Sugerir qué paciente practicar según su nivel
- Recopilar problemas técnicos para enviarlos al equipo de soporte

NAVEGACIÓN DE LA PLATAFORMA (usa estos links cuando refieras a secciones):
- Inicio: /dashboard
- Pacientes (practicar): /pacientes
- Mi historial: /historial
- Mi progreso: /progreso
- Aprendizaje: /aprendizaje
- Mi perfil: /mi-perfil
- Soporte técnico: /soporte

Cuando menciones una sección o paciente, incluye el link en formato markdown: [nombre](/ruta)

LO QUE NO HACES:
- No das diagnósticos clínicos reales
- No reemplazas al docente supervisor
- No respondes sobre temas fuera de psicología clínica y la plataforma
- No inventas datos del estudiante que no tienes

CONTEXTO DEL ESTUDIANTE:
{CONTEXT}

Si el estudiante reporta un problema técnico, responde algo como: "Entiendo, voy a enviar esto al equipo técnico para que lo revisen. Te van a responder a tu correo." y agrega al final de tu mensaje exactamente esta etiqueta: [SUPPORT_TICKET]`;

const INSTRUCTOR_PROMPT = `Eres GlorIA, la asistente de supervisión clínica de una plataforma de entrenamiento con pacientes simulados por IA.

TU PERSONALIDAD:
- Profesional, directa, eficiente
- Hablas en español, con tildes correctas
- Usas un tono de colega supervisora: apoyas la labor docente con datos concretos
- Eres concisa — respondes en 2-4 oraciones a menos que te pidan más detalle
- Tuteas al docente

LO QUE PUEDES HACER:
- Informar sobre el estado de los alumnos: sesiones completadas, puntajes, racha, inactividad
- Alertar sobre sesiones pendientes de revisión
- Sugerir qué alumnos necesitan atención (inactivos, bajos puntajes)
- Orientar sobre la pauta de evaluación (Valdés & Gómez, 2023, escala 0-4)
- Interpretar scores del grupo y tendencias
- Explicar cómo usar las herramientas de supervisión en la plataforma
- Ayudar a redactar feedback para sesiones
- Recopilar problemas técnicos para enviarlos al equipo de soporte

NAVEGACIÓN DE LA PLATAFORMA (usa estos links cuando refieras a secciones):
- Panel docente: /docente/dashboard
- Revisiones pendientes: /docente/revisiones
- Métricas de alumnos: /docente/metricas
- Perfiles de pacientes: /perfiles
- Sobre GlorIA: /sobre

Cuando menciones una sección, incluye el link en formato markdown: [nombre](/ruta)

LO QUE NO HACES:
- No das diagnósticos clínicos reales
- No reemplazas la supervisión docente directa
- No respondes sobre temas fuera de psicología clínica y la plataforma
- No inventas datos que no tienes

CONTEXTO DEL DOCENTE Y SU GRUPO:
{CONTEXT}

Si el docente reporta un problema técnico, responde algo como: "Entiendo, voy a enviar esto al equipo técnico para que lo revisen. Te van a responder a tu correo." y agrega al final de tu mensaje exactamente esta etiqueta: [SUPPORT_TICKET]`;

const ADMIN_PROMPT = `Eres GlorIA, la asistente ejecutiva de una plataforma de entrenamiento clínico con pacientes simulados por IA para estudiantes de psicología.

TU PERSONALIDAD:
- Profesional, estratégica, orientada a datos
- Hablas en español, con tildes correctas
- Usas un tono ejecutivo: directo, conciso, con cifras concretas
- Eres concisa — respondes en 2-4 oraciones a menos que te pidan más detalle
- Tuteas al administrador

LO QUE PUEDES HACER:
- Dar resúmenes ejecutivos: usuarios, sesiones, adopción, tendencias
- Informar sobre métricas clave: estudiantes activos, sesiones completadas, promedios
- Reportar estado de pilotos
- Alertar sobre estudiantes inactivos, revisiones pendientes, anomalías
- Orientar sobre las herramientas administrativas de la plataforma
- Recopilar problemas técnicos para enviarlos al equipo de soporte

NAVEGACIÓN DE LA PLATAFORMA (usa estos links cuando refieras a secciones):
- Panel admin: /admin/dashboard
- Instituciones: /admin/establecimientos
- Usuarios: /admin/usuarios
- Pacientes IA: /perfiles
- Métricas: /admin/metricas
- Pilotos: /admin/pilotos
- Retroalimentación: /admin/retroalimentacion
- Costos: /admin/costos
- Investigación: /admin/investigacion
- Notificaciones: /admin/notificaciones
- Monitoreo: /admin/monitoreo

Cuando menciones una sección, incluye el link en formato markdown: [nombre](/ruta)

LO QUE NO HACES:
- No das diagnósticos clínicos
- No inventas datos que no tienes
- No respondes sobre temas fuera de la plataforma

CONTEXTO ADMINISTRATIVO:
{CONTEXT}

Si el administrador reporta un problema técnico, responde algo como: "Entiendo, voy a enviar esto al equipo técnico para que lo revisen." y agrega al final de tu mensaje exactamente esta etiqueta: [SUPPORT_TICKET]`;

// ════════════════════════════════════════════
// Context builders
// ════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildStudentContext(admin: any, userId: string, profile: any, currentPage: string | undefined) {
  const [{ data: progress }, { data: patients }] = await Promise.all([
    admin.from("student_progress").select("*").eq("student_id", userId).maybeSingle(),
    admin.from("ai_patients").select("id, name, difficulty_level").eq("is_active", true).order("name"),
  ]);

  return [
    `Nombre: ${profile?.full_name || "estudiante"}`,
    progress ? `Nivel: ${progress.level} (${progress.level_name})` : null,
    progress ? `XP total: ${progress.total_xp}` : null,
    progress ? `Sesiones completadas: ${progress.sessions_completed}` : null,
    progress?.current_streak ? `Racha actual: ${progress.current_streak} días` : null,
    progress?.last_session_date ? `Última sesión: ${progress.last_session_date}` : null,
    currentPage ? `Página actual: ${currentPage}` : null,
    patients && patients.length > 0
      ? `Pacientes disponibles:\n${patients.map((p: { id: string; name: string; difficulty_level: string }) => `- [${p.name}](/chat/${p.id}) (${p.difficulty_level})`).join("\n")}`
      : null,
  ].filter(Boolean).join("\n");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildInstructorContext(admin: any, userId: string, profile: any, currentPage: string | undefined) {
  // Get instructor's establishment
  const { data: instrProfile } = await admin
    .from("profiles")
    .select("establishment_id")
    .eq("id", userId)
    .single();

  const estId = instrProfile?.establishment_id;
  if (!estId) {
    return [
      `Nombre: ${profile?.full_name || "docente"}`,
      `Rol: Docente`,
      `Sin establecimiento asignado — no se pueden cargar datos de alumnos.`,
      currentPage ? `Página actual: ${currentPage}` : null,
    ].filter(Boolean).join("\n");
  }

  // Fetch students in establishment
  const { data: students } = await admin
    .from("profiles")
    .select("id, full_name")
    .eq("role", "student")
    .eq("establishment_id", estId)
    .order("full_name");

  const studentIds = (students || []).map((s: { id: string }) => s.id);
  if (studentIds.length === 0) {
    return [
      `Nombre: ${profile?.full_name || "docente"}`,
      `Rol: Docente`,
      `Total alumnos: 0`,
      currentPage ? `Página actual: ${currentPage}` : null,
    ].filter(Boolean).join("\n");
  }

  // Parallel queries for student data
  const [{ data: allProgress }, { data: sessions }, { count: pendingCount }] = await Promise.all([
    admin.from("student_progress")
      .select("student_id, level_name, sessions_completed, last_session_date, current_streak")
      .in("student_id", studentIds),
    admin.from("conversations")
      .select("student_id, created_at, session_competencies(overall_score_v2, feedback_status)")
      .eq("status", "completed")
      .in("student_id", studentIds)
      .order("created_at", { ascending: false })
      .limit(500),
    admin.from("session_competencies")
      .select("id", { count: "exact", head: true })
      .eq("feedback_status", "pending")
      .in("student_id", studentIds),
  ]);

  // Calculate averages
  const scores = (sessions || [])
    .map((s: { session_competencies: { overall_score_v2: number } | null }) => s.session_competencies?.overall_score_v2)
    .filter((v: number | undefined | null): v is number => typeof v === "number" && v > 0);
  const avgScore = scores.length > 0 ? (scores.reduce((a: number, b: number) => a + b, 0) / scores.length).toFixed(1) : "N/A";

  // Inactive students (>7 days)
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const progressMap = new Map((allProgress || []).map((p: { student_id: string; last_session_date: string }) => [p.student_id, p]));
  const inactive = (students || []).filter((s: { id: string; full_name: string }) => {
    const p = progressMap.get(s.id) as { last_session_date?: string } | undefined;
    return !p?.last_session_date || p.last_session_date < weekAgo;
  });

  // Students needing attention (with names)
  const inactiveNames = inactive.slice(0, 8).map((s: { full_name: string }) => s.full_name).join(", ");

  return [
    `Nombre: ${profile?.full_name || "docente"}`,
    `Rol: Docente`,
    `Total alumnos: ${studentIds.length}`,
    `Sesiones pendientes de revisión: ${pendingCount || 0}`,
    `Promedio general del grupo (escala 0-4): ${avgScore}`,
    `Alumnos inactivos (>7 días sin practicar): ${inactive.length}${inactiveNames ? ` — ${inactiveNames}` : ""}`,
    currentPage ? `Página actual: ${currentPage}` : null,
  ].filter(Boolean).join("\n");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildAdminContext(admin: any, userId: string, profile: any, role: string, currentPage: string | undefined) {
  const isSuperadmin = role === "superadmin";

  // Determine scope
  let estIds: string[] = [];
  let estNames: string[] = [];

  if (!isSuperadmin) {
    const { data: assignments } = await admin
      .from("admin_establishments")
      .select("establishment_id, establishments(name)")
      .eq("admin_id", userId);
    estIds = (assignments || []).map((a: { establishment_id: string }) => a.establishment_id);
    estNames = (assignments || []).map((a: { establishments: { name: string } | null }) => a.establishments?.name).filter(Boolean);
  } else {
    const { data: allEst } = await admin
      .from("establishments")
      .select("id, name")
      .eq("is_active", true);
    estIds = (allEst || []).map((e: { id: string }) => e.id);
    estNames = (allEst || []).map((e: { name: string }) => e.name);
  }

  // Get scoped students
  let studentQuery = admin.from("profiles").select("id").eq("role", "student");
  if (!isSuperadmin && estIds.length > 0) {
    studentQuery = studentQuery.in("establishment_id", estIds);
  } else if (!isSuperadmin) {
    // Admin without establishments
    return [
      `Nombre: ${profile?.full_name || "admin"}`,
      `Rol: ${isSuperadmin ? "Superadministrador" : "Administrador"}`,
      `Sin instituciones asignadas.`,
      currentPage ? `Página actual: ${currentPage}` : null,
    ].filter(Boolean).join("\n");
  }
  const { data: scopedStudents } = await studentQuery;
  const studentIds = (scopedStudents || []).map((s: { id: string }) => s.id);
  const safeIds = studentIds.length > 0 ? studentIds : ["00000000-0000-0000-0000-000000000000"];

  // Parallel aggregate queries
  const queries: Promise<{ count: number | null }>[] = [
    admin.from("conversations").select("id", { count: "exact", head: true }).eq("status", "completed").in("student_id", safeIds),
    admin.from("session_competencies").select("id", { count: "exact", head: true }).eq("feedback_status", "pending").in("student_id", safeIds),
  ];

  // Instructors count (scoped)
  let instructorQuery = admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "instructor");
  if (!isSuperadmin && estIds.length > 0) {
    instructorQuery = instructorQuery.in("establishment_id", estIds);
  }
  queries.push(instructorQuery);

  const [sessionsRes, pendingRes, instructorsRes] = await Promise.all(queries);
  const totalSessions = sessionsRes.count || 0;
  const pendingReviews = pendingRes.count || 0;
  const totalInstructors = instructorsRes.count || 0;

  // Pilots
  const { data: pilots } = await admin.from("pilots").select("id, status").limit(100);
  const activePilots = (pilots || []).filter((p: { status: string }) => ["en_curso", "validado", "enviado"].includes(p.status)).length;
  const finishedPilots = (pilots || []).filter((p: { status: string }) => p.status === "finalizado").length;

  // Inactive students
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: recentActive } = await admin
    .from("conversations")
    .select("student_id")
    .in("student_id", safeIds)
    .gte("created_at", weekAgo);
  const activeSet = new Set((recentActive || []).map((c: { student_id: string }) => c.student_id));
  const inactiveCount = studentIds.length - activeSet.size;

  const lines = [
    `Nombre: ${profile?.full_name || "admin"}`,
    `Rol: ${isSuperadmin ? "Superadministrador" : "Administrador"}`,
    !isSuperadmin && estNames.length > 0 ? `Instituciones a cargo: ${estNames.join(", ")}` : null,
    isSuperadmin ? `Total instituciones activas: ${estIds.length}` : null,
    `Total estudiantes: ${studentIds.length}`,
    `Total docentes: ${totalInstructors}`,
    `Sesiones completadas: ${totalSessions}`,
    `Revisiones pendientes: ${pendingReviews}`,
    `Estudiantes inactivos (>7 días): ${inactiveCount} de ${studentIds.length}`,
    `Pilotos activos: ${activePilots}`,
    `Pilotos finalizados: ${finishedPilots}`,
    currentPage ? `Página actual: ${currentPage}` : null,
  ];

  return lines.filter(Boolean).join("\n");
}

// ════════════════════════════════════════════
// POST handler
// ════════════════════════════════════════════

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("No autorizado", { status: 401 });

  const body = await request.json();
  const { messages, currentPage } = body as { messages: { role: string; content: string }[]; currentPage?: string };

  if (!messages || messages.length === 0) {
    return new Response("Sin mensajes", { status: 400 });
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, email, role, establishment_id")
    .eq("id", user.id)
    .single();

  const role = profile?.role || "student";
  const name = profile?.full_name || "usuario";

  // Build role-specific context and select prompt
  let promptTemplate: string;
  let ctx: string;

  if (role === "instructor") {
    promptTemplate = INSTRUCTOR_PROMPT;
    ctx = await buildInstructorContext(admin, user.id, profile, currentPage);
  } else if (role === "admin" || role === "superadmin") {
    promptTemplate = ADMIN_PROMPT;
    ctx = await buildAdminContext(admin, user.id, profile, role, currentPage);
  } else {
    promptTemplate = STUDENT_PROMPT;
    ctx = await buildStudentContext(admin, user.id, profile, currentPage);
  }

  const systemPrompt = promptTemplate.replace("{CONTEXT}", ctx);

  const llmStream = chatStream(
    messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
    systemPrompt
  );

  // Wrap the LLM stream: collect full text for support ticket detection
  let fullText = "";
  const userMessages = messages.filter(m => m.role === "user");
  const lastUserMsg = userMessages[userMessages.length - 1]?.content || "";

  const outputStream = new ReadableStream({
    async start(controller) {
      const reader = llmStream.getReader();
      const encoder = new TextEncoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullText += value;
          controller.enqueue(encoder.encode(value));
        }
      } finally {
        reader.releaseLock();
        controller.close();

        // After stream completes, check for support ticket (fire-and-forget)
        if (fullText.includes("[SUPPORT_TICKET]")) {
          try {
            const resendKey = process.env.RESEND_API_KEY;
            if (resendKey) {
              const roleLabel = role === "instructor" ? "Docente" : role === "admin" ? "Admin" : role === "superadmin" ? "Supradmin" : "Estudiante";
              const resend = new Resend(resendKey);
              await resend.emails.send({
                from: "GlorIA <noreply@glor-ia.com>",
                to: process.env.SUPPORT_EMAIL || "tomasdespouy@gmail.com",
                replyTo: profile?.email || user.email || undefined,
                subject: `[GlorIA Soporte] Ticket de ${roleLabel.toLowerCase()} — ${name}`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px;">
                    <h2 style="color: #4A55A2;">Ticket de soporte via GlorIA</h2>
                    <p><strong>Usuario:</strong> ${name} (${profile?.email})</p>
                    <p><strong>Rol:</strong> ${roleLabel}</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;">
                    <p><strong>Problema reportado:</strong></p>
                    <p style="background: #f9f9f9; padding: 12px; border-radius: 8px;">${lastUserMsg}</p>
                  </div>
                `,
              });
            }
          } catch { /* non-critical */ }
        }
      }
    },
  });

  return new Response(outputStream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Transfer-Encoding": "chunked" },
  });
}
