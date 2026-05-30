import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getUserProfile } from "@/lib/supabase/user-profile";
import Link from "next/link";
import { LEARNING_DATA } from "@/lib/learning-data";
import { getPatientImageUrl } from "@/lib/patient-assets";
import HomeHero from "@/components/HomeHero";
import HomeNextSteps, { type NextStep } from "@/components/HomeNextSteps";
import HomeRecentActivity, { type ActivityItem } from "@/components/HomeRecentActivity";

// Cap por sesión para no inflar el total con sesiones que dejaron el
// timer corriendo sin visibility (bug conocido: SessionTimer no respeta
// pestaña en background). 90 min cubre incluso las más largas reales.
const ACTIVE_SECONDS_CAP_PER_SESSION = 90 * 60;

function rateToBadge(score: number | null | undefined): ActivityItem["badge"] {
  if (score == null) return null;
  if (score >= 9) return { label: "Excelente", tone: "good" };
  if (score >= 7) return { label: "Muy buena", tone: "good" };
  if (score >= 5) return { label: "Buena", tone: "neutral" };
  return { label: "En mejora", tone: "neutral" };
}

function relativeDate(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Hoy";
  if (days === 1) return "Hace 1 día";
  if (days < 7) return `Hace ${days} días`;
  if (days < 30) return `Hace ${Math.floor(days / 7)} sem`;
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "short" });
}

