import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminContext } from "@/lib/admin-helpers";
import { applyScope, scopeAllowsCourse, scopeAllowsEstablishmentWide, scopeAllowsSectionCreation, scopeAllowsSection } from "@/lib/admin-scope";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Building2 } from "lucide-react";
import InstitutionTabs from "./InstitutionTabs";

export default async function EstablishmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getAdminContext();
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: establishment } = await supabase
    .from("establishments").select("*").eq("id", id).single();

  if (!establishment) redirect("/admin/establecimientos");
  if (!ctx.isSuperadmin && !ctx.establishmentIds.includes(id)) redirect("/admin/establecimientos");

  // Fetch all data in parallel
  const [
    { data: assignments },
    { data: allAdminUsers },
    { data: courses },
    { data: sections },
    { data: profiles },
    { data: assignedPatientRows },
    { data: allPatients },
    { data: moduleRows },
  ] = await Promise.all([
    admin.from("admin_establishments").select("admin_id, course_id, section_id").eq("establishment_id", id),
    admin.from("profiles").select("id, full_name, email").eq("role", "admin"),
    admin.from("courses").select("*").eq("establishment_id", id).order("name"),
    admin.from("sections").select("*").order("name"),
    // Docentes/alumnos acotados al alcance del que mira: un admin de una
    // asignatura no ve el listado completo del establecimiento (mismo criterio
    // que /admin/usuarios). Superadmin → applyScope no toca la query.
    applyScope(
      admin.from("profiles").select("id, full_name, email, role, course_id, section_id")
        .eq("establishment_id", id).order("full_name"),
      ctx.scope,
    ),
    admin.from("establishment_patients").select("ai_patient_id").eq("establishment_id", id),
    admin.from("ai_patients").select("id, name, age, occupation, difficulty_level, country, is_active, tags, country_origin, country_residence").order("name"),
    admin.from("establishment_modules").select("module_key, is_active").eq("establishment_id", id),
  ]);

  const courseIds = (courses || []).map((c) => c.id as string);
  const { data: coursePatientRows } = courseIds.length
    ? await admin.from("course_patients").select("course_id, ai_patient_id").in("course_id", courseIds)
    : { data: [] as { course_id: string; ai_patient_id: string }[] };

  const assignedAdminIds = new Set(assignments?.map((a) => a.admin_id) || []);
  // Scope (asignatura/sección) de cada admin asignado, para mostrarlo/editarlo.
  const scopeByAdmin = new Map<string, { course_id: string | null; section_id: string | null }>();
  (assignments || []).forEach((a) => scopeByAdmin.set(a.admin_id, { course_id: a.course_id ?? null, section_id: a.section_id ?? null }));
  const assignedAdmins = (allAdminUsers || [])
    .filter((a) => assignedAdminIds.has(a.id))
    .map((a) => ({ ...a, ...(scopeByAdmin.get(a.id) || { course_id: null, section_id: null }) }));
  const availableAdmins = (allAdminUsers || []).filter((a) => !assignedAdminIds.has(a.id));

  // Un admin acotado a una asignatura/sección solo ve esa parte del catálogo.
  const visibleCourses = (courses || []).filter((c) => scopeAllowsCourse(ctx.scope, id, c.id));

  // Permisos de creación de estructura académica dentro de esta institución.
  const canCreateCourse = scopeAllowsEstablishmentWide(ctx.scope, id);
  const sectionEditableCourseIds = visibleCourses
    .filter((c) => scopeAllowsSectionCreation(ctx.scope, id, c.id))
    .map((c) => c.id as string);

  // Map sections to their courses
  type SectionRow = { id: string; name: string; course_id: string; is_active: boolean };
  const courseSections: Record<string, SectionRow[]> = {};
  visibleCourses.forEach((c) => { courseSections[c.id] = []; });
  (sections || []).forEach((s) => {
    if (courseSections[s.course_id]) courseSections[s.course_id].push(s as SectionRow);
  });

  // Renombrar una sección exige un alcance más fino que verla: un admin
  // acotado a UNA sección ve (dentro de su asignatura visible) también a sus
  // hermanas, pero no puede tocarlas — mismo criterio que ya rige para crear
  // una sección hermana desde ese alcance.
  const sectionRenameableIds = Object.values(courseSections)
    .flat()
    .filter((s) => scopeAllowsSection(ctx.scope, id, s.course_id, s.id))
    .map((s) => s.id);

  const instructors = (profiles || []).filter((p) => p.role === "instructor");
  const students = (profiles || []).filter((p) => p.role === "student");

  const assignedPatientIds = new Set((assignedPatientRows || []).map((r) => r.ai_patient_id));
  const estCountry = establishment.country || null;

  // Pacientes habilitados por asignatura (programa de certificación) — ver
  // comentario de semántica en la migración course_patients.
  const coursePatientIds: Record<string, string[]> = {};
  (courses || []).forEach((c) => { coursePatientIds[c.id as string] = []; });
  (coursePatientRows || []).forEach((r) => {
    if (coursePatientIds[r.course_id]) coursePatientIds[r.course_id].push(r.ai_patient_id);
  });

  return (
    <div className="min-h-screen">
      <header className="px-4 sm:px-8 py-5">
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
          <Link href="/admin/establecimientos" className="hover:text-sidebar transition-colors">
            Instituciones
          </Link>
          <span>/</span>
          <span className="text-gray-700">{establishment.name}</span>
        </div>
        <div className="flex items-center gap-3">
          {establishment.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={establishment.logo_url} alt="" className="w-8 h-8 rounded-lg object-contain bg-gray-50" />
          ) : (
            <Building2 size={24} className="text-gray-400" />
          )}
          <h1 className="text-2xl font-bold text-gray-900">{establishment.name}</h1>
          <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
            establishment.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
          }`}>
            {establishment.is_active ? "Activa" : "Inactiva"}
          </span>
        </div>
      </header>

      <div className="px-4 sm:px-8 pb-8">
        <InstitutionTabs
          establishment={establishment}
          assignedAdmins={assignedAdmins}
          availableAdmins={availableAdmins}
          courses={visibleCourses}
          courseSections={courseSections}
          canCreateCourse={canCreateCourse}
          sectionEditableCourseIds={sectionEditableCourseIds}
          sectionRenameableIds={sectionRenameableIds}
          instructors={instructors}
          students={students}
          isSuperadmin={ctx.isSuperadmin}
          allPatients={allPatients || []}
          assignedPatientIds={Array.from(assignedPatientIds)}
          coursePatientIds={coursePatientIds}
          estCountry={estCountry}
          modules={(moduleRows || []) as { module_key: string; is_active: boolean }[]}
        />
      </div>
    </div>
  );
}
