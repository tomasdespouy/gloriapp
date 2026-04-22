import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chat } from "@/lib/ai";
import { calculateSessionXp, getLevelInfo, LEVELS } from "@/lib/gamification";
import { evalLimiter, checkRateLimit } from "@/lib/rate-limit";

const EVALUATION_PROMPT = `Eres un supervisor clínico experto evaluando la sesión de un estudiante de psicología.
Usa la Pauta para la Evaluación de Competencias Psicoterapéuticas para el trabajo con Adultos (Valdés & Gómez, 2023), del libro "Supervisión clínica para estudiantes de Psicología" (Ediciones Universidad Santo Tomás).

Evalúa la conversación en estas 10 competencias, escala de 0 a 4:
- 0: No aplicaba (la situación no requería esta competencia)
- 1: Deficiente (no cumplió cuando era necesario)
- 2: Básico/parcial (cumplió parcialmente)
- 3: Adecuado (cumplió satisfactoriamente)
- 4: Excelente/integrado (excepcional e integrado con otras intervenciones)

DOMINIO 1 — ESTRUCTURA DE LA SESIÓN:
- setting_terapeutico: Capacidad de explicitar encuadre terapéutico y aclarar dudas
- motivo_consulta: Capacidad de indagar e integrar motivo manifiesto y latente, explorar recursos
- datos_contextuales: Capacidad de entrevistar e integrar información de contextos relevantes
- objetivos: Capacidad de construir objetivos terapéuticos con el paciente

DOMINIO 2 — ACTITUDES TERAPÉUTICAS:
- escucha_activa: Atención coherente a comunicación verbal y no verbal, respondiendo en congruencia
- actitud_no_valorativa: Aceptación incondicional sin juicios explícitos ni implícitos
- optimismo: Transmisión proactiva de optimismo integrado con intervenciones técnicas
- presencia: Atención sostenida, flexibilidad y sintonía con el paciente
- conducta_no_verbal: Atención a lo no verbal del paciente e integración con lo verbal
- contencion_afectos: Contención emocional con presencia, calidez, empatía y validación

El promedio general (overall_score_v2) se calcula SOLO con competencias que obtienen > 0.

Para CADA competencia con puntaje > 0, incluye una cita textual del estudiante que justifique el puntaje.
Si el puntaje es bajo, cita el momento donde falló o donde perdió una oportunidad.

Responde ÚNICAMENTE con JSON válido (sin markdown, sin backticks):
{
  "setting_terapeutico": 0.0,
  "motivo_consulta": 0.0,
  "datos_contextuales": 0.0,
  "objetivos": 0.0,
  "escucha_activa": 0.0,
  "actitud_no_valorativa": 0.0,
  "optimismo": 0.0,
  "presencia": 0.0,
  "conducta_no_verbal": 0.0,
  "contencion_afectos": 0.0,
  "overall_score_v2": 0.0,
  "commentary": "Retroalimentación constructiva en 2-3 oraciones",
  "strengths": ["fortaleza 1", "fortaleza 2"],
  "areas_to_improve": ["área 1", "área 2"],
  "evidence": {
    "setting_terapeutico": {"quote": "Cita textual del estudiante que justifica el puntaje", "observation": "Por qué esta intervención demuestra o no la competencia"},
    "motivo_consulta": {"quote": "...", "observation": "..."},
    "datos_contextuales": {"quote": "...", "observation": "..."},
    "objetivos": {"quote": "...", "observation": "..."},
    "escucha_activa": {"quote": "...", "observation": "..."},
    "actitud_no_valorativa": {"quote": "...", "observation": "..."},
    "optimismo": {"quote": "...", "observation": "..."},
    "presencia": {"quote": "...", "observation": "..."},
    "conducta_no_verbal": {"quote": "...", "observation": "..."},
    "contencion_afectos": {"quote": "...", "observation": "..."}
  }
}`;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();

  // Verify auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // Rate limit: 5 evaluations/hour per user
  const rateLimited = await checkRateLimit(evalLimiter, user.id);
  if (rateLimited) return rateLimited;

  // Get reflection data from body
  const body = await request.json().catch(() => ({}));
  const {
    discomfort_moment, would_redo, clinical_note,
    alliance_framing, rupture_moment, nonverbal_cues,
    intervention_types, clinical_hypothesis,
  } = body;

  // Verify conversation ownership and get details (defense-in-depth on RLS).
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, student_id, ai_patient_id, status")
    .eq("id", conversationId)
    .eq("student_id", user.id)
    .single();

  if (!conversation) return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });

  // Mark conversation as completed (student_id filter mirrors the SELECT above).
  await supabase
    .from("conversations")
    .update({ status: "completed", ended_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("student_id", user.id);

  // Save reflection (if provided — v2 fields or legacy)
  const hasReflection = alliance_framing || rupture_moment || nonverbal_cues ||
    intervention_types || clinical_hypothesis || discomfort_moment || would_redo || clinical_note;

  if (hasReflection) {
    await admin.from("session_feedback").upsert({
      conversation_id: conversationId,
      student_id: user.id,
      discomfort_moment,
      would_redo,
      clinical_note,
      alliance_framing,
      rupture_moment,
      nonverbal_cues,
      intervention_types,
      clinical_hypothesis,
    }, { onConflict: "conversation_id" });
  }

  // Fetch messages for evaluation
  const { data: messages } = await admin
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at");

  if (!messages || messages.length < 2) {
    return NextResponse.json({ error: "Sesión muy corta para evaluar" }, { status: 400 });
  }

  // Build transcript for evaluation
  const transcript = messages
    .map((m) => `${m.role === "user" ? "TERAPEUTA" : "PACIENTE"}: ${m.content}`)
    .join("\n\n");

  // Fast mode: respond immediately and push the LLM evaluation +
  // downstream work (XP, achievements, notifications, summary) to
  // `after()` so they run in background without blocking the UX.
  // Used by the pilot flow where the student goes straight to the
  // survey — waiting 20-30s for the evaluator would delay the
  // survey trigger.
  const fast = request.nextUrl.searchParams.get("fast") === "true";
  if (fast) {
    after(async () => {
      try {
        await evaluateAndPersist({
          admin,
          userId: user.id,
          conversationId,
          aiPatientId: conversation.ai_patient_id,
          studentId: conversation.student_id,
          transcript,
          reflection: {
            discomfort_moment,
            would_redo,
            clinical_note,
            alliance_framing,
            rupture_moment,
            nonverbal_cues,
            intervention_types,
            clinical_hypothesis,
          },
        });
      } catch (err) {
        console.error("[complete fast] background eval failed:", err);
      }
    });
    return NextResponse.json({ pending_eval: true });
  }

  // Synchronous (legacy) flow: wait for the LLM and return the full
  // results in the response. Still used by non-pilot users who want
  // to see their scores right away.
  let evaluation;
  try {
    const response = await chat(
      [{ role: "user", content: `Conversación a evaluar:\n\n${transcript}` }],
      EVALUATION_PROMPT
    );

    // Parse JSON from response (handle possible markdown wrapping)
    const jsonStr = response.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    evaluation = JSON.parse(jsonStr);
  } catch {
    return NextResponse.json({ error: "Error al evaluar la sesión" }, { status: 500 });
  }

  // Save competency scores (V2 + legacy V1 mapped)
  const overallV2 = evaluation.overall_score_v2 || evaluation.overall_score || 0;

  await admin.from("session_competencies").upsert({
    conversation_id: conversationId,
    student_id: user.id,
    feedback_status: "pending",
    // V2 competencies
    setting_terapeutico: evaluation.setting_terapeutico || 0,
    motivo_consulta: evaluation.motivo_consulta || 0,
    datos_contextuales: evaluation.datos_contextuales || 0,
    objetivos: evaluation.objetivos || 0,
    escucha_activa: evaluation.escucha_activa || 0,
    actitud_no_valorativa: evaluation.actitud_no_valorativa || 0,
    optimismo: evaluation.optimismo || 0,
    presencia: evaluation.presencia || 0,
    conducta_no_verbal: evaluation.conducta_no_verbal || 0,
    contencion_afectos: evaluation.contencion_afectos || 0,
    overall_score_v2: overallV2,
    eval_version: 2,
    // Legacy V1 mapped (for backward compat with existing views)
    empathy: evaluation.escucha_activa || 0,
    active_listening: evaluation.escucha_activa || 0,
    open_questions: evaluation.motivo_consulta || 0,
    reformulation: evaluation.datos_contextuales || 0,
    confrontation: evaluation.actitud_no_valorativa || 0,
    silence_management: evaluation.presencia || 0,
    rapport: evaluation.contencion_afectos || 0,
    overall_score: overallV2,
    ai_commentary: evaluation.commentary,
    strengths: evaluation.strengths || [],
    areas_to_improve: evaluation.areas_to_improve || [],
    evidence: evaluation.evidence || null,
  }, { onConflict: "conversation_id" });

  // Calculate XP (V2 scale 0-4)
  const xpEarned = calculateSessionXp(overallV2);

  // Update student progress
  const { data: progress } = await admin
    .from("student_progress")
    .select("*")
    .eq("student_id", user.id)
    .single();

  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  let currentStreak = progress?.current_streak || 0;
  let longestStreak = progress?.longest_streak || 0;

  if (progress?.last_session_date === today) {
    // Already practiced today, no streak change
  } else if (progress?.last_session_date === yesterday) {
    currentStreak += 1;
  } else {
    currentStreak = 1;
  }
  if (currentStreak > longestStreak) longestStreak = currentStreak;

  const newTotalXp = (progress?.total_xp || 0) + xpEarned;
  const newSessionsCompleted = (progress?.sessions_completed || 0) + 1;
  const levelInfo = getLevelInfo(newTotalXp);

  await admin.from("student_progress").upsert({
    student_id: user.id,
    level: levelInfo.current.level,
    level_name: levelInfo.current.name,
    total_xp: newTotalXp,
    sessions_completed: newSessionsCompleted,
    current_streak: currentStreak,
    longest_streak: longestStreak,
    last_session_date: today,
    updated_at: new Date().toISOString(),
  }, { onConflict: "student_id" });

  // Check achievements
  const newAchievements: string[] = [];

  const { data: existingAchievements } = await admin
    .from("student_achievements")
    .select("achievement_id, achievements(key)")
    .eq("student_id", user.id);

  const earnedKeys = new Set(
    existingAchievements?.map((a) => {
      const ach = a.achievements as unknown as { key: string };
      return ach?.key;
    }) || []
  );

  const { data: allAchievements } = await admin.from("achievements").select("*");

  const achievementChecks: Record<string, () => boolean> = {
    first_session: () => newSessionsCompleted >= 1,
    five_sessions: () => newSessionsCompleted >= 5,
    ten_sessions: () => newSessionsCompleted >= 10,
    empathy_master: () => evaluation.empathy >= 9,
    listening_master: () => evaluation.active_listening >= 9,
    rapport_master: () => evaluation.rapport >= 9,
    streak_3: () => currentStreak >= 3,
    streak_7: () => currentStreak >= 7,
    first_reflection: () => !!(discomfort_moment || would_redo || clinical_note || alliance_framing || rupture_moment || nonverbal_cues || intervention_types || clinical_hypothesis),
    high_performer: () => evaluation.overall_score >= 8,
    perfect_session: () =>
      [evaluation.empathy, evaluation.active_listening, evaluation.open_questions,
       evaluation.reformulation, evaluation.confrontation, evaluation.silence_management,
       evaluation.rapport].some((s: number) => s >= 10),
  };

  let bonusXp = 0;

  for (const achievement of allAchievements || []) {
    if (earnedKeys.has(achievement.key)) continue;
    const check = achievementChecks[achievement.key];
    if (check && check()) {
      await admin.from("student_achievements").insert({
        student_id: user.id,
        achievement_id: achievement.id,
      });
      newAchievements.push(achievement.key);
      bonusXp += achievement.xp_reward;
    }
  }

  // Apply bonus XP from achievements
  if (bonusXp > 0) {
    const finalXp = newTotalXp + bonusXp;
    const finalLevel = getLevelInfo(finalXp);
    await admin.from("student_progress").update({
      total_xp: finalXp,
      level: finalLevel.current.level,
      level_name: finalLevel.current.name,
    }).eq("student_id", user.id);
  }

  // Notify instructors that a session is pending review
  const { data: student } = await admin
    .from("profiles")
    .select("full_name, establishment_id")
    .eq("id", user.id)
    .single();

  if (student?.establishment_id) {
    const { data: instructors } = await admin
      .from("profiles")
      .select("id")
      .eq("establishment_id", student.establishment_id)
      .in("role", ["instructor", "admin", "superadmin"]);

    const patientRow = await admin.from("ai_patients").select("name").eq("id", conversation.ai_patient_id).single();
    const patientName = patientRow.data?.name || "paciente";

    const notifications = (instructors || [])
      .filter((inst) => inst.id !== user.id) // Don't notify yourself
      .map((inst) => ({
        user_id: inst.id,
        type: "pending_review",
        title: "Sesión pendiente de revisión",
        body: `${student.full_name || "Estudiante"} completó una sesión con ${patientName}`,
        href: `/docente/sesion/${conversationId}`,
        is_read: false,
      }));
    if (notifications.length > 0) {
      await admin.from("notifications").insert(notifications);
    }

    // Send email to instructors via Resend
    const recipientIds = (instructors || [])
      .filter((inst) => inst.id !== user.id)
      .map((i) => i.id);

    if (process.env.RESEND_API_KEY && recipientIds.length > 0) {
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);

        const { data: instructorProfiles } = await admin
          .from("profiles")
          .select("email, full_name")
          .in("id", recipientIds);

        const emails = (instructorProfiles || [])
          .filter((p) => p.email)
          .map((p) => p.email as string);

        if (emails.length > 0) {
          await resend.emails.send({
            from: "GlorIA <noreply@glor-ia.com>",
            to: emails[0],
            ...(emails.length > 1 ? { bcc: emails.slice(1) } : {}),
            subject: `Sesión pendiente de revisión — ${student.full_name || "Estudiante"}`,
            html: `
              <div style="font-family: sans-serif; max-width: 500px;">
                <h2 style="color: #4A55A2;">Nueva sesión por revisar</h2>
                <p><strong>${student.full_name || "Un estudiante"}</strong> completó una sesión con <strong>${patientName}</strong> y está pendiente de tu revisión.</p>
                <p>Ingresa a GlorIA para revisar la evaluación de la IA, la autorreflexión del estudiante, y enviar tu retroalimentación.</p>
                <p style="color: #999; font-size: 12px; margin-top: 24px;">GlorIA — Plataforma de entrenamiento clínico</p>
              </div>
            `,
          });
        }
      } catch {
        // Email is optional — don't fail the request
      }
    }
  }

  // Generate session summary for multi-session memory (non-blocking)
  generateSessionSummary(admin, conversationId, conversation.student_id, conversation.ai_patient_id, transcript).catch(() => {});

  const levelUp = levelInfo.current.level > (progress?.level || 1);

  return NextResponse.json({
    evaluation,
    xp_earned: xpEarned + bonusXp,
    level_up: levelUp,
    new_level: levelInfo.current,
    new_achievements: newAchievements,
    total_xp: newTotalXp + bonusXp,
    sessions_completed: newSessionsCompleted,
    streak: currentStreak,
  });
}

