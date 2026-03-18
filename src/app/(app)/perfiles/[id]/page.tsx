import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, ChevronLeft, ChevronRight } from "lucide-react";
import ExportFichaButton from "./ExportFichaButton";
import PatientImageModal from "./PatientImageModal";

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role;
  if (role !== "instructor" && role !== "admin" && role !== "superadmin") redirect("/dashboard");
  const canEdit = role === "admin" || role === "superadmin";

  const admin = createAdminClient();
  const { data: patient } = await admin
    .from("ai_patients")
    .select("*")
    .eq("id", id)
    .single();

  if (!patient) redirect("/perfiles");

  const slug = patient.name
    .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");

  const diffLabels: Record<string, string> = {
    beginner: "Principiante", intermediate: "Intermedio", advanced: "Avanzado",
  };

  // Session count
  const { count } = await admin
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("ai_patient_id", id);

  // Navigation: get prev/next patient IDs (sorted by name asc)
  const { data: allPatients } = await admin
    .from("ai_patients")
    .select("id, name")
    .order("name", { ascending: true });

  let prevId: string | null = null;
  let nextId: string | null = null;
  let currentIndex = -1;
  if (allPatients) {
    currentIndex = allPatients.findIndex(p => p.id === id);
    if (currentIndex > 0) prevId = allPatients[currentIndex - 1].id;
    if (currentIndex >= 0 && currentIndex < allPatients.length - 1) nextId = allPatients[currentIndex + 1].id;
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Link href="/perfiles" className="inline-flex items-center gap-1.5 text-xs text-sidebar hover:underline">
            <ArrowLeft size={14} /> Volver a perfiles
          </Link>
          <div className="flex items-center gap-2">
            {allPatients && currentIndex >= 0 && (
              <span className="text-[10px] text-gray-400 mr-2">
                {currentIndex + 1} de {allPatients.length}
              </span>
            )}
            {prevId ? (
              <Link
                href={`/perfiles/${prevId}`}
                className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:text-sidebar hover:border-sidebar/30 transition-colors"
                title="Paciente anterior"
              >
                <ChevronLeft size={16} />
              </Link>
            ) : (
              <div className="w-8 h-8 rounded-full border border-gray-100 flex items-center justify-center text-gray-200">
                <ChevronLeft size={16} />
              </div>
            )}
            {nextId ? (
              <Link
                href={`/perfiles/${nextId}`}
                className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:text-sidebar hover:border-sidebar/30 transition-colors"
                title="Paciente siguiente"
              >
                <ChevronRight size={16} />
              </Link>
            ) : (
              <div className="w-8 h-8 rounded-full border border-gray-100 flex items-center justify-center text-gray-200">
                <ChevronRight size={16} />
              </div>
            )}
          </div>
        </div>

        {/* Header */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start gap-5">
            <PatientImageModal
              src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/patients/${slug}.png?v=${new Date(patient.updated_at).getTime()}`}
              videoSrc={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/patients/${slug}.mp4?v=${new Date(patient.updated_at).getTime()}`}
              alt={patient.name}
            />
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-gray-900">{patient.name}</h1>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                  patient.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
                }`}>
                  {patient.is_active ? "Activo" : "Inactivo"}
                </span>
              </div>
              <p className="text-sm text-gray-500">{patient.age} años, {patient.occupation}</p>
              <p className="text-sm text-gray-400 italic mt-1">&ldquo;{patient.quote}&rdquo;</p>
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  patient.difficulty_level === "beginner" ? "bg-green-100 text-green-700" :
                  patient.difficulty_level === "intermediate" ? "bg-yellow-100 text-yellow-700" :
                  "bg-red-100 text-red-700"
                }`}>
                  {diffLabels[patient.difficulty_level] || patient.difficulty_level}
                </span>
                {patient.country_origin && (
                  <span className="text-xs text-gray-500">
                    Origen: <strong>{patient.country_origin}</strong>
                  </span>
                )}
                {patient.country_residence && patient.country_residence !== patient.country_origin && (
                  <span className="text-xs text-gray-500">
                    Reside en: <strong>{patient.country_residence}</strong>
                  </span>
                )}
                {patient.country && (
                  <span className="text-xs text-gray-400">
                    Visible: {Array.isArray(patient.country) ? patient.country.join(", ") : patient.country}
                  </span>
                )}
                <span className="text-xs text-gray-400">{count || 0} sesiones</span>
                <span className="text-xs text-gray-400">
                  Creado {new Date(patient.created_at).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ExportFichaButton patientId={id} patientName={patient.name} />
              {canEdit && (
                <Link
                  href={`/perfiles/${id}/editar`}
                  className="flex items-center gap-2 bg-sidebar text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-sidebar-hover transition-colors"
                >
                  <Pencil size={14} />
                  Editar
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Problem, backstory & personal details */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Motivo de consulta</h3>
              <p className="text-sm text-gray-800 leading-relaxed">{patient.presenting_problem}</p>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Historia</h3>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{patient.backstory}</p>
            </div>

            {/* Personal details */}
            {(patient.birthday || patient.neighborhood) && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Datos personales</h3>
                <div className="space-y-1">
                  {patient.birthday && (
                    <p className="text-xs text-gray-600">
                      <span className="text-gray-400">Cumpleaños:</span>{" "}
                      {new Date(patient.birthday + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  )}
                  {patient.neighborhood && (
                    <p className="text-xs text-gray-600">
                      <span className="text-gray-400">Sector:</span> {patient.neighborhood}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Family */}
            {(patient.family_members as { name: string; age: number; relationship: string; notes: string }[] || []).length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Grupo familiar</h3>
                <div className="space-y-1.5">
                  {(patient.family_members as { name: string; age: number; relationship: string; notes: string }[]).map((m, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="font-medium text-gray-800">{m.name}</span>
                      <span className="text-gray-400">({m.age} años, {m.relationship})</span>
                      {m.notes && <span className="text-gray-500 italic">— {m.notes}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Personality & tags */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Rasgos de personalidad</h3>
              <div className="space-y-2">
                {Object.entries(patient.personality_traits || {}).map(([key, val]) => {
                  const traitLabels: Record<string, string> = {
                    openness: "Apertura",
                    neuroticism: "Neuroticismo",
                    resistance: "Resistencia",
                    communication_style: "Estilo comunicacional",
                    "commúnication_style": "Estilo comunicacional",
                    extraversion: "Extroversión",
                    agreeableness: "Amabilidad",
                    conscientiousness: "Responsabilidad",
                  };
                  const valLabels: Record<string, string> = {
                    high_initial: "Alta inicial",
                    active_testing: "Prueba activa",
                    passive: "Pasiva",
                    generational: "Generacional",
                    moderate: "Moderada",
                    low: "Baja",
                    high: "Alta",
                    medium: "Media",
                  };
                  const label = traitLabels[key] || key.replace(/_/g, " ");
                  const value = typeof val === "number" ? val.toFixed(1) : (valLabels[String(val)] || String(val));
                  return (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-xs text-gray-600 capitalize">{label}</span>
                      <span className="text-xs font-medium text-gray-900">{value}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Etiquetas</h3>
              <div className="flex flex-wrap gap-1.5">
                {(patient.tags || []).map((tag: string) => (
                  <span key={tag} className="text-[11px] bg-sidebar/10 text-sidebar px-2 py-0.5 rounded-full font-medium">
                    {tag}
                  </span>
                ))}
              </div>
              {(patient.skills_practiced || []).length > 0 && (
                <>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 mt-4">Habilidades practicadas</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {(patient.skills_practiced || []).map((s: string) => (
                      <span key={s} className="text-[11px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                        {s}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* System prompt (collapsible) */}
        {canEdit && (
          <details className="bg-white rounded-2xl border border-gray-200 p-6 mt-6">
            <summary className="text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer">
              Instrucciones para la IA (prompt del paciente)
            </summary>
            <pre className="mt-3 text-xs text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-xl p-4 max-h-[400px] overflow-y-auto">
              {patient.system_prompt}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
