import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import PilotosClient from "./PilotosClient";

export default async function PilotosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "superadmin") redirect("/admin/dashboard");

  const admin = createAdminClient();

  const [{ data: pilots }, { data: establishments }] = await Promise.all([
    supabase
      .from("pilots")
      .select("*, pilot_participants(id)")
      .order("created_at", { ascending: false }),
    admin
      .from("establishments")
      .select("id, name, country")
      .eq("is_active", true)
      .order("name"),
  ]);

  const pilotList = (pilots || []).map((p) => ({
    ...p,
    participant_count: (p.pilot_participants as { id: string }[])?.length || 0,
    pilot_participants: undefined,
  }));

  return <PilotosClient pilots={pilotList} establishments={establishments || []} />;
}
