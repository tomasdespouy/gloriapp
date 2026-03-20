import { getUserProfile } from "@/lib/supabase/user-profile";
import { redirect } from "next/navigation";
import RecordSessionClient from "./RecordSessionClient";

export default async function GrabarSesionPage() {
  const profile = await getUserProfile();
  if (!profile) redirect("/login");

  // Only students and instructors can access
  if (profile.role !== "student" && profile.role !== "instructor") {
    redirect("/dashboard");
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <RecordSessionClient />
    </div>
  );
}
