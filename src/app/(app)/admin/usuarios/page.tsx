import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminContext } from "@/lib/admin-helpers";
import { applyScope, scopeAllowsCourse, scopeAllowsSection } from "@/lib/admin-scope";
import { ACCESS_FILTERS, accessBlock, pilotWindowBlock, type AccessBlock, type AccessFilter, type PilotWindow } from "@/lib/access-status";
import UsuariosClient from "./UsuariosClient";

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; per_page?: string; q?: string; role?: string; est?: string; course?: string; section?: string; estado?: string }>;
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
  const estadoFilter: AccessFilter | "" = ACCESS_FILTERS.includes(params.estado as AccessFilter)
    ? (params.estado as AccessFilter)
    : "";

  const ctx = await getAdminContext();
  const supabase = await createClient();
  const adminClient = createAdminClient();

  // ─── Estado de acceso: quién NO puede entrar y por qué ───────────────────
  // Tres motivos (ver src/lib/access-status.ts): cuenta desactivada, ventana de
  // piloto cerrada y clave temporal sin cambiar. El de piloto no vive en
  // `profiles`: hay que cruzar pilot_participants con las fechas del piloto.
  const now = Date.now();
  const { data: allPilots } = await adminClient
    .from("pilots")
    .select("id, name, status, scheduled_at, ended_at");
  const pilotById = new Map<string, PilotWindow>(
    (allPilots || []).map((p) => [p.id as string, p as PilotWindow]),
  );

  // Con filtro de estado activo hay que resolver el bloqueo de TODOS antes de
  // paginar (si no, la paginación y el total mentirían). Sin filtro, basta con
  // los usuarios de la página, que se resuelven más abajo.
  let estadoIds: string[] | null = null;
  let participationAll: Map<string, string> | null = null;
  if (estadoFilter) {
    const { data: parts } = await adminClient.from("pilot_participants").select("user_id, pilot_id");
    participationAll = new Map((parts || []).map((r) => [r.user_id as string, r.pilot_id as string]));

    // PostgREST corta en 1000 filas por respuesta (max-rows del servidor), así
    // que se pagina hasta agotar: con un solo tramo el filtro ignoraría a los
    // usuarios del final de la tabla.
    type MiniProfile = { id: string; role: string; is_disabled: boolean | null; must_change_password: boolean | null };
    const everyone: MiniProfile[] = [];
    const CHUNK = 1000;
    for (let offset = 0; ; offset += CHUNK) {
      const { data: chunk } = await applyScope(
        adminClient
          .from("profiles")
          .select("id, role, is_disabled, must_change_password")
          .order("id")
          .range(offset, offset + CHUNK - 1),
        ctx.scope,
      );
      if (!chunk || chunk.length === 0) break;
      everyone.push(...(chunk as MiniProfile[]));
      if (chunk.length < CHUNK) break;
    }
    const wanted = (b: AccessBlock) =>
      estadoFilter === "bloqueado"
        ? b.kind !== "none"
        : estadoFilter === "desactivado"
          ? b.kind === "disabled"
          : estadoFilter === "piloto"
            ? b.kind === "pilot"
            : b.kind === "temp_password";
    estadoIds = everyone
      .filter((p) => {
        const pilotId = participationAll!.get(p.id);
        return wanted(accessBlock(p, pilotId ? pilotById.get(pilotId) || null : null, now));
      })
      .map((p) => p.id as string);
    if (estadoIds.length === 0) estadoIds = ["00000000-0000-0000-0000-000000000000"];
  }

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
  if (estadoIds) countQuery = countQuery.in("id", estadoIds);
  // nosemgrep: postgrest-or-template-literal -- searchQuery sanitized above
  if (searchQuery) countQuery = countQuery.or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`);
  const { count: totalCount } = await countQuery;

  // Fetch paginated users scoped by establishment + filters
  const from = (currentPage - 1) * perPage;
  const to = from + perPage - 1;

  let usersQuery = supabase
    .from("profiles")
    .select("id, email, full_name, role, establishment_id, course_id, section_id, is_disabled, must_change_password, created_at, credentials_sent_at")
    .order("full_name")
    .range(from, to);
  usersQuery = applyScope(usersQuery, ctx.scope);
  if (roleFilter) usersQuery = usersQuery.eq("role", roleFilter);
  if (estFilter) usersQuery = usersQuery.eq("establishment_id", estFilter);
  if (courseFilter) usersQuery = usersQuery.eq("course_id", courseFilter);
  if (sectionFilter) usersQuery = usersQuery.eq("section_id", sectionFilter);
  if (estadoIds) usersQuery = usersQuery.in("id", estadoIds);
  // nosemgrep: postgrest-or-template-literal -- searchQuery sanitized above
  if (searchQuery) usersQuery = usersQuery.or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`);

  const { data: users } = await usersQuery;

  // Bloqueo de acceso de los usuarios de ESTA página. Si el filtro de estado ya
  // trajo la participación completa, se reutiliza; si no, se consulta acotado.
  const pageIds = (users || []).map((u) => u.id as string);
  let pilotByUser = participationAll;
  if (!pilotByUser) {
    const { data: parts } = await adminClient
      .from("pilot_participants")
      .select("user_id, pilot_id")
      .in("user_id", pageIds.length ? pageIds : ["00000000-0000-0000-0000-000000000000"]);
    pilotByUser = new Map((parts || []).map((r) => [r.user_id as string, r.pilot_id as string]));
  }
  const blockByUser = new Map<string, AccessBlock>(
    (users || []).map((u) => {
      const pilotId = pilotByUser!.get(u.id as string);
      return [
        u.id as string,
        accessBlock(u as { role: string; is_disabled: boolean; must_change_password: boolean }, pilotId ? pilotById.get(pilotId) || null : null, now),
      ];
    }),
  );

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

  // Para un ADMIN, asignatura/sección representan su ALCANCE: NULL = "Todas" si
  // tiene fila en admin_establishments, o "Sin asignar" si no la tiene (no ve
  // nada). Para alumnos/docentes se mantiene "—" cuando no hay asignación.
  const { data: aeRows } = await adminClient.from("admin_establishments").select("admin_id");
  const assignedAdminIds = new Set((aeRows || []).map((r) => r.admin_id));
  const scopeLabel = (u: { id: string; role: string }, id: string | null, map: Map<string, string>) =>
    u.role !== "admin"
      ? (id ? map.get(id) || "—" : "—")
      : !assignedAdminIds.has(u.id)
        ? "Sin asignar"
        : (id ? map.get(id) || "—" : "Todas");

  const enrichedUsers = (users || []).map((u) => ({
    ...u,
    sessionCount: sessionCountMap[u.id] || 0,
    lastActivity: lastActivityMap[u.id] || null,
    establishmentName: establishments?.find((e) => e.id === u.establishment_id)?.name || "—",
    courseName: scopeLabel(u, u.course_id, courseMap),
    sectionName: scopeLabel(u, u.section_id, sectionMap),
    accessBlock: blockByUser.get(u.id) || ({ kind: "none" } as AccessBlock),
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
      initialEstado={estadoFilter}
    />
  );
}
