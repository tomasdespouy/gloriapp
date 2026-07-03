import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminContext } from "@/lib/admin-helpers";
import { applyScope, scopeAllowsCourse, scopeAllowsSection } from "@/lib/admin-scope";
import RetroClient from "./RetroClient";

const SAFE_EMPTY_ID = "00000000-0000-0000-0000-000000000000";

export default async function RetroalimentacionPage() {
  const ctx = await getAdminContext();
  const admin = createAdminClient();
  const isSuperadmin = ctx.isSuperadmin;
  const allowedEstIds = ctx.establishmentIds;

  // For admin: pre-resolve the user_ids belonging to their establishments
  // (used to filter survey_responses). Superadmin sees everything.
  let scopedUserIds: string[] | null = null;
  if (!isSuperadmin) {
    const { data: estUsers } = await applyScope(admin.from("profiles").select("id"), ctx.scope);
    scopedUserIds = (estUsers || []).map((u) => u.id);
  }

  // Build queries with scope where applicable
  let surveysQ = admin
    .from("surveys")
    .select("*")
    .order("created_at", { ascending: false });
  if (!isSuperadmin) {
    // Admin sees: global surveys + surveys scoped to their establishments
    if (allowedEstIds.length === 0) {
      surveysQ = surveysQ.eq("scope_type", "global");
    } else {
      // allowedEstIds come from admin_establishments (server-controlled uuids, not user input)
      // nosemgrep: postgrest-or-template-literal
      surveysQ = surveysQ.or(
        `scope_type.eq.global,and(scope_type.eq.establishment,scope_id.in.(${allowedEstIds.join(",")}))`
      );
    }
  }

  // Main list: actual answered surveys only. Declines (status='not_taken',
  // "No realizada") are counted separately via declinedCountQ below so
  // they don't pollute NPS, charts or the recent-responses list.
  let responsesQ = admin
    .from("survey_responses")
    .select(
      "*, profiles!survey_responses_user_id_fkey(full_name, establishment_id, course_id, section_id)"
    )
    .eq("status", "completed")
    .order("created_at", { ascending: false });
  if (!isSuperadmin) {
    const ids = scopedUserIds && scopedUserIds.length > 0 ? scopedUserIds : [SAFE_EMPTY_ID];
    responsesQ = responsesQ.in("user_id", ids);
  }

  // Parallel count of "No realizada" rows scoped the same way. Rendered
  // in RetroClient's overview so admins can see declines as a distinct
  // bucket from pending/completed.
  let declinedCountQ = admin
    .from("survey_responses")
    .select("id", { count: "exact", head: true })
    .eq("status", "not_taken");
  if (!isSuperadmin) {
    const ids = scopedUserIds && scopedUserIds.length > 0 ? scopedUserIds : [SAFE_EMPTY_ID];
    declinedCountQ = declinedCountQ.in("user_id", ids);
  }

  let establishmentsQ = admin
    .from("establishments")
    .select("id, name, country")
    .order("name");
  if (!isSuperadmin) {
    const ids = allowedEstIds.length > 0 ? allowedEstIds : [SAFE_EMPTY_ID];
    establishmentsQ = establishmentsQ.in("id", ids);
  }

  let coursesQ = admin
    .from("courses")
    .select("id, name, establishment_id")
    .order("name");
  if (!isSuperadmin) {
    const ids = allowedEstIds.length > 0 ? allowedEstIds : [SAFE_EMPTY_ID];
    coursesQ = coursesQ.in("establishment_id", ids);
  }

  // Fetch in parallel
  const [
    { data: surveys },
    { data: responses },
    { data: establishments },
    { data: coursesRaw },
    { count: declinedCount },
  ] = await Promise.all([surveysQ, responsesQ, establishmentsQ, coursesQ, declinedCountQ]);

  // Acotar asignaturas/secciones al alcance del admin (no solo al establecimiento).
  const courseEstMap = new Map((coursesRaw || []).map((c) => [c.id, c.establishment_id]));
  const courses = isSuperadmin
    ? (coursesRaw || [])
    : (coursesRaw || []).filter((c) => scopeAllowsCourse(ctx.scope, c.establishment_id, c.id));
  const allowedCourseIds = courses.map((c) => c.id);
  let sectionsQ = admin
    .from("sections")
    .select("id, name, course_id")
    .order("name");
  if (!isSuperadmin) {
    const ids = allowedCourseIds.length > 0 ? allowedCourseIds : [SAFE_EMPTY_ID];
    sectionsQ = sectionsQ.in("course_id", ids);
  }
  const { data: sectionsRaw } = await sectionsQ;
  const sections = isSuperadmin
    ? (sectionsRaw || [])
    : (sectionsRaw || []).filter((s) => scopeAllowsSection(ctx.scope, courseEstMap.get(s.course_id), s.course_id, s.id));

  // Build NPS summary. Ignore null nps_score (newer JSONB surveys without
  // a 0-10 rating) so they don't pollute the NPS calculation.
  const allScores = (responses || [])
    .map((r) => r.nps_score as number | null)
    .filter((s): s is number => typeof s === "number");
  const promoters = allScores.filter((s) => s >= 9).length;
  const detractors = allScores.filter((s) => s <= 6).length;
  const nps =
    allScores.length > 0
      ? Math.round(((promoters - detractors) / allScores.length) * 100)
      : 0;

  // ── Supervisores: ciclo de retroalimentación docente (solo lectura) ──
  // Acotado por establecimiento con los mismos scopedUserIds (alumnos en
  // alcance). Superadmin: sin filtro. Se agrupa por approved_by (el supervisor
  // que cerró la retro). Lo pendiente es una bolsa institucional: no se
  // atribuye a un docente (los docentes ven todo el establecimiento).
  const scopeIds =
    scopedUserIds && scopedUserIds.length > 0 ? scopedUserIds : [SAFE_EMPTY_ID];

  let closedQ = admin
    .from("session_competencies")
    .select("conversation_id, student_id, approved_by, approved_at, overall_score")
    .in("feedback_status", ["approved", "evaluated"])
    .not("approved_by", "is", null)
    .order("approved_at", { ascending: false })
    .limit(1000);
  if (!isSuperadmin) closedQ = closedQ.in("student_id", scopeIds);

  let pendingQ = admin
    .from("session_competencies")
    .select("id", { count: "exact", head: true })
    .eq("feedback_status", "pending");
  if (!isSuperadmin) pendingQ = pendingQ.in("student_id", scopeIds);

  const [{ data: closedRows }, { count: pendingInstitution }] = await Promise.all([
    closedQ,
    pendingQ,
  ]);

  type ClosedRow = {
    conversation_id: string;
    student_id: string;
    approved_by: string;
    approved_at: string | null;
    overall_score: number | null;
  };
  const rows = (closedRows || []) as ClosedRow[];

  const approverIds = [...new Set(rows.map((r) => r.approved_by).filter(Boolean))];
  const closedStudentIds = [...new Set(rows.map((r) => r.student_id).filter(Boolean))];
  const convIds = [...new Set(rows.map((r) => r.conversation_id).filter(Boolean))];
  const peopleIds = [...new Set([...approverIds, ...closedStudentIds])];

  const [{ data: people }, { data: convs }, { data: fbs }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name")
      .in("id", peopleIds.length ? peopleIds : [SAFE_EMPTY_ID]),
    admin
      .from("conversations")
      .select("id, session_number, ended_at, created_at, ai_patients(name)")
      .in("id", convIds.length ? convIds : [SAFE_EMPTY_ID]),
    admin
      .from("session_feedback")
      .select("conversation_id, teacher_comment, teacher_score")
      .in("conversation_id", convIds.length ? convIds : [SAFE_EMPTY_ID]),
  ]);

  type ConvInfo = { sessionNumber: number | null; endedAt: string | null; patientName: string };
  type FbInfo = { comment: string | null; score: number | null };

  const nameById = new Map<string, string>(
    (people || []).map((p) => [p.id as string, (p.full_name as string) || "—"] as [string, string])
  );
  const convById = new Map<string, ConvInfo>(
    (convs || []).map((c) => {
      const ap = c.ai_patients as unknown;
      const patientName = Array.isArray(ap)
        ? ((ap[0] as { name?: string })?.name ?? "—")
        : ((ap as { name?: string })?.name ?? "—");
      return [
        c.id as string,
        {
          sessionNumber: (c.session_number as number | null) ?? null,
          endedAt: ((c.ended_at as string | null) || (c.created_at as string | null)) ?? null,
          patientName,
        },
      ] as [string, ConvInfo];
    })
  );
  const fbById = new Map<string, FbInfo>(
    (fbs || []).map((f) => [
      f.conversation_id as string,
      {
        comment: (f.teacher_comment as string | null) || null,
        score: (f.teacher_score as number | null) ?? null,
      },
    ] as [string, FbInfo])
  );

  type SupFeedback = {
    conversationId: string;
    studentName: string;
    patientName: string;
    sessionNumber: number | null;
    approvedAt: string | null;
    closeDays: number | null;
    teacherComment: string | null;
    teacherScore: number | null;
    overallScore: number | null;
  };
  const supMap = new Map<
    string,
    { id: string; name: string; feedbacks: SupFeedback[]; closeDaysList: number[] }
  >();
  for (const r of rows) {
    const conv = convById.get(r.conversation_id);
    const fb = fbById.get(r.conversation_id);
    const closeDaysRaw =
      r.approved_at && conv?.endedAt
        ? Math.max(
            0,
            (new Date(r.approved_at).getTime() - new Date(conv.endedAt).getTime()) / 86400000
          )
        : null;
    const entry =
      supMap.get(r.approved_by) || {
        id: r.approved_by,
        name: nameById.get(r.approved_by) || "—",
        feedbacks: [],
        closeDaysList: [],
      };
    entry.feedbacks.push({
      conversationId: r.conversation_id,
      studentName: nameById.get(r.student_id) || "—",
      patientName: conv?.patientName || "—",
      sessionNumber: conv?.sessionNumber ?? null,
      approvedAt: r.approved_at,
      closeDays: closeDaysRaw != null ? Math.round(closeDaysRaw * 10) / 10 : null,
      teacherComment: fb?.comment ?? null,
      teacherScore: fb?.score ?? null,
      overallScore: r.overall_score ?? null,
    });
    if (closeDaysRaw != null) entry.closeDaysList.push(closeDaysRaw);
    supMap.set(r.approved_by, entry);
  }

  const supervisores = {
    supervisors: [...supMap.values()]
      .map((s) => ({
        id: s.id,
        name: s.name,
        closedCount: s.feedbacks.length,
        avgCloseDays: s.closeDaysList.length
          ? Math.round((s.closeDaysList.reduce((a, b) => a + b, 0) / s.closeDaysList.length) * 10) / 10
          : null,
        feedbacks: s.feedbacks,
      }))
      .sort((a, b) => b.closedCount - a.closedCount),
    totalClosed: rows.length,
    pendingInstitution: pendingInstitution || 0,
  };

  return (
    <RetroClient
      supervisores={supervisores}
      surveys={surveys || []}
      responses={(responses || []).map((r) => ({
        ...r,
        userName:
          (r.profiles as unknown as { full_name: string })?.full_name || "—",
        establishmentId: (r.profiles as unknown as { establishment_id: string })
          ?.establishment_id,
        courseId: (r.profiles as unknown as { course_id: string })?.course_id,
        sectionId: (r.profiles as unknown as { section_id: string })?.section_id,
      }))}
      establishments={establishments || []}
      courses={courses || []}
      sections={sections || []}
      nps={nps}
      totalResponses={(responses || []).length}
      declinedCount={declinedCount || 0}
      isSuperadmin={isSuperadmin}
    />
  );
}
