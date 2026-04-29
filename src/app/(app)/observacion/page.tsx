import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import LiveSessionClient from "./LiveSessionClient";

// Módulo de grabación en vivo — versión LLM con auto-diarización.
// Reemplazó al walkie-talkie viejo el 2026-04-29 (commit feat/live-llm).
// El walkie-talkie sigue accesible por superadmin en /observacion-walkie-talkie
// como fallback puntual. Cuando se haya validado el approach LLM con uso
// real, se puede eliminar el legacy.
export default async function ObservacionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <LiveSessionClient />;
}
