import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import ExportFichaButton from "../ExportFichaButton";

export default async function FichaClinicaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: patient } = await admin
    .from("ai_patients")
    .select("*")
    .eq("id", id)
    .single();

  if (!patient) redirect("/perfiles");

  const diffLabels: Record<string, string> = {
    beginner: "Principiante",
    intermediate: "Intermedio",
    advanced: "Avanzado",
  };

  const traitLabels: Record<string, string> = {
    openness: "Apertura",
    neuroticism: "Neuroticismo",
    resistance: "Resistencia",
    communication_style: "Estilo comunicacional",
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
    anxious_but_open: "Ansioso/a pero abierto/a",
    reserved: "Reservado/a",
    defensive: "Defensivo/a",
    verbose: "Verborrágico/a",
    intellectualizing: "Intelectualizador/a",
    avoidant: "Evitativo/a",
    confrontational: "Confrontacional",
    compliant: "Complaciente",
    silent: "Silencioso/a",
    demanding: "Demandante",
    distrustful: "Desconfiado/a",
  };

  const slug = patient.name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ /g, "-");

  const imgSrc = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/patients/${slug}.png?v=${new Date(patient.updated_at).getTime()}`;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-6 print:px-0 print:py-0">
      {/* Navigation */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <Link
          href={`/perfiles/${id}`}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-sidebar transition-colors"
        >
          <ArrowLeft size={16} /> Volver al perfil
        </Link>
        <ExportFichaButton patientId={id} patientName={patient.name} />
      </div>

      {/* Ficha clínica */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8 print:border-0 print:shadow-none print:p-0">
        {/* Header */}
        <div className="flex items-start gap-6 mb-8 pb-6 border-b border-gray-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imgSrc}
            alt={patient.name}
            className="w-24 h-24 rounded-2xl object-cover border border-gray-200"
          />
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{patient.name}</h1>
            <p className="text-sm text-gray-500 mb-2">
              {patient.age} años &middot; {patient.occupation}
            </p>
            <p className="text-sm text-gray-400 italic mb-3">
              &ldquo;{patient.quote}&rdquo;
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-600">
              <span>Origen: <strong>{patient.country_origin || "—"}</strong></span>
              <span>Residencia: <strong>{patient.country_residence || "—"}</strong></span>
              <span>Visible para: <strong>{Array.isArray(patient.country) ? patient.country.join(", ") : (patient.country || "Todos")}</strong></span>
              <span>Dificultad: <strong>{diffLabels[patient.difficulty_level] || patient.difficulty_level}</strong></span>
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left column */}
          <div className="space-y-6">
            <section>
              <h2 className="text-xs font-semibold text-[#4A55A2] uppercase tracking-wide mb-2">
                Motivo de consulta
              </h2>
              <p className="text-sm text-gray-800 leading-relaxed">{patient.presenting_problem}</p>
              {(patient.tags || []).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {patient.tags.map((tag: string) => (
                    <span key={tag} className="text-[11px] bg-[#4A55A2]/10 text-[#4A55A2] px-2 py-0.5 rounded-full font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-xs font-semibold text-[#4A55A2] uppercase tracking-wide mb-2">
                Historia
              </h2>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{patient.backstory}</p>
            </section>

            {patient.distinctive_factor && (
              <section>
                <h2 className="text-xs font-semibold text-[#4A55A2] uppercase tracking-wide mb-2">
                  Factor distintivo
                </h2>
                <p className="text-sm text-gray-700 leading-relaxed">{patient.distinctive_factor}</p>
              </section>
            )}

            {(patient.family_members || []).length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-[#4A55A2] uppercase tracking-wide mb-2">
                  Familia
                </h2>
                <div className="space-y-2">
                  {patient.family_members.map((fm: { name: string; age: number; relationship: string; notes?: string }, i: number) => (
                    <div key={i} className="text-sm text-gray-700">
                      <span className="font-medium">{fm.name}</span>
                      <span className="text-gray-400"> ({fm.age} años, {fm.relationship})</span>
                      {fm.notes && <span className="text-gray-500"> — {fm.notes}</span>}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-6">
            <section>
              <h2 className="text-xs font-semibold text-[#4A55A2] uppercase tracking-wide mb-2">
                Rasgos de personalidad
              </h2>
              <p className="text-[10px] text-gray-400 mb-3">Big Five (Costa & McCrae, 1992), Reactancia (Beutler & Harwood, 2000)</p>
              <div className="space-y-2">
                {Object.entries(patient.personality_traits || {}).map(([key, val]) => {
                  const label = traitLabels[key] || key.replace(/_/g, " ");
                  const value = typeof val === "number"
                    ? val.toFixed(1)
                    : (valLabels[String(val)] || String(val));
                  return (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-xs text-gray-600 capitalize">{label}</span>
                      <span className="text-xs font-medium text-gray-900">{value}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            {patient.birthday && (
              <section>
                <h2 className="text-xs font-semibold text-[#4A55A2] uppercase tracking-wide mb-2">
                  Datos personales
                </h2>
                <div className="space-y-1 text-xs text-gray-600">
                  <p>Cumpleaños: <strong>{new Date(patient.birthday + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })}</strong></p>
                  {patient.neighborhood && <p>Sector: <strong>{patient.neighborhood}</strong></p>}
                </div>
              </section>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-100 text-center">
          <p className="text-[10px] text-gray-400">
            Ficha cl&iacute;nica generada por GlorIA &middot; Universidad Gabriela Mistral
          </p>
        </div>
      </div>
    </div>
  );
}
