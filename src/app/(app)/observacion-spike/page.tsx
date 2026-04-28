import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SpikeClient from "./SpikeClient";

// Spike experimental aislado del módulo /observacion. Solo accesible por
// superadmin via URL directa — no aparece en sidebar (no está en
// src/lib/modules.ts). No toca el flujo de grabación de la plataforma.
export default async function SpikePage() {
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
