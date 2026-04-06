import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function MasivoPacientesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  // Only superadmin can create patients in bulk (admin can only view)
  if (profile?.role !== "superadmin") {
    redirect("/perfiles");
  }

  return <>{children}</>;
}
