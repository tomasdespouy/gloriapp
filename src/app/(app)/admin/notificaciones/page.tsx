import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NotificacionesClient from "./NotificacionesClient";

export default async function NotificacionesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "superadmin") redirect("/admin/dashboard");

  return <NotificacionesClient />;
}
