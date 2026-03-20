import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PacientesClient from "./PacientesClient";

export default async function PacientesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Get student's country via their establishment
  const { data: profile } = await supabase
    .from("profiles")
    .select("establishment_id")
    .eq("id", user.id)
    .single();

  let studentCountry: string | null = null;
  if (profile?.establishment_id) {
    const { data: establishment } = await supabase
      .from("establishments")
      .select("country")
      .eq("id", profile.establishment_id)
      .single();
    studentCountry = establishment?.country || null;
  }

  // Fetch active patients, filtered by country if student has one
  let query = supabase
    .from("ai_patients")
    .select("id, name, age, occupation, quote, difficulty_level, tags, country, voice_id")
    .eq("is_active", true);

  if (studentCountry) {
    query = query.contains("country", [studentCountry]);
  }

  const { data: patients } = await query;

  // Fetch active or abandoned conversations for this student (both can be resumed)
  const { data: activeConversations } = await supabase
    .from("conversations")
    .select("id, ai_patient_id")
    .eq("student_id", user.id)
    .in("status", ["active", "abandoned"]);

  // Build map as plain object (serializable)
  const activeSessionMap: Record<string, string> = {};
  if (activeConversations) {
    for (const conv of activeConversations) {
      activeSessionMap[conv.ai_patient_id] = conv.id;
    }
  }

  return (
    <div className="min-h-screen">
      <header className="px-4 sm:px-8 py-4 sm:py-5">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Pacientes</h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
          Elige un paciente para iniciar una sesión de práctica terapéutica
        </p>
      </header>

      <div className="px-4 sm:px-8 pb-8">
        <PacientesClient
          patients={patients || []}
          activeSessionMap={activeSessionMap}
        />
      </div>
    </div>
  );
}
