import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CostosClient from "./CostosClient";

export default async function CostosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "superadmin") redirect("/admin/dashboard");

  // Get establishments for filter
  const { data: establishments } = await supabase.from("establishments").select("id, name, country");

  return <CostosClient establishments={establishments || []} />;
}
