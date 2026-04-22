import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/supabase/user-profile";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import PatientTable from "./PatientTable";

const SAFE_EMPTY_ID = "00000000-0000-0000-0000-000000000000";

export default async function PerfilesPage() {
  const profile = await getUserProfile();
  if (!profile) redirect("/login");

  // Authorization uses the real DB role; effective role drives UI/scoping so
  // that a superadmin impersonating admin/instructor sees what that role would.
  if (
    profile.realRole !== "instructor" &&
    profile.realRole !== "admin" &&
    profile.realRole !== "superadmin"
  ) {
    redirect("/dashboard");
  }

  const role = profile.role;
  if (role !== "instructor" && role !== "admin" && role !== "superadmin") {
    redirect("/dashboard");
  }

  // Only effective superadmin can create/edit patients. If impersonating admin,
  // this is false even though the real user is superadmin.
  const canEdit = role === "superadmin";

  const supabase = await createClient();
  const admin = createAdminClient();

  // Resolve which patients this user can see:
  //  - superadmin: all
  //  - admin: only patients assigned to their scope via establishment_patients
  //  - instructor: the patients of their establishment
  let visiblePatientIds: string[] | null = null; // null = all (superadmin)
  if (role === "admin") {
    let estIds: string[];
    if (profile.isImpersonating && profile.establishmentId) {
      // Scope mirrors the impersonation cookie's single establishment.
      estIds = [profile.establishmentId];
    } else {
      const { data: assignments } = await supabase
        .from("admin_establishments")
        .select("establishment_id")
        .eq("admin_id", profile.id);
      estIds = (assignments || []).map((a) => a.establishment_id);
    }
    if (estIds.length === 0) {
      visiblePatientIds = [];
    } else {
      const { data: ep } = await admin
        .from("establishment_patients")
        .select("ai_patient_id")
        .in("establishment_id", estIds);
      visiblePatientIds = (ep || []).map((r) => r.ai_patient_id);
    }
  } else if (role === "instructor") {
    // profile.establishmentId already honors the impersonation cookie override.
    if (!profile.establishmentId) {
      visiblePatientIds = [];
    } else {
      const { data: ep } = await admin
        .from("establishment_patients")
        .select("ai_patient_id")
        .eq("establishment_id", profile.establishmentId);
      visiblePatientIds = (ep || []).map((r) => r.ai_patient_id);
    }
  }

  let patientsQ = admin
    .from("ai_patients")
    .select(
      "id, name, age, occupation, quote, presenting_problem, difficulty_level, country, country_origin, country_residence, is_active, created_at, updated_at"
    )
    .order("created_at", { ascending: false });
  if (visiblePatientIds !== null) {
    patientsQ = patientsQ.in(
      "id",
      visiblePatientIds.length > 0 ? visiblePatientIds : [SAFE_EMPTY_ID]
    );
  }
  const { data: patients } = await patientsQ;

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
