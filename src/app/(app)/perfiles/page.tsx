import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import PatientTable from "./PatientTable";

export default async function PerfilesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Only admin/superadmin/instructor can access
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role;
  if (role !== "instructor" && role !== "admin" && role !== "superadmin") {
    redirect("/dashboard");
  }

  const canEdit = role === "admin" || role === "superadmin";

  const admin = createAdminClient();
  const { data: patients } = await admin
    .from("ai_patients")
    .select("id, name, age, occupation, quote, presenting_problem, difficulty_level, country, country_origin, country_residence, is_active, created_at, updated_at")
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Perfiles de pacientes</h1>
            <p className="text-gray-500 mt-1">Gestiona y crea pacientes IA para el simulador</p>
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <Link
                href="/perfiles/masivo"
                className="flex items-center gap-2 border border-[#4A55A2] text-[#4A55A2] px-4 py-2.5 rounded-lg hover:bg-[#4A55A2]/5 transition-colors font-medium text-sm"
              >
                Generación masiva
              </Link>
              <Link
                href="/perfiles/nuevo"
                className="flex items-center gap-2 bg-[#4A55A2] text-white px-4 py-2.5 rounded-lg hover:bg-[#3D4890] transition-colors font-medium text-sm"
              >
                <Plus size={18} />
                Crear paciente
              </Link>
            </div>
          )}
        </div>

        <PatientTable patients={patients || []} canEdit={canEdit} />
      </div>
    </div>
  );
}
