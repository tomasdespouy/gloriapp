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
  type PatientFormData,
  type GeneratedProfile,
  type TestResult,
} from "@/lib/patient-options";

const STEPS = ["Configurar", "Perfil", "Prueba", "Guardar"];

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
  const [profile, setProfile] = useState<GeneratedProfile | null>(null);
  const [editedPrompt, setEditedPrompt] = useState("");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageLoading, setImageLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // --- API calls ---
  async function generateProfile() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/patients/generate-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error del servidor");
      if (data.system_prompt) {
        setProfile(data);
        setEditedPrompt(data.system_prompt);
        setStep(1);
      } else {
        throw new Error("Respuesta invalida del modelo");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al generar el perfil");
    } finally {
      setLoading(false);
    }
  }

  async function testConversation() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/patients/test-conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_prompt: editedPrompt,
          patient_name: form.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error del servidor");
      if (data.conversation) {
        setTestResult(data);
        setStep(2);
      } else {
        throw new Error("Respuesta invalida del modelo");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al probar la conversación");
    } finally {
      setLoading(false);
    }
  }

  async function savePatient() {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const slug = form.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");

      // Auto-upload image to Storage if generated but not yet saved
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
          quote: profile.quote,
          presenting_problem: profile.presenting_problem,
          backstory: profile.backstory,
          personality_traits: profile.personality_traits,
          system_prompt: editedPrompt,
          difficulty_level: form.difficulty,
          tags: profile.tags,
          skills_practiced: profile.skills_practiced,
          total_sessions: profile.total_sessions,
          country: form.countries,
          country_origin: form.countries[0] || "Chile",
          country_residence: form.countries[0] || "Chile",
          birthday: profile.birthday || null,
          neighborhood: profile.neighborhood || null,
          family_members: profile.family_members || [],
        })
      );
      if (videoFile) body.append("video", videoFile);

      const res = await fetch("/api/patients", {
        method: "POST",
        body,
      });
      if (!res.ok) throw new Error("Error al guardar");
      router.push("/perfiles");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar el paciente");
    } finally {
      setLoading(false);
    }
  }

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

        {/* Stepper */}
        <div className="flex items-center gap-2 mb-10">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  i < step
                    ? "bg-green-500 text-white"
                    : i === step
                    ? "bg-[#4A55A2] text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {i < step ? <Check size={14} /> : i + 1}
              </div>
              <span className={`text-sm hidden sm:inline ${i === step ? "font-medium text-gray-900" : "text-gray-400"}`}>
                {label}
              </span>
              {i < STEPS.length - 1 && <div className="w-8 lg:w-16 h-px bg-gray-200" />}
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        {/* Step 0: Form */}
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
                <Select label="Genero" value={form.gender} options={GENDER_OPTIONS} onChange={(v) => updateForm("gender", v)} />
                <Input label="Ocupacion" value={form.occupation} onChange={(v) => updateForm("occupation", v)} placeholder="Ej: Enfermera" />
              </div>
              {/* Countries multiselect */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Países (puede elegir más de uno)</label>
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

            {/* Arquetipo */}
            <Section title="Arquetipo clínico">
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
            <Section title="Rasgos de personalidad" subtitle="Seleccióna 2 o más">
              <ChipGrid options={PERSONALITY_OPTIONS} selected={form.personalityTraits} onToggle={(v) => toggleArrayItem("personalityTraits", v)} />
            </Section>

            {/* Defensa */}
            <Section title="Mecanismos de defensa" subtitle="Seleccióna 1 o más">
              <ChipGrid options={DEFENSE_OPTIONS} selected={form.defenseMechanisms} onToggle={(v) => toggleArrayItem("defenseMechanisms", v)} />
            </Section>

            {/* Temas sensibles */}
            <Section title="Temas sensibles" subtitle="Seleccióna 1 o más">
              <ChipGrid options={SENSITIVE_TOPICS} selected={form.sensitiveTopics} onToggle={(v) => toggleArrayItem("sensitiveTopics", v)} />
            </Section>

            {/* Configuracion */}
            <Section title="Configuracion de sesión">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select label="Nivel de apertura inicial" value={form.openness} options={OPENNESS_OPTIONS} onChange={(v) => updateForm("openness", v)} />
                <Select label="Variabilidad emociónal" value={form.variability} options={VARIABILITY_OPTIONS} onChange={(v) => updateForm("variability", v)} />
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
                onClick={generateProfile}
                disabled={!isFormValid() || loading}
                className="flex items-center gap-2 bg-[#4A55A2] text-white px-6 py-3 rounded-lg hover:bg-[#3D4890] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                Generar perfil
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Preview */}
        {step === 1 && profile && (
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
                  <p className="text-sm text-gray-500">{form.age} años &middot; {form.occupation}</p>
                  <p className="text-sm text-gray-600 italic mt-1">&ldquo;{profile.quote}&rdquo;</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {profile.tags.map((tag) => (
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
                  onClick={generateProfile}
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

            {/* Ficha clínica preview */}
            <FichaClinicaPreview form={form} profile={profile} systemPrompt={editedPrompt} />

            {/* Actions */}
            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(0)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
                <ArrowLeft size={18} /> Volver al formulario
              </button>
              <button
                onClick={testConversation}
                disabled={loading}
                className="flex items-center gap-2 bg-[#4A55A2] text-white px-6 py-3 rounded-lg hover:bg-[#3D4890] disabled:opacity-50 transition-colors font-medium"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <MessageCircle size={18} />}
                Probar paciente
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Test */}
        {step === 2 && testResult && (
          <div className="space-y-6">
            {/* Simulated conversation */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-4">Conversación simulada</h3>
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                {testResult.conversation.map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.role === "estudiante" ? "" : "flex-row-reverse"}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      msg.role === "estudiante" ? "bg-green-100" : "bg-[#4A55A2]"
                    }`}>
                      {msg.role === "estudiante" ? (
                        <User size={14} className="text-green-700" />
                      ) : (
                        <span className="text-white text-xs font-bold">
                          {form.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </span>
                      )}
                    </div>
                    <div className={`max-w-[75%] rounded-xl px-4 py-3 text-sm ${
                      msg.role === "estudiante"
                        ? "bg-gray-100 text-gray-800"
                        : "bg-[#4A55A2]/10 text-gray-800"
                    }`}>
                      <p className="text-xs font-medium mb-1 text-gray-500">
                        {msg.role === "estudiante" ? "Terapeuta" : form.name}
                      </p>
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Analysis */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-4">Analisis del perfil</h3>

              {/* Scores */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <ScoreCard label="Consistencia" value={testResult.analysis.consistency} />
                <ScoreCard label="Realismo" value={testResult.analysis.realism} />
                <ScoreCard label="Matriz" value={testResult.analysis.matrix_compliance} />
              </div>

              {/* Details */}
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-green-700 mb-2">Fortalezas</h4>
                  <ul className="space-y-1">
                    {testResult.analysis.strengths.map((s, i) => (
                      <li key={i} className="text-sm text-gray-600 flex items-start gap-1.5">
                        <span className="text-green-500 mt-0.5">+</span> {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-red-700 mb-2">Debilidades</h4>
                  <ul className="space-y-1">
                    {testResult.analysis.weaknesses.map((w, i) => (
                      <li key={i} className="text-sm text-gray-600 flex items-start gap-1.5">
                        <span className="text-red-500 mt-0.5">-</span> {w}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-[#4A55A2] mb-2">Sugerencias</h4>
                  <ul className="space-y-1">
                    {testResult.analysis.suggestions.map((s, i) => (
                      <li key={i} className="text-sm text-gray-600 flex items-start gap-1.5">
                        <span className="text-[#4A55A2] mt-0.5">*</span> {s}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(1)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
                <ArrowLeft size={18} /> Ajustar perfil
              </button>
              <div className="flex gap-3">
                <button
                  onClick={testConversation}
                  disabled={loading}
                  className="flex items-center gap-2 border border-[#4A55A2] text-[#4A55A2] px-4 py-2.5 rounded-lg hover:bg-[#4A55A2]/5 disabled:opacity-50 transition-colors text-sm font-medium"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  Probar de nuevo
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="flex items-center gap-2 bg-[#4A55A2] text-white px-6 py-2.5 rounded-lg hover:bg-[#3D4890] transition-colors font-medium"
                >
                  Continuar <ArrowRight size={18} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Save */}
        {step === 3 && profile && (
          <div className="space-y-6">
            {/* Image generation */}
            <ImageGenerator
              form={form}
              profile={profile}
              generatedImage={generatedImage}
              setGeneratedImage={setGeneratedImage}
              imagePrompt={imagePrompt}
              setImagePrompt={setImagePrompt}
              imageLoading={imageLoading}
              setImageLoading={setImageLoading}
            />

            {/* Video generation from image */}
            {generatedImage && (
              <VideoGenerator imageUrl={generatedImage} patientName={form.name} />
            )}

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
                  {videoFile ? videoFile.name : "Click para selecciónar video"}
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
            </div>

            {/* Summary */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-4">Resumen</h3>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <dt className="text-gray-500">Nombre</dt>
                <dd className="text-gray-900 font-medium">{form.name}</dd>
                <dt className="text-gray-500">Edad</dt>
                <dd className="text-gray-900">{form.age} años</dd>
                <dt className="text-gray-500">Ocupacion</dt>
                <dd className="text-gray-900">{form.occupation}</dd>
                <dt className="text-gray-500">Dificultad</dt>
                <dd className="text-gray-900">{DIFFICULTY_OPTIONS.find((d) => d.value === form.difficulty)?.label}</dd>
                <dt className="text-gray-500">Quote</dt>
                <dd className="text-gray-900 italic">&ldquo;{profile.quote}&rdquo;</dd>
                <dt className="text-gray-500">Tags</dt>
                <dd className="text-gray-900">{profile.tags.join(", ")}</dd>
                <dt className="text-gray-500">Habilidades</dt>
                <dd className="text-gray-900">{profile.skills_practiced.join(", ")}</dd>
                <dt className="text-gray-500">Sesiónes</dt>
                <dd className="text-gray-900">{profile.total_sessions}</dd>
              </dl>
            </div>

            {/* Save action — prominent */}
            <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-green-800">Paso final: guardar paciente en la plataforma</p>
                  <p className="text-xs text-green-600 mt-0.5">Asegúrate de haber guardado la imagen y el video antes de continuar.</p>
                </div>
                <button
                  onClick={savePatient}
                  disabled={loading}
                  className="flex items-center gap-2 bg-green-600 text-white px-8 py-3 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors font-bold text-base shadow-md"
                >
                  {loading ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
                  Guardar paciente
                </button>
              </div>
            </div>

            <div className="flex justify-start pt-2">
              <button onClick={() => setStep(2)} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors text-sm">
                <ArrowLeft size={16} /> Volver a la prueba
              </button>
            </div>
          </div>
        )}
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
        <option value="">Selecciónar...</option>
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

function ScoreCard({ label, value }: { label: string; value: number }) {
  const color = value >= 8 ? "text-green-600" : value >= 6 ? "text-yellow-600" : "text-red-600";
  return (
    <div className="bg-gray-50 rounded-lg p-4 text-center">
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}

function FichaClinicaPreview({ form, profile, systemPrompt }: { form: PatientFormData; profile: GeneratedProfile; systemPrompt: string }) {
  const [generating, setGenerating] = useState(false);
  const [fichaContent, setFichaContent] = useState<string | null>(null);

  const generateFicha = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/patients/generate-ficha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          age: form.age,
          occupation: form.occupation,
          countries: form.countries,
          presenting_problem: profile.presenting_problem,
          backstory: profile.backstory,
          difficulty_level: form.difficulty,
          personality_traits: profile.personality_traits,
          tags: profile.tags,
          system_prompt: systemPrompt,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setFichaContent(data.content);
      }
    } catch { /* silently fail */ }
    setGenerating(false);
  };

  const downloadPDF = async () => {
    if (!fichaContent) return;
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "letter" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;
    let y = 20;

    // Header
    doc.setFillColor(74, 85, 162);
    doc.rect(0, 0, pageWidth, 35, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("FICHA CLÍNICA", margin, 15);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`${form.name} — ${form.age} años, ${form.occupation}`, margin, 23);
    doc.setFontSize(9);
    doc.text(`${form.countries.join(", ")} | Dificultad: ${form.difficulty} | GlorIA`, margin, 30);
    y = 45;

    // Parse sections
    const sections = fichaContent.split(/\d+\.\s+/).filter(Boolean);
    const titles = fichaContent.match(/\d+\.\s+[A-ZÁÉÍÓÚÑ\s]+/g) || [];

    for (let i = 0; i < sections.length; i++) {
      const title = titles[i]?.trim() || `Sección ${i + 1}`;
      const body = sections[i].trim();

      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFillColor(74, 85, 162);
      doc.rect(margin, y - 4, maxWidth, 8, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(title, margin + 3, y + 1);
      y += 10;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(50, 50, 50);
      const lines = doc.splitTextToSize(body, maxWidth);
      for (const line of lines) {
        if (y > 260) { doc.addPage(); y = 20; }
        doc.text(line, margin, y);
        y += 4.5;
      }
      y += 6;
    }

    // Footers
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.line(margin, 268, pageWidth - margin, 268);
      doc.text(`GlorIA — Ficha clínica de ${form.name} — Página ${i} de ${totalPages}`, margin, 272);
    }

    doc.save(`Ficha_Clinica_${form.name.replace(/\s+/g, "_")}.pdf`);
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-sidebar" />
          <h3 className="font-semibold text-gray-900">Ficha clínica</h3>
        </div>
        <div className="flex items-center gap-2">
          {fichaContent && (
            <button onClick={downloadPDF}
              className="flex items-center gap-1.5 text-sm bg-sidebar text-white px-4 py-2 rounded-lg font-medium hover:bg-sidebar-hover transition-colors">
              <FileText size={14} /> Descargar PDF
            </button>
          )}
          <button onClick={generateFicha} disabled={generating}
            className="flex items-center gap-1.5 text-sm border border-sidebar text-sidebar px-4 py-2 rounded-lg font-medium hover:bg-sidebar/5 transition-colors disabled:opacity-50">
            {generating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {generating ? "Generando..." : fichaContent ? "Regenerar" : "Generar ficha clínica"}
          </button>
        </div>
      </div>

      {fichaContent ? (
        <div className="bg-gray-50 rounded-lg p-4 max-h-[400px] overflow-y-auto">
          <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{fichaContent}</pre>
        </div>
      ) : (
        <p className="text-xs text-gray-400 text-center py-6">
          Genera la ficha clínica para revisión de la escuela de psicología antes de activar el paciente.
        </p>
      )}
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
      detail: `${form.age} años`,
    });

    checks.push({
      label: "Ocupación",
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
      label: "Extensión del prompt",
      pass: systemPrompt.length >= 500,
      detail: `${systemPrompt.length} caracteres (mín. 500)`,
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

    // Add structural checks inline
    const structuralRules = [
      { label: "Secciones (HISTORIA, PERSONALIDAD, etc.)", pass: ["HISTORIA:", "PERSONALIDAD:", "COMPORTAMIENTO", "REGLAS:"].filter(s => systemPrompt.includes(s)).length >= 3, detail: "" },
      { label: "Bullets (-) en vez de texto corrido", pass: (systemPrompt.match(/^- /gm) || []).length >= 5, detail: `${(systemPrompt.match(/^- /gm) || []).length} bullets encontrados` },
      { label: "Corchetes para no verbal [...]", pass: /\[.+\]/.test(systemPrompt), detail: /\[.+\]/.test(systemPrompt) ? "Correcto" : "Falta: [suspira], [mira al suelo]" },
      { label: "Regla anti-repetición", pass: systemPrompt.toLowerCase().includes("nunca repitas"), detail: "" },
      { label: "Límite 1-4 oraciones", pass: /1-4 oraciones|maximo.*oracion/i.test(systemPrompt), detail: "" },
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
          Verifica que el system prompt sea coherente con todas las variables configuradas y que no tenga errores de rol.
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
                  {result.score >= 80 ? "Perfil robusto — listo para usar" : result.score >= 60 ? "Aceptable con mejoras sugeridas" : "Necesita ajustes antes de usar"}
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
              <p className="text-xs font-semibold text-sidebar mb-1.5">Análisis de la IA</p>
              <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line">{result.suggestion}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ImageGenerator({
  form, profile, generatedImage, setGeneratedImage, imagePrompt, setImagePrompt, imageLoading, setImageLoading,
}: {
  form: PatientFormData; profile: GeneratedProfile;
  generatedImage: string | null; setGeneratedImage: (v: string | null) => void;
  imagePrompt: string; setImagePrompt: (v: string) => void;
  imageLoading: boolean; setImageLoading: (v: boolean) => void;
}) {
  const [error, setError] = useState("");
  const [showPrompt, setShowPrompt] = useState(false);

  const buildDefaultPrompt = () => {
    const gender = form.gender === "Femeniño" ? "woman" : form.gender === "Masculino" ? "man" : "person";
    const countries = form.countries.join(", ");

    // Diversity-driven appearance details based on country and age
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

    // Age-related appearance
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
        // Keep polling every 5 seconds
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
          <p className="text-[10px] text-gray-300 mt-1">Usa Luma Dream Machine — movimiento sutil y natural</p>
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
            Tip: para mejores resultados, describe movimientos sutiles (parpadeo, respiración) y evita movimientos bruscos.
          </p>
        </div>
      )}
    </div>
  );
}
