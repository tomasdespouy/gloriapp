import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import VoicePilotsClient from "./VoicePilotsClient";

export default async function VoicePilotsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "superadmin") redirect("/admin/dashboard");

  const admin = createAdminClient();

  const { data: pilots } = await admin
    .from("voice_pilots")
    .select("*, ai_patients(id, name, base_patient_id, is_active)")
    .order("created_at", { ascending: false });

  const pilotIds = (pilots || []).map((p) => p.id);

  const [{ data: accessRows }, { data: grantRows }] = await Promise.all([
    pilotIds.length
      ? admin.from("voice_pilot_access").select("*").in("pilot_id", pilotIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    pilotIds.length
      ? admin.from("voice_attempt_grants").select("*").in("pilot_id", pilotIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);

  const userIds = Array.from(new Set([
    ...(accessRows || []).map((r) => r.user_id as string),
    ...(grantRows || []).map((r) => r.user_id as string),
  ]));

  const { data: users } = userIds.length
    ? await admin.from("profiles").select("id, full_name, email").in("id", userIds)
    : { data: [] as { id: string; full_name: string | null; email: string }[] };

  return (
    <VoicePilotsClient
      pilots={pilots || []}
      accessRows={accessRows || []}
      grantRows={grantRows || []}
      users={users || []}
    />
  );
}
