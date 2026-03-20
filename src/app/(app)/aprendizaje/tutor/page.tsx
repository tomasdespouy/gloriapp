import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import TutorClient from "./TutorClient";
import { COMPETENCY_LABELS_V2 } from "@/lib/gamification";
import { getUserProfile } from "@/lib/supabase/user-profile";

export default async function TutorPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getUserProfile();
  const firstName = profile?.fullName?.split(" ")[0] || "Estudiante";

  const competencies = Object.entries(COMPETENCY_LABELS_V2).map(([key, label]) => ({
    key,
    label,
  }));

  return <TutorClient competencies={competencies} firstName={firstName} />;
}
