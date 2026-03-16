import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chat } from "@/lib/ai";
import { summarizeSession, mergeNarrative } from "@/lib/narrative";
import { calculateSessionXp, getLevelInfo } from "@/lib/gamification";

const EVALUATION_PROMPT = `Eres un supervisor clínico experto evaluando la sesión de un estudiante de psicología.
Usa el instrumento de competencias clínicas de la Universidad Gabriela Mistral.

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
  "areas_to_improve": ["área 1", "área 2"]
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

  // Get reflection data from body
  const body = await request.json().catch(() => ({}));
  const { discomfort_moment, would_redo, clinical_note } = body;

  // Verify conversation ownership and get details
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, student_id, ai_patient_id, status")
    .eq("id", conversationId)
    .single();

  if (!conversation) return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });

  // Mark conversation as completed
  await supabase
    .from("conversations")
    .update({ status: "completed" })
    .eq("id", conversationId);

  // Save reflection (if provided)
  if (discomfort_moment || would_redo || clinical_note) {
    await admin.from("session_feedback").upsert({
      conversation_id: conversationId,
      student_id: user.id,
      discomfort_moment,
      would_redo,
      clinical_note,
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

  // Call LLM for evaluation
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
  }, { onConflict: "conversation_id" });

  // Generate cumulative narrative summary (non-blocking, max 10 sessions)
  const MAX_NARRATIVE_SESSIONS = 10;
  const narrativePromise = (async () => {
    try {
      // Load existing narrative for this student-patient pair
      const { data: existing } = await admin
        .from("patient_narratives")
        .select("narrative, sessions_included")
        .eq("student_id", user.id)
        .eq("ai_patient_id", conversation.ai_patient_id)
        .maybeSingle();

      const currentCount = existing?.sessions_included || 0;

      // Cap at 10 sessions — narrative is frozen after that
      if (currentCount >= MAX_NARRATIVE_SESSIONS) return;

      // Summarize this session
      const sessionSummary = await summarizeSession(transcript);

      // Merge with previous narrative
      const sessionsIncluded = currentCount + 1;
      const merged = await mergeNarrative(
        existing?.narrative || "",
        sessionSummary,
        sessionsIncluded,
      );

      // Upsert the cumulative narrative
      await admin.from("patient_narratives").upsert({
        student_id: user.id,
        ai_patient_id: conversation.ai_patient_id,
        narrative: merged.narrative,
        key_themes: merged.key_themes,
        sessions_included: sessionsIncluded,
        last_conversation_id: conversationId,
        updated_at: new Date().toISOString(),
      }, { onConflict: "student_id,ai_patient_id" });
    } catch (err) {
      console.error("Narrative generation failed (non-critical):", err);
    }
  })();

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
    first_reflection: () => !!(discomfort_moment || would_redo || clinical_note),
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

    const notifications = (instructors || []).map((inst) => ({
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
  }

  // Await narrative (best-effort, don't block response on failure)
  await narrativePromise;

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