export default async function Dashboard() {
  const userProfile = await getUserProfile();
  if (!userProfile) redirect("/login");

  const supabase = await createClient();
  const admin = createAdminClient();

  // Profile (for establishment-based patient visibility)
  const { data: studentProfile } = await supabase
    .from("profiles")
    .select("establishment_id")
    .eq("id", userProfile.id)
    .single();

  // Establishment-based patient visibility
  let visiblePatientIds: string[] | null = null;
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

  // Today + week boundaries for metric calculations
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfWeek = new Date();
  const dayOfWeek = startOfWeek.getDay(); // 0=Dom .. 6=Sáb
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  startOfWeek.setDate(startOfWeek.getDate() + mondayOffset);
  startOfWeek.setHours(0, 0, 0, 0);

  // All main data in parallel
  const [
    { data: recentSessions },
    { data: patientsWithBirthday },
    { data: learningRows },
    { data: suggestedPatients },
    { data: allConversations },
    { data: previousVisit },
  ] = await Promise.all([
    supabase
      .from("conversations")
      .select(`
        id, ai_patient_id, session_number, status, created_at, active_seconds,
        session_feedback(teacher_score)
      `)
      .eq("student_id", userProfile.id)
      .order("created_at", { ascending: false })
      .limit(8),
    admin.from("ai_patients").select("id, name, birthday, age").eq("is_active", true).not("birthday", "is", null),
    supabase.from("learning_progress").select("competency").eq("student_id", userProfile.id).neq("competency", "tutor"),
    admin.from("ai_patients").select("id, name, age, occupation, difficulty_level").eq("is_active", true),
    supabase.from("conversations").select("status, active_seconds, created_at").eq("student_id", userProfile.id),
    supabase
      .from("conversations")
      .select("created_at")
      .eq("student_id", userProfile.id)
      .lt("created_at", startOfToday.toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // ── Birthday ──
  const today = new Date();
  const birthdayPatients = (patientsWithBirthday || []).filter((p) => {
    const bd = new Date(p.birthday + "T12:00:00");
    return bd.getMonth() === today.getMonth() && bd.getDate() === today.getDate();
  });

  // ── Hero metrics ──
  const daysSinceLastVisit = previousVisit?.created_at
    ? Math.max(
        1,
        Math.floor((Date.now() - new Date(previousVisit.created_at).getTime()) / (1000 * 60 * 60 * 24)),
      )
    : null;

  const sessionsCount = (allConversations || []).filter((c) => c.status === "completed").length;

  const totalMinutes = Math.round(
    (allConversations || []).reduce(
      (sum, c) => sum + Math.min(c.active_seconds || 0, ACTIVE_SECONDS_CAP_PER_SESSION),
      0,
    ) / 60,
  );

  // Cápsulas listas = total examples en LEARNING_DATA - cuántos ya leyó
  const totalExamples = LEARNING_DATA.reduce((sum, c) => sum + c.examples.length, 0);
  const readExamples = (learningRows || []).length;
  const capsulesReady = Math.max(0, totalExamples - readExamples);

  // ── Patient name map (admin bypasses RLS for shown sessions) ──
  const sessionPatientIds = [...new Set((recentSessions || []).map((s) => s.ai_patient_id))];
  const { data: sessionPatients } = sessionPatientIds.length > 0
    ? await admin.from("ai_patients").select("id, name").in("id", sessionPatientIds)
    : { data: [] as { id: string; name: string }[] };
  const patientNameMap = new Map((sessionPatients || []).map((p) => [p.id, p.name]));

  // ── Active session (más reciente sin terminar) ──
  type RawSession = {
    id: string;
    ai_patient_id: string;
    session_number: number;
    status: string;
    created_at: string;
    active_seconds: number | null;
    session_feedback: { teacher_score: number | null }[] | { teacher_score: number | null } | null;
  };
  const sessions = (recentSessions || []) as RawSession[];
  const activeSession = sessions.find(
    (s) =>
      (s.status === "active" || s.status === "abandoned") &&
      (!visiblePatientIds || visiblePatientIds.includes(s.ai_patient_id)),
  );

  // ── Build next steps ──
  const nextSteps: NextStep[] = [];

  if (activeSession) {
    const name = patientNameMap.get(activeSession.ai_patient_id) || "tu paciente";
    nextSteps.push({
      kind: "active_session",
      subtitle: "Continúa tu práctica",
      title: `Sesión con ${name}`,
      href: `/chat/${activeSession.ai_patient_id}`,
    });
  }

  // Next capsule: primera competencia con ejemplos sin leer
  const readByComp = new Map<string, number>();
  (learningRows || []).forEach((r) => {
    readByComp.set(r.competency, (readByComp.get(r.competency) || 0) + 1);
  });
  const nextCompetency = LEARNING_DATA.find(
    (c) => (readByComp.get(c.key) || 0) < c.examples.length,
  );
  if (nextCompetency) {
    const read = readByComp.get(nextCompetency.key) || 0;
    const remaining = nextCompetency.examples.length - read;
    nextSteps.push({
      kind: "next_capsule",
      subtitle: "Sigue aprendiendo",
      title: nextCompetency.name,
      href: `/aprendizaje/${nextCompetency.key}`,
    });
    // Guarda remaining para descriptor más rico (lo embebemos en subtitle como punto extra)
    nextSteps[nextSteps.length - 1].subtitle = `Sigue aprendiendo · ${remaining} ejemplo${remaining === 1 ? "" : "s"} restante${remaining === 1 ? "" : "s"}`;
  }

  // Objetivo semanal: 3 sesiones por semana (Lun-Dom)
  const WEEKLY_GOAL = 3;
  const thisWeekDone = (allConversations || []).filter(
    (c) => c.status === "completed" && new Date(c.created_at) >= startOfWeek,
  ).length;
  if (thisWeekDone < WEEKLY_GOAL) {
    nextSteps.push({
      kind: "weekly_goal",
      subtitle: `Objetivo semanal · ${thisWeekDone}/${WEEKLY_GOAL} completadas`,
      title: `Practica ${WEEKLY_GOAL} entrevistas clínicas`,
      href: "/pacientes",
    });
  }

  // ── Recent activity (últimas 3 sesiones completadas) ──
  const recentActivity: ActivityItem[] = sessions
    .filter((s) => s.status === "completed")
    .slice(0, 3)
    .map((s) => {
      const fb = Array.isArray(s.session_feedback) ? s.session_feedback[0] : s.session_feedback;
      const name = patientNameMap.get(s.ai_patient_id) || "Paciente";
      return {
        kind: "session_completed" as const,
        title: `Entrevista con ${name}`,
        subtitle: `Práctica completada · ${relativeDate(s.created_at)}`,
        badge: rateToBadge(fb?.teacher_score),
      };
    });

  // ── Patient suggestions (idéntica lógica que antes) ──
  const practicedPatientIds = new Set((recentSessions || []).map((s) => s.ai_patient_id));
  const visibleSuggestions = (suggestedPatients || [])
    .filter((p) => !visiblePatientIds || visiblePatientIds.includes(p.id));

  const neverPracticed = visibleSuggestions.filter((p) => !practicedPatientIds.has(p.id));
  const alreadyPracticed = visibleSuggestions.filter((p) => practicedPatientIds.has(p.id));
  const shuffled = [...neverPracticed].sort(() => Math.random() - 0.5);
  const fallback = [...alreadyPracticed].sort(() => Math.random() - 0.5);
  const candidatePool = [...shuffled, ...fallback];

  const picked: typeof candidatePool = [];
  const diffLevels = ["beginner", "intermediate", "advanced"];
  for (const level of diffLevels) {
    const match = candidatePool.find((p) => p.difficulty_level === level && !picked.includes(p));
    if (match) picked.push(match);
  }
  for (const p of candidatePool) {
    if (picked.length >= 4) break;
    if (!picked.includes(p)) picked.push(p);
  }

  const patientSuggestions = picked.map((p) => ({
    id: p.id, name: p.name, age: p.age, occupation: p.occupation, difficulty: p.difficulty_level,
  }));

  const slug = (name: string) =>
    name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-");

  const firstName = userProfile.fullName.split(" ")[0] || "Estudiante";

  // Primary CTA: continuar sesión activa o empezar nueva
  const primaryCta = activeSession
    ? { href: `/chat/${activeSession.ai_patient_id}`, label: "Continuar práctica" }
    : { href: "/pacientes", label: "Empezar práctica" };

  return (
    <div className="min-h-screen">
      <div className="px-4 sm:px-6 lg:px-8 py-6 pb-10 space-y-6 max-w-7xl mx-auto">

        {/* Birthday banner */}
        {birthdayPatients.length > 0 && (
          <div className="animate-fade-in bg-sidebar/5 border border-sidebar/15 rounded-xl px-5 py-3 flex items-center gap-3">
            <span className="text-lg" role="img" aria-label="cumpleaños">🎂</span>
            <p className="text-sm text-gray-700">
              {"Hoy es el cumpleaños de "}
              <strong className="text-gray-900">{birthdayPatients.map((p) => p.name).join(", ")}</strong>
              {birthdayPatients.length === 1
                ? `. Cumple ${today.getFullYear() - new Date(birthdayPatients[0].birthday + "T12:00:00").getFullYear()} años.`
                : "."}
            </p>
          </div>
        )}

        {/* Hero cinematográfico */}
        <div className="animate-fade-in">
          <HomeHero
            firstName={firstName}
            daysSinceLastVisit={daysSinceLastVisit}
            sessionsCount={sessionsCount}
            totalMinutes={totalMinutes}
            capsulesReady={capsulesReady}
            primaryCta={primaryCta}
          />
        </div>

        {/* Grid 2/3 + 1/3 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna izquierda */}
          <div className="lg:col-span-2 space-y-6 animate-slide-up">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-900">¿Con quién quieres practicar?</h2>
                <Link href="/pacientes" className="text-xs text-sidebar hover:underline">Ver todos</Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {patientSuggestions.map((p) => {
                  const pSlug = slug(p.name);
                  const diffColor =
                    p.difficulty === "beginner" ? "text-emerald-600 bg-emerald-50"
                    : p.difficulty === "intermediate" ? "text-amber-600 bg-amber-50"
                    : "text-red-600 bg-red-50";
                  const diffLabel =
                    p.difficulty === "beginner" ? "Principiante"
                    : p.difficulty === "intermediate" ? "Intermedio" : "Avanzado";
                  return (
                    <Link
                      key={p.id}
                      href={`/chat/${p.id}`}
                      className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all group"
                    >
                      <div className="aspect-square overflow-hidden bg-gray-100 relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={getPatientImageUrl(pSlug)}
                          alt={p.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                        <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 bg-sidebar text-white font-semibold text-[10px] px-2.5 py-1 rounded-lg opacity-90 group-hover:opacity-100 transition-opacity">
                          Practicar →
                        </span>
                      </div>
                      <div className="p-2.5">
                        <p className="text-xs font-bold text-gray-900">{p.name}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">{p.age} años · {p.occupation}</p>
                        <span className={`inline-block mt-1 text-[9px] font-medium px-2 py-0.5 rounded-full ${diffColor}`}>
                          {diffLabel}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
              <div className="text-center mt-4">
                <Link href="/pacientes" className="text-xs text-sidebar hover:underline">
                  Ver todos los pacientes →
                </Link>
              </div>
            </div>
          </div>

          {/* Columna derecha */}
          <div className="space-y-6 animate-slide-up">
            <HomeNextSteps steps={nextSteps} />
            <HomeRecentActivity items={recentActivity} />
          </div>
        </div>
      </div>
    </div>
  );
}
