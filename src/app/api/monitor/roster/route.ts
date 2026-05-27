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
const NIL = "00000000-0000-0000-0000-000000000000";

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
    .select("id, full_name, email, role, avatar_url, establishment_id, course_id, section_id, last_seen_at, credentials_sent_at")
    .neq("role", "superadmin");
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

  // Catálogos de nombres (tablas chicas).
  const [{ data: establishments }, { data: courses }, { data: sections }] = await Promise.all([
    admin.from("establishments").select("id, name"),
    courseIds.length ? admin.from("courses").select("id, name").in("id", courseIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    sectionIds.length ? admin.from("sections").select("id, name").in("id", sectionIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const estName = new Map((establishments || []).map((e) => [e.id, e.name]));
  const courseName = new Map((courses || []).map((c) => [c.id, c.name]));
  const sectionName = new Map((sections || []).map((s) => [s.id, s.name]));

  // Conversaciones: paginadas. Evita (1) el cap de 1000 filas de PostgREST y
  // (2) que un `.in` con cientos de student_id reviente la URL (devolvía 0 →
  // todos contaban 0 conversaciones en la vista supradmin). Con listas chicas
  // filtramos por `.in`; con listas grandes/"all" traemos todo y agregamos en
  // memoria contra un Set.
  const idSet = new Set(studentIds);
  const useIn = resolved.mode === "ids" && studentIds.length <= 100;
  type ConvRow = { id: string; student_id: string; status: string; created_at: string; started_at: string | null };
  const convRows: ConvRow[] = [];
  const PAGE = 1000;
  for (let from = 0; from < 200_000; from += PAGE) {
    let cq = admin.from("conversations").select("id, student_id, status, created_at, started_at").range(from, from + PAGE - 1);
    if (useIn) cq = cq.in("student_id", studentIds);
    const { data: page } = await cq;
    const rows = (page || []) as ConvRow[];
    for (const r of rows) if (idSet.has(r.student_id)) convRows.push(r);
    if (rows.length < PAGE) break;
  }

  // Reflexiones del alumno (autorreflexión) por conversación, y encuestas por
  // alumno — para distinguir las etapas de actividad. Paginadas por el mismo
  // motivo (cap de 1000 / .in gigante).
  const REFL = ["discomfort_moment", "would_redo", "clinical_note", "alliance_framing", "rupture_moment", "nonverbal_cues", "intervention_types", "clinical_hypothesis"];
  const reflConvIds = new Set<string>();
  for (let from = 0; from < 200_000; from += PAGE) {
    const { data: page } = await admin
      .from("session_feedback")
      .select(`conversation_id, ${REFL.join(", ")}`)
      .range(from, from + PAGE - 1);
    const rows = (page || []) as unknown as Record<string, unknown>[];
    for (const r of rows) {
      if (REFL.some((f) => { const v = r[f]; return typeof v === "string" && v.trim().length > 0; })) {
        reflConvIds.add(r.conversation_id as string);
      }
    }
    if (rows.length < PAGE) break;
  }
  const surveyUsers = new Set<string>();
  for (let from = 0; from < 200_000; from += PAGE) {
    const { data: page } = await admin.from("survey_responses").select("user_id").range(from, from + PAGE - 1);
    const rows = page || [];
    for (const r of rows) if (r.user_id) surveyUsers.add(r.user_id);
    if (rows.length < PAGE) break;
  }

  type Agg = { sessions: number; activeSession: boolean; lastActivity: number | null; latestTs: number; latestStatus: string | null; latestConvId: string | null };
  const agg = new Map<string, Agg>();
  for (const id of studentIds) agg.set(id, { sessions: 0, activeSession: false, lastActivity: null, latestTs: 0, latestStatus: null, latestConvId: null });

  for (const c of convRows) {
    const a = agg.get(c.student_id);
    if (!a) continue;
    a.sessions += 1;
    if (c.status === "active") a.activeSession = true;
    const ts = new Date(c.started_at || c.created_at).getTime();
    if (!Number.isNaN(ts) && (a.lastActivity === null || ts > a.lastActivity)) {
      a.lastActivity = ts;
    }
    // Conversación más reciente (por created_at) para derivar la actividad.
    const cts = new Date(c.created_at).getTime();
    if (!Number.isNaN(cts) && cts >= a.latestTs) {
      a.latestTs = cts;
      a.latestStatus = c.status;
      a.latestConvId = c.id;
    }
  }

  // Deriva la etiqueta de actividad (estado actual o último estado si offline).
  const activityFor = (a: Agg, online: boolean, studentId: string): string => {
    if (a.activeSession) return "En sesión";
    if (a.latestStatus === "abandoned") return "Paciente IA abandonó";
    if (a.latestStatus === "completed") {
      if (surveyUsers.has(studentId)) return "Encuesta enviada";
      if (a.latestConvId && reflConvIds.has(a.latestConvId)) return "Autorreflexión enviada";
      return "Cerró sesión";
    }
    return online ? "En plataforma" : "Sin actividad";
  };

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
        role: s.role,
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
        activity: activityFor(a, online, s.id),
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

  // Totales globales de la AUTORIDAD (toda tu área: superadmin = todo GlorIA;
  // admin = su establecimiento), ignorando el filtro de UI. Para las cápsulas
  // "global" que no se contaminan con lo filtrado.
  const authCol =
    auth.mode === "section" ? "section_id"
    : auth.mode === "course" ? "course_id"
    : auth.mode === "establishment" ? "establishment_id"
    : null;
  const authVals =
    auth.mode === "section" ? auth.sectionIds
    : auth.mode === "course" ? auth.courseIds
    : auth.mode === "establishment" ? auth.establishmentIds
    : [];
  const safeVals = authVals.length ? authVals : [NIL];
  const twoMinAgo = new Date(Date.now() - ONLINE_WINDOW_MS).toISOString();

  let peopleQ = admin.from("profiles").select("id", { count: "exact", head: true }).neq("role", "superadmin");
  if (authCol) peopleQ = peopleQ.in(authCol, safeVals);
  let onlineQ = admin.from("profiles").select("id", { count: "exact", head: true }).neq("role", "superadmin").gte("last_seen_at", twoMinAgo);
  if (authCol) onlineQ = onlineQ.in(authCol, safeVals);

  const [{ count: peopleTotal }, { count: onlineTotal }, { data: activeConvs }] = await Promise.all([
    peopleQ,
    onlineQ,
    admin.from("conversations").select("student_id").eq("status", "active"),
  ]);

  let inSessionTotal = 0;
  const activeStudentIds = [...new Set((activeConvs || []).map((c) => c.student_id).filter(Boolean))];
  if (activeStudentIds.length) {
    let q = admin.from("profiles").select("id", { count: "exact", head: true }).neq("role", "superadmin").in("id", activeStudentIds);
    if (authCol) q = q.in(authCol, safeVals);
    const { count } = await q;
    inSessionTotal = count || 0;
  }

  return NextResponse.json({
    students: roster,
    totals: { people: peopleTotal || 0, online: onlineTotal || 0, inSession: inSessionTotal },
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
