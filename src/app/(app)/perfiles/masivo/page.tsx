"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Globe, Loader2, Check, Save, Image as ImageIcon,
} from "lucide-react";

const COUNTRIES = [
  { code: "Chile", flag: "🇨🇱", label: "Chile" },
  { code: "México", flag: "🇲🇽", label: "México" },
  { code: "Colombia", flag: "🇨🇴", label: "Colombia" },
  { code: "Argentina", flag: "🇦🇷", label: "Argentina" },
  { code: "Perú", flag: "🇵🇪", label: "Perú" },
  { code: "España", flag: "🇪🇸", label: "España" },
];

const DIFF_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
  beginner: { label: "Básico", color: "bg-green-100 text-green-700", emoji: "🌱" },
  intermediate: { label: "Intermedio", color: "bg-yellow-100 text-yellow-700", emoji: "🌿" },
  advanced: { label: "Avanzado", color: "bg-red-100 text-red-700", emoji: "🌳" },
};

interface GeneratedPatient {
  name: string;
  age: number;
  gender: string;
  occupation: string;
  quote: string;
  presenting_problem: string;
  backstory: string;
  personality_traits: string[];
  tags: string[];
  difficulty_level: string;
  system_prompt: string;
  _imageUrl?: string;
  _imageLoading?: boolean;
  _saved?: boolean;
}

