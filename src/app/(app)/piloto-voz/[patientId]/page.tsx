import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserProfile } from "@/lib/supabase/user-profile";
import VoiceRoomClient from "@/components/VoiceRoomClient";

/**
 * Sala de prueba tecnica del piloto de voz (Etapa 2, incremento minimo).
 * Solo superadmin por ahora: no es la experiencia final del alumno (sin
 * transcripcion, sin grabacion, sin feedback) — sirve para escuchar la voz
 * real de punta a punta contra el rele ya desplegado. La autorizacion real
 * de la conversacion la resuelve /api/voice-pilot/attempts (fail-closed),
 * este gate es solo para no exponer la sala mientras es un borrador.
 */
export default async function PilotoVozPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;

  const profile = await getUserProfile();
  if (!profile) redirect("/login");
  if (profile.realRole !== "superadmin") redirect("/admin/dashboard");

  const { data: patient } = await createAdminClient()
    .from("ai_patients")
    .select("id, name, interaction_mode")
    .eq("id", patientId)
    .maybeSingle();

  if (!patient || patient.interaction_mode !== "voice_only") notFound();

  return <VoiceRoomClient patientId={patient.id} patientName={patient.name} />;
}
