import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import TutorClient from "./TutorClient";
import { COMPETENCY_LABELS_V2 } from "@/lib/gamification";
import { getUserProfile } from "@/lib/supabase/user-profile";
import { isPilotActive } from "@/lib/pilot-helpers";

export default async function TutorPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Pilot participants with skip_tutor_redirect=true should not see the
  // tutor onboarding at all — even if they navigate to the URL directly
  // (e.g. via the sidebar "Aprendizaje" link, which may still be visible
  // during the 1-tick before layout filtering kicks in).
  const admin = createAdminClient();
  const { data: pp } = await admin
    .from("pilot_participants")
    .select("pilot_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (pp?.pilot_id) {
    const { data: pilotRow } = await admin
      .from("pilots")
      .select("ui_config, status, scheduled_at, ended_at")
      .eq("id", pp.pilot_id)
      .single();
    // Defensive: only skip the tutor when the pilot is still live.
    const skipTutor =
      isPilotActive(pilotRow) &&
      !!(pilotRow?.ui_config as Record<string, boolean> | null)?.skip_tutor_redirect;
    if (skipTutor) redirect("/dashboard");
  }

  const profile = await getUserProfile();
  const firstName = profile?.fullName?.split(" ")[0] || "Estudiante";

  const competencies = Object.entries(COMPETENCY_LABELS_V2).map(([key, label]) => ({
    key,
    label,
  }));

  return <TutorClient competencies={competencies} firstName={firstName} />;
}
