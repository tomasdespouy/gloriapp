import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SpikeClient from "./SpikeClient";

// Spike experimental: diarización post-hoc de sesión clínica vía LLM.
// Pantalla aislada — solo accesible vía URL directa por superadmin, no
// aparece en sidebar, no toca /observacion ni el endpoint live-session
// existente. Endpoint dedicado: /api/live-session-llm.
export default async function SpikeLlmPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "superadmin") redirect("/");

  return <SpikeClient />;
}
