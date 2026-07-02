import { createClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/admin-helpers";
import { applyScope, scopeAllowsCourse, scopeAllowsSection } from "@/lib/admin-scope";
import UsuariosClient from "./UsuariosClient";

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; per_page?: string; q?: string; role?: string; est?: string; course?: string; section?: string }>;
}) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page || "1", 10));
  const perPage = Math.max(1, Math.min(200, parseInt(params.per_page || "50", 10)));
  // Strip PostgREST .or() metacharacters (commas/parentheses) and length-cap
  // before interpolating into the filter expression.
  const searchQuery = (params.q || "").trim().slice(0, 100).replace(/[,()]/g, " ");
  const roleFilter = params.role || "";
  const rawEstFilter = params.est || "";
  const courseFilter = params.course || "";
  const sectionFilter = params.section || "";

  const ctx = await getAdminContext();
  const supabase = await createClient();

  // Reject URL-tampered est filters that fall outside the caller's scope.
  // Superadmin can filter by any establishment; admin can only filter within
  // their own assigned establishments.
  const estFilter =
    rawEstFilter && (ctx.isSuperadmin || ctx.establishmentIds.includes(rawEstFilter))
      ? rawEstFilter
      : "";

  // Get total count with filters. El alcance del admin (establecimiento +
  // asignatura/sección) se aplica con applyScope; superadmin no se filtra.
  let countQuery = supabase
    .from("profiles")
    .select("id", { count: "exact", head: true });
  countQuery = applyScope(countQuery, ctx.scope);
  if (roleFilter) countQuery = countQuery.eq("role", roleFilter);
  if (estFilter) countQuery = countQuery.eq("establishment_id", estFilter);
  if (courseFilter) countQuery = countQuery.eq("course_id", courseFilter);
  if (sectionFilter) countQuery = countQuery.eq("section_id", sectionFilter);
  // nosemgrep: postgrest-or-template-literal -- searchQuery sanitized above
  if (searchQuery) countQuery = countQuery.or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`);
  const { count: totalCount } = await countQuery;

  // Fetch paginated users scoped by establishment + filters
  const from = (currentPage - 1) * perPage;
  const to = from + perPage - 1;

  let usersQuery = supabase
    .from("profiles")
    .select("id, email, full_name, role, establishment_id, course_id, section_id, is_disabled, created_at, credentials_sent_at")
    .order("full_name")
    .range(from, to);
  usersQuery = applyScope(usersQuery, ctx.scope);
  if (roleFilter) usersQuery = usersQuery.eq("role", roleFilter);
  if (estFilter) usersQuery = usersQuery.eq("establishment_id", estFilter);
  if (courseFilter) usersQuery = usersQuery.eq("course_id", courseFilter);
  if (sectionFilter) usersQuery = usersQuery.eq("section_id", sectionFilter);
  // nosemgrep: postgrest-or-template-literal -- searchQuery sanitized above
  if (searchQuery) usersQuery = usersQuery.or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`);

  const { data: users } = await usersQuery;

  // Fetch establishments for filter dropdown
  const { data: establishments } = ctx.isSuperadmin
    ? await supabase.from("establishments").select("id, name").order("name")
    : await supabase
        .from("establishments")
        .select("id, name")
        .in("id", ctx.establishmentIds.length > 0 ? ctx.establishmentIds : ["00000000-0000-0000-0000-000000000000"])
        .order("name");

  // Cursos y secciones (nombres + selectores del form + dropdowns de filtro),
  // ACOTADOS al alcance del admin para no exponer asignaturas/secciones ajenas.
  const estScope = ctx.scope.all
    ? null
    : ctx.establishmentIds.length
      ? ctx.establishmentIds
      : ["00000000-0000-0000-0000-000000000000"];
  let coursesQ = supabase.from("courses").select("id, name, establishment_id, is_active");
  if (estScope) coursesQ = coursesQ.in("establishment_id", estScope);
  const { data: allCoursesRaw } = await coursesQ;
  const courseEstMap = new Map((allCoursesRaw || []).map((c) => [c.id, c.establishment_id]));
  let sectionsQ = supabase.from("sections").select("id, name, course_id, is_active");
  if (estScope) {
    const cids = (allCoursesRaw || []).map((c) => c.id);
    sectionsQ = sectionsQ.in("course_id", cids.length ? cids : ["00000000-0000-0000-0000-000000000000"]);
  }
  const { data: allSectionsRaw } = await sectionsQ;

  const allCourses = (allCoursesRaw || []).filter((c) => scopeAllowsCourse(ctx.scope, c.establishment_id, c.id));
  const allSections = (allSectionsRaw || []).filter((s) => scopeAllowsSection(ctx.scope, courseEstMap.get(s.course_id), s.course_id, s.id));
  const courseMap = new Map(allCourses.map((c) => [c.id, c.name]));
  const sectionMap = new Map(allSections.map((s) => [s.id, s.name]));

  // Session counts per student
  const studentIds = users?.filter((u) => u.role === "student").map((u) => u.id) || [];
  const safeIds = studentIds.length > 0 ? studentIds : ["00000000-0000-0000-0000-000000000000"];

  const { data: sessions } = await supabase
    .from("conversations")
    .select("student_id, created_at")
    .eq("status", "completed")
    .in("student_id", safeIds);

  const sessionCountMap: Record<string, number> = {};
  const lastActivityMap: Record<string, string> = {};
  sessions?.forEach((s) => {
    sessionCountMap[s.student_id] = (sessionCountMap[s.student_id] || 0) + 1;
    if (!lastActivityMap[s.student_id] || s.created_at > lastActivityMap[s.student_id]) {
      lastActivityMap[s.student_id] = s.created_at;
    }
  });

  const enrichedUsers = (users || []).map((u) => ({
    ...u,
    sessionCount: sessionCountMap[u.id] || 0,
    lastActivity: lastActivityMap[u.id] || null,
    establishmentName: establishments?.find((e) => e.id === u.establishment_id)?.name || "—",
    courseName: u.course_id ? courseMap.get(u.course_id) || "—" : "—",
    sectionName: u.section_id ? sectionMap.get(u.section_id) || "—" : "—",
  }));

  return (
    <UsuariosClient
      users={enrichedUsers}
      establishments={establishments || []}
      courses={allCourses || []}
      sections={allSections || []}
      isSuperadmin={ctx.isSuperadmin}
      totalCount={totalCount || 0}
      currentPage={currentPage}
      perPage={perPage}
      initialSearch={searchQuery}
      initialRole={roleFilter}
      initialEst={estFilter}
      initialCourse={courseFilter}
      initialSection={sectionFilter}
    />
  );
}