// --- Generate session summary for multi-session memory ---
async function generateSessionSummary(
  admin: ReturnType<typeof createAdminClient>,
  conversationId: string,
  studentId: string,
  patientId: string,
  transcript: string,
) {
  // Get session number
  const { data: conv } = await admin
    .from("conversations")
    .select("session_number")
    .eq("id", conversationId)
    .single();

  // Get final clinical state
  const { data: finalState } = await admin
    .from("clinical_state_log")
    .select("resistencia, alianza, apertura_emocional, sintomatologia, disposicion_cambio")
    .eq("conversation_id", conversationId)
    .order("turn_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const summaryResponse = await chat(
    [{ role: "user", content: `Resume esta sesi\u00f3n terap\u00e9utica de forma neutral y observacional.

TRANSCRIPCI\u00d3N:
${transcript}

Responde SOLO con JSON v\u00e1lido:
{
  "summary": "Resumen narrativo de 80-120 palabras en tercera persona neutral. Qu\u00e9 temas se abordaron, c\u00f3mo reaccion\u00f3 el paciente, qu\u00e9 intervenciones realiz\u00f3 el terapeuta. Incluir datos concretos mencionados (nombres, lugares, eventos).",
  "key_revelations": ["Dato o informaci\u00f3n cl\u00ednicamente relevante que surgi\u00f3", "Otro dato relevante"],
  "therapeutic_progress": "Una oraci\u00f3n describiendo el estado de la relaci\u00f3n terap\u00e9utica al final de esta sesi\u00f3n."
}` }],
    "Eres un asistente que genera res\u00famenes compactos de sesiones terap\u00e9uticas desde una perspectiva observacional neutral. Solo JSON."
  );

  try {
    const cleaned = summaryResponse.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    await admin.from("session_summaries").upsert({
      conversation_id: conversationId,
      student_id: studentId,
      ai_patient_id: patientId,
      session_number: conv?.session_number || 1,
      summary: parsed.summary,
      key_revelations: parsed.key_revelations || [],
      therapeutic_progress: parsed.therapeutic_progress || "",
      final_clinical_state: finalState || null,
    }, { onConflict: "conversation_id" });
  } catch {
    // Non-critical — session works without summary
  }
}

