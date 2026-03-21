import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import PacientesClient from "./PacientesClient";

export default async function PacientesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Get student's country via their establishment
  const { data: profile } = await supabase
    .from("profiles")
    .select("establishment_id")
    .eq("id", user.id)
    .single();

  let studentCountry: string | null = null;
  const establishmentId = profile?.establishment_id || null;

  // Use admin client for all establishment-related queries (RLS blocks students)
  const admin = createAdminClient();

  if (establishmentId) {
    const { data: establishment } = await admin
      .from("establishments")
      .select("country")
      .eq("id", establishmentId)
      .single();
    studentCountry = establishment?.country || null;
  }

  // Fetch patients visible to this student:
  // 1. By establishment country (ai_patients.country contains the establishment country)
  // 2. By explicit assignment (establishment_patients table)
  // 3. If no establishment, show all active patients
  type PatientRow = { id: string; name: string; age: number; occupation: string | null; quote: string; difficulty_level: string; tags: string[] | null; country: string[] | null; voice_id: string | null };
  let patients: PatientRow[] = [];

  if (establishmentId) {
    // Query both sources in parallel (admin bypasses RLS)
    const [byCountryResult, byAssignmentResult] = await Promise.all([
      studentCountry
        ? admin
            .from("ai_patients")
            .select("id, name, age, occupation, quote, difficulty_level, tags, country, voice_id")
            .eq("is_active", true)
            .contains("country", [studentCountry])
        : Promise.resolve({ data: [] as typeof patients }),
      admin
        .from("establishment_patients")
        .select("ai_patient_id")
        .eq("establishment_id", establishmentId),
    ]);

    const byCountry = byCountryResult.data || [];
    const assignedIds = (byAssignmentResult.data || []).map((r) => r.ai_patient_id);

    // If there are explicit assignments, fetch those patients too
    if (assignedIds.length > 0) {
      const { data: byAssignment } = await admin
        .from("ai_patients")
        .select("id, name, age, occupation, quote, difficulty_level, tags, country, voice_id")
        .eq("is_active", true)
        .in("id", assignedIds);

      // Merge and deduplicate
      const seen = new Set<string>();
      patients = [...byCountry, ...(byAssignment || [])].filter((p) => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });
    } else {
      patients = byCountry;
    }
  } else {
    // No establishment — show all active patients
    const { data } = await admin
      .from("ai_patients")
      .select("id, name, age, occupation, quote, difficulty_level, tags, country, voice_id")
      .eq("is_active", true);
    patients = data || [];
  }

  // Fetch active or abandoned conversations for this student (both can be resumed)
  const { data: activeConversations } = await supabase
    .from("conversations")
    .select("id, ai_patient_id")
    .eq("student_id", user.id)
    .in("status", ["active", "abandoned"]);

  // Build map as plain object (serializable)
  const activeSessionMap: Record<string, string> = {};
  if (activeConversations) {
    for (const conv of activeConversations) {
      activeSessionMap[conv.ai_patient_id] = conv.id;
    }
  }

  return (
    <div className="min-h-screen">
      <header className="px-4 sm:px-8 py-4 sm:py-5">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Pacientes</h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
          Elige un paciente para iniciar una sesión de práctica terapéutica
        </p>
      </header>

      <div className="px-4 sm:px-8 pb-8">
        <PacientesClient
          patients={patients || []}
          activeSessionMap={activeSessionMap}
        />
      </div>
    </div>
  );
}
