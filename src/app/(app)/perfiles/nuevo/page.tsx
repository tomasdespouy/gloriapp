"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Check,
  Upload,
  RefreshCw,
  User,
  ImageIcon,
  Download,
  Video,
  Play,
  MessageCircle,
  FileText,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Brain,
  Sparkles,
  Terminal,
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
  NARRATIVE_SECTIONS,
  EXTENDED_SECTIONS,
  type PatientFormData,
  type GeneratedProfile,
  type TestResult,
  type ShortNarrative,
  type ExtendedNarrative,
  type CoherenceReview,
  type Projections,
  type LevelProjection,
} from "@/lib/patient-options";

// ══════════════════════════════════════════
// PHASES & STEPS
// ══════════════════════════════════════════

const PHASES = ["Variables", "Relato", "Validación", "Proyecciones", "System Prompt", "Activar"];

function getPhaseForStep(step: number): number {
  if (step === 0) return 0;
  if (step >= 1 && step <= 3) return 1;
  if (step >= 4 && step <= 5) return 2;
  if (step >= 6 && step <= 7) return 3;
  if (step >= 8 && step <= 9) return 4;
  return 5; // steps 10-14
}

// ══════════════════════════════════════════
// INITIAL STATE
// ══════════════════════════════════════════

const initialForm: PatientFormData = {
  name: "",
  age: 30,
  gender: "",
  occupation: "",
  countries: ["Chile"],
  countryOrigin: "Chile",
  countryResidence: "Chile",
  enabledCountries: ["Chile"],
  context: "",
  motivo: "",
  archetype: "",
  personalityTraits: [],
  defenseMechanisms: [],
  openness: "",
  sensitiveTopics: [],
  variability: "",
  difficulty: "",
  distinctiveFactor: "",
};

// ══════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════

