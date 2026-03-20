import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import InstructorOnboarding from "@/components/InstructorOnboarding";

export default async function DocenteLayout({
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

  if (profile?.role !== "instructor" && profile?.role !== "admin" && profile?.role !== "superadmin") {
    redirect("/dashboard");
  }

  return (
    <>
      {children}
      {profile?.role === "instructor" && <InstructorOnboarding />}
    </>
  );
}
