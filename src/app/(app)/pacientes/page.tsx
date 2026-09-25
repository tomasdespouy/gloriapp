import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import PacientesClient, { type PatientLockInfo } from "./PacientesClient";
import { getCertificationPolicy, getStudentLastSessionEnd, computeLockState } from "@/lib/certification";

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

  // Programa de certificación: candado por agenda. Para el resto de las
  // cuentas (la inmensa mayoría), certPolicy.isCertificationProgram es false
  // y lockMap queda undefined — PacientesClient se comporta exactamente igual
  // que antes.
  let lockMap: Record<string, PatientLockInfo> | undefined;
  let minHoursBetweenSessions = 72;
  const certPolicy = await getCertificationPolicy(user.id);
  if (certPolicy.isCertificationProgram) {
    // Lista explícita por asignatura, no hereda la visibilidad por país del
    // establecimiento: sin filas en course_patients, no hay pacientes (opt-in
    // deliberado — ver migración course_patients).
    const { data: rosterRows } = await admin
      .from("course_patients")
      .select("ai_patient_id")
      .eq("course_id", certPolicy.courseId);
    const rosterIds = (rosterRows || []).map((r) => r.ai_patient_id);
    if (rosterIds.length > 0) {
      const { data: rosterPatients } = await admin
        .from("ai_patients")
        .select("id, name, age, occupation, quote, difficulty_level, tags, country, voice_id")
        .eq("is_active", true)
        .in("id", rosterIds);
      patients = rosterPatients || [];
    } else {
      patients = [];
    }

    minHoursBetweenSessions = certPolicy.minHoursBetweenSessions;
    const [{ data: schedules }, lastSessionEndedAt] = await Promise.all([
      admin
        .from("patient_schedules")
        .select("ai_patient_id, scheduled_at, status")
        .eq("student_id", user.id),
      getStudentLastSessionEnd(user.id),
    ]);
    const scheduleByPatient = new Map((schedules || []).map((s) => [s.ai_patient_id, s]));
    lockMap = {};
    for (const patient of patients) {
      const schedule = scheduleByPatient.get(patient.id) ?? null;
      const lock = computeLockState({
        schedule: schedule ? { scheduled_at: schedule.scheduled_at, status: schedule.status } : null,
        lastSessionEndedAt,
        minHours: certPolicy.minHoursBetweenSessions,
      });
      lockMap[patient.id] = {
        locked: lock.locked,
        reason: lock.reason,
        unlocksAt: lock.unlocksAt,
        scheduledAt: schedule?.scheduled_at ?? null,
      };
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
          lockMap={lockMap}
          minHoursBetweenSessions={minHoursBetweenSessions}
        />
      </div>
    </div>
  );
}