export default function NuevoPerfilPage() {
  const router = useRouter();

  // Navigation
  const [step, setStep] = useState(0);

  // Phase 1 - Variables
  const [form, setForm] = useState<PatientFormData>(initialForm);

  // Phase 2 - Relato
  const [shortNarrative, setShortNarrative] = useState<ShortNarrative | null>(null);
  const [editedShortNarrative, setEditedShortNarrative] = useState<ShortNarrative | null>(null);
  const [extendedNarrative, setExtendedNarrative] = useState<ExtendedNarrative | null>(null);

  // Phase 3 - Validacion
  const [coherenceReview, setCoherenceReview] = useState<CoherenceReview | null>(null);

  // Phase 4 - Proyecciones
  const [projections, setProjections] = useState<Projections | null>(null);
  const [activeProjectionTab, setActiveProjectionTab] = useState<"principiante" | "intermedio" | "experto">("principiante");

  // Phase 5 - System Prompt
  const [systemPrompt, setSystemPrompt] = useState("");
  const [designNotes, setDesignNotes] = useState<string[]>([]);

  // Phase 6 - Activar
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageLoading, setImageLoading] = useState(false);
  const [savedPatientId, setSavedPatientId] = useState<string | null>(null);

  // Global
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Helpers ──

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

  const RANDOM_NAMES_F = ["Valentina Rojas", "Camila Herrera", "Francisca Soto", "Isidora Munoz", "Antonia Lagos", "Catalina Bravo", "Macarena Fuentes", "Javiera Pizarro", "Paula Contreras", "Daniela Espinoza"];
  const RANDOM_NAMES_M = ["Sebastian Morales", "Martin Caceres", "Diego Sepulveda", "Felipe Araya", "Tomas Vergara", "Nicolas Reyes", "Benjamin Tapia", "Matias Olivares", "Joaquin Paredes", "Gabriel Navarro"];
  const RANDOM_OCCUPATIONS = ["Enfermera", "Profesor de colegio", "Abogada", "Ingeniero civil", "Disenadora grafica", "Contador", "Trabajadora social", "Estudiante universitario", "Chef", "Periodista", "Arquitecto", "Psicologa", "Medico", "Comerciante", "Musico", "Obrero de construccion", "Administrativa", "Emprendedora"];

  function generateRandom() {
    const gender = pick(GENDER_OPTIONS);
    const isFem = gender === "Femeniño";
    const name = pick(isFem ? RANDOM_NAMES_F : RANDOM_NAMES_M);
    const age = 18 + Math.floor(Math.random() * 45);
    const origin = pick(COUNTRY_OPTIONS);
    const residence = Math.random() > 0.3 ? origin : pick(COUNTRY_OPTIONS);
    const enabled = pickN(COUNTRY_OPTIONS, 1, 3);
    if (!enabled.includes(residence)) enabled.push(residence);

    setForm({
      name,
      age,
      gender,
      occupation: pick(RANDOM_OCCUPATIONS),
      countries: enabled,
      countryOrigin: origin,
      countryResidence: residence,
      enabledCountries: enabled,
      context: pick(CONTEXT_OPTIONS),
      motivo: pick(MOTIVO_OPTIONS),
      archetype: pick(ARCHETYPE_OPTIONS).value,
      personalityTraits: pickN(PERSONALITY_OPTIONS, 2, 4),
      defenseMechanisms: pickN(DEFENSE_OPTIONS, 1, 3),
      openness: pick(OPENNESS_OPTIONS),
      sensitiveTopics: pickN(SENSITIVE_TOPICS, 1, 3),
      variability: pick(VARIABILITY_OPTIONS),
      difficulty: pick(DIFFICULTY_OPTIONS).value,
      distinctiveFactor: "",
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

  // ── API Calls ──

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
      setEditedShortNarrative(data);
      setStep(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al generar el relato");
    } finally {
      setLoading(false);
    }
  }

  // Step 2 → 3: Generate extended narrative
  async function generateExtendedNarrative() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/patients/generate-extended-narrative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form, shortNarrative: editedShortNarrative }),
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

  // Step 3 → 4: Review coherence
  async function reviewCoherence() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/patients/review-coherence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form, shortNarrative: editedShortNarrative, extendedNarrative }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error del servidor");
      setCoherenceReview(data);
      setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al validar coherencia");
    } finally {
      setLoading(false);
    }
  }

  // Step 5 → 6: Generate projections
  async function generateProjections() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/patients/generate-projections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form, shortNarrative: editedShortNarrative, extendedNarrative }),
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
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/patients/generate-system-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form, shortNarrative: editedShortNarrative, extendedNarrative, projections }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error del servidor");
      setSystemPrompt(data.system_prompt);
      setDesignNotes(data.design_notes || []);
      setStep(8);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al generar system prompt");
    } finally {
      setLoading(false);
    }
  }

  // Step 9 → 10: Save patient
  async function savePatient() {
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

      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          age: form.age,
          occupation: form.occupation,
          system_prompt: systemPrompt,
          difficulty_level: form.difficulty,
          country: form.enabledCountries,
          country_origin: form.countryOrigin || form.enabledCountries[0] || "Chile",
          country_residence: form.countryResidence || form.enabledCountries[0] || "Chile",
          short_narrative: editedShortNarrative,
          extended_narrative: extendedNarrative,
          coherence_review: coherenceReview,
          projections,
          design_notes: designNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");
      setSavedPatientId(data.id || "saved");
      setStep(10);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar el paciente");
    } finally {
      setLoading(false);
    }
  }

  // ── Current phase ──
  const currentPhase = getPhaseForStep(step);

  // ══════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/perfiles" className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Crear paciente</h1>
          <span className="text-xs text-gray-400 ml-auto">Paso {step + 1} de 15</span>
        </div>

        {/* Phase Stepper */}
        <div className="flex items-center gap-2 mb-10">
          {PHASES.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  i < currentPhase
                    ? "bg-green-500 text-white"
                    : i === currentPhase
                    ? "bg-[#4A55A2] text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {i < currentPhase ? <Check size={14} /> : i + 1}
              </div>
              <span className={`text-sm hidden sm:inline ${i === currentPhase ? "font-medium text-gray-900" : "text-gray-400"}`}>
                {label}
              </span>
              {i < PHASES.length - 1 && <div className="w-6 lg:w-12 h-px bg-gray-200" />}
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* PHASE 1: VARIABLES (Step 0)                */}
        {/* ═══════════════════════════════════════════ */}
        {step === 0 && (
          <div className="space-y-8">
            {/* Random button */}
            <div className="flex justify-end">
              <button
                onClick={generateRandom}
                className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
              >
                <RefreshCw size={16} />
                Crear aleatoriamente
              </button>
            </div>

            {/* Identidad */}
            <Section title="Identidad del paciente">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Input label="Nombre completo" value={form.name} onChange={(v) => updateForm("name", v)} placeholder="Ej: Ana Valdivia" />
                <Input label="Edad" type="number" value={String(form.age)} onChange={(v) => updateForm("age", parseInt(v) || 0)} />
                <Select label="Género" value={form.gender} options={GENDER_OPTIONS} onChange={(v) => updateForm("gender", v)} />
                <Input label="Ocupación" value={form.occupation} onChange={(v) => updateForm("occupation", v)} placeholder="Ej: Enfermera" />
              </div>
              {/* Country fields: origin, residence, enabled */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <Select label="Nacionalidad (país de origen)" value={form.countryOrigin} options={COUNTRY_OPTIONS} onChange={(v) => updateForm("countryOrigin", v)} />
                <Select label="País de residencia actual" value={form.countryResidence} options={COUNTRY_OPTIONS} onChange={(v) => updateForm("countryResidence", v)} />
              </div>

              {/* Enabled countries — special highlight */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Habilitar en</label>
                <p className="text-[10px] text-amber-600 mb-2">Los estudiantes de estos países podrán ver y practicar con este paciente</p>
                <div className="flex flex-wrap gap-2">
                  {COUNTRY_OPTIONS.map((c) => {
                    const selected = form.enabledCountries.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          const next = selected
                            ? form.enabledCountries.filter((x) => x !== c)
                            : [...form.enabledCountries, c];
                          updateForm("enabledCountries", next.length > 0 ? next : [c]);
                          updateForm("countries", next.length > 0 ? next : [c]);
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border-2 ${
                          selected
                            ? "bg-amber-500 text-white border-amber-500"
                            : "bg-white text-gray-500 border-gray-200 hover:border-amber-300 hover:text-amber-600"
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

              {/* Factor distintivo */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Factor distintivo <span className="text-gray-400 font-normal">(opcional)</span></label>
                <p className="text-[10px] text-amber-600 mb-2">
                  Un elemento identitario que define a este paciente y tendrá prioridad en la consulta. Ej: feminista, persona privada de libertad, situación de discapacidad, evento traumático específico, identidad de género, migrante forzado, etc.
                </p>
                <textarea
                  value={form.distinctiveFactor}
                  onChange={(e) => updateForm("distinctiveFactor", e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#4A55A2]"
                  rows={2}
                  placeholder="Ej: Activista feminista que fue detenida en una protesta / Persona con discapacidad visual adquirida hace 2 años / Sobreviviente de violencia intrafamiliar"
                />
              </div>
            </Section>

            {/* Arquetipo */}
            <Section title="Arquetipo clínico" citation={[
              { authors: "Otani, A.", work: "Client Resistance in Counseling: Its Theoretical Rationale and Taxonomic Classification. Journal of Counseling & Development", year: "1989", url: "https://onlinelibrary.wiley.com/doi/abs/10.1002/j.1556-6676.1989.tb02117.x" },
              { authors: "Beutler, L.E., Moleiro, C. & Talebi, H.", work: "Resistance in Psychotherapy: What Conclusions Are Supported by Research. Journal of Clinical Psychology", year: "2002", url: "https://onlinelibrary.wiley.com/doi/abs/10.1002/jclp.1144" },
              { authors: "Safran, J.D. & Muran, J.C.", work: "Negotiating the Therapeutic Alliance: A Relational Treatment Guide. Guilford Press", year: "2000" },
            ]}>
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

            {/* Personalidad */}
            <Section title="Rasgos de personalidad" subtitle="Selecciona 2 o mas" citation={[
              { authors: "Costa, P.T. & McCrae, R.R.", work: "Revised NEO Personality Inventory (NEO-PI-R) and NEO Five-Factor Inventory Professional Manual. Psychological Assessment Resources", year: "1992" },
              { authors: "Widiger, T.A. & Trull, T.J.", work: "Dimensional Models of Personality: The Five-Factor Model and the DSM-5. Dialogues in Clinical Neuroscience", year: "2013", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC3811085/" },
              { authors: "Millon, T.", work: "Disorders of Personality: Introducing a DSM/ICD Spectrum from Normal to Abnormal. Wiley", year: "2011" },
            ]}>
              <ChipGrid options={PERSONALITY_OPTIONS} selected={form.personalityTraits} onToggle={(v) => toggleArrayItem("personalityTraits", v)} />
            </Section>

            {/* Defensa */}
            <Section title="Mecanismos de defensa" subtitle="Selecciona 1 o mas" citation={[
              { authors: "Freud, A.", work: "The Ego and the Mechanisms of Defence. Hogarth Press", year: "1936" },
              { authors: "Vaillant, G.E.", work: "Ego Mechanisms of Defense: A Guide for Clinicians and Researchers. American Psychiatric Press", year: "1992" },
              { authors: "Perry, J.C.", work: "Defense Mechanism Rating Scales (DMRS)", year: "1990" },
              { authors: "Bond, M., Andrews, G. & Singh, M.", work: "The Defense Style Questionnaire. Journal of Nervous and Mental Disease", year: "1993", url: "https://pubmed.ncbi.nlm.nih.gov/8473876/" },
            ]}>
              <ChipGrid options={DEFENSE_OPTIONS} selected={form.defenseMechanisms} onToggle={(v) => toggleArrayItem("defenseMechanisms", v)} />
            </Section>

            {/* Temas sensibles */}
            <Section title="Temas sensibles" subtitle="Selecciona 1 o mas" citation={[
              { authors: "Pope, K.S., Sonne, J.L. & Greene, B.", work: "What Therapists Don't Talk About and Why: Understanding Taboos That Hurt Us and Our Clients. APA", year: "2006" },
              { authors: "Farber, B.A.", work: "Self-Disclosure in Psychotherapy. Guilford Press", year: "2006" },
              { authors: "Farber, B.A., Blanchard, M. & Love, M.", work: "Disclosure, Concealment, and Dishonesty in Psychotherapy. Journal of Clinical Psychology", year: "2020", url: "https://onlinelibrary.wiley.com/doi/abs/10.1002/jclp.22891" },
            ]}>
              <ChipGrid options={SENSITIVE_TOPICS} selected={form.sensitiveTopics} onToggle={(v) => toggleArrayItem("sensitiveTopics", v)} />
            </Section>

            {/* Configuracion */}
            <Section title="Configuración de sesión" citation={[
              { authors: "Jourard, S.M.", work: "The Transparent Self. Van Nostrand Reinhold (Nivel de apertura)", year: "1971" },
              { authors: "Gross, J.J.", work: "The Emerging Field of Emotion Regulation: An Integrative Review. Review of General Psychology (Variabilidad emocional)", year: "1998" },
              { authors: "Greenberg, L.S.", work: "Emotion-Focused Therapy: Coaching Clients to Work Through Their Feelings. APA", year: "2015" },
              { authors: "Hill, C.E.", work: "Helping Skills: Facilitating Exploration, Insight, and Action. APA (Dificultad clínica)", year: "2014" },
            ]}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select label="Nivel de apertura inicial" value={form.openness} options={OPENNESS_OPTIONS} onChange={(v) => updateForm("openness", v)} />
                <Select label="Variabilidad emocional" value={form.variability} options={VARIABILITY_OPTIONS} onChange={(v) => updateForm("variability", v)} />
                <Select
                  label="Dificultad clínica"
                  value={form.difficulty}
                  options={DIFFICULTY_OPTIONS.map((d) => d.value)}
                  displayOptions={DIFFICULTY_OPTIONS.map((d) => d.label)}
                  onChange={(v) => updateForm("difficulty", v)}
                />
              </div>
            </Section>

            {/* Action */}
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

        {/* ═══════════════════════════════════════════ */}
        {/* PHASE 2: RELATO (Steps 1-3)                */}
        {/* ═══════════════════════════════════════════ */}

        {/* Step 1: Show short narrative (read-only) */}
        {step === 1 && shortNarrative && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <BookOpen size={20} className="text-[#4A55A2]" />
              <h2 className="text-lg font-semibold text-gray-900">Relato corto generado</h2>
            </div>
            <p className="text-sm text-gray-500 -mt-4">
              La IA ha generado un relato en 5 secciones a partir de las variables configuradas. Revisa el contenido antes de continuar a la edicion.
            </p>

            <div className="grid grid-cols-1 gap-4">
              {(Object.keys(NARRATIVE_SECTIONS) as (keyof ShortNarrative)[]).map((key) => (
                <div key={key} className="bg-white rounded-xl p-5 shadow-sm">
                  <h4 className="text-sm font-semibold text-[#4A55A2] mb-2">{NARRATIVE_SECTIONS[key]}</h4>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{shortNarrative[key]}</p>
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(0)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors text-sm">
                <ArrowLeft size={16} /> Volver a variables
              </button>
              <button
                onClick={() => setStep(2)}
                className="flex items-center gap-2 bg-[#4A55A2] text-white px-6 py-3 rounded-lg hover:bg-[#3D4890] transition-colors font-medium"
              >
                Editar relato <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Edit short narrative + generate extended */}
        {step === 2 && editedShortNarrative && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <FileText size={20} className="text-[#4A55A2]" />
              <h2 className="text-lg font-semibold text-gray-900">Editar relato corto</h2>
            </div>
            <p className="text-sm text-gray-500 -mt-4">
              Modifica las secciones que necesites. Cuando estes conforme, genera el relato extenso.
            </p>

            <div className="grid grid-cols-1 gap-4">
              {(Object.keys(NARRATIVE_SECTIONS) as (keyof ShortNarrative)[]).map((key) => (
                <div key={key} className="bg-white rounded-xl p-5 shadow-sm">
                  <label className="block text-sm font-semibold text-[#4A55A2] mb-2">{NARRATIVE_SECTIONS[key]}</label>
                  <textarea
                    value={editedShortNarrative[key]}
                    onChange={(e) => setEditedShortNarrative((prev) => prev ? { ...prev, [key]: e.target.value } : prev)}
                    rows={4}
                    className="w-full border border-gray-200 rounded-lg p-3 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-[#4A55A2]/20 focus:border-[#4A55A2]"
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(1)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors text-sm">
                <ArrowLeft size={16} /> Volver a vista previa
              </button>
              <button
                onClick={generateExtendedNarrative}
                disabled={loading}
                className="flex items-center gap-2 bg-[#4A55A2] text-white px-6 py-3 rounded-lg hover:bg-[#3D4890] disabled:opacity-50 transition-colors font-medium"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                Generar relato extenso
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Show extended narrative */}
        {step === 3 && extendedNarrative && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <BookOpen size={20} className="text-[#4A55A2]" />
              <h2 className="text-lg font-semibold text-gray-900">Relato extenso</h2>
            </div>
            <p className="text-sm text-gray-500 -mt-4">
              Se generaron 8 secciones detalladas. Revisa cada una antes de validar la coherencia clinica.
            </p>

            <div className="grid grid-cols-1 gap-3">
              {(Object.keys(EXTENDED_SECTIONS) as (keyof ExtendedNarrative)[]).map((key) => (
                <ExpandableCard key={key} title={EXTENDED_SECTIONS[key]}>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{extendedNarrative[key]}</p>
                </ExpandableCard>
              ))}
            </div>

            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(2)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors text-sm">
                <ArrowLeft size={16} /> Editar relato corto
              </button>
              <button
                onClick={reviewCoherence}
                disabled={loading}
                className="flex items-center gap-2 bg-[#4A55A2] text-white px-6 py-3 rounded-lg hover:bg-[#3D4890] disabled:opacity-50 transition-colors font-medium"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                Validar coherencia
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* PHASE 3: VALIDACION (Steps 4-5)            */}
        {/* ═══════════════════════════════════════════ */}

        {/* Step 4: Coherence review results */}
        {step === 4 && coherenceReview && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <ShieldCheck size={20} className="text-[#4A55A2]" />
              <h2 className="text-lg font-semibold text-gray-900">Revision de coherencia</h2>
            </div>

            {/* Score */}
            <div className={`rounded-2xl border-2 p-6 text-center ${
              coherenceReview.score >= 8 ? "bg-green-50 border-green-200" :
              coherenceReview.score >= 6 ? "bg-amber-50 border-amber-200" :
              "bg-red-50 border-red-200"
            }`}>
              <p className={`text-6xl font-bold ${
                coherenceReview.score >= 8 ? "text-green-600" :
                coherenceReview.score >= 6 ? "text-amber-600" :
                "text-red-600"
              }`}>{coherenceReview.score}</p>
              <p className="text-sm text-gray-500 mt-1">Puntaje de coherencia (1-10)</p>
            </div>

            {/* Clinical consistency - green */}
            {coherenceReview.clinical_consistency.length > 0 && (
              <div className="bg-green-50 rounded-xl p-5 border border-green-200">
                <h4 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
                  <CheckCircle2 size={16} /> Consistencia clinica
                </h4>
                <ul className="space-y-1.5">
                  {coherenceReview.clinical_consistency.map((item, i) => (
                    <li key={i} className="text-sm text-green-700 flex items-start gap-2">
                      <span className="text-green-500 mt-0.5 flex-shrink-0">+</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Narrative gaps - amber */}
            {coherenceReview.narrative_gaps.length > 0 && (
              <div className="bg-amber-50 rounded-xl p-5 border border-amber-200">
                <h4 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
                  <AlertTriangle size={16} /> Brechas narrativas
                </h4>
                <ul className="space-y-1.5">
                  {coherenceReview.narrative_gaps.map((item, i) => (
                    <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                      <span className="text-amber-500 mt-0.5 flex-shrink-0">!</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* DSM-5 & PDM-2 alignment */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl p-5 shadow-sm">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Alineacion DSM-5</h4>
                <p className="text-sm text-gray-600 leading-relaxed">{coherenceReview.dsm5_alignment}</p>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Alineacion PDM-2</h4>
                <p className="text-sm text-gray-600 leading-relaxed">{coherenceReview.pdm2_alignment}</p>
              </div>
            </div>

            {/* Suggestions */}
            {coherenceReview.suggestions.length > 0 && (
              <div className="bg-[#4A55A2]/5 rounded-xl p-5 border border-[#4A55A2]/10">
                <h4 className="text-sm font-semibold text-[#4A55A2] mb-3 flex items-center gap-2">
                  <Sparkles size={16} /> Sugerencias
                </h4>
                <ul className="space-y-1.5">
                  {coherenceReview.suggestions.map((item, i) => (
                    <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-[#4A55A2] mt-0.5 flex-shrink-0">*</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(3)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors text-sm">
                <ArrowLeft size={16} /> Volver al relato extenso
              </button>
              <button
                onClick={() => setStep(5)}
                className="flex items-center gap-2 bg-[#4A55A2] text-white px-6 py-3 rounded-lg hover:bg-[#3D4890] transition-colors font-medium"
              >
                Revisar y aprobar <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Approve or go back */}
        {step === 5 && coherenceReview && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <ShieldCheck size={20} className="text-[#4A55A2]" />
              <h2 className="text-lg font-semibold text-gray-900">Aprobar coherencia</h2>
            </div>

            {/* Approval status */}
            {!coherenceReview.approved && (
              <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={24} className="text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-amber-800">La IA no aprueba este perfil automaticamente</p>
                    <p className="text-xs text-amber-600 mt-1">
                      El puntaje de coherencia es {coherenceReview.score}/10. Se recomienda volver a editar el relato corto para mejorar la consistencia.
                      Sin embargo, puedes continuar si consideras que el perfil es adecuado.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {coherenceReview.approved && (
              <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-6">
                <div className="flex items-start gap-3">
                  <CheckCircle2 size={24} className="text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-green-800">Perfil aprobado</p>
                    <p className="text-xs text-green-600 mt-1">
                      El perfil tiene un puntaje de coherencia de {coherenceReview.score}/10 y ha sido aprobado por la IA. Puedes continuar con las proyecciones.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Summary */}
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Resumen de validacion</h4>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <dt className="text-gray-500">Puntaje</dt>
                <dd className="font-medium">{coherenceReview.score}/10</dd>
                <dt className="text-gray-500">Consistencias</dt>
                <dd className="font-medium">{coherenceReview.clinical_consistency.length} items</dd>
                <dt className="text-gray-500">Brechas</dt>
                <dd className="font-medium">{coherenceReview.narrative_gaps.length} items</dd>
                <dt className="text-gray-500">Sugerencias</dt>
                <dd className="font-medium">{coherenceReview.suggestions.length} items</dd>
                <dt className="text-gray-500">Aprobado por IA</dt>
                <dd className={`font-medium ${coherenceReview.approved ? "text-green-600" : "text-amber-600"}`}>
                  {coherenceReview.approved ? "Si" : "No"}
                </dd>
              </dl>
            </div>

            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(2)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors text-sm">
                <ArrowLeft size={16} /> Volver a editar relato
              </button>
              <button
                onClick={generateProjections}
                disabled={loading}
                className="flex items-center gap-2 bg-[#4A55A2] text-white px-6 py-3 rounded-lg hover:bg-[#3D4890] disabled:opacity-50 transition-colors font-medium"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Brain size={18} />}
                Generar proyecciones
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* PHASE 4: PROYECCIONES (Steps 6-7)          */}
        {/* ═══════════════════════════════════════════ */}

        {/* Step 6: Show projections — table summary */}
        {step === 6 && projections && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <Brain size={20} className="text-[#4A55A2]" />
              <h2 className="text-lg font-semibold text-gray-900">Proyecciones terapéuticas</h2>
            </div>
            <p className="text-sm text-gray-500 -mt-4">
              Tabla comparativa de 3 niveles de terapeuta × 8 sesiones. Incluye variables adaptativas del motor clínico.
            </p>

            {/* Comparative table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="p-2 text-left font-semibold text-gray-600 border border-gray-200 w-12">#</th>
                    {projections.levels.map((l) => (
                      <th key={l.level} className="p-2 text-left font-semibold border border-gray-200" style={{
                        color: l.level === "principiante" ? "#22c55e" : l.level === "intermedio" ? "#eab308" : "#ef4444",
                      }}>
                        {l.level.charAt(0).toUpperCase() + l.level.slice(1)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 8 }, (_, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                      <td className="p-2 border border-gray-200 text-center font-bold text-gray-400">{i + 1}</td>
                      {projections.levels.map((level) => {
                        const s = level.sessions[i];
                        if (!s) return <td key={level.level} className="p-2 border border-gray-200" />;
                        const adaptive = (s as unknown as Record<string, unknown>).adaptive_state as Record<string, number> | undefined;
                        return (
                          <td key={level.level} className="p-2 border border-gray-200 align-top">
                            <p className="font-semibold text-gray-900 mb-1">{s.focus}</p>
                            <p className="text-gray-500 mb-1">{s.patient_state}</p>
                            <p className="text-[#4A55A2] font-medium mb-1">{s.key_moment}</p>
                            {adaptive && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {Object.entries(adaptive).map(([k, v]) => {
                                  const label = { resistencia: "R", alianza: "A", apertura_emocional: "AE", sintomatologia: "S", disposicion_cambio: "DC" }[k] || k;
                                  const color = k === "resistencia" || k === "sintomatologia"
                                    ? (v > 50 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700")
                                    : (v > 50 ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700");
                                  return (
                                    <span key={k} className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${color}`} title={k}>
                                      {label}:{v}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Level descriptions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {projections.levels.map((level) => (
                <div key={level.level} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-gray-700 mb-1 capitalize">{level.level}</p>
                  <p className="text-[10px] text-gray-500">{level.description}</p>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 text-[10px] text-gray-400">
              <span>R = Resistencia</span>
              <span>A = Alianza</span>
              <span>AE = Apertura emocional</span>
              <span>S = Sintomatología</span>
              <span>DC = Disposición al cambio</span>
              <span className="text-gray-300">|</span>
              <span className="text-green-600">Verde = favorable</span>
              <span className="text-red-600">Rojo = desfavorable</span>
            </div>

            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(5)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors text-sm">
                <ArrowLeft size={16} /> Volver a validación
              </button>
              <button
                onClick={() => setStep(7)}
                className="flex items-center gap-2 bg-[#4A55A2] text-white px-6 py-3 rounded-lg hover:bg-[#3D4890] transition-colors font-medium"
              >
                Continuar <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Step 7: Human reviews projections → generate system prompt */}
        {step === 7 && projections && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <Brain size={20} className="text-[#4A55A2]" />
              <h2 className="text-lg font-semibold text-gray-900">Confirmar proyecciones</h2>
            </div>
            <p className="text-sm text-gray-500 -mt-4">
              Revisa el resumen de proyecciones. Al continuar, se generara el system prompt final del paciente.
            </p>

            {/* Summary table */}
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Resumen de niveles</h4>
              <div className="space-y-3">
                {projections.levels.map((level) => (
                  <div key={level.level} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900 capitalize">{level.level}</p>
                      <p className="text-xs text-gray-500">{level.description?.slice(0, 80)}...</p>
                    </div>
                    <span className="text-xs bg-[#4A55A2]/10 text-[#4A55A2] px-3 py-1 rounded-full font-medium">
                      {level.sessions.length} sesiones
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(6)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors text-sm">
                <ArrowLeft size={16} /> Ver proyecciones detalladas
              </button>
              <button
                onClick={generateSystemPrompt}
                disabled={loading}
                className="flex items-center gap-2 bg-[#4A55A2] text-white px-6 py-3 rounded-lg hover:bg-[#3D4890] disabled:opacity-50 transition-colors font-medium"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Terminal size={18} />}
                Generar system prompt
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* PHASE 5: SYSTEM PROMPT (Steps 8-9)         */}
        {/* ═══════════════════════════════════════════ */}

        {/* Step 8: Show and edit system prompt */}
        {step === 8 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <Terminal size={20} className="text-[#4A55A2]" />
              <h2 className="text-lg font-semibold text-gray-900">System prompt generado</h2>
            </div>
            <p className="text-sm text-gray-500 -mt-4">
              Este es el prompt que la IA usara para simular al paciente. Puedes editarlo directamente.
            </p>

            {/* Editable system prompt */}
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-gray-900">System prompt</label>
                <span className="text-xs text-gray-400">{systemPrompt.length} caracteres</span>
              </div>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={24}
                className="w-full border border-gray-200 rounded-lg p-4 text-sm font-mono leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-[#4A55A2]/20 focus:border-[#4A55A2]"
              />
            </div>

            {/* Design notes */}
            {designNotes.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-900">Notas de diseno</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {designNotes.map((note, i) => (
                    <div key={i} className="bg-[#4A55A2]/5 rounded-xl p-4 border border-[#4A55A2]/10">
                      <p className="text-xs text-gray-700 leading-relaxed">{note}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(7)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors text-sm">
                <ArrowLeft size={16} /> Volver a proyecciones
              </button>
              <button
                onClick={() => setStep(9)}
                className="flex items-center gap-2 bg-[#4A55A2] text-white px-6 py-3 rounded-lg hover:bg-[#3D4890] transition-colors font-medium"
              >
                Validar y continuar <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Step 9: Final validation before save */}
        {step === 9 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle2 size={20} className="text-[#4A55A2]" />
              <h2 className="text-lg font-semibold text-gray-900">Confirmar y guardar</h2>
            </div>
            <p className="text-sm text-gray-500 -mt-4">
              Revisa el resumen completo antes de guardar el paciente en la plataforma.
            </p>

            {/* Patient summary card */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-start gap-5">
                <div className="w-14 h-14 rounded-full bg-[#4A55A2] flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-lg font-bold">
                    {form.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </span>
                </div>
                <div>
                  <h4 className="text-lg font-bold text-gray-900">{form.name}</h4>
                  <p className="text-sm text-gray-500">{form.age} anos -- {form.occupation}</p>
                  <p className="text-xs text-gray-400 mt-1">{form.countries.join(", ")} -- {form.context}</p>
                </div>
              </div>
            </div>

            {/* Generation checklist */}
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Checklist de generación</h4>
              <div className="space-y-2">
                {[
                  { label: "Variables configuradas", done: true },
                  { label: "Relato corto generado y editado", done: !!editedShortNarrative },
                  { label: "Relato extenso generado", done: !!extendedNarrative },
                  { label: "Coherencia validada", done: !!coherenceReview },
                  { label: "Proyecciones generadas", done: !!projections },
                  { label: "System prompt generado", done: !!systemPrompt },
                ].map((item, i) => (
                  <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${item.done ? "bg-green-50" : "bg-gray-50"}`}>
                    {item.done ? <CheckCircle2 size={14} className="text-green-500" /> : <XCircle size={14} className="text-gray-300" />}
                    <span className={item.done ? "text-green-800 font-medium" : "text-gray-400"}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{systemPrompt.length}</p>
                <p className="text-xs text-gray-500">caracteres en prompt</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{coherenceReview?.score || "-"}</p>
                <p className="text-xs text-gray-500">coherencia</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{projections?.levels.length || 0}</p>
                <p className="text-xs text-gray-500">niveles</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{designNotes.length}</p>
                <p className="text-xs text-gray-500">notas de diseno</p>
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(8)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors text-sm">
                <ArrowLeft size={16} /> Editar system prompt
              </button>
              <button
                onClick={savePatient}
                disabled={loading || !systemPrompt}
                className="flex items-center gap-2 bg-green-600 text-white px-8 py-3 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors font-bold text-base shadow-md"
              >
                {loading ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
                Guardar paciente
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* PHASE 6: ACTIVAR (Steps 10-14)             */}
        {/* ═══════════════════════════════════════════ */}

        {/* Step 10: Save success + checklist */}
        {step === 10 && (
          <div className="space-y-6">
            <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-8 text-center">
              <CheckCircle2 size={48} className="text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-green-800">Paciente guardado exitosamente</h2>
              <p className="text-sm text-green-600 mt-2">
                {form.name} ha sido creado en la plataforma. Ahora puedes generar la imagen y el video.
              </p>
            </div>

            {/* Success checklist */}
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Estado de activacion</h4>
              <div className="space-y-2">
                {[
                  { label: "Paciente guardado en base de datos", done: true },
                  { label: "System prompt configurado", done: true },
                  { label: "Relatos y proyecciones almacenados", done: true },
                  { label: "Imagen de perfil (opcional)", done: !!generatedImage },
                  { label: "Video animado (opcional)", done: false },
                ].map((item, i) => (
                  <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${item.done ? "bg-green-50" : "bg-gray-50"}`}>
                    {item.done ? <CheckCircle2 size={14} className="text-green-500" /> : <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300" />}
                    <span className={item.done ? "text-green-800 font-medium" : "text-gray-500"}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Link href="/perfiles" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors text-sm">
                <ArrowLeft size={16} /> Volver a perfiles
              </Link>
              <button
                onClick={() => setStep(11)}
                className="flex items-center gap-2 bg-[#4A55A2] text-white px-6 py-3 rounded-lg hover:bg-[#3D4890] transition-colors font-medium"
              >
                <ImageIcon size={18} />
                Generar imagen
              </button>
            </div>
          </div>
        )}

        {/* Step 11: Image generation */}
        {step === 11 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <ImageIcon size={20} className="text-[#4A55A2]" />
              <h2 className="text-lg font-semibold text-gray-900">Imagen del paciente</h2>
            </div>
            <p className="text-sm text-gray-500 -mt-4">
              Genera una imagen de perfil para {form.name}. Este paso es opcional.
            </p>

            <ImageGenerator
              form={form}
              generatedImage={generatedImage}
              setGeneratedImage={setGeneratedImage}
              imagePrompt={imagePrompt}
              setImagePrompt={setImagePrompt}
              imageLoading={imageLoading}
              setImageLoading={setImageLoading}
            />

            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(10)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors text-sm">
                <ArrowLeft size={16} /> Volver al resumen
              </button>
              <div className="flex gap-3">
                {generatedImage && (
                  <button
                    onClick={() => setStep(12)}
                    className="flex items-center gap-2 bg-[#4A55A2] text-white px-6 py-3 rounded-lg hover:bg-[#3D4890] transition-colors font-medium"
                  >
                    <Video size={18} />
                    Generar video
                  </button>
                )}
                <Link
                  href="/perfiles"
                  className="flex items-center gap-2 border border-gray-300 text-gray-600 px-5 py-3 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                >
                  Finalizar sin video
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Step 12: Video generation */}
        {step === 12 && generatedImage && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <Video size={20} className="text-[#4A55A2]" />
              <h2 className="text-lg font-semibold text-gray-900">Video animado</h2>
            </div>
            <p className="text-sm text-gray-500 -mt-4">
              Genera un video animado a partir de la imagen de {form.name}. Este paso es opcional.
            </p>

            <VideoGenerator imageUrl={generatedImage} patientName={form.name} />

            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(11)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors text-sm">
                <ArrowLeft size={16} /> Volver a imagen
              </button>
              <button
                onClick={() => setStep(13)}
                className="flex items-center gap-2 bg-[#4A55A2] text-white px-6 py-3 rounded-lg hover:bg-[#3D4890] transition-colors font-medium"
              >
                Continuar <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Step 13: Upload manual video */}
        {step === 13 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <Upload size={20} className="text-[#4A55A2]" />
              <h2 className="text-lg font-semibold text-gray-900">Video manual (opcional)</h2>
            </div>
            <p className="text-sm text-gray-500 -mt-4">
              Si prefieres, puedes subir un video .mp4 manualmente para usar como avatar animado.
            </p>

            <ManualVideoUpload form={form} />

            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(12)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors text-sm">
                <ArrowLeft size={16} /> Volver a video generado
              </button>
              <button
                onClick={() => setStep(14)}
                className="flex items-center gap-2 bg-[#4A55A2] text-white px-6 py-3 rounded-lg hover:bg-[#3D4890] transition-colors font-medium"
              >
                Finalizar <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Step 14: Final summary */}
        {step === 14 && (
          <div className="space-y-6">
            <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-8 text-center">
              <Zap size={48} className="text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-green-800">Paciente activado</h2>
              <p className="text-sm text-green-600 mt-2">
                {form.name} esta listo para ser utilizado en sesiones de practica.
              </p>
            </div>

            {/* Full summary */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h4 className="text-sm font-semibold text-gray-900 mb-4">Resumen completo</h4>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <dt className="text-gray-500">Nombre</dt>
                <dd className="text-gray-900 font-medium">{form.name}</dd>
                <dt className="text-gray-500">Edad</dt>
                <dd className="text-gray-900">{form.age} anos</dd>
                <dt className="text-gray-500">Ocupacion</dt>
                <dd className="text-gray-900">{form.occupation}</dd>
                <dt className="text-gray-500">Paises</dt>
                <dd className="text-gray-900">{form.countries.join(", ")}</dd>
                <dt className="text-gray-500">Motivo</dt>
                <dd className="text-gray-900">{form.motivo}</dd>
                <dt className="text-gray-500">Dificultad</dt>
                <dd className="text-gray-900">{DIFFICULTY_OPTIONS.find((d) => d.value === form.difficulty)?.label}</dd>
                <dt className="text-gray-500">Coherencia</dt>
                <dd className="text-gray-900">{coherenceReview?.score || "-"}/10</dd>
                <dt className="text-gray-500">System prompt</dt>
                <dd className="text-gray-900">{systemPrompt.length} caracteres</dd>
                <dt className="text-gray-500">Imagen</dt>
                <dd className="text-gray-900">{generatedImage ? "Generada" : "Sin imagen"}</dd>
              </dl>
            </div>

            <div className="flex justify-center pt-4">
              <Link
                href="/perfiles"
                className="flex items-center gap-2 bg-[#4A55A2] text-white px-8 py-3 rounded-xl hover:bg-[#3D4890] transition-colors font-bold text-base shadow-md"
              >
                Ir a perfiles
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// REUSABLE UI COMPONENTS
// ══════════════════════════════════════════

function CitationButton({ citation }: { citation: { authors: string; work: string; year: string; url?: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-5 h-5 rounded-full bg-sidebar/10 text-sidebar flex items-center justify-center text-[10px] font-bold hover:bg-sidebar/20 transition-colors"
        title="Ver respaldo académico"
      >
        i
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-7 z-50 w-80 bg-white rounded-lg shadow-xl border border-gray-200 p-4 space-y-2.5">
            <p className="text-[10px] font-bold text-sidebar uppercase tracking-wide">Respaldo académico</p>
            {citation.map((c, i) => (
              <div key={i} className="text-xs text-gray-600 leading-relaxed">
                <span className="font-medium text-gray-800">{c.authors} ({c.year}).</span>{" "}
                <span className="italic">{c.work}.</span>
                {c.url && (
                  <a href={c.url} target="_blank" rel="noopener noreferrer" className="ml-1 text-sidebar hover:underline text-[10px]">
                    Ver fuente
                  </a>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Section({ title, subtitle, citation, children }: { title: string; subtitle?: string; citation?: { authors: string; work: string; year: string; url?: string }[]; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        {citation && <CitationButton citation={citation} />}
      </div>
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

function ExpandableCard({ title, children }: { title: string; children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
      >
        <h4 className="text-sm font-semibold text-[#4A55A2]">{title}</h4>
        {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>
      {expanded && <div className="px-5 pb-5 -mt-2">{children}</div>}
    </div>
  );
}

// ══════════════════════════════════════════
// IMAGE GENERATOR
// ══════════════════════════════════════════

function ImageGenerator({
  form, generatedImage, setGeneratedImage, imagePrompt, setImagePrompt, imageLoading, setImageLoading,
}: {
  form: PatientFormData;
  generatedImage: string | null; setGeneratedImage: (v: string | null) => void;
  imagePrompt: string; setImagePrompt: (v: string) => void;
  imageLoading: boolean; setImageLoading: (v: boolean) => void;
}) {
  const [error, setError] = useState("");
  const [showPrompt, setShowPrompt] = useState(false);

  const buildDefaultPrompt = () => {
    const gender = form.gender === "Femeniño" ? "woman" : form.gender === "Masculino" ? "man" : "person";
    const countries = form.countries.join(", ");

    const appearanceHints: Record<string, string> = {
      "Chile": "mestizo Chilean features, could range from lighter to darker skin tones, straight or wavy dark hair",
      "Colombia": "diverse Colombian features — could be Afro-Colombian with dark skin, mestizo with warm brown skin, or lighter-skinned paisa — varied hair textures",
      "México": "Mexican features — could be indigenous, mestizo, or lighter-skinned — diverse skin tones from brown to olive",
      "Perú": "Peruvian features — could be Quechua with copper skin and straight dark hair, mestizo, or Afro-Peruvian",
      "Argentina": "Argentine features — could be of European descent with lighter skin, mestizo, or darker-skinned from the north",
      "República Dominicana": "Dominican features — mixed African and European heritage, warm dark skin, curly or coily hair",
      "Ecuador": "Ecuadorian features — could be indigenous highland, coastal mestizo, or Afro-Ecuadorian",
      "Bolivia": "Bolivian features — could be Aymara or Quechua indigenous with bronze skin, or mestizo",
      "Venezuela": "Venezuelan features — diverse mix, could be lighter or darker skinned, straight or curly hair",
      "Uruguay": "Uruguayan features, could range from European to Afro-Uruguayan descent",
      "Paraguay": "Paraguayan Guaraní-mestizo features, warm brown skin, straight dark hair",
      "España": "Spanish features — Mediterranean appearance with olive to fair skin",
    };

    const countryKey = form.countries[0] || "Chile";
    const appearance = appearanceHints[countryKey] || "distinctive Latin American features with natural ethnic diversity";

    const ageDesc = form.age < 25 ? "youthful appearance"
      : form.age < 40 ? "adult appearance, early signs of maturity"
      : form.age < 55 ? "mature adult, visible laugh lines or slight wrinkles"
      : "older adult, gray or white hair, weathered but dignified features";

    return `Professional portrait photograph of a ${form.age}-year-old ${gender} from ${countries}. ${appearance}. ${ageDesc}. Works as ${form.occupation} — clothing and grooming reflect their socioeconomic context (${form.context}). Expression: neutral with slight warmth, as if sitting in a therapist's waiting room. Natural lighting, clean neutral background. This should look like a REAL person — not a model or stock photo. Unique distinguishing features (birthmarks, specific nose shape, eye shape, hair style). Realistic skin texture, natural imperfections. Photorealistic portrait, candid feel. No text, no watermarks.`;
  };

  const generateImage = async (customPrompt?: string) => {
    const prompt = customPrompt || imagePrompt || buildDefaultPrompt();
    if (!imagePrompt) setImagePrompt(prompt);
    setImageLoading(true);
    setError("");

    const res = await fetch("/api/patients/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Error al generar imagen");
      setImageLoading(false);
      return;
    }

    const data = await res.json();
    setGeneratedImage(data.url);
    if (data.revised_prompt && !customPrompt) setImagePrompt(data.revised_prompt);
    setImageLoading(false);
  };

  const [imageSaved, setImageSaved] = useState(false);
  const [imageSaving, setImageSaving] = useState(false);

  const saveImageToStorage = async () => {
    if (!generatedImage) return;
    setImageSaving(true);
    const slug = form.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");
    const res = await fetch("/api/patients/upload-asset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: generatedImage, slug, type: "image" }),
    });
    if (res.ok) setImageSaved(true);
    setImageSaving(false);
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ImageIcon size={18} className="text-sidebar" />
          <h3 className="font-semibold text-gray-900">Imagen del paciente</h3>
        </div>
        <div className="flex items-center gap-2">
          {generatedImage && (
            <button onClick={saveImageToStorage} disabled={imageSaving || imageSaved}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                imageSaved ? "bg-green-100 text-green-700" : "bg-green-600 text-white hover:bg-green-700"
              } disabled:opacity-70`}>
              {imageSaving ? <Loader2 size={12} className="animate-spin" /> : imageSaved ? <CheckCircle2 size={12} /> : <Upload size={12} />}
              {imageSaving ? "Subiendo..." : imageSaved ? "Imagen guardada" : "Guardar en plataforma"}
            </button>
          )}
          <button onClick={() => generateImage()} disabled={imageLoading}
            className="flex items-center gap-1.5 text-sm border border-sidebar text-sidebar px-4 py-2 rounded-lg font-medium hover:bg-sidebar/5 transition-colors disabled:opacity-50">
            {imageLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {imageLoading ? "Generando..." : generatedImage ? "Regenerar" : "Generar imagen"}
          </button>
        </div>
      </div>

      {/* Image preview */}
      {generatedImage ? (
        <div className="flex justify-center mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={generatedImage} alt={form.name} className="w-64 h-64 rounded-2xl object-cover shadow-lg" />
        </div>
      ) : !imageLoading ? (
        <div className="flex flex-col items-center justify-center py-8 text-gray-400">
          <ImageIcon size={40} className="mb-2 opacity-30" />
          <p className="text-xs">Genera una imagen basada en la identidad del paciente</p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 size={32} className="animate-spin text-sidebar mb-3" />
          <p className="text-xs text-gray-400">Generando imagen con DALL-E 3...</p>
          <p className="text-[10px] text-gray-300 mt-1">Esto puede tomar 15-30 segundos</p>
        </div>
      )}

      {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

      {/* Prompt editor */}
      <button onClick={() => setShowPrompt(!showPrompt)}
        className="text-xs text-sidebar font-medium hover:underline mb-2">
        {showPrompt ? "Ocultar prompt" : "Ver/editar prompt de imagen"}
      </button>

      {showPrompt && (
        <div className="space-y-2 animate-fade-in">
          <textarea
            value={imagePrompt || buildDefaultPrompt()}
            onChange={(e) => setImagePrompt(e.target.value)}
            rows={4}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-sidebar/20"
            placeholder="Describe la imagen que deseas generar..."
          />
          <div className="flex items-center gap-2">
            <button onClick={() => generateImage(imagePrompt)} disabled={imageLoading}
              className="text-xs bg-sidebar text-white px-3 py-1.5 rounded-lg font-medium hover:bg-sidebar-hover transition-colors disabled:opacity-50">
              Generar con este prompt
            </button>
            <button onClick={() => { setImagePrompt(buildDefaultPrompt()); }}
              className="text-xs text-gray-400 hover:text-gray-600">
              Restaurar prompt original
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════
// VIDEO GENERATOR
// ══════════════════════════════════════════

function VideoGenerator({ imageUrl, patientName }: { imageUrl: string; patientName: string }) {
  const [state, setState] = useState<"idle" | "generating" | "polling" | "done" | "error">("idle");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [videoPrompt, setVideoPrompt] = useState("Subtle natural movement: gentle breathing, slight eye blinks, micro facial expressions. The person stays still, looking forward with a calm, neutral presence. Photorealistic, no camera movement.");
  const [showPrompt, setShowPrompt] = useState(false);
  const [error, setError] = useState("");

  const startGeneration = async () => {
    setState("generating");
    setError("");
    setVideoUrl(null);

    const res = await fetch("/api/patients/generate-video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: imageUrl, prompt: videoPrompt }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Error al iniciar generación");
      setState("error");
      return;
    }

    const data = await res.json();
    setGenerationId(data.id);
    setState("polling");
    pollStatus(data.id);
  };

  const pollStatus = async (id: string) => {
    const poll = async () => {
      const res = await fetch(`/api/patients/generate-video?id=${id}`);
      if (!res.ok) { setState("error"); setError("Error consultando estado"); return; }
      const data = await res.json();

      if (data.state === "completed" && data.video_url) {
        setVideoUrl(data.video_url);
        setState("done");
      } else if (data.state === "failed") {
        setState("error");
        setError("La generación de video falló. Intenta de nuevo.");
      } else {
        setTimeout(() => pollStatus(id), 5000);
      }
    };
    poll();
  };

  const [videoSaved, setVideoSaved] = useState(false);
  const [videoSaving, setVideoSaving] = useState(false);

  const saveVideoToStorage = async () => {
    if (!videoUrl) return;
    setVideoSaving(true);
    const slug = patientName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");
    const res = await fetch("/api/patients/upload-asset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: videoUrl, slug, type: "video" }),
    });
    if (res.ok) setVideoSaved(true);
    setVideoSaving(false);
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Video size={18} className="text-sidebar" />
          <h3 className="font-semibold text-gray-900">Video animado (Luma AI)</h3>
        </div>
        <div className="flex items-center gap-2">
          {videoUrl && (
            <button onClick={saveVideoToStorage} disabled={videoSaving || videoSaved}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                videoSaved ? "bg-green-100 text-green-700" : "bg-green-600 text-white hover:bg-green-700"
              } disabled:opacity-70`}>
              {videoSaving ? <Loader2 size={12} className="animate-spin" /> : videoSaved ? <CheckCircle2 size={12} /> : <Upload size={12} />}
              {videoSaving ? "Subiendo..." : videoSaved ? "Video guardado" : "Guardar en plataforma"}
            </button>
          )}
          <button onClick={startGeneration} disabled={state === "generating" || state === "polling"}
            className="flex items-center gap-1.5 text-sm border border-sidebar text-sidebar px-4 py-2 rounded-lg font-medium hover:bg-sidebar/5 transition-colors disabled:opacity-50">
            {state === "generating" || state === "polling" ? (
              <><Loader2 size={14} className="animate-spin" /> Generando...</>
            ) : (
              <><Video size={14} /> {videoUrl ? "Regenerar video" : "Generar video"}</>
            )}
          </button>
        </div>
      </div>

      {/* Video preview */}
      {videoUrl ? (
        <div className="flex justify-center mb-4">
          <div className="relative rounded-2xl overflow-hidden shadow-lg">
            <video src={videoUrl} controls loop className="w-64 h-64 object-cover" />
          </div>
        </div>
      ) : state === "generating" || state === "polling" ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 size={32} className="animate-spin text-sidebar mb-3" />
          <p className="text-xs text-gray-500 font-medium">
            {state === "generating" ? "Iniciando generación..." : "Generando video con Luma AI..."}
          </p>
          <p className="text-[10px] text-gray-400 mt-1">Esto puede tomar 1-3 minutos</p>
          <div className="mt-4 w-48 bg-gray-100 rounded-full h-1.5 overflow-hidden">
            <div className="bg-sidebar h-1.5 rounded-full animate-pulse" style={{ width: "60%" }} />
          </div>
        </div>
      ) : state === "idle" ? (
        <div className="flex flex-col items-center justify-center py-8 text-gray-400">
          <Play size={40} className="mb-2 opacity-30" />
          <p className="text-xs">Genera un video animado a partir de la imagen del paciente</p>
          <p className="text-[10px] text-gray-300 mt-1">Usa Luma Dream Machine -- movimiento sutil y natural</p>
        </div>
      ) : null}

      {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

      {/* Prompt editor */}
      <button onClick={() => setShowPrompt(!showPrompt)}
        className="text-xs text-sidebar font-medium hover:underline mb-2">
        {showPrompt ? "Ocultar prompt" : "Ver/editar prompt de video"}
      </button>

      {showPrompt && (
        <div className="space-y-2 animate-fade-in">
          <textarea
            value={videoPrompt}
            onChange={(e) => setVideoPrompt(e.target.value)}
            rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-sidebar/20"
          />
          <p className="text-[10px] text-gray-400">
            Tip: para mejores resultados, describe movimientos sutiles (parpadeo, respiracion) y evita movimientos bruscos.
          </p>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════
// MANUAL VIDEO UPLOAD
// ══════════════════════════════════════════

function ManualVideoUpload({ form }: { form: PatientFormData }) {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);

  const handleUpload = async () => {
    if (!videoFile) return;
    setUploading(true);
    const slug = form.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");
    const body = new FormData();
    body.append("video", videoFile);
    body.append("slug", slug);
    try {
      const res = await fetch("/api/patients/upload-asset", { method: "POST", body });
      if (res.ok) setUploaded(true);
    } catch { /* silently fail */ }
    setUploading(false);
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <h3 className="font-semibold text-gray-900 mb-4">Subir video del paciente (manual)</h3>
      <p className="text-sm text-gray-500 mb-4">
        Sube un video .mp4 que se usara como avatar animado. Se guardara como{" "}
        <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">
          {form.name
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, "-")}
          .mp4
        </code>
      </p>
      <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-8 cursor-pointer hover:border-[#4A55A2] hover:bg-[#4A55A2]/5 transition-colors">
        <Upload size={32} className="text-gray-400 mb-2" />
        <span className="text-sm text-gray-600">
          {videoFile ? videoFile.name : "Click para seleccionar video"}
        </span>
        {videoFile && (
          <span className="text-xs text-gray-400 mt-1">
            {(videoFile.size / 1024 / 1024).toFixed(1)} MB
          </span>
        )}
        <input
          type="file"
          accept="video/mp4"
          className="hidden"
          onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
        />
      </label>

      {videoFile && !uploaded && (
        <div className="flex justify-end mt-4">
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? "Subiendo..." : "Subir video"}
          </button>
        </div>
      )}

      {uploaded && (
        <div className="flex items-center gap-2 mt-4 text-sm text-green-700 bg-green-50 rounded-lg px-4 py-2">
          <CheckCircle2 size={16} /> Video subido exitosamente
        </div>
      )}
    </div>
  );
}
