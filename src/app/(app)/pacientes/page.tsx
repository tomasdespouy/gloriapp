import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import PacientesClient, { type PatientLockInfo } from "./PacientesClient";
import { getCertificationPolicy, getStudentLastSessionEnd, computeLockState } from "@/lib/certification";
import { getAuthorizedVoicePilotPatientIds } from "@/lib/voice-pilot-auth";

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
            .neq("interaction_mode", "voice_only")
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
        .neq("interaction_mode", "voice_only")
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
      .eq("is_active", true)
      .neq("interaction_mode", "voice_only");
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

  // Programa de certificación. Para el resto de las cuentas (la inmensa
  // mayoría), certPolicy.isCertificationProgram es false y lockMap queda
  // undefined — PacientesClient se comporta exactamente igual que antes.
  //
  // "Habilitado" (course_patients) y "agendado" (patient_schedules) son dos
  // cosas distintas: TODOS los pacientes visibles se muestran siempre — los
  // no habilitados quedan grises con candado, sin ninguna acción posible; los
  // habilitados se ven a color, con el CTA variando según si ya se agendó,
  // está esperando su horario, o ya se puede empezar.
  let lockMap: Record<string, PatientLockInfo> | undefined;
  let minHoursBetweenSessions = 72;
  const certPolicy = await getCertificationPolicy(user.id);
  if (certPolicy.isCertificationProgram) {
    const { data: rosterRows } = await admin
      .from("course_patients")
      .select("ai_patient_id")
      .eq("course_id", certPolicy.courseId);
    const rosterIds = new Set((rosterRows || []).map((r) => r.ai_patient_id));

    // Un paciente habilitado explícitamente por el admin se ve aunque no
    // matchee la visibilidad por país del establecimiento (unión, no filtro).
    const missingIds = Array.from(rosterIds).filter((rid) => !patients.some((p) => p.id === rid));
    if (missingIds.length > 0) {
      const { data: extra } = await admin
        .from("ai_patients")
        .select("id, name, age, occupation, quote, difficulty_level, tags, country, voice_id")
        .eq("is_active", true)
        .neq("interaction_mode", "voice_only")
        .in("id", missingIds);
      patients = [...patients, ...(extra || [])];
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
      const enabled = rosterIds.has(patient.id);
      if (!enabled) {
        lockMap[patient.id] = { enabled: false, reason: null, unlocksAt: null, scheduledAt: null };
        continue;
      }
      const schedule = scheduleByPatient.get(patient.id) ?? null;
      const lock = computeLockState({
        schedule: schedule ? { scheduled_at: schedule.scheduled_at, status: schedule.status } : null,
        lastSessionEndedAt,
        minHours: certPolicy.minHoursBetweenSessions,
      });
      lockMap[patient.id] = {
        enabled: true,
        reason: lock.locked ? lock.reason : null,
        unlocksAt: lock.unlocksAt,
        scheduledAt: schedule?.scheduled_at ?? null,
      };
    }
  }

  // Piloto de voz (AU-05/AC-01/02/03): unión explícita, no un cambio al
  // array de países — un paciente `visibility='private_pilot'` solo entra a
  // la lista si voice_pilot_access autoriza al usuario actual, sin importar
  // establecimiento/país/asignación (A-02/A-06). La tarjeta lo muestra pero
  // sin acción (P-03: la pantalla de voz todavía no existe, Etapa 2/3).
  const authorizedVoicePatientIds = await getAuthorizedVoicePilotPatientIds(user.id);
  const voiceOnlyIds = new Set<string>();
  if (authorizedVoicePatientIds.length > 0) {
    const { data: voicePatients } = await admin
      .from("ai_patients")
      .select("id, name, age, occupation, quote, difficulty_level, tags, country, voice_id")
      .eq("is_active", true)
      .eq("interaction_mode", "voice_only")
      .in("id", authorizedVoicePatientIds);
    for (const vp of voicePatients || []) {
      if (!patients.some((p) => p.id === vp.id)) {
        patients = [...patients, vp];
        voiceOnlyIds.add(vp.id);
      }
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
          voiceOnlyIds={Array.from(voiceOnlyIds)}
        />
      </div>
    </div>
  );
}
