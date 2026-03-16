"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Check,
  User,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  BookOpen,
  Search,
  BarChart3,
  Zap,
} from "lucide-react";
import {
  GENDER_OPTIONS,
  CONTEXT_OPTIONS,
  MOTIVO_OPTIONS,
  ARCHETYPE_OPTIONS,
  PERSONALITY_OPTIONS,
  DEFENSE_OPTIONS,
  OPENNESS_OPTIONS,
  SENSITIVE_TOPICS,
  VARIABILITY_OPTIONS,
  DIFFICULTY_OPTIONS,
  COUNTRY_OPTIONS,
  NARRATIVE_LABELS,
  EXTENDED_NARRATIVE_LABELS,
  type PatientFormData,
  type ShortNarrative,
  type ExtendedNarrative,
  type CoherenceReview,
  type CoherenceItem,
  type Projections,
  type GeneratedSystemPrompt,
} from "@/lib/patient-options";

// Visual phases for the stepper (grouping 15 steps into 6 phases)
const PHASES = [
  { label: "Variables", icon: User, steps: [0] },
  { label: "Relato", icon: BookOpen, steps: [1, 2, 3] },
  { label: "Validacion", icon: Search, steps: [4, 5] },
  { label: "Proyecciones", icon: BarChart3, steps: [6, 7] },
  { label: "System prompt", icon: Zap, steps: [8, 9] },
  { label: "Activar", icon: Check, steps: [10] },
];

const initialForm: PatientFormData = {
  name: "",
  age: 30,
  gender: "",
  occupation: "",
  countries: ["Chile"],
  context: "",
  motivo: "",
  archetype: "",
  personalityTraits: [],
  defenseMechanisms: [],
  openness: "",
  sensitiveTopics: [],
  variability: "",
  difficulty: "",
};

