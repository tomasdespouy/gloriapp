import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getUserProfile } from "@/lib/supabase/user-profile";
import CompetencyRadar from "@/components/CompetencyRadar";
import LevelBadge from "@/components/LevelBadge";
import AchievementCard from "@/components/AchievementCard";
import ProgresoClient from "./ProgresoClient";
import StudentDashboardClient from "../dashboard/StudentDashboardClient";
import { EMPTY_SCORES_V2, COMPETENCY_LABELS_V2, COMPETENCY_KEYS_V2, type CompetencyScoresV2 } from "@/lib/gamification";
import { LEARNING_DATA } from "@/lib/learning-data";
import { isPilotActive } from "@/lib/pilot-helpers";
import { Info } from "lucide-react";

export default async function ProgresoPage() {
  const userProfile = await getUserProfile();
  if (!userProfile) redirect("/login");

  const supabase = await createClient();
  const admin = createAdminClient();

  // Pilot gate: students outside any active pilot must NOT see AI-generated
  // competency scores until their docente has approved the evaluation. Pilot
  // participants (real pilots only — isPilotActive guards against stale flags)
  // see the same data with a disclaimer banner below, to make it explicit
  // that the feedback has not passed supervision yet. Admin client is used
  // for pilot_participants/pilots because student RLS only covers their own
  // pilot_participants row (see 20260420130000); pilots table is superadmin-
  // scoped anyway.
  let isPilot = false;
  const { data: pp } = await admin
    .from("pilot_participants")
    .select("pilot_id")
    .eq("user_id", userProfile.id)
    .maybeSingle();
  if (pp?.pilot_id) {
    const { data: pilotRow } = await admin
      .from("pilots")
      .select("status, scheduled_at, ended_at")
      .eq("id", pp.pilot_id)
      .single();
    if (isPilotActive(pilotRow)) isPilot = true;
  }

  // Build the two session_competencies queries. For non-pilot students we
  // restrict to rows the docente has explicitly approved (or the student
  // has subsequently acknowledged). Pilot students see the unfiltered view
  // — the disclaimer banner explains this is pre-supervision data.
  const RECENT_COLS = "setting_terapeutico, motivo_consulta, datos_contextuales, objetivos, escucha_activa, actitud_no_valorativa, optimismo, presencia, conducta_no_verbal, contencion_afectos, overall_score_v2, eval_version, overall_score, created_at";
  const HISTORY_COLS = "overall_score_v2, setting_terapeutico, motivo_consulta, datos_contextuales, objetivos, escucha_activa, actitud_no_valorativa, optimismo, presencia, conducta_no_verbal, contencion_afectos, eval_version, created_at";
  let recentScoresQuery = supabase
    .from("session_competencies")
    .select(RECENT_COLS)
    .eq("student_id", userProfile.id);
  let historyQuery = supabase
    .from("session_competencies")
    .select(HISTORY_COLS)
    .eq("student_id", userProfile.id)
    .eq("eval_version", 2);
  if (!isPilot) {
    recentScoresQuery = recentScoresQuery.in("feedback_status", ["approved", "evaluated"]);
    historyQuery = historyQuery.in("feedback_status", ["approved", "evaluated"]);
  }

  // All queries in parallel
  const [
    { data: progress },
    { data: recentScores },
    { data: allAchievements },
    { data: earnedAchievements },
    { data: learningProgress },
    { data: competencyHistory },
  ] = await Promise.all([
    supabase.from("student_progress").select("*").eq("student_id", userProfile.id).single(),
    recentScoresQuery.order("created_at", { ascending: false }).limit(10),
    supabase.from("achievements").select("*").order("xp_reward"),
    supabase.from("student_achievements").select("achievement_id, earned_at").eq("student_id", userProfile.id),
    supabase.from("learning_progress").select("competency, example_id").eq("student_id", userProfile.id),
    historyQuery.order("created_at", { ascending: true }).limit(15),
  ]);

  // Count completed nano courses (all examples read in a module)
  const readByCompetency: Record<string, number> = {};
  (learningProgress || []).forEach((p) => {
    if (p.competency !== "tutor") {
      readByCompetency[p.competency] = (readByCompetency[p.competency] || 0) + 1;
    }
  });
  const completedModules = LEARNING_DATA.filter(
    (m) => m.examples.length > 0 && (readByCompetency[m.key] || 0) >= m.examples.length
  ).length;

  // Use V2 scores if available, fallback to V1
  const hasV2 = recentScores?.some((s) => Number(s.eval_version) === 2);

  const avgScores: CompetencyScoresV2 = recentScores && recentScores.length > 0
    ? {
        setting_terapeutico: avg(recentScores.map((s) => Number(s.setting_terapeutico || 0))),
        motivo_consulta: avg(recentScores.map((s) => Number(s.motivo_consulta || 0))),
        datos_contextuales: avg(recentScores.map((s) => Number(s.datos_contextuales || 0))),
        objetivos: avg(recentScores.map((s) => Number(s.objetivos || 0))),
        escucha_activa: avg(recentScores.map((s) => Number(s.escucha_activa || 0))),
        actitud_no_valorativa: avg(recentScores.map((s) => Number(s.actitud_no_valorativa || 0))),
        optimismo: avg(recentScores.map((s) => Number(s.optimismo || 0))),
        presencia: avg(recentScores.map((s) => Number(s.presencia || 0))),
        conducta_no_verbal: avg(recentScores.map((s) => Number(s.conducta_no_verbal || 0))),
        contencion_afectos: avg(recentScores.map((s) => Number(s.contencion_afectos || 0))),
      }
    : EMPTY_SCORES_V2;

  const avgOverall = recentScores && recentScores.length > 0
    ? avg(recentScores.map((s) => Number(s.overall_score_v2 || s.overall_score || 0)))
    : 0;

  // Best competency
  let bestComp = "";
  let bestVal = 0;
  if (recentScores && recentScores.length > 0) {
    for (const key of COMPETENCY_KEYS_V2) {
      const val = avgScores[key as keyof CompetencyScoresV2];
      if (val > bestVal) { bestVal = val; bestComp = COMPETENCY_LABELS_V2[key]; }
    }
  }

  const earnedMap = new Map(
    earnedAchievements?.map((a) => [a.achievement_id, a.earned_at]) || []
  );
  const earnedCount = earnedAchievements?.length || 0;
  const totalCount = allAchievements?.length || 0;

  // "Sesiones evaluadas" must reflect the number of real session_competencies
  // rows, NOT the number of achievements earned. Previously the KPI label
  // said "Sesiones evaluadas" but the value was earnedCount, which made
  // brand-new accounts look like they had data.
  const evaluatedSessionsCount = recentScores?.length || 0;

  const hasData = (progress?.sessions_completed || 0) > 0;
  const streak = progress?.current_streak || 0;
  const longestStreak = progress?.longest_streak || 0;

  // Competency data for client
  const compData = COMPETENCY_KEYS_V2.map((key) => ({
    key,
    label: COMPETENCY_LABELS_V2[key],
    value: avgScores[key as keyof CompetencyScoresV2],
  }));

  return (
    <div className="min-h-screen">
      <header className="px-4 sm:px-8 py-5 animate-fade-in">
        <h1 className="text-2xl font-bold text-gray-900">Mi progreso</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Tu desarrollo de competencias clínicas
        </p>
      </header>

      {isPilot && (
        <div className="mx-4 sm:mx-8 mb-6 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3 animate-fade-in">
          <Info size={18} className="text-amber-700 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900">
              Retroalimentación generada por la plataforma
            </p>
            <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
              Esta evaluación fue generada automáticamente por la IA y
              todavía no ha sido revisada por tu docente supervisor. Es
              información complementaria — no reemplaza la evaluación de
              tu docente.
            </p>
          </div>
        </div>
      )}

      <div className="px-4 sm:px-8 pb-8 space-y-6">
        {/* Stats row — pedagogical metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-stagger">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
            <p className="text-3xl font-bold text-gray-900">{progress?.sessions_completed || 0}</p>
            <p className="text-xs text-gray-500 mt-1">Sesiones realizadas</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
            <p className="text-3xl font-bold text-sidebar">
              {progress?.sessions_completed ? Math.round((progress.sessions_completed * 25) / 60) : 0}
            </p>
            <p className="text-xs text-gray-500 mt-1">Horas en sesión (aprox.)</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
            <p className="text-3xl font-bold text-green-600">{evaluatedSessionsCount}</p>
            <p className="text-xs text-gray-500 mt-1">Sesiones evaluadas</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
            <p className="text-3xl font-bold text-amber-500">{completedModules}</p>
            <p className="text-xs text-gray-500 mt-1">Nano cursos completados</p>
          </div>
        </div>

        {/* Radar + Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-slide-up">
          {/* Radar */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Radar de competencias</h3>
            {hasData ? (
              <CompetencyRadar scores={avgScores} size={420} version={hasV2 ? 2 : 1} />
            ) : (
              <div className="flex items-center justify-center h-[280px] text-gray-400 text-sm">
                Completa tu primera sesión para ver tu radar
              </div>
            )}
            {hasData && (
              <p className="text-sm text-gray-500 font-medium text-center mt-2">
                Promedio de las últimas {recentScores?.length || 0} sesiones
              </p>
            )}
          </div>

          {/* Competency breakdown */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Detalle por competencia</h3>
              <a
                href="/sobre#respaldo-autores"
                className="w-5 h-5 rounded-full bg-sidebar/10 text-sidebar flex items-center justify-center text-[10px] font-bold hover:bg-sidebar/20 transition-colors"
                title="Basado en la Pauta de Evaluación de Competencias Psicoterapéuticas (Valdés & Gómez, 2023). Ver citas en Sobre GlorIA."
              >
                i
              </a>
            </div>
            {hasData ? (
              <ProgresoClient type="bars" compData={compData} />
            ) : (
              <div className="flex items-center justify-center h-[280px] text-gray-400 text-sm">
                Sin datos aún
              </div>
            )}
          </div>
        </div>

        {/* Evolution chart */}
        {(() => {
          const V2_KEYS = [
            "setting_terapeutico", "motivo_consulta", "datos_contextuales", "objetivos",
            "escucha_activa", "actitud_no_valorativa", "optimismo", "presencia", "conducta_no_verbal", "contencion_afectos",
          ];
          const evolutionData = (competencyHistory || []).map((row, idx) => {
            const point: Record<string, number | string> = { session: `S${idx + 1}` };
            V2_KEYS.forEach((key) => { point[key] = Number((row as Record<string, unknown>)[key]) || 0; });
            point.overall = Number(row.overall_score_v2) || 0;
            return point;
          });
          return (
            <div className="animate-slide-up">
              <StudentDashboardClient evolutionData={evolutionData} />
            </div>
          );
        })()}

        {/* Achievements */}
        <div className="animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">Logros</h3>
            <span className="text-sm text-gray-400">{earnedCount} de {totalCount}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 animate-stagger">
            {allAchievements?.map((a) => (
              <AchievementCard
                key={a.id}
                name={a.name}
                description={a.description}
                icon={a.icon}
                earned={earnedMap.has(a.id)}
                earnedAt={earnedMap.get(a.id) || undefined}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Number((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1));
}
