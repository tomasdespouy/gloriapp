import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminContext } from "@/lib/admin-helpers";
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
    if (allowedEstIds.length === 0) {
      // Admin without assigned establishments: empty scope
      scopedUserIds = [];
    } else {
      const { data: estUsers } = await admin
        .from("profiles")
        .select("id")
        .in("establishment_id", allowedEstIds);
      scopedUserIds = (estUsers || []).map((u) => u.id);
    }
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
      surveysQ = surveysQ.or(
        `scope_type.eq.global,and(scope_type.eq.establishment,scope_id.in.(${allowedEstIds.join(",")}))`
      );
    }
  }

  let responsesQ = admin
    .from("survey_responses")
    .select(
      "*, profiles!survey_responses_user_id_fkey(full_name, establishment_id, course_id, section_id)"
    )
    .order("created_at", { ascending: false });
  if (!isSuperadmin) {
    const ids = scopedUserIds && scopedUserIds.length > 0 ? scopedUserIds : [SAFE_EMPTY_ID];
    responsesQ = responsesQ.in("user_id", ids);
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
    { data: courses },
  ] = await Promise.all([surveysQ, responsesQ, establishmentsQ, coursesQ]);

  // Sections: filter by the resolved courses (depends on courses query result)
  const allowedCourseIds = (courses || []).map((c) => c.id);
  let sectionsQ = admin
    .from("sections")
    .select("id, name, course_id")
    .order("name");
  if (!isSuperadmin) {
    const ids = allowedCourseIds.length > 0 ? allowedCourseIds : [SAFE_EMPTY_ID];
    sectionsQ = sectionsQ.in("course_id", ids);
  }
  const { data: sections } = await sectionsQ;

  // Build NPS summary
  const allScores = (responses || []).map((r) => r.nps_score as number);
  const promoters = allScores.filter((s) => s >= 9).length;
  const detractors = allScores.filter((s) => s <= 6).length;
  const nps =
    allScores.length > 0
      ? Math.round(((promoters - detractors) / allScores.length) * 100)
      : 0;

  return (
    <RetroClient
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
      totalResponses={allScores.length}
      isSuperadmin={isSuperadmin}
    />
  );
}