export default function NuevoPerfilPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<PatientFormData>(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1-2: Short narrative
  const [shortNarrative, setShortNarrative] = useState<ShortNarrative | null>(null);

  // Step 3-5: Extended narrative
  const [extendedNarrative, setExtendedNarrative] = useState<ExtendedNarrative | null>(null);

  // Step 4-5: Coherence review
  const [coherenceReview, setCoherenceReview] = useState<CoherenceReview | null>(null);

  // Step 6-7: Projections
  const [projections, setProjections] = useState<Projections | null>(null);

  // Step 8-9: System prompt
  const [generatedPrompt, setGeneratedPrompt] = useState<GeneratedSystemPrompt | null>(null);
  const [editedPrompt, setEditedPrompt] = useState("");

  // Step 10: Media (optional, post-activation)
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  // --- Helpers ---
  function updateForm<K extends keyof PatientFormData>(key: K, value: PatientFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleArrayItem(key: "personalityTraits" | "defenseMechanisms" | "sensitiveTopics", item: string) {
    setForm((prev) => {
      const arr = prev[key];
      return {
        ...prev,
        [key]: arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item],
      };
    });
  }

  function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
  function pickN<T>(arr: T[], min: number, max: number): T[] {
    const n = min + Math.floor(Math.random() * (max - min + 1));
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
  }

  const RANDOM_NAMES_F = ["Valentina Rojas", "Camila Herrera", "Francisca Soto", "Isidora Muñoz", "Antonia Lagos", "Catalina Bravo", "Macarena Fuentes", "Javiera Pizarro", "Paula Contreras", "Daniela Espinoza"];
  const RANDOM_NAMES_M = ["Sebastián Morales", "Martín Cáceres", "Diego Sepúlveda", "Felipe Araya", "Tomás Vergara", "Nicolás Reyes", "Benjamín Tapia", "Matías Olivares", "Joaquín Paredes", "Gabriel Navarro"];
  const RANDOM_OCCUPATIONS = ["Enfermera", "Profesor de colegio", "Abogada", "Ingeniero civil", "Diseñadora gráfica", "Contador", "Trabajadora social", "Estudiante universitario", "Chef", "Periodista", "Arquitecto", "Psicóloga", "Médico", "Comerciante", "Músico", "Obrero de construcción", "Administrativa", "Emprendedora"];

  function generateRandom() {
    const gender = pick(GENDER_OPTIONS);
    const isFem = gender === "Femeniño";
    const name = pick(isFem ? RANDOM_NAMES_F : RANDOM_NAMES_M);
    const age = 18 + Math.floor(Math.random() * 45);

    setForm({
      name,
      age,
      gender,
      occupation: pick(RANDOM_OCCUPATIONS),
      countries: pickN(COUNTRY_OPTIONS, 1, 2),
      context: pick(CONTEXT_OPTIONS),
      motivo: pick(MOTIVO_OPTIONS),
      archetype: pick(ARCHETYPE_OPTIONS).value,
      personalityTraits: pickN(PERSONALITY_OPTIONS, 2, 4),
      defenseMechanisms: pickN(DEFENSE_OPTIONS, 1, 3),
      openness: pick(OPENNESS_OPTIONS),
      sensitiveTopics: pickN(SENSITIVE_TOPICS, 1, 3),
      variability: pick(VARIABILITY_OPTIONS),
      difficulty: pick(DIFFICULTY_OPTIONS).value,
    });
  }

  function isFormValid() {
    return (
      form.name.trim() &&
      form.age > 0 &&
      form.gender &&
      form.occupation.trim() &&
      form.countries.length > 0 &&
      form.context &&
      form.motivo &&
      form.archetype &&
      form.personalityTraits.length >= 2 &&
      form.defenseMechanisms.length >= 1 &&
      form.openness &&
      form.sensitiveTopics.length >= 1 &&
      form.variability &&
      form.difficulty
    );
  }

  // Get current phase index based on step
  function getCurrentPhase(): number {
    for (let i = 0; i < PHASES.length; i++) {
      if (PHASES[i].steps.includes(step)) return i;
    }
    return 0;
  }

  // --- API calls ---

  // Step 0 → 1: Generate short narrative
  async function generateNarrative() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/patients/generate-narrative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error del servidor");
      setShortNarrative(data);
      setStep(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al generar el relato");
    } finally {
      setLoading(false);
    }
  }

  // Step 2 → 3: Generate extended narrative
  async function generateExtendedNarrative() {
    if (!shortNarrative) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/patients/generate-extended-narrative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form, shortNarrative }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error del servidor");
      setExtendedNarrative(data);
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al generar el relato extenso");
    } finally {
      setLoading(false);
    }
  }

  // Step 3 → 4: Review coherence (auto-triggered after extended narrative)
  async function reviewCoherence() {
    if (!shortNarrative || !extendedNarrative) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/patients/review-coherence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form, shortNarrative, extendedNarrative }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error del servidor");
      setCoherenceReview(data);
      setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error en la revision de coherencia");
    } finally {
      setLoading(false);
    }
  }

  // Step 5 → 6: Generate projections
  async function generateProjections() {
    if (!shortNarrative || !extendedNarrative) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/patients/generate-projections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form, shortNarrative, extendedNarrative }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error del servidor");
      setProjections(data);
      setStep(6);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al generar proyecciones");
    } finally {
      setLoading(false);
    }
  }

  // Step 7 → 8: Generate system prompt
  async function generateSystemPrompt() {
    if (!shortNarrative || !extendedNarrative || !projections) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/patients/generate-system-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form, shortNarrative, extendedNarrative, projections }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error del servidor");
      setGeneratedPrompt(data);
      setEditedPrompt(data.system_prompt);
      setStep(8);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al generar el system prompt");
    } finally {
      setLoading(false);
    }
  }

  // Step 9 → 10: Save patient
  async function savePatient() {
    if (!generatedPrompt) return;
    setLoading(true);
    setError(null);
    try {
      const slug = form.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");

      if (generatedImage) {
        await fetch("/api/patients/upload-asset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: generatedImage, slug, type: "image" }),
        }).catch(() => {});
      }

      const body = new FormData();
      body.append(
        "data",
        JSON.stringify({
          name: form.name,
          age: form.age,
          occupation: form.occupation,
          quote: generatedPrompt.quote,
          presenting_problem: generatedPrompt.presenting_problem,
          backstory: generatedPrompt.backstory,
          personality_traits: generatedPrompt.personality_traits,
          system_prompt: editedPrompt,
          difficulty_level: form.difficulty,
          tags: generatedPrompt.tags,
          skills_practiced: generatedPrompt.skills_practiced,
          total_sessions: generatedPrompt.total_sessions,
          country: form.countries,
          country_origin: form.countries[0] || "Chile",
          country_residence: form.countries[0] || "Chile",
          birthday: generatedPrompt.birthday || null,
          neighborhood: generatedPrompt.neighborhood || null,
          family_members: generatedPrompt.family_members || [],
          short_narrative: shortNarrative,
          extended_narrative: extendedNarrative,
          coherence_review: coherenceReview,
          projections,
          creation_step: 11,
        })
      );
      if (videoFile) body.append("video", videoFile);

      const res = await fetch("/api/patients", {
        method: "POST",
        body,
      });
      if (!res.ok) throw new Error("Error al guardar");
      setStep(10);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar el paciente");
    } finally {
      setLoading(false);
    }
  }

  const currentPhase = getCurrentPhase();

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/perfiles" className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Crear paciente</h1>
        </div>

        {/* Phase stepper */}
        <div className="flex items-center gap-2 mb-10">
          {PHASES.map((phase, i) => {
            const PhaseIcon = phase.icon;
            const isComplete = i < currentPhase;
            const isCurrent = i === currentPhase;
            return (
              <div key={phase.label} className="flex items-center gap-2">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                    isComplete
                      ? "bg-green-500 text-white"
                      : isCurrent
                      ? "bg-[#4A55A2] text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {isComplete ? <Check size={14} /> : <PhaseIcon size={16} />}
                </div>
                <span className={`text-sm hidden sm:inline ${isCurrent ? "font-medium text-gray-900" : "text-gray-400"}`}>
                  {phase.label}
                </span>
                {i < PHASES.length - 1 && <div className="w-6 lg:w-12 h-px bg-gray-200" />}
              </div>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        {/* ===================== STEP 0: Variables (Paso 1 - Humano) ===================== */}
        {step === 0 && (
          <div className="space-y-8">
            <div className="flex justify-end">
              <button
                onClick={generateRandom}
                className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
              >
                <RefreshCw size={16} />
                Crear aleatoriamente
              </button>
            </div>

            <Section title="Identidad del paciente">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Input label="Nombre completo" value={form.name} onChange={(v) => updateForm("name", v)} placeholder="Ej: Ana Valdivia" />
                <Input label="Edad" type="number" value={String(form.age)} onChange={(v) => updateForm("age", parseInt(v) || 0)} />
                <Select label="Genero" value={form.gender} options={GENDER_OPTIONS} onChange={(v) => updateForm("gender", v)} />
                <Input label="Ocupacion" value={form.occupation} onChange={(v) => updateForm("occupation", v)} placeholder="Ej: Enfermera" />
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Paises (puede elegir mas de uno)</label>
                <div className="flex flex-wrap gap-2">
                  {COUNTRY_OPTIONS.map((c) => {
                    const selected = form.countries.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          const next = selected
                            ? form.countries.filter((x) => x !== c)
                            : [...form.countries, c];
                          updateForm("countries", next.length > 0 ? next : [c]);
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                          selected
                            ? "bg-sidebar text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <Select label="Contexto sociocultural" value={form.context} options={CONTEXT_OPTIONS} onChange={(v) => updateForm("context", v)} />
                <Select label="Motivo de consulta" value={form.motivo} options={MOTIVO_OPTIONS} onChange={(v) => updateForm("motivo", v)} />
              </div>
            </Section>

            <Section title="Arquetipo clinico">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {ARCHETYPE_OPTIONS.map((a) => (
                  <button
                    key={a.value}
                    type="button"
                    onClick={() => updateForm("archetype", a.value)}
                    className={`text-left p-3 rounded-lg border-2 transition-all ${
                      form.archetype === a.value
                        ? "border-[#4A55A2] bg-[#4A55A2]/5"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <p className="font-medium text-sm text-gray-900">{a.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{a.description}</p>
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Rasgos de personalidad" subtitle="Selecciona 2 o mas">
              <ChipGrid options={PERSONALITY_OPTIONS} selected={form.personalityTraits} onToggle={(v) => toggleArrayItem("personalityTraits", v)} />
            </Section>

            <Section title="Mecanismos de defensa" subtitle="Selecciona 1 o mas">
              <ChipGrid options={DEFENSE_OPTIONS} selected={form.defenseMechanisms} onToggle={(v) => toggleArrayItem("defenseMechanisms", v)} />
            </Section>

            <Section title="Temas sensibles" subtitle="Selecciona 1 o mas">
              <ChipGrid options={SENSITIVE_TOPICS} selected={form.sensitiveTopics} onToggle={(v) => toggleArrayItem("sensitiveTopics", v)} />
            </Section>

            <Section title="Configuracion de sesion">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select label="Nivel de apertura inicial" value={form.openness} options={OPENNESS_OPTIONS} onChange={(v) => updateForm("openness", v)} />
                <Select label="Variabilidad emocional" value={form.variability} options={VARIABILITY_OPTIONS} onChange={(v) => updateForm("variability", v)} />
                <Select
                  label="Dificultad clinica"
                  value={form.difficulty}
                  options={DIFFICULTY_OPTIONS.map((d) => d.value)}
                  displayOptions={DIFFICULTY_OPTIONS.map((d) => d.label)}
                  onChange={(v) => updateForm("difficulty", v)}
                />
              </div>
            </Section>

            <div className="flex justify-end pt-4">
              <button
                onClick={generateNarrative}
                disabled={!isFormValid() || loading}
                className="flex items-center gap-2 bg-[#4A55A2] text-white px-6 py-3 rounded-lg hover:bg-[#3D4890] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                Generar relato
              </button>
            </div>
          </div>
        )}

        {/* ===================== STEP 1: Short narrative preview (Paso 2 - IA genera) ===================== */}
        {step === 1 && shortNarrative && (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
              La IA genero un relato estructurado corto. Revisa cada seccion y edita lo que necesites antes de continuar.
            </div>

            {(Object.keys(NARRATIVE_LABELS) as Array<keyof ShortNarrative>).map((key) => (
              <div key={key} className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 text-sm">{NARRATIVE_LABELS[key]}</h3>
                </div>
                <textarea
                  value={shortNarrative[key]}
                  onChange={(e) =>
                    setShortNarrative((prev) => prev ? { ...prev, [key]: e.target.value } : prev)
                  }
                  rows={4}
                  className="w-full border border-gray-200 rounded-lg p-3 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-[#4A55A2]/20 focus:border-[#4A55A2]"
                />
              </div>
            ))}

            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(0)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
                <ArrowLeft size={18} /> Volver a variables
              </button>
              <div className="flex gap-3">
                <button
                  onClick={generateNarrative}
                  disabled={loading}
                  className="flex items-center gap-2 border border-[#4A55A2] text-[#4A55A2] px-4 py-2.5 rounded-lg hover:bg-[#4A55A2]/5 disabled:opacity-50 transition-colors text-sm font-medium"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  Regenerar relato
                </button>
                <button
                  onClick={() => setStep(2)}
                  className="flex items-center gap-2 bg-[#4A55A2] text-white px-6 py-2.5 rounded-lg hover:bg-[#3D4890] transition-colors font-medium"
                >
                  Validar y continuar <ArrowRight size={18} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===================== STEP 2: Confirm short narrative → generate extended (Paso 3-4) ===================== */}
        {step === 2 && shortNarrative && (
          <div className="space-y-6">
            <Section title="Relato corto validado">
              <div className="space-y-3">
                {(Object.keys(NARRATIVE_LABELS) as Array<keyof ShortNarrative>).map((key) => (
                  <div key={key}>
                    <p className="text-xs font-medium text-gray-500 mb-1">{NARRATIVE_LABELS[key]}</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{shortNarrative[key]}</p>
                  </div>
                ))}
              </div>
            </Section>

            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
              Al continuar, la IA generara un relato extenso (~10 paginas) a partir del relato corto validado. Este proceso puede tomar 30-60 segundos.
            </div>

            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(1)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
                <ArrowLeft size={18} /> Editar relato corto
              </button>
              <button
                onClick={generateExtendedNarrative}
                disabled={loading}
                className="flex items-center gap-2 bg-[#4A55A2] text-white px-6 py-3 rounded-lg hover:bg-[#3D4890] disabled:opacity-50 transition-colors font-medium"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <BookOpen size={18} />}
                {loading ? "Generando relato extenso..." : "Generar relato extenso"}
              </button>
            </div>
          </div>
        )}

        {/* ===================== STEP 3: Extended narrative preview + edit (Paso 4) ===================== */}
        {step === 3 && extendedNarrative && (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
              Relato extenso generado. Revisa y edita cada seccion. Luego la IA revisara la coherencia.
            </div>

            {(Object.keys(EXTENDED_NARRATIVE_LABELS) as Array<keyof ExtendedNarrative>).map((key) => (
              <div key={key} className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-gray-900 text-sm mb-3">{EXTENDED_NARRATIVE_LABELS[key]}</h3>
                <textarea
                  value={extendedNarrative[key]}
                  onChange={(e) =>
                    setExtendedNarrative((prev) => prev ? { ...prev, [key]: e.target.value } : prev)
                  }
                  rows={8}
                  className="w-full border border-gray-200 rounded-lg p-3 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-[#4A55A2]/20 focus:border-[#4A55A2]"
                />
                <p className="text-xs text-gray-400 mt-1">{extendedNarrative[key].length} caracteres</p>
              </div>
            ))}

            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(2)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
                <ArrowLeft size={18} /> Volver
              </button>
              <div className="flex gap-3">
                <button
                  onClick={generateExtendedNarrative}
                  disabled={loading}
                  className="flex items-center gap-2 border border-[#4A55A2] text-[#4A55A2] px-4 py-2.5 rounded-lg hover:bg-[#4A55A2]/5 disabled:opacity-50 transition-colors text-sm font-medium"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  Regenerar
                </button>
                <button
                  onClick={reviewCoherence}
                  disabled={loading}
                  className="flex items-center gap-2 bg-[#4A55A2] text-white px-6 py-2.5 rounded-lg hover:bg-[#3D4890] disabled:opacity-50 transition-colors font-medium"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                  {loading ? "Revisando coherencia..." : "Revisar coherencia"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===================== STEP 4: Coherence review results (Paso 5) ===================== */}
        {step === 4 && coherenceReview && extendedNarrative && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-4">Revision de coherencia</h3>
              <p className="text-sm text-gray-700 mb-6 leading-relaxed">{coherenceReview.summary}</p>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {coherenceReview.items.filter((i) => i.severity === "ok").length}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Coherente</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-amber-600">
                    {coherenceReview.items.filter((i) => i.severity === "sugerencia").length}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Sugerencias</p>
                </div>
                <div className="bg-red-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-red-600">
                    {coherenceReview.items.filter((i) => i.severity === "critica").length}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Criticas</p>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-2">
                {coherenceReview.items.map((item, i) => (
                  <CoherenceItemCard key={i} item={item} />
                ))}
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(3)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
                <ArrowLeft size={18} /> Editar relato extenso
              </button>
              <div className="flex gap-3">
                <button
                  onClick={reviewCoherence}
                  disabled={loading}
                  className="flex items-center gap-2 border border-[#4A55A2] text-[#4A55A2] px-4 py-2.5 rounded-lg hover:bg-[#4A55A2]/5 disabled:opacity-50 transition-colors text-sm font-medium"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  Re-evaluar
                </button>
                <button
                  onClick={() => setStep(5)}
                  className="flex items-center gap-2 bg-[#4A55A2] text-white px-6 py-2.5 rounded-lg hover:bg-[#3D4890] transition-colors font-medium"
                >
                  Validar y continuar <ArrowRight size={18} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===================== STEP 5: Confirm → Generate projections (Paso 6-7) ===================== */}
        {step === 5 && (
          <div className="space-y-6">
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
              Al continuar, la IA generara 3 proyecciones paralelas de 8 sesiones cada una (principiante, intermedio, experto). Este proceso puede tomar 30-60 segundos.
            </div>

            <Section title="Que se evaluara">
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
                  Coherencia del paciente a lo largo de 8 sesiones
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
                  Evolucion o involucion segun el nivel del estudiante
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
                  Mantenimiento de personalidad y patologia
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
                  Alianza terapeutica, sintomas y resistencia por sesion
                </li>
              </ul>
            </Section>

            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(4)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
                <ArrowLeft size={18} /> Volver a coherencia
              </button>
              <button
                onClick={generateProjections}
                disabled={loading}
                className="flex items-center gap-2 bg-[#4A55A2] text-white px-6 py-3 rounded-lg hover:bg-[#3D4890] disabled:opacity-50 transition-colors font-medium"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <BarChart3 size={18} />}
                {loading ? "Generando proyecciones..." : "Generar proyecciones"}
              </button>
            </div>
          </div>
        )}

        {/* ===================== STEP 6: Projections results (Paso 7-8) ===================== */}
        {step === 6 && projections && (
          <ProjectionsView
            projections={projections}
            onBack={() => setStep(5)}
            onContinue={() => setStep(7)}
            onRegenerate={generateProjections}
            loading={loading}
          />
        )}

        {/* ===================== STEP 7: Confirm → Generate system prompt (Paso 8-9) ===================== */}
        {step === 7 && (
          <div className="space-y-6">
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
              Al continuar, la IA generara el system prompt optimizado para sesiones, basandose en todo el material validado (relato, coherencia, proyecciones).
            </div>

            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(6)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
                <ArrowLeft size={18} /> Volver a proyecciones
              </button>
              <button
                onClick={generateSystemPrompt}
                disabled={loading}
                className="flex items-center gap-2 bg-[#4A55A2] text-white px-6 py-3 rounded-lg hover:bg-[#3D4890] disabled:opacity-50 transition-colors font-medium"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
                {loading ? "Generando system prompt..." : "Generar system prompt"}
              </button>
            </div>
          </div>
        )}

        {/* ===================== STEP 8: System prompt editor (Paso 9-10) ===================== */}
        {step === 8 && generatedPrompt && (
          <div className="space-y-6">
            {/* Patient card preview */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-4">Vista previa del paciente</h3>
              <div className="flex items-start gap-6">
                <div className="w-16 h-16 rounded-full bg-[#4A55A2] flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-lg font-bold">
                    {form.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-lg font-bold text-gray-900">{form.name}</h4>
                  <p className="text-sm text-gray-500">{form.age} anos &middot; {form.occupation}</p>
                  <p className="text-sm text-gray-600 italic mt-1">&ldquo;{generatedPrompt.quote}&rdquo;</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {generatedPrompt.tags.map((tag) => (
                      <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Profile validator */}
            <ProfileValidator form={form} systemPrompt={editedPrompt} />

            {/* System prompt editor */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">System prompt</h3>
                <button
                  onClick={generateSystemPrompt}
                  disabled={loading}
                  className="flex items-center gap-1.5 text-sm text-[#4A55A2] hover:underline"
                >
                  <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                  Regenerar
                </button>
              </div>
              <textarea
                value={editedPrompt}
                onChange={(e) => setEditedPrompt(e.target.value)}
                rows={20}
                className="w-full border border-gray-200 rounded-lg p-4 text-sm font-mono leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-[#4A55A2]/20 focus:border-[#4A55A2]"
              />
              <p className="text-xs text-gray-400 mt-2">{editedPrompt.length} caracteres</p>
            </div>

            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(7)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
                <ArrowLeft size={18} /> Volver
              </button>
              <button
                onClick={() => setStep(9)}
                className="flex items-center gap-2 bg-[#4A55A2] text-white px-6 py-2.5 rounded-lg hover:bg-[#3D4890] transition-colors font-medium"
              >
                Continuar a guardar <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ===================== STEP 9: Save + activate (Paso 11) ===================== */}
        {step === 9 && generatedPrompt && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-4">Resumen del paciente</h3>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <dt className="text-gray-500">Nombre</dt>
                <dd className="text-gray-900 font-medium">{form.name}</dd>
                <dt className="text-gray-500">Edad</dt>
                <dd className="text-gray-900">{form.age} anos</dd>
                <dt className="text-gray-500">Ocupacion</dt>
                <dd className="text-gray-900">{form.occupation}</dd>
                <dt className="text-gray-500">Dificultad</dt>
                <dd className="text-gray-900">{DIFFICULTY_OPTIONS.find((d) => d.value === form.difficulty)?.label}</dd>
                <dt className="text-gray-500">Quote</dt>
                <dd className="text-gray-900 italic">&ldquo;{generatedPrompt.quote}&rdquo;</dd>
                <dt className="text-gray-500">Tags</dt>
                <dd className="text-gray-900">{generatedPrompt.tags.join(", ")}</dd>
                <dt className="text-gray-500">Habilidades</dt>
                <dd className="text-gray-900">{generatedPrompt.skills_practiced.join(", ")}</dd>
                <dt className="text-gray-500">Sesiones</dt>
                <dd className="text-gray-900">{generatedPrompt.total_sessions}</dd>
              </dl>
            </div>

            {/* Checklist */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-4">Checklist de creacion</h3>
              <div className="space-y-2">
                {[
                  { label: "Variables ingresadas", done: true },
                  { label: "Relato corto validado", done: !!shortNarrative },
                  { label: "Relato extenso generado", done: !!extendedNarrative },
                  { label: "Coherencia revisada", done: !!coherenceReview },
                  { label: "Proyecciones generadas", done: !!projections },
                  { label: "System prompt generado", done: !!generatedPrompt },
                ].map((item, i) => (
                  <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${item.done ? "bg-green-50" : "bg-gray-50"}`}>
                    {item.done ? <CheckCircle2 size={16} className="text-green-500" /> : <XCircle size={16} className="text-gray-300" />}
                    <span className={item.done ? "text-green-800" : "text-gray-400"}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Save */}
            <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-green-800">Activar paciente</p>
                  <p className="text-xs text-green-600 mt-0.5">El paciente quedara activo para sesiones. Imagen y video se pueden agregar despues.</p>
                </div>
                <button
                  onClick={savePatient}
                  disabled={loading}
                  className="flex items-center gap-2 bg-green-600 text-white px-8 py-3 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors font-bold text-base shadow-md"
                >
                  {loading ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
                  Guardar y activar
                </button>
              </div>
            </div>

            <div className="flex justify-start pt-2">
              <button onClick={() => setStep(8)} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors text-sm">
                <ArrowLeft size={16} /> Volver al system prompt
              </button>
            </div>
          </div>
        )}

        {/* ===================== STEP 10: Success + optional media (Pasos 12-15) ===================== */}
        {step === 10 && (
          <div className="space-y-6">
            <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-8 text-center">
              <CheckCircle2 size={48} className="text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-green-800 mb-2">Paciente activado</h2>
              <p className="text-sm text-green-600">
                {form.name} ya esta disponible para sesiones de practica.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-2">Opcional: agregar imagen y video</h3>
              <p className="text-sm text-gray-500 mb-4">Puedes agregar imagen y video desde la ficha del paciente en cualquier momento.</p>
              <div className="flex gap-3">
                <Link
                  href="/perfiles"
                  className="flex items-center gap-2 bg-[#4A55A2] text-white px-6 py-3 rounded-lg hover:bg-[#3D4890] transition-colors font-medium"
                >
                  Ver todos los pacientes
                </Link>
                <button
                  onClick={() => router.push("/perfiles")}
                  className="flex items-center gap-2 border border-gray-200 text-gray-600 px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Crear otro paciente
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Projections View Component ---

function ProjectionsView({
  projections,
  onBack,
  onContinue,
  onRegenerate,
  loading,
}: {
  projections: Projections;
  onBack: () => void;
  onContinue: () => void;
  onRegenerate: () => void;
  loading: boolean;
}) {
  const [activeTab, setActiveTab] = useState<"principiante" | "intermedio" | "experto">("principiante");
  const tabs = [
    { key: "principiante" as const, label: "Principiante", color: "bg-blue-500" },
    { key: "intermedio" as const, label: "Intermedio", color: "bg-amber-500" },
    { key: "experto" as const, label: "Experto", color: "bg-green-500" },
  ];

  const projection = projections[activeTab];

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-[#4A55A2] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Scores */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm text-center">
          <p className={`text-3xl font-bold ${projection.coherence_score >= 7 ? "text-green-600" : "text-amber-600"}`}>
            {projection.coherence_score}/10
          </p>
          <p className="text-xs text-gray-500 mt-1">Coherencia</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm text-center">
          <p className={`text-3xl font-bold ${projection.evolution_score >= 7 ? "text-green-600" : projection.evolution_score >= 4 ? "text-amber-600" : "text-red-600"}`}>
            {projection.evolution_score}/10
          </p>
          <p className="text-xs text-gray-500 mt-1">Evolucion</p>
        </div>
      </div>

      {/* Overall assessment */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="font-semibold text-gray-900 mb-2">Evaluacion general</h3>
        <p className="text-sm text-gray-700 leading-relaxed">{projection.overall_assessment}</p>
      </div>

      {/* Sessions timeline */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="font-semibold text-gray-900 mb-4">Proyeccion de 8 sesiones</h3>
        <div className="space-y-4">
          {projection.sessions.map((session) => (
            <div key={session.session_number} className="border border-gray-100 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900">Sesion {session.session_number}</span>
                <div className="flex gap-3 text-xs">
                  <span className="text-blue-600">Alianza: {session.alliance}/10</span>
                  <span className="text-red-600">Sintomas: {session.symptoms}/10</span>
                  <span className="text-amber-600">Resistencia: {session.resistance}/10</span>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-1">{session.summary}</p>
              <p className="text-xs text-[#4A55A2] italic">Momento clave: {session.key_moment}</p>

              {/* Mini bar chart */}
              <div className="flex gap-1 mt-2">
                <div className="h-1.5 rounded-full bg-blue-400" style={{ width: `${session.alliance * 10}%` }} title="Alianza" />
                <div className="h-1.5 rounded-full bg-red-400" style={{ width: `${session.symptoms * 10}%` }} title="Sintomas" />
                <div className="h-1.5 rounded-full bg-amber-400" style={{ width: `${session.resistance * 10}%` }} title="Resistencia" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
          <ArrowLeft size={18} /> Volver
        </button>
        <div className="flex gap-3">
          <button
            onClick={onRegenerate}
            disabled={loading}
            className="flex items-center gap-2 border border-[#4A55A2] text-[#4A55A2] px-4 py-2.5 rounded-lg hover:bg-[#4A55A2]/5 disabled:opacity-50 transition-colors text-sm font-medium"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Regenerar
          </button>
          <button
            onClick={onContinue}
            className="flex items-center gap-2 bg-[#4A55A2] text-white px-6 py-2.5 rounded-lg hover:bg-[#3D4890] transition-colors font-medium"
          >
            Continuar <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Coherence Item Card ---

function CoherenceItemCard({ item }: { item: CoherenceItem }) {
  const config = {
    critica: { bg: "bg-red-50", border: "border-red-200", icon: <XCircle size={16} className="text-red-500" />, label: "Critica", labelColor: "text-red-700" },
    sugerencia: { bg: "bg-amber-50", border: "border-amber-200", icon: <AlertTriangle size={16} className="text-amber-500" />, label: "Sugerencia", labelColor: "text-amber-700" },
    ok: { bg: "bg-green-50", border: "border-green-200", icon: <CheckCircle2 size={16} className="text-green-500" />, label: "OK", labelColor: "text-green-700" },
  };
  const c = config[item.severity];

  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-lg border ${c.bg} ${c.border}`}>
      <div className="mt-0.5 flex-shrink-0">{c.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs font-medium ${c.labelColor}`}>{c.label}</span>
          <span className="text-xs text-gray-400">{item.type === "interna" ? "Coherencia interna" : "Coherencia clinica"}</span>
          <span className="text-xs text-gray-300">{item.section}</span>
        </div>
        <p className="text-sm text-gray-700">{item.message}</p>
      </div>
    </div>
  );
}

// --- Reusable UI pieces ---

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
      {subtitle && <p className="text-sm text-gray-400 mb-4">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {children}
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A55A2]/20 focus:border-[#4A55A2]"
      />
    </div>
  );
}

function Select({
  label,
  value,
  options,
  displayOptions,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  displayOptions?: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A55A2]/20 focus:border-[#4A55A2] bg-white"
      >
        <option value="">Seleccionar...</option>
        {options.map((opt, i) => (
          <option key={opt} value={opt}>
            {displayOptions ? displayOptions[i] : opt}
          </option>
        ))}
      </select>
    </div>
  );
}

function ChipGrid({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onToggle(opt)}
          className={`px-3 py-1.5 rounded-full text-sm transition-all ${
            selected.includes(opt)
              ? "bg-[#4A55A2] text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function ProfileValidator({ form, systemPrompt }: { form: PatientFormData; systemPrompt: string }) {
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    checks: { label: string; pass: boolean; detail: string }[];
    suggestion: string;
  } | null>(null);

  const runLocalChecks = () => {
    const prompt = systemPrompt.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const checks: { label: string; pass: boolean; detail: string }[] = [];

    checks.push({
      label: "Nombre del paciente",
      pass: prompt.includes(normalize(form.name.split(" ")[0])),
      detail: form.name,
    });

    checks.push({
      label: "Edad mencionada",
      pass: prompt.includes(String(form.age)),
      detail: `${form.age} anos`,
    });

    checks.push({
      label: "Ocupacion",
      pass: prompt.includes(normalize(form.occupation).slice(0, 5)),
      detail: form.occupation,
    });

    checks.push({
      label: "Motivo de consulta",
      pass: normalize(form.motivo).split(" ").some((w) => w.length > 4 && prompt.includes(w)),
      detail: form.motivo,
    });

    const traitMatches = form.personalityTraits.filter((t) => prompt.includes(normalize(t).slice(0, 6)));
    checks.push({
      label: "Rasgos de personalidad",
      pass: traitMatches.length >= Math.ceil(form.personalityTraits.length * 0.5),
      detail: `${traitMatches.length}/${form.personalityTraits.length}: ${form.personalityTraits.join(", ")}`,
    });

    const defenseMatches = form.defenseMechanisms.filter((d) => prompt.includes(normalize(d).slice(0, 6)));
    checks.push({
      label: "Mecanismos de defensa",
      pass: defenseMatches.length >= 1,
      detail: `${defenseMatches.length}/${form.defenseMechanisms.length}: ${form.defenseMechanisms.join(", ")}`,
    });

    const topicMatches = form.sensitiveTopics.filter((t) => prompt.includes(normalize(t).slice(0, 5)));
    checks.push({
      label: "Temas sensibles",
      pass: topicMatches.length >= 1,
      detail: `${topicMatches.length}/${form.sensitiveTopics.length}: ${form.sensitiveTopics.join(", ")}`,
    });

    checks.push({
      label: "Extension del prompt",
      pass: systemPrompt.length >= 500,
      detail: `${systemPrompt.length} caracteres (min. 500)`,
    });

    const therapistPhrases = ["estoy aqui para escucharte", "puedes compartir", "como te sientes"];
    const hasTherapist = therapistPhrases.some((p) => prompt.includes(p));
    checks.push({
      label: "Sin lenguaje de terapeuta",
      pass: !hasTherapist,
      detail: hasTherapist ? "Contiene frases de terapeuta" : "OK",
    });

    checks.push({
      label: "Reglas de comportamiento",
      pass: prompt.includes("regla") || prompt.includes("nunca") || prompt.includes("no digas") || prompt.includes("no salgas"),
      detail: "Debe incluir reglas claras",
    });

    return checks;
  };

  const handleValidate = async () => {
    const localChecks = runLocalChecks();

    const structuralRules = [
      { label: "Secciones (HISTORIA, PERSONALIDAD, etc.)", pass: ["HISTORIA:", "PERSONALIDAD:", "COMPORTAMIENTO", "REGLAS:"].filter(s => systemPrompt.includes(s)).length >= 3, detail: "" },
      { label: "Bullets (-) en vez de texto corrido", pass: (systemPrompt.match(/^- /gm) || []).length >= 5, detail: `${(systemPrompt.match(/^- /gm) || []).length} bullets encontrados` },
      { label: "Corchetes para no verbal [...]", pass: /\[.+\]/.test(systemPrompt), detail: /\[.+\]/.test(systemPrompt) ? "Correcto" : "Falta: [suspira], [mira al suelo]" },
      { label: "Regla anti-repeticion", pass: systemPrompt.toLowerCase().includes("nunca repitas"), detail: "" },
      { label: "Limite 1-4 oraciones", pass: /1-4 oraciones|maximo.*oracion/i.test(systemPrompt), detail: "" },
      { label: "Apertura gradual", pass: /gradual|progresiv|poco a poco|eventualmente|con el tiempo/i.test(systemPrompt), detail: "" },
    ];

    const allChecks = [...localChecks, ...structuralRules];
    const passCount = allChecks.filter((c) => c.pass).length;
    const score = Math.round((passCount / allChecks.length) * 100);
    setResult({ score, checks: allChecks, suggestion: "" });

    setValidating(true);
    try {
      const res = await fetch("/api/patients/validate-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form, systemPrompt }),
      });
      if (res.ok) {
        const data = await res.json();
        setResult({ score, checks: allChecks, suggestion: data.suggestion || "" });
      }
    } catch { /* keep local */ }
    setValidating(false);
  };

  const scoreColor = (result?.score || 0) >= 80 ? "text-green-600" : (result?.score || 0) >= 60 ? "text-amber-600" : "text-red-600";
  const scoreBg = (result?.score || 0) >= 80 ? "bg-green-50 border-green-200" : (result?.score || 0) >= 60 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-sidebar" />
          <h3 className="font-semibold text-gray-900">Validador de robustez</h3>
        </div>
        <button onClick={handleValidate} disabled={validating}
          className="flex items-center gap-1.5 text-sm border border-sidebar text-sidebar px-4 py-2 rounded-lg font-medium hover:bg-sidebar/5 transition-colors disabled:opacity-50">
          {validating ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
          {validating ? "Validando..." : result ? "Revalidar" : "Validar perfil"}
        </button>
      </div>

      {!result && (
        <p className="text-xs text-gray-400 text-center py-4">
          Verifica que el system prompt sea coherente con todas las variables configuradas.
        </p>
      )}

      {result && (
        <div className="space-y-4 animate-fade-in">
          <div className={`flex items-center justify-between rounded-xl border p-4 ${scoreBg}`}>
            <div className="flex items-center gap-3">
              {result.score >= 80 ? <CheckCircle2 size={24} className="text-green-500" /> :
               result.score >= 60 ? <AlertTriangle size={24} className="text-amber-500" /> :
               <XCircle size={24} className="text-red-500" />}
              <div>
                <p className={`text-2xl font-bold ${scoreColor}`}>{result.score}%</p>
                <p className="text-xs text-gray-500">
                  {result.score >= 80 ? "Perfil robusto" : result.score >= 60 ? "Aceptable con mejoras" : "Necesita ajustes"}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-400">{result.checks.filter((c) => c.pass).length}/{result.checks.length}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {result.checks.map((check, i) => (
              <div key={i} className={`flex items-start gap-2 px-3 py-2 rounded-lg text-xs ${check.pass ? "bg-green-50" : "bg-red-50"}`}>
                {check.pass ? <CheckCircle2 size={14} className="text-green-500 mt-0.5 flex-shrink-0" />
                            : <XCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />}
                <div>
                  <p className={`font-medium ${check.pass ? "text-green-800" : "text-red-800"}`}>{check.label}</p>
                  <p className={check.pass ? "text-green-600" : "text-red-600"}>{check.detail}</p>
                </div>
              </div>
            ))}
          </div>

          {validating && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Loader2 size={12} className="animate-spin" /> Analizando coherencia con IA...
            </div>
          )}
          {result.suggestion && (
            <div className="bg-sidebar/5 rounded-xl p-4 border border-sidebar/10">
              <p className="text-xs font-semibold text-sidebar mb-1.5">Analisis de la IA</p>
              <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line">{result.suggestion}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
