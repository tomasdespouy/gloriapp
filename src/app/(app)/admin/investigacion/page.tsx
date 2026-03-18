import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ResearchClient from "./ResearchClient";

export default async function InvestigacionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "superadmin") redirect("/admin/dashboard");

  return <ResearchClient />;
}
