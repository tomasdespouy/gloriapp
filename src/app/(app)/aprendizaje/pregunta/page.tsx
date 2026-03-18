import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AskGloriaClient from "./AskGloriaClient";

export default async function PreguntaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  return <AskGloriaClient studentName={profile?.full_name || "Estudiante"} />;
}
