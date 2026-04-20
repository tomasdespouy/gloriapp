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
      .select("*, pilot_participants(id, first_login_at)")
      .order("created_at", { ascending: false }),
    admin
      .from("establishments")
      .select("id, name, country, logo_url")
      .eq("is_active", true)
      .order("name"),
  ]);

  // Derive "en_desarrollo": a pilot whose real status is validado/enviado
  // and that already has at least one participant who logged in. The raw
  // status in the DB is NOT modified — this is purely a display hint for
  // the general listing.
  const pilotList = (pilots || []).map((p) => {
    const participants = (p.pilot_participants as { id: string; first_login_at: string | null }[]) || [];
    const loggedInCount = participants.filter((pp) => !!pp.first_login_at).length;
    const inProgress =
      (p.status === "validado" || p.status === "enviado") && loggedInCount >= 1;
    return {
      ...p,
      participant_count: participants.length,
      derived_status: inProgress ? "en_desarrollo" : null,
      pilot_participants: undefined,
    };
  });

  return <PilotosClient pilots={pilotList} establishments={establishments || []} />;
}
