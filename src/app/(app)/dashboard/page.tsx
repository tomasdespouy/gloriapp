import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getUserProfile } from "@/lib/supabase/user-profile";
import LevelBadge from "@/components/LevelBadge";
import DashboardClient from "./DashboardClient";
import Link from "next/link";

export default async function Dashboard() {
  const userProfile = await getUserProfile();
  if (!userProfile) redirect("/login");

  const supabase = await createClient();

  // All data queries in parallel
  const [
    { data: progress },
    { data: recentScores },
    { data: recentSessions },
  ] = await Promise.all([
    supabase.from("student_progress").select("*").eq("student_id", userProfile.id).single(),
    supabase.from("session_competencies").select("overall_score").eq("student_id", userProfile.id).order("created_at", { ascending: false }).limit(5),
    supabase.from("conversations").select("id, ai_patient_id, session_number, status, created_at, active_seconds, ai_patients(name)").eq("student_id", userProfile.id).order("created_at", { ascending: false }).limit(5),
  ]);

  const avgScoreNum = recentScores && recentScores.length > 0
    ? recentScores.reduce((a, b) => a + Number(b.overall_score), 0) / recentScores.length
    : 0;

  const firstName = userProfile.fullName.split(" ")[0] || "Estudiante";
  const sessionsCompleted = progress?.sessions_completed || 0;
  const streak = progress?.current_streak || 0;
  const totalXp = progress?.total_xp || 0;

  // Serialize sessions for client
  const sessions = (recentSessions || []).map((s) => {
    const p = s.ai_patients as unknown as { name: string };
    return {
      id: s.id,
      patientId: s.ai_patient_id,
      patientName: p?.name || "",
      sessionNumber: s.session_number,
      status: s.status,
      createdAt: s.created_at,
      activeSeconds: s.active_seconds || 0,
    };
  });

  return (
    <div className="min-h-screen">
      <header className="flex justify-between items-center px-8 py-5 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Bienvenido, {firstName}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {sessionsCompleted > 0
              ? `Llevas ${sessionsCompleted} ${sessionsCompleted === 1 ? "sesión" : "sesiones"} completadas`
              : "Comienza tu primera sesión de práctica"
            }
          </p>
        </div>
      </header>

      <div className="px-8 pb-8 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-stagger">
          {/* Level — hero card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 md:col-span-2 lg:col-span-1">
            <LevelBadge totalXp={totalXp} size="large" />
          </div>

          {/* Streak */}
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl border border-orange-100 p-5">
            <DashboardClient
              type="streak"
              value={streak}
            />
          </div>

          {/* Sessions */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-5">
            <DashboardClient
              type="sessions"
              value={sessionsCompleted}
            />
          </div>

          {/* Avg score */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100 p-5">
            <DashboardClient
              type="score"
              value={avgScoreNum}
            />
          </div>
        </div>

        {/* Recent sessions — flashcards */}
        <div className="animate-slide-up">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Sesiones recientes</h3>
            <Link href="/historial" className="text-xs text-sidebar hover:underline">Ver historial completo</Link>
          </div>

          {sessions.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 animate-stagger">
              {sessions.map((s) => {
                const isActive = s.status === "active";
                const href = isActive
                  ? `/chat/${s.patientId}?conversationId=${s.id}`
                  : `/review/${s.id}`;

                const patientSlug = s.patientName
                  .toLowerCase()
                  .normalize("NFD")
                  .replace(/[\u0300-\u036f]/g, "")
                  .replace(/\s+/g, "-");

                const date = new Date(s.createdAt);
                const day = date.toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" });
                const h = date.getHours().toString().padStart(2, "0");
                const m = date.getMinutes().toString().padStart(2, "0");
                const time = `${h}:${m}`;

                const mins = Math.round(s.activeSeconds / 60);
                const duration = mins > 0 ? `${mins} min` : "";

                return (
                  <Link
                    key={s.id}
                    href={href}
                    className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-sidebar/30 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 group"
                  >
                    <div className="aspect-square overflow-hidden bg-gray-100 relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/patients/${patientSlug}.png`}
                        alt={s.patientName}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                      <div className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isActive ? "bg-amber-400 text-amber-900" : "bg-green-500 text-white"
                      }`}>
                        {isActive ? "En curso" : "Completada"}
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-sidebar transition-colors">
                        {s.patientName}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5 capitalize">{day}, {time}</p>
                      {duration && <p className="text-[11px] text-gray-400">Duración: {duration}</p>}
                      <p className="text-[11px] text-sidebar font-medium mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isActive ? "Retomar →" : "Ver resumen →"}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-sidebar/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🧑‍⚕️</span>
              </div>
              <p className="text-sm font-medium text-gray-700">¡Comienza tu primera práctica!</p>
              <p className="text-xs text-gray-400 mt-1 mb-4">Elige un paciente y pon a prueba tus habilidades terapéuticas</p>
              <Link
                href="/pacientes"
                className="inline-block bg-sidebar text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-sidebar-hover transition-colors"
              >
                Ver pacientes
              </Link>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
