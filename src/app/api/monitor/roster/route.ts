import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getMonitorAuthority,
  resolveMonitorStudentIds,
  parseRequestedScope,
} from "@/lib/monitor/scope";

// Monitor operacional — roster de personas dentro del alcance del usuario.
//
// Devuelve, por alumno: si está conectado ahora, su última actividad real,
// cuántas sesiones lleva, si tiene una sesión en curso y cuántas quedan por
// revisar. Es la tabla que alimenta el panel "Personas" para supradmin,
// admin e instructor (y, tras la extracción, la vista de Pilotos).
//
// El alcance se resuelve server-side: el query param `scope` es solo un
// filtro de UI que nunca amplía la autoridad del usuario.

const ONLINE_WINDOW_MS = 2 * 60 * 1000; // "conectado ahora": last_seen_at < 2 min

export async function GET(request: Request) {
  const auth = await getMonitorAuthority();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const requested = parseRequestedScope(new URL(request.url).searchParams.get("scope"));
  const resolved = await resolveMonitorStudentIds(auth, requested);
  const admin = createAdminClient();

  // 1) Perfiles de los alumnos en alcance.
  let profilesQuery = admin
    .from("profiles")
    .select("id, full_name, email, avatar_url, establishment_id, course_id, section_id, last_seen_at, credentials_sent_at")
    .eq("role", "student");
  if (resolved.mode === "ids") {
    if (resolved.studentIds.length === 0) {
      return NextResponse.json({ students: [], scope: scopeInfo(auth, requested), generatedAt: new Date().toISOString() });
    }
    profilesQuery = profilesQuery.in("id", resolved.studentIds);
  }
  const { data: profiles } = await profilesQuery;
  const students = profiles || [];
  const studentIds = students.map((s) => s.id);

  if (studentIds.length === 0) {
    return NextResponse.json({ students: [], scope: scopeInfo(auth, requested), generatedAt: new Date().toISOString() });
  }

  // Nombres de asignatura/sección: solo los referenciados por estos alumnos.
  const courseIds = [...new Set(students.map((s) => s.course_id).filter((x): x is string => !!x))];
  const sectionIds = [...new Set(students.map((s) => s.section_id).filter((x): x is string => !!x))];

  // 2) Conversaciones + estado de revisión, en paralelo con catálogos de nombres.
  const [{ data: conversations }, { data: establishments }, { data: courses }, { data: sections }] = await Promise.all([
    admin
      .from("conversations")
      .select("id, student_id, status, created_at, started_at, active_seconds, session_competencies(feedback_status)")
      .in("student_id", studentIds),
    admin.from("establishments").select("id, name"),
    courseIds.length ? admin.from("courses").select("id, name").in("id", courseIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    sectionIds.length ? admin.from("sections").select("id, name").in("id", sectionIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const estName = new Map((establishments || []).map((e) => [e.id, e.name]));
  const courseName = new Map((courses || []).map((c) => [c.id, c.name]));
  const sectionName = new Map((sections || []).map((s) => [s.id, s.name]));

  type Agg = {
    sessions: number;
    activeSession: boolean;
    lastActivity: number | null; // epoch ms
    pendingReviews: number;
  };
  const agg = new Map<string, Agg>();
  for (const id of studentIds) {
    agg.set(id, { sessions: 0, activeSession: false, lastActivity: null, pendingReviews: 0 });
  }

  for (const c of conversations || []) {
    const a = agg.get(c.student_id);
    if (!a) continue;
    a.sessions += 1;
    if (c.status === "active") a.activeSession = true;

    const ts = new Date(c.started_at || c.created_at).getTime();
    if (!Number.isNaN(ts) && (a.lastActivity === null || ts > a.lastActivity)) {
      a.lastActivity = ts;
    }

    // Pendiente de revisión: sesión completada cuyo feedback no fue resuelto.
    if (c.status === "completed") {
      const sc = c.session_competencies as { feedback_status?: string }[] | { feedback_status?: string } | null;
      const fs = Array.isArray(sc) ? sc[0]?.feedback_status : sc?.feedback_status;
      if (!fs || fs === "pending") a.pendingReviews += 1;
    }
  }

  const now = Date.now();
  const roster = students
    .map((s) => {
      const a = agg.get(s.id)!;
      const lastSeen = s.last_seen_at ? new Date(s.last_seen_at).getTime() : null;
      const online = lastSeen !== null && now - lastSeen < ONLINE_WINDOW_MS;
      return {
        id: s.id,
        full_name: s.full_name,
        email: s.email,
        avatar_url: s.avatar_url,
        establishment_id: s.establishment_id,
        establishment_name: s.establishment_id ? estName.get(s.establishment_id) || null : null,
        course_id: s.course_id,
        course_name: s.course_id ? courseName.get(s.course_id) || null : null,
        section_id: s.section_id,
        section_name: s.section_id ? sectionName.get(s.section_id) || null : null,
        online,
        last_seen_at: s.last_seen_at,
        last_activity_at: a.lastActivity ? new Date(a.lastActivity).toISOString() : null,
        sessions_count: a.sessions,
        has_active_session: a.activeSession,
        pending_reviews: a.pendingReviews,
        credentials_sent_at: s.credentials_sent_at,
      };
    })
    .sort((x, y) => {
      // Conectados primero, luego por última actividad descendente.
      if (x.online !== y.online) return x.online ? -1 : 1;
      const lx = x.last_activity_at ? Date.parse(x.last_activity_at) : 0;
      const ly = y.last_activity_at ? Date.parse(y.last_activity_at) : 0;
      return ly - lx;
    });

  return NextResponse.json({
    students: roster,
    scope: scopeInfo(auth, requested),
    generatedAt: new Date().toISOString(),
  });
}

function scopeInfo(
  auth: Extract<Awaited<ReturnType<typeof getMonitorAuthority>>, { ok: true }>,
  requested: ReturnType<typeof parseRequestedScope>,
) {
  return {
    authority: auth.mode,
    isSuperadmin: auth.isSuperadmin,
    sectionFallback: auth.sectionFallback,
    requestedKind: requested.kind,
  };
}
