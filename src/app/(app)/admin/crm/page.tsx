import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CRMClient from "./CRMClient";

export default async function CRMPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "superadmin") redirect("/admin/dashboard");

  const { data: universities } = await supabase
    .from("crm_universities")
    .select("*")
    .order("name");

  return <CRMClient universities={universities || []} />;
}
