import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PatientCard from "@/components/PatientCard";

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
    .select("id, name, age, occupation, quote, difficulty_level, tags, country")
    .eq("is_active", true)
    .order("difficulty_level");

  if (studentCountry) {
    query = query.contains("country", [studentCountry]);
  }

  const { data: patients } = await query;

  return (
    <div className="min-h-screen">
      <header className="px-8 py-5">
        <h1 className="text-2xl font-bold text-gray-900">Pacientes</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Elige un paciente para iniciar una sesión de práctica terapéutica
        </p>
      </header>

      <div className="px-8 pb-8">
        {/* Difficulty legend */}
        <div className="flex gap-4 mb-6">
          <span className="text-xs text-gray-500 flex items-center gap-1">🌱 Principiante</span>
          <span className="text-xs text-gray-500 flex items-center gap-1">🌿 Intermedio</span>
          <span className="text-xs text-gray-500 flex items-center gap-1">🌳 Avanzado</span>
        </div>

        {patients && patients.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {patients.map((patient) => (
              <PatientCard
                key={patient.id}
                id={patient.id}
                name={patient.name}
                age={patient.age}
                occupation={patient.occupation}
                quote={patient.quote}
                difficultyLevel={patient.difficulty_level}
                tags={patient.tags}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-sm text-gray-400">No hay pacientes disponibles para tu institución.</p>
          </div>
        )}
      </div>
    </div>
  );
}
