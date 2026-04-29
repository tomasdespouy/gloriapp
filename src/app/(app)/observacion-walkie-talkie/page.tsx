import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getUserProfile } from "@/lib/supabase/user-profile";
import ObservacionClient from "./ObservacionClient";

// Versión legacy (walkie-talkie) del módulo de grabación en vivo.
// Reemplazada en /observacion por la versión LLM (auto-diarización +
// summary + safety alerts). Esta ruta queda como dormante por si hay
// que rollback puntual — accesible solo a superadmin via URL directa.
// No aparece en sidebar.
export default async function ObservacionWalkieTalkiePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "superadmin") redirect("/observacion");

  const fullProfile = await getUserProfile();

  return (
    <div className="h-full overflow-hidden flex flex-col" style={{ height: "calc(100dvh - 48px)" }}>
      <ObservacionClient
        userName={fullProfile?.fullName || ""}
        userAvatarUrl={fullProfile?.avatarUrl || null}
      />
    </div>
  );
}
