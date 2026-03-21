import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getUserProfile } from "@/lib/supabase/user-profile";
import Link from "next/link";
import { LEVELS, getLevelInfo } from "@/lib/gamification";

export default async function Dashboard() {
  const userProfile = await getUserProfile();
  if (!userProfile) redirect("/login");

  const supabase = await createClient();

  // Tutor onboarding check
  if (userProfile.role === "student") {
    const { data: tutorProgress } = await supabase
      .from("learning_progress")
      .select("id")
      .eq("student_id", userProfile.id)
      .eq("competency", "tutor")
      .limit(1);

    if (!tutorProgress || tutorProgress.length === 0) {
      redirect("/aprendizaje/tutor");
    }
  }

  // Get student's visible patient IDs (by establishment country + explicit assignments)
  const { data: studentProfile } = await supabase
    .from("profiles")
    .select("establishment_id")
    .eq("id", userProfile.id)
    .single();

  const admin = createAdminClient();
  let visiblePatientIds: string[] | null = null; // null = no filtering (superadmin/no establishment)
  if (studentProfile?.establishment_id) {
    const { data: est } = await admin
      .from("establishments")
      .select("country")
      .eq("id", studentProfile.establishment_id)
      .single();

    const [{ data: byCountry }, { data: byAssignment }] = await Promise.all([
      est?.country
        ? admin.from("ai_patients").select("id").eq("is_active", true).contains("country", [est.country])
        : Promise.resolve({ data: [] as { id: string }[] }),
      admin
        .from("establishment_patients")
        .select("ai_patient_id")
        .eq("establishment_id", studentProfile.establishment_id),
    ]);

    const ids = new Set([
      ...(byCountry || []).map((p) => p.id),
      ...(byAssignment || []).map((p) => p.ai_patient_id),
    ]);
    visiblePatientIds = Array.from(ids);
  }

  // All queries in parallel
  const [
    { data: progress },
    { data: recentSessions },
    { data: patientsWithBirthday },
    { data: learningRows },
    { data: achievementsEarned },
    { data: suggestedPatients },
  ] = await Promise.all([
    supabase.from("student_progress").select("*").eq("student_id", userProfile.id).single(),
    supabase
      .from("conversations")
      .select("id, ai_patient_id, session_number, status, created_at, active_seconds")
      .eq("student_id", userProfile.id)
      .order("created_at", { ascending: false })
      .limit(8),
    admin.from("ai_patients").select("id, name, birthday, age").eq("is_active", true).not("birthday", "is", null),
    supabase.from("learning_progress").select("competency").eq("student_id", userProfile.id).neq("competency", "tutor"),
    supabase.from("student_achievements").select("id").eq("student_id", userProfile.id),
    admin.from("ai_patients").select("id, name, age, occupation, difficulty_level").eq("is_active", true).limit(4),
  ]);

  // Birthday
  const today = new Date();
  const birthdayPatients = (patientsWithBirthday || []).filter((p) => {
    const bd = new Date(p.birthday + "T12:00:00");
    return bd.getMonth() === today.getMonth() && bd.getDate() === today.getDate();
  });

  // Level
  const totalXp = progress?.total_xp || 0;
  const levelInfo = getLevelInfo(totalXp);
  const sessionsCompleted = progress?.sessions_completed || 0;
  const streak = progress?.current_streak || 0;
  const modulesCompleted = new Set((learningRows || []).map((r) => r.competency)).size;
  const achievementCount = achievementsEarned?.length || 0;

  const firstName = userProfile.fullName.split(" ")[0] || "Estudiante";
  const avatarUrl = userProfile.avatarUrl;
  const initials = userProfile.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  // Fetch patient names for recent sessions (admin bypasses RLS)
  const sessionPatientIds = [...new Set((recentSessions || []).map((s) => s.ai_patient_id))];
  const { data: sessionPatients } = sessionPatientIds.length > 0
    ? await admin.from("ai_patients").select("id, name").in("id", sessionPatientIds)
    : { data: [] as { id: string; name: string }[] };
  const patientNameMap = new Map((sessionPatients || []).map((p) => [p.id, p.name]));

  // Sessions
  const sessions = (recentSessions || []).map((s) => {
    return {
      id: s.id, patientId: s.ai_patient_id, patientName: patientNameMap.get(s.ai_patient_id) || "",
      sessionNumber: s.session_number, status: s.status,
      createdAt: s.created_at, activeSeconds: s.active_seconds || 0,
    };
  });
  const activeSessions = sessions.filter((s) =>
    (s.status === "active" || s.status === "abandoned") &&
    (!visiblePatientIds || visiblePatientIds.includes(s.patientId))
  );

  const patientSuggestions = (suggestedPatients || [])
    .filter((p) => !visiblePatientIds || visiblePatientIds.includes(p.id))
    .map((p) => ({
      id: p.id, name: p.name, age: p.age, occupation: p.occupation, difficulty: p.difficulty_level,
    }));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const slug = (name: string) => name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");

  return (
    <div className="min-h-screen">
      <div className="px-4 sm:px-8 py-6 pb-8 space-y-6 max-w-4xl mx-auto">

        {/* Birthday banner */}
        {birthdayPatients.length > 0 && (
          <div className="animate-fade-in bg-sidebar/5 border border-sidebar/15 rounded-xl px-5 py-4 flex items-center gap-3">
            <span className="text-lg" role="img" aria-label="cumplea\u00f1os">🎂</span>
            <p className="text-sm text-gray-700">
              {"Hoy es el cumplea\u00f1os de "}
              <strong className="text-gray-900">{birthdayPatients.map((p) => p.name).join(", ")}</strong>
              {birthdayPatients.length === 1
                ? `. Cumple ${today.getFullYear() - new Date(birthdayPatients[0].birthday + "T12:00:00").getFullYear()} a\u00f1os.`
                : "."}
            </p>
          </div>
        )}

        {/* ═══ PROFILE CARD ═══ */}
        <div className="animate-fade-in bg-white rounded-2xl border border-gray-200 p-6 sm:p-8">
          <div className="flex items-center gap-5 sm:gap-6">
            {/* Avatar — big, clickable */}
            <Link
              href="/mi-perfil"
              className="relative group flex-shrink-0"
              title="Editar mi perfil"
            >
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-3 border-sidebar/20 group-hover:border-sidebar transition-colors">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-sidebar flex items-center justify-center">
                    <span className="text-white text-2xl sm:text-3xl font-bold">{initials}</span>
                  </div>
                )}
              </div>
              {/* Overlay on hover */}
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
              {/* "Sube tu foto" nudge if no avatar */}
              {!avatarUrl && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[9px] text-sidebar font-medium bg-sidebar/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                  Sube tu foto
                </span>
              )}
            </Link>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                Hola, {firstName}
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {levelInfo.current.name} &middot; {totalXp} XP
                {streak > 0 && <span className="text-amber-500"> &middot; {streak}d racha</span>}
              </p>

              {/* XP progress bar */}
              {levelInfo.next && (
                <div className="mt-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-sidebar to-sidebar/70 rounded-full transition-all duration-1000"
                        style={{ width: `${levelInfo.progress * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-400 whitespace-nowrap">
                      {levelInfo.xpInLevel}/{levelInfo.xpForNext}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {levelInfo.xpForNext - levelInfo.xpInLevel} XP para {levelInfo.next.name}
                  </p>
                </div>
              )}

              {/* Mini stats row */}
              <div className="flex gap-4 mt-3">
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-900">{sessionsCompleted}</p>
                  <p className="text-[10px] text-gray-400">sesiones</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-900">{modulesCompleted}<span className="text-xs font-normal text-gray-300">/10</span></p>
                  <p className="text-[10px] text-gray-400">m&oacute;dulos</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-900">{achievementCount}<span className="text-xs font-normal text-gray-300">/12</span></p>
                  <p className="text-[10px] text-gray-400">logros</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ ACTIVE SESSIONS — HORIZONTAL CARDS / CAROUSEL ═══ */}
        {activeSessions.length > 0 && (
          <div className="animate-slide-up">
            <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 scrollbar-hide">
              {activeSessions.map((s) => {
                const patientSlug = slug(s.patientName);
                const mins = Math.round(s.activeSeconds / 60);
                return (
                  <Link
                    key={s.id}
                    href={`/chat/${s.patientId}?conversationId=${s.id}`}
                    className={`snap-start flex-shrink-0 bg-gradient-to-br from-sidebar to-[#2D3561] rounded-2xl overflow-hidden hover:shadow-xl transition-all group ${
                      activeSessions.length === 1 ? "w-full" : "w-[85%] sm:w-[calc(50%-0.5rem)]"
                    }`}
                  >
                    <div className="flex items-center gap-4 p-5">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden flex-shrink-0 border-2 border-white/20">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`${supabaseUrl}/storage/v1/object/public/patients/${patientSlug}.png`}
                          alt={s.patientName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-white/50 uppercase tracking-wider font-medium mb-1">
                          {"Contin\u00faa donde lo dejaste"}
                        </p>
                        <p className="text-base sm:text-lg font-bold text-white truncate">
                          Sesi&oacute;n #{s.sessionNumber} con {s.patientName}
                        </p>
                        <p className="text-xs text-white/60 mt-0.5">
                          {mins > 0 ? `${mins} min` : "Reci\u00e9n iniciada"}
                          {s.status === "abandoned" ? " \u00b7 Abandonada" : " \u00b7 En curso"}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        <span className="inline-flex items-center gap-1.5 bg-white/20 text-white font-semibold text-sm px-4 py-2 rounded-xl transition-colors group-hover:bg-white group-hover:text-sidebar">
                          Retomar &rarr;
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ QUICK ACTIONS ═══ */}
        <div className="animate-slide-up">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">&iquest;Qu&eacute; quieres hacer hoy?</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Link href="/pacientes" className="bg-white rounded-xl border border-gray-200 p-4 hover:border-sidebar/30 hover:shadow-md transition-all group text-center">
              <div className="w-10 h-10 rounded-lg bg-sidebar/10 flex items-center justify-center mx-auto mb-2 group-hover:bg-sidebar/20 transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4A55A2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
              </div>
              <p className="text-xs font-semibold text-gray-900">Practicar</p>
            </Link>
            <Link href="/aprendizaje" className="bg-white rounded-xl border border-gray-200 p-4 hover:border-sidebar/30 hover:shadow-md transition-all group text-center">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mx-auto mb-2 group-hover:bg-emerald-500/20 transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              </div>
              <p className="text-xs font-semibold text-gray-900">Aprender</p>
            </Link>
            <Link href="/progreso" className="bg-white rounded-xl border border-gray-200 p-4 hover:border-sidebar/30 hover:shadow-md transition-all group text-center">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center mx-auto mb-2 group-hover:bg-amber-500/20 transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
              </div>
              <p className="text-xs font-semibold text-gray-900">Progreso</p>
            </Link>
            <Link href="/historial" className="bg-white rounded-xl border border-gray-200 p-4 hover:border-sidebar/30 hover:shadow-md transition-all group text-center">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center mx-auto mb-2 group-hover:bg-purple-500/20 transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <p className="text-xs font-semibold text-gray-900">Historial</p>
            </Link>
          </div>
        </div>

        {/* ═══ PATIENT SUGGESTIONS ═══ */}
        <div className="animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">&iquest;Con qui&eacute;n quieres practicar?</h2>
            <Link href="/pacientes" className="text-xs text-sidebar hover:underline">Ver todos</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {patientSuggestions.map((p) => {
              const pSlug = slug(p.name);
              const diffColor = p.difficulty === "beginner" ? "text-emerald-600 bg-emerald-50" : p.difficulty === "intermediate" ? "text-amber-600 bg-amber-50" : "text-red-600 bg-red-50";
              const diffLabel = p.difficulty === "beginner" ? "Principiante" : p.difficulty === "intermediate" ? "Intermedio" : "Avanzado";
              return (
                <Link
                  key={p.id}
                  href={`/chat/${p.id}`}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-sidebar/30 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 group"
                >
                  <div className="aspect-square overflow-hidden bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`${supabaseUrl}/storage/v1/object/public/patients/${pSlug}.png`}
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-sidebar transition-colors">{p.name}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5 truncate">{p.age} a&ntilde;os &middot; {p.occupation}</p>
                    <span className={`inline-block mt-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full ${diffColor}`}>
                      {diffLabel}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
