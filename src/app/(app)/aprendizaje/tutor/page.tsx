import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import TutorClient from "./TutorClient";
import { COMPETENCY_LABELS } from "@/lib/gamification";

export default async function TutorPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const competencies = Object.entries(COMPETENCY_LABELS).map(([key, label]) => ({
    key,
    label,
  }));

  return <TutorClient competencies={competencies} />;
}