export default function MasivoPage() {
  const router = useRouter();
  const [step, setStep] = useState<"select" | "generating" | "review" | "saving">("select");
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<GeneratedPatient[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savingCount, setSavingCount] = useState(0);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const handleGenerate = async () => {
    if (!selectedCountry) return;
    setStep("generating");
    setError(null);

    try {
      const res = await fetch("/api/patients/generate-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country: selectedCountry }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error generando perfiles");
      }

      const { profiles: generated } = await res.json();
      setProfiles(generated.map((p: GeneratedPatient) => ({ ...p, _imageUrl: undefined, _imageLoading: false, _saved: false })));
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      setStep("select");
    }
  };

  const generateImage = async (idx: number) => {
    const p = profiles[idx];
    setProfiles((prev) => prev.map((pr, i) => i === idx ? { ...pr, _imageLoading: true } : pr));

    try {
      const res = await fetch("/api/patients/generate-batch-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: p.name, age: p.age, gender: p.gender,
          country: selectedCountry, occupation: p.occupation,
        }),
      });
      const data = await res.json();
      if (data.imageUrl) {
        setProfiles((prev) => prev.map((pr, i) => i === idx ? { ...pr, _imageUrl: data.imageUrl, _imageLoading: false } : pr));
      }
    } catch {
      setProfiles((prev) => prev.map((pr, i) => i === idx ? { ...pr, _imageLoading: false } : pr));
    }
  };

  const generateAllImages = async () => {
    for (let i = 0; i < profiles.length; i++) {
      if (!profiles[i]._imageUrl) {
        await generateImage(i);
      }
    }
  };

  const saveAllPatients = async () => {
    setStep("saving");
    let saved = 0;

    for (let i = 0; i < profiles.length; i++) {
      const p = profiles[i];
      if (p._saved) { saved++; continue; }

      try {
        const res = await fetch("/api/patients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: p.name,
            age: p.age,
            occupation: p.occupation,
            quote: p.quote,
            presenting_problem: p.presenting_problem,
            backstory: p.backstory,
            personality_traits: p.personality_traits,
            tags: p.tags,
            difficulty_level: p.difficulty_level,
            system_prompt: p.system_prompt,
            skills_practiced: [],
            total_sessions: 5,
          }),
        });

        if (res.ok) {
          setProfiles((prev) => prev.map((pr, j) => j === i ? { ...pr, _saved: true } : pr));
          saved++;
        }
      } catch {
        // continue with others
      }
      setSavingCount(saved);
    }

    setTimeout(() => router.push("/perfiles"), 1500);
  };

  const country = COUNTRIES.find((c) => c.code === selectedCountry);

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <Link href="/perfiles" className="text-xs text-sidebar hover:underline mb-4 inline-flex items-center gap-1">
          <ArrowLeft size={12} /> Volver a perfiles
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">🌎 Generación masiva de pacientes</h1>
        <p className="text-sm text-gray-500 mb-6">
          Selecciona un país para generar 12 pacientes con diversidad clínica, cultural y socioeconómica
        </p>

        {/* Step 1: Select country */}
        {step === "select" && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {COUNTRIES.map((c) => (
                <button
                  key={c.code}
                  onClick={() => setSelectedCountry(c.code)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                    selectedCountry === c.code
                      ? "border-sidebar bg-sidebar/5 shadow-sm"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  <span className="text-4xl">{c.flag}</span>
                  <span className="text-sm font-medium text-gray-900">{c.label}</span>
                </button>
              ))}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
              <p className="text-sm font-medium text-gray-900 mb-2">Se generarán:</p>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-green-600">4</p>
                  <p className="text-xs text-gray-500">🌱 Nivel básico</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-yellow-600">4</p>
                  <p className="text-xs text-gray-500">🌿 Nivel intermedio</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">4</p>
                  <p className="text-xs text-gray-500">🌳 Nivel avanzado</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-3 text-center">6 mujeres + 6 hombres — patologías, contextos y perfiles diversos</p>
            </div>

            <button
              onClick={handleGenerate}
              disabled={!selectedCountry}
              className="w-full bg-sidebar hover:bg-[#354080] text-white py-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Globe size={18} />
              Generar 12 pacientes de {country?.label || "..."}
            </button>
          </div>
        )}

        {/* Step 2: Generating */}
        {step === "generating" && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center animate-fade-in">
            <Loader2 size={48} className="mx-auto text-sidebar animate-spin mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Generando 12 pacientes de {country?.flag} {country?.label}
            </h2>
            <p className="text-sm text-gray-500">
              La IA está creando perfiles clínicos con diversidad de contextos, patologías y niveles de dificultad...
            </p>
            <p className="text-xs text-gray-400 mt-2">Esto puede tomar 30-60 segundos</p>
          </div>
        )}

        {/* Step 3: Review */}
        {step === "review" && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {country?.flag} {profiles.length} pacientes generados para {country?.label}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={generateAllImages}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <ImageIcon size={14} />
                  Generar todas las imágenes
                </button>
                <button
                  onClick={saveAllPatients}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sidebar text-white text-sm font-medium hover:bg-[#354080] transition-colors"
                >
                  <Save size={14} />
                  Guardar todos
                </button>
              </div>
            </div>

            {/* Group by difficulty */}
            {(["beginner", "intermediate", "advanced"] as const).map((diff) => {
              const group = profiles.filter((p) => p.difficulty_level === diff);
              const d = DIFF_LABELS[diff];
              return (
                <div key={diff}>
                  <p className="text-sm font-semibold text-gray-900 mb-2">
                    {d.emoji} {d.label} ({group.length})
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {group.map((p) => {
                      const idx = profiles.indexOf(p);
                      const isExpanded = expandedIdx === idx;
                      return (
                        <div key={idx} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                          <div
                            className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
                            onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                          >
                            {/* Avatar */}
                            <div className="w-10 h-10 rounded-full bg-sidebar flex items-center justify-center flex-shrink-0 overflow-hidden">
                              {p._imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={p._imageUrl} alt={p.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-white text-xs font-bold">
                                  {p.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                                </span>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {p.name}
                                <span className="text-gray-400 font-normal"> · {p.age} años · {p.gender === "Femenino" ? "♀" : "♂"}</span>
                              </p>
                              <p className="text-[11px] text-gray-500 truncate">{p.occupation} — {p.presenting_problem}</p>
                            </div>

                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${d.color}`}>
                              {d.label}
                            </span>
                          </div>

                          {isExpanded && (
                            <div className="border-t border-gray-100 px-4 py-3 space-y-3 bg-gray-50/50 animate-fade-in">
                              <div>
                                <p className="text-[10px] font-semibold text-gray-400 uppercase">Frase</p>
                                <p className="text-sm text-gray-700 italic">&quot;{p.quote}&quot;</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold text-gray-400 uppercase">Historia</p>
                                <p className="text-xs text-gray-700 leading-relaxed">{p.backstory}</p>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {p.tags?.map((t) => (
                                  <span key={t} className="text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{t}</span>
                                ))}
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={(e) => { e.stopPropagation(); generateImage(idx); }}
                                  disabled={p._imageLoading}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-white disabled:opacity-50"
                                >
                                  {p._imageLoading ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12} />}
                                  {p._imageUrl ? "Regenerar imagen" : "Generar imagen"}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Step 4: Saving */}
        {step === "saving" && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center animate-fade-in">
            {savingCount < profiles.length ? (
              <>
                <Loader2 size={48} className="mx-auto text-sidebar animate-spin mb-4" />
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Guardando pacientes...
                </h2>
                <p className="text-sm text-gray-500">
                  {savingCount} de {profiles.length} guardados
                </p>
                <div className="mt-4 h-2 bg-gray-100 rounded-full max-w-xs mx-auto overflow-hidden">
                  <div
                    className="h-full bg-sidebar rounded-full transition-all"
                    style={{ width: `${(savingCount / profiles.length) * 100}%` }}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <Check size={32} className="text-green-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  {savingCount} pacientes guardados
                </h2>
                <p className="text-sm text-gray-500">Redirigiendo a perfiles...</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
