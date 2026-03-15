import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, ChevronRight, Brain, GraduationCap,
  MessageSquare, TrendingUp, Flame, Target,
} from "lucide-react";
import DownloadReportButton from "@/components/DownloadReportButton";

interface Props {
  params: Promise<{ studentId: string }>;
}

export default async function DocenteAlumnoPage({ params }: Props) {
  const { studentId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Student profile
  const { data: student } = await supabase
    .from("profiles")
    .select("id, full_name, email, created_at")
    .eq("id", studentId)
    .eq("role", "student")
    .single();

  if (!student) redirect("/docente/dashboard");

  // Progress
  const { data: progress } = await supabase
    .from("student_progress")
    .select("*")
    .eq("student_id", studentId)
    .single();

  // All sessions with evaluations
  const { data: sessions } = await supabase
    .from("conversations")
    .select(`
      id, ai_patient_id, session_number, status, created_at,
      ai_patients(name, difficulty_level),
      session_competencies(empathy, active_listening, open_questions, reformulation, confrontation, silence_management, rapport, overall_score, ai_commentary),
      session_feedback(teacher_comment, teacher_score)
    `)
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });

  // Achievements
  const { data: achievements } = await supabase
    .from("student_achievements")
    .select("earned_at, achievements(name, description, icon)")
    .eq("student_id", studentId)
    .order("earned_at", { ascending: false });

  const completedSessions = sessions?.filter((s) => s.status === "completed") || [];
  const totalSessions = completedSessions.length;

  type CompRow = {
    empathy: number; active_listening: number; open_questions: number;
    reformulation: number; confrontation: number; silence_management: number;
    rapport: number; overall_score: number; ai_commentary?: string;
  };
  type FbRow = { teacher_comment: string | null; teacher_score: number | null };

  // Compute average competencies across all sessions
  const allComps = completedSessions.flatMap((s) => {
    const comp = (s.session_competencies as CompRow[] | null)?.[0];
    return comp ? [comp] : [];
  });

  const avgComp = (key: keyof CompRow) => {
    const vals = allComps.map((c) => Number(c[key])).filter((v) => !isNaN(v));
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  };

  // Competency progression (last 10 sessions, oldest first)
  const progressionSessions = completedSessions.slice(0, 10).reverse();

  // Reviewed vs not reviewed
  const reviewedCount = completedSessions.filter((s) => {
    const fb = (s.session_feedback as FbRow[] | null)?.[0];
    return fb?.teacher_comment || fb?.teacher_score != null;
  }).length;

  const initials = student.full_name
    ?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "?";
  const joinDate = new Date(student.created_at).toLocaleDateString("es-CL", {
    day: "numeric", month: "long", year: "numeric",
  });

  const COMP_KEYS = [
    { key: "empathy", label: "Empatía" },
    { key: "active_listening", label: "Escucha activa" },
    { key: "open_questions", label: "Preguntas abiertas" },
    { key: "reformulation", label: "Reformulación" },
    { key: "confrontation", label: "Confrontación" },
    { key: "silence_management", label: "Silencios" },
    { key: "rapport", label: "Rapport" },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="px-8 py-5 border-b border-gray-100">
        <div className="flex items-center gap-4">
          <Link
            href="/docente/dashboard"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={18} className="text-gray-500" />
          </Link>
          <div className="w-10 h-10 rounded-full bg-sidebar flex items-center justify-center">
            <span className="text-white text-sm font-bold">{initials}</span>
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900">
              {student.full_name || student.email}
            </h1>
            <p className="text-xs text-gray-500">
              Registrado el {joinDate} &middot; {student.email}
            </p>
          </div>
          <DownloadReportButton studentId={studentId} />
        </div>
      </header>

      <div className="px-8 py-6 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">Nivel</p>
            <p className="text-lg font-bold text-gray-900">
              {progress?.level_name || "Sin actividad"}
            </p>
            <p className="text-xs text-gray-400">{progress?.total_xp || 0} XP</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">Sesiones</p>
            <p className="text-lg font-bold text-gray-900">{totalSessions}</p>
            <p className="text-xs text-gray-400">{reviewedCount} revisadas</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">Puntaje promedio</p>
            <p className="text-lg font-bold text-gray-900">
              {allComps.length > 0 ? avgComp("overall_score").toFixed(1) : "—"}
            </p>
            <p className="text-xs text-gray-400">evaluación IA</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">Racha actual</p>
            <p className="text-lg font-bold text-gray-900 flex items-center gap-1">
              {progress?.current_streak || 0}
              {(progress?.current_streak || 0) > 0 && <Flame size={16} className="text-orange-500" />}
            </p>
            <p className="text-xs text-gray-400">mejor: {progress?.longest_streak || 0}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
          {/* Left: Competency averages + session list */}
          <div className="space-y-6">
            {/* Competency averages */}
            {allComps.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Target size={16} className="text-sidebar" />
                  <h3 className="text-sm font-semibold text-gray-900">Promedio de competencias</h3>
                </div>
                <div className="space-y-2.5">
                  {COMP_KEYS.map(({ key, label }) => {
                    const val = avgComp(key as keyof CompRow);
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <span className="text-xs text-gray-600 w-32">{label}</span>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${(val / 10) * 100}%`,
                              backgroundColor: val >= 7 ? "#22c55e" : val >= 5 ? "#eab308" : "#ef4444",
                            }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-700 w-8 text-right">
                          {val.toFixed(1)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Competency progression chart (simplified text-based) */}
            {progressionSessions.length >= 2 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp size={16} className="text-green-500" />
                  <h3 className="text-sm font-semibold text-gray-900">Evolución del puntaje general</h3>
                </div>
                <div className="flex items-end gap-2 h-24">
                  {progressionSessions.map((s, i) => {
                    const comp = (s.session_competencies as CompRow[] | null)?.[0];
                    const val = comp?.overall_score != null ? Number(comp.overall_score) : 0;
                    const height = Math.max((val / 10) * 100, 5);
                    return (
                      <div key={s.id} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[9px] font-medium text-gray-500">{val.toFixed(1)}</span>
                        <div
                          className="w-full rounded-t"
                          style={{
                            height: `${height}%`,
                            backgroundColor: val >= 7 ? "#4A55A2" : val >= 5 ? "#94a3b8" : "#f87171",
                          }}
                        />
                        <span className="text-[8px] text-gray-400">#{s.session_number}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Session list */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Historial de sesiones</h3>
              {sessions && sessions.length > 0 ? (
                <div className="space-y-1">
                  {sessions.map((session) => {
                    const patient = session.ai_patients as unknown as { name: string; difficulty_level: string } | null;
                    const comp = (session.session_competencies as CompRow[] | null)?.[0];
                    const fb = (session.session_feedback as FbRow[] | null)?.[0];
                    const isCompleted = session.status === "completed";
                    const hasTeacherReview = fb?.teacher_comment || fb?.teacher_score != null;
                    const score = comp?.overall_score != null ? Number(comp.overall_score) : null;

                    const date = new Date(session.created_at).toLocaleDateString("es-CL", {
                      day: "numeric", month: "short",
                    });

                    return (
                      <Link
                        key={session.id}
                        href={isCompleted ? `/docente/sesion/${session.id}` : "#"}
                        className={`flex items-center gap-3 py-2.5 px-3 -mx-1 rounded-lg transition-colors group ${
                          isCompleted ? "hover:bg-gray-50 cursor-pointer" : "opacity-50"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {patient?.name} <span className="text-gray-400 font-normal">#{session.session_number}</span>
                          </p>
                          <p className="text-[11px] text-gray-400">{date}</p>
                        </div>

                        {score != null && (
                          <div className="flex items-center gap-1.5">
                            <Brain size={12} className="text-sidebar" />
                            <span className="text-xs font-medium text-sidebar">{score.toFixed(1)}</span>
                          </div>
                        )}

                        {hasTeacherReview ? (
                          <span className="flex items-center gap-1 text-[10px] text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                            <GraduationCap size={10} />
                            {fb?.teacher_score != null ? `${Number(fb.teacher_score).toFixed(1)}` : "Revisada"}
                          </span>
                        ) : isCompleted ? (
                          <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                            Pendiente
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                            En curso
                          </span>
                        )}

                        {isCompleted && (
                          <ChevronRight size={14} className="text-gray-300 group-hover:text-sidebar transition-colors" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-6">Sin sesiones registradas</p>
              )}
            </div>
          </div>

          {/* Right: Achievements + teacher evaluations summary */}
          <div className="space-y-6">
            {/* Teacher evaluations summary */}
            {reviewedCount > 0 && (
              <div className="bg-white rounded-xl border border-purple-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <GraduationCap size={16} className="text-purple-600" />
                  <h3 className="text-sm font-semibold text-gray-900">Tus evaluaciones</h3>
                </div>
                <div className="space-y-3">
                  {completedSessions
                    .filter((s) => {
                      const fb = (s.session_feedback as FbRow[] | null)?.[0];
                      return fb?.teacher_comment || fb?.teacher_score != null;
                    })
                    .slice(0, 5)
                    .map((s) => {
                      const fb = (s.session_feedback as FbRow[] | null)?.[0];
                      const patient = s.ai_patients as unknown as { name: string } | null;
                      const date = new Date(s.created_at).toLocaleDateString("es-CL", {
                        day: "numeric", month: "short",
                      });
                      return (
                        <div key={s.id} className="border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-medium text-gray-900">{patient?.name} #{s.session_number}</p>
                            {fb?.teacher_score != null && (
                              <span className="text-xs font-bold text-purple-700">
                                {Number(fb.teacher_score).toFixed(1)}/10
                              </span>
                            )}
                          </div>
                          {fb?.teacher_comment && (
                            <p className="text-[11px] text-gray-500 line-clamp-2">{fb.teacher_comment}</p>
                          )}
                          <p className="text-[10px] text-gray-400 mt-0.5">{date}</p>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Achievements */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Logros del alumno</h3>
              {achievements && achievements.length > 0 ? (
                <div className="space-y-2">
                  {achievements.map((a, i) => {
                    const ach = a.achievements as unknown as { name: string; description: string; icon: string } | null;
                    return (
                      <div key={i} className="flex items-center gap-3 py-1.5">
                        <div className="w-7 h-7 rounded-full bg-sidebar/10 flex items-center justify-center text-xs">
                          *
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900 truncate">{ach?.name}</p>
                          <p className="text-[10px] text-gray-400 truncate">{ach?.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-400 text-center py-4">Sin logros aún</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
