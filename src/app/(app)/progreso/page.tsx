import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getUserProfile } from "@/lib/supabase/user-profile";
import CompetencyRadar from "@/components/CompetencyRadar";
import LevelBadge from "@/components/LevelBadge";
import AchievementCard from "@/components/AchievementCard";
import ProgresoClient from "./ProgresoClient";
import { EMPTY_SCORES_V2, COMPETENCY_LABELS_V2, COMPETENCY_KEYS_V2, type CompetencyScoresV2 } from "@/lib/gamification";

export default async function ProgresoPage() {
  const userProfile = await getUserProfile();
  if (!userProfile) redirect("/login");

  const supabase = await createClient();

  // All queries in parallel
  const [
    { data: progress },
    { data: recentScores },
    { data: allAchievements },
    { data: earnedAchievements },
  ] = await Promise.all([
    supabase.from("student_progress").select("*").eq("student_id", userProfile.id).single(),
    supabase.from("session_competencies").select("setting_terapeutico, motivo_consulta, datos_contextuales, objetivos, escucha_activa, actitud_no_valorativa, optimismo, presencia, conducta_no_verbal, contencion_afectos, overall_score_v2, eval_version, overall_score, created_at").eq("student_id", userProfile.id).order("created_at", { ascending: false }).limit(10),
    supabase.from("achievements").select("*").order("xp_reward"),
    supabase.from("student_achievements").select("achievement_id, earned_at").eq("student_id", userProfile.id),
  ]);

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
      <header className="px-8 py-5 animate-fade-in">
        <h1 className="text-2xl font-bold text-gray-900">Mi progreso</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Tu desarrollo de competencias clínicas
        </p>
      </header>

      <div className="px-8 pb-8 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-stagger">
          {/* Level */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <LevelBadge totalXp={progress?.total_xp || 0} size="large" />
          </div>

          {/* Avg score */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100 p-5">
            <ProgresoClient type="score" value={avgOverall} bestComp={bestComp} />
          </div>

          {/* Streak */}
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl border border-orange-100 p-5">
            <ProgresoClient type="streak" value={streak} longestStreak={longestStreak} />
          </div>

          {/* Achievements */}
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl border border-purple-100 p-5">
            <ProgresoClient type="achievements" value={earnedCount} total={totalCount} />
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
              <p className="text-xs text-gray-400 text-center mt-2">
                Promedio de las últimas {recentScores?.length || 0} sesiones
              </p>
            )}
          </div>

          {/* Competency breakdown */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Detalle por competencia</h3>
            {hasData ? (
              <ProgresoClient type="bars" compData={compData} />
            ) : (
              <div className="flex items-center justify-center h-[280px] text-gray-400 text-sm">
                Sin datos aún
              </div>
            )}
          </div>
        </div>

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
