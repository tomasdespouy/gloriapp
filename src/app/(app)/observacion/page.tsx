import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getUserProfile } from "@/lib/supabase/user-profile";
import ObservacionClient from "./ObservacionClient";

export default async function ObservacionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getUserProfile();

  return (
    <div className="h-full overflow-hidden flex flex-col" style={{ height: "calc(100dvh - 48px)" }}>
      <ObservacionClient
        userName={profile?.fullName || ""}
        userAvatarUrl={profile?.avatarUrl || null}
      />
    </div>
  );
}
