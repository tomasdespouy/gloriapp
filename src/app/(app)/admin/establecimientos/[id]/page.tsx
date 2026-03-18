import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminContext } from "@/lib/admin-helpers";
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
  ] = await Promise.all([
    admin.from("admin_establishments").select("admin_id").eq("establishment_id", id),
    admin.from("profiles").select("id, full_name, email").eq("role", "admin"),
    admin.from("courses").select("*").eq("establishment_id", id).order("name"),
    admin.from("sections").select("*").order("name"),
    admin.from("profiles").select("id, full_name, email, role, course_id, section_id")
      .eq("establishment_id", id).order("full_name"),
  ]);

  const assignedAdminIds = new Set(assignments?.map((a) => a.admin_id) || []);
  const assignedAdmins = (allAdminUsers || []).filter((a) => assignedAdminIds.has(a.id));
  const availableAdmins = (allAdminUsers || []).filter((a) => !assignedAdminIds.has(a.id));

  // Map sections to their courses
  type SectionRow = { id: string; name: string; course_id: string; is_active: boolean };
  const courseSections: Record<string, SectionRow[]> = {};
  (courses || []).forEach((c) => { courseSections[c.id] = []; });
  (sections || []).forEach((s) => {
    if (courseSections[s.course_id]) courseSections[s.course_id].push(s as SectionRow);
  });

  const instructors = (profiles || []).filter((p) => p.role === "instructor");
  const students = (profiles || []).filter((p) => p.role === "student");

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
          courses={courses || []}
          courseSections={courseSections}
          instructors={instructors}
          students={students}
          isSuperadmin={ctx.isSuperadmin}
        />
      </div>
    </div>
  );
}
