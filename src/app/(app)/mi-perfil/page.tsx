import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import ProfileClient from "./ProfileClient";

export default async function MiPerfilPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role, avatar_url, establishment_id")
    .eq("id", user.id)
    .single();

  let establishmentName: string | null = null;
  if (profile?.establishment_id) {
    // Use admin client to look up the establishment name. The student RLS
    // policy on `establishments` may not allow students to read the name
    // of their own establishment, which previously caused the profile to
    // show "Sin asignar" even when establishment_id was correctly set.
    // Scoping by the user's own profile.establishment_id (already
    // authenticated above) keeps this safe — we only ever read the
    // establishment that belongs to the current user.
    const { data: est } = await createAdminClient()
      .from("establishments")
      .select("name")
      .eq("id", profile.establishment_id)
      .single();
    establishmentName = est?.name || null;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Mi perfil</h1>
      <ProfileClient
        userId={user.id}
        fullName={profile?.full_name || ""}
        email={profile?.email || user.email || ""}
        role={profile?.role || "student"}
        avatarUrl={profile?.avatar_url || null}
        establishmentName={establishmentName}
      />
    </div>
  );
}