// ─────────────────────────────────────────────────────────────────
// Mirror of the synchronous evaluation flow, used by the fast-mode
// branch via `after()`. Kept deliberately self-contained so the
// background task can run without depending on the live request.
// Errors are swallowed and logged; the session still counts as
// completed even if the eval fails, because status=completed was
// set earlier in the request.
// ─────────────────────────────────────────────────────────────────
async function evaluateAndPersist(ctx: {
  admin: ReturnType<typeof createAdminClient>;
  userId: string;
  conversationId: string;
  aiPatientId: string;
  studentId: string;
  transcript: string;
  reflection: {
    discomfort_moment?: string;
    would_redo?: string;
    clinical_note?: string;
    alliance_framing?: string;
    rupture_moment?: string;
    nonverbal_cues?: string;
    intervention_types?: string;
    clinical_hypothesis?: string;
  };
}) {
  const { admin, userId, conversationId, aiPatientId, studentId, transcript, reflection } = ctx;

  // LLM evaluation
  const response = await chat(
    [{ role: "user", content: `Conversación a evaluar:\n\n${transcript}` }],
    EVALUATION_PROMPT,
  );
  const jsonStr = response.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
  const evaluation = JSON.parse(jsonStr);

  const overallV2 = evaluation.overall_score_v2 || evaluation.overall_score || 0;

  await admin.from("session_competencies").upsert({
    conversation_id: conversationId,
    student_id: userId,
    feedback_status: "pending",
    setting_terapeutico: evaluation.setting_terapeutico || 0,
    motivo_consulta: evaluation.motivo_consulta || 0,
    datos_contextuales: evaluation.datos_contextuales || 0,
    objetivos: evaluation.objetivos || 0,
    escucha_activa: evaluation.escucha_activa || 0,
    actitud_no_valorativa: evaluation.actitud_no_valorativa || 0,
    optimismo: evaluation.optimismo || 0,
    presencia: evaluation.presencia || 0,
    conducta_no_verbal: evaluation.conducta_no_verbal || 0,
    contencion_afectos: evaluation.contencion_afectos || 0,
    overall_score_v2: overallV2,
    eval_version: 2,
    empathy: evaluation.escucha_activa || 0,
    active_listening: evaluation.escucha_activa || 0,
    open_questions: evaluation.motivo_consulta || 0,
    reformulation: evaluation.datos_contextuales || 0,
    confrontation: evaluation.actitud_no_valorativa || 0,
    silence_management: evaluation.presencia || 0,
    rapport: evaluation.contencion_afectos || 0,
    overall_score: overallV2,
    ai_commentary: evaluation.commentary,
    strengths: evaluation.strengths || [],
    areas_to_improve: evaluation.areas_to_improve || [],
    evidence: evaluation.evidence || null,
  }, { onConflict: "conversation_id" });

  const xpEarned = calculateSessionXp(overallV2);

  const { data: progress } = await admin
    .from("student_progress").select("*").eq("student_id", userId).single();

  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  let currentStreak = progress?.current_streak || 0;
  let longestStreak = progress?.longest_streak || 0;

  if (progress?.last_session_date === today) {
    // no streak change
  } else if (progress?.last_session_date === yesterday) {
    currentStreak += 1;
  } else {
    currentStreak = 1;
  }
  if (currentStreak > longestStreak) longestStreak = currentStreak;

  const newTotalXp = (progress?.total_xp || 0) + xpEarned;
  const newSessionsCompleted = (progress?.sessions_completed || 0) + 1;
  const levelInfo = getLevelInfo(newTotalXp);

  await admin.from("student_progress").upsert({
    student_id: userId,
    level: levelInfo.current.level,
    level_name: levelInfo.current.name,
    total_xp: newTotalXp,
    sessions_completed: newSessionsCompleted,
    current_streak: currentStreak,
    longest_streak: longestStreak,
    last_session_date: today,
    updated_at: new Date().toISOString(),
  }, { onConflict: "student_id" });

  // Achievements
  const { data: existingAchievements } = await admin
    .from("student_achievements")
    .select("achievement_id, achievements(key)")
    .eq("student_id", userId);
  const earnedKeys = new Set(
    existingAchievements?.map((a) => {
      const ach = a.achievements as unknown as { key: string };
      return ach?.key;
    }) || [],
  );
  const { data: allAchievements } = await admin.from("achievements").select("*");
  const hasReflection = !!(
    reflection.discomfort_moment || reflection.would_redo || reflection.clinical_note ||
    reflection.alliance_framing || reflection.rupture_moment || reflection.nonverbal_cues ||
    reflection.intervention_types || reflection.clinical_hypothesis
  );
  const checks: Record<string, () => boolean> = {
    first_session: () => newSessionsCompleted >= 1,
    five_sessions: () => newSessionsCompleted >= 5,
    ten_sessions: () => newSessionsCompleted >= 10,
    empathy_master: () => evaluation.empathy >= 9,
    listening_master: () => evaluation.active_listening >= 9,
    rapport_master: () => evaluation.rapport >= 9,
    streak_3: () => currentStreak >= 3,
    streak_7: () => currentStreak >= 7,
    first_reflection: () => hasReflection,
    high_performer: () => evaluation.overall_score >= 8,
    perfect_session: () =>
      [evaluation.empathy, evaluation.active_listening, evaluation.open_questions,
       evaluation.reformulation, evaluation.confrontation, evaluation.silence_management,
       evaluation.rapport].some((s: number) => s >= 10),
  };
  let bonusXp = 0;
  for (const achievement of allAchievements || []) {
    if (earnedKeys.has(achievement.key)) continue;
    const check = checks[achievement.key];
    if (check && check()) {
      await admin.from("student_achievements").insert({
        student_id: userId, achievement_id: achievement.id,
      });
      bonusXp += achievement.xp_reward;
    }
  }
  if (bonusXp > 0) {
    const finalXp = newTotalXp + bonusXp;
    const finalLevel = getLevelInfo(finalXp);
    await admin.from("student_progress").update({
      total_xp: finalXp,
      level: finalLevel.current.level,
      level_name: finalLevel.current.name,
    }).eq("student_id", userId);
  }

  // Instructor notifications + email
  const { data: student } = await admin
    .from("profiles").select("full_name, establishment_id").eq("id", userId).single();
  if (student?.establishment_id) {
    const { data: instructors } = await admin
      .from("profiles").select("id")
      .eq("establishment_id", student.establishment_id)
      .in("role", ["instructor", "admin", "superadmin"]);
    const patientRow = await admin.from("ai_patients").select("name").eq("id", aiPatientId).single();
    const patientName = patientRow.data?.name || "paciente";
    const notifications = (instructors || [])
      .filter((inst) => inst.id !== userId)
      .map((inst) => ({
        user_id: inst.id,
        type: "pending_review",
        title: "Sesión pendiente de revisión",
        body: `${student.full_name || "Estudiante"} completó una sesión con ${patientName}`,
        href: `/docente/sesion/${conversationId}`,
        is_read: false,
      }));
    if (notifications.length > 0) {
      await admin.from("notifications").insert(notifications);
    }
    const recipientIds = (instructors || [])
      .filter((inst) => inst.id !== userId).map((i) => i.id);
    if (process.env.RESEND_API_KEY && recipientIds.length > 0) {
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        const { data: instructorProfiles } = await admin
          .from("profiles").select("email, full_name").in("id", recipientIds);
        const emails = (instructorProfiles || [])
          .filter((p) => p.email).map((p) => p.email as string);
        if (emails.length > 0) {
          await resend.emails.send({
            from: "GlorIA <noreply@glor-ia.com>",
            to: emails[0],
            ...(emails.length > 1 ? { bcc: emails.slice(1) } : {}),
            subject: `Sesión pendiente de revisión — ${student.full_name || "Estudiante"}`,
            html: `
              <div style="font-family: sans-serif; max-width: 500px;">
                <h2 style="color: #4A55A2;">Nueva sesión por revisar</h2>
                <p><strong>${student.full_name || "Un estudiante"}</strong> completó una sesión con <strong>${patientName}</strong> y está pendiente de tu revisión.</p>
                <p>Ingresa a GlorIA para revisar la evaluación de la IA, la autorreflexión del estudiante, y enviar tu retroalimentación.</p>
              </div>
            `,
          });
        }
      } catch { /* email best-effort */ }
    }
  }

  // Session summary for multi-session memory (same fn as sync flow)
  await generateSessionSummary(admin, conversationId, studentId, aiPatientId, transcript);
}
