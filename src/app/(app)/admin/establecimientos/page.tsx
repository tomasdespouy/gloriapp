import { createClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/admin-helpers";
import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import InstitutionList from "./InstitutionList";

export default async function EstablecimientosPage() {
  const ctx = await getAdminContext();
  const supabase = await createClient();

  const { data: establishments } = ctx.isSuperadmin
    ? await supabase.from("establishments").select("*").order("name")
    : await supabase
        .from("establishments")
        .select("*")
        .in("id", ctx.establishmentIds.length > 0 ? ctx.establishmentIds : ["00000000-0000-0000-0000-000000000000"])
        .order("name");

  // Get all profiles for metrics
  const estIds = establishments?.map((e) => e.id) || [];
  const safeEstIds = estIds.length > 0 ? estIds : ["00000000-0000-0000-0000-000000000000"];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, role, establishment_id")
    .in("establishment_id", safeEstIds);

  // Build metrics
  const estMetrics = (establishments || []).map((est) => {
    const estProfiles = profiles?.filter((p) => p.establishment_id === est.id) || [];
    return {
      id: est.id,
      name: est.name,
      slug: est.slug,
      country: est.country || "—",
      logo_url: est.logo_url,
      website_url: est.website_url,
      contact_name: est.contact_name || "—",
      contact_email: est.contact_email || "—",
      is_active: est.is_active,
      totalUsers: estProfiles.length,
      students: estProfiles.filter((p) => p.role === "student").length,
      instructors: estProfiles.filter((p) => p.role === "instructor").length,
      admins: estProfiles.filter((p) => p.role === "admin").length,
    };
  });

  return (
    <div className="min-h-screen">
      <header className="flex justify-between items-center px-8 py-5">
        <div className="flex items-center gap-3">
          <Building2 size={24} className="text-gray-400" />
          <h1 className="text-2xl font-bold text-gray-900">Instituciones</h1>
        </div>
        {ctx.isSuperadmin && (
          <Link
            href="/admin/establecimientos/nuevo"
            className="flex items-center gap-2 bg-sidebar text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-sidebar-hover transition-colors"
          >
            <Plus size={16} />
            Nueva institución
          </Link>
        )}
      </header>

      <div className="px-8 pb-8">
        <InstitutionList institutions={estMetrics} isSuperadmin={ctx.isSuperadmin} />
      </div>
    </div>
  );
}
