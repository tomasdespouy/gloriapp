"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, ToggleLeft, ToggleRight, ImageIcon, Video, RefreshCw, Upload, Loader2, Sparkles } from "lucide-react";

interface FamilyMember {
  name: string;
  age: number;
  relationship: string;
  notes: string;
}

interface Patient {
  id: string;
  name: string;
  age: number | null;
  occupation: string | null;
  quote: string;
  presenting_problem: string;
  backstory: string;
  system_prompt: string;
  difficulty_level: string;
  tags: string[];
  skills_practiced: string[];
  total_sessions: number;
  country: string[] | string | null;
  country_origin: string | null;
  country_residence: string | null;
  birthday: string | null;
  neighborhood: string | null;
  family_members: FamilyMember[] | null;
  is_active: boolean;
}

const COUNTRY_OPTIONS = [
  "Chile", "Argentina", "Colombia", "México", "Perú",
  "España", "Ecuador", "Bolivia", "Uruguay", "Paraguay", "Venezuela",
  "República Dominicana",
];

export default function PatientEditForm({ patient }: { patient: Patient }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: patient.name,
    age: patient.age || 30,
    occupation: patient.occupation || "",
    quote: patient.quote,
    presenting_problem: patient.presenting_problem,
    backstory: patient.backstory,
    system_prompt: patient.system_prompt,
    difficulty_level: patient.difficulty_level,
    tags: patient.tags?.join(", ") || "",
    skills_practiced: patient.skills_practiced?.join(", ") || "",
    total_sessions: patient.total_sessions || 5,
    country_origin: patient.country_origin || "",
    country_residence: patient.country_residence || "",
    visible_countries: (Array.isArray(patient.country) ? patient.country : patient.country ? [patient.country] : ["Chile"]) as string[],
    birthday: patient.birthday || "",
    neighborhood: patient.neighborhood || "",
    family_members: (patient.family_members || []) as FamilyMember[],
    is_active: patient.is_active,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Media state
  const slug = patient.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const [imageUrl, setImageUrl] = useState(`${supabaseUrl}/storage/v1/object/public/patients/${slug}.png`);
  const [videoUrl, setVideoUrl] = useState(`${supabaseUrl}/storage/v1/object/public/patients/${slug}.mp4`);
  const [imageLoading, setImageLoading] = useState(false);
  const [imagePrompt, setImagePrompt] = useState("");
  const [showImagePrompt, setShowImagePrompt] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoGenerating, setVideoGenerating] = useState<false | "generating" | "polling">(false);
  const [mediaMessage, setMediaMessage] = useState("");
  const [imageError, setImageError] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const generateImage = async () => {
    const prompt = imagePrompt || `Professional portrait photograph of a ${form.age}-year-old person from ${form.country_origin || "Chile"} who works as ${form.occupation}. Neutral expression, natural lighting, clean background. Realistic, not a model. No text, no watermarks.`;
    if (!imagePrompt) setImagePrompt(prompt);
    setImageLoading(true);
    setMediaMessage("");
    try {
      const res = await fetch("/api/patients/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al generar imagen");
      if (data.revised_prompt) setImagePrompt(data.revised_prompt);

      // Upload to Supabase Storage
      const uploadRes = await fetch("/api/patients/upload-asset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: data.url, slug, type: "image" }),
      });
      if (!uploadRes.ok) throw new Error("Error al subir imagen a storage");

      setImageUrl(`${supabaseUrl}/storage/v1/object/public/patients/${slug}.png?t=${Date.now()}`);
      setImageError(false);
      setMediaMessage("Imagen generada correctamente");
    } catch (e) {
      setMediaMessage("Error imagen: " + (e instanceof Error ? e.message : "desconocido"));
    } finally {
      setImageLoading(false);
    }
  };

  const handleVideoUpload = async (file: File) => {
    setVideoUploading(true);
    setMediaMessage("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("slug", slug);
      const res = await fetch("/api/patients/upload-video", { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al subir");
      }
      setVideoUrl(`${supabaseUrl}/storage/v1/object/public/patients/${slug}.mp4?t=${Date.now()}`);
      setVideoError(false);
      setMediaMessage("Video subido correctamente");
    } catch (e) {
      setMediaMessage("Error video: " + (e instanceof Error ? e.message : "desconocido"));
    } finally {
      setVideoUploading(false);
    }
  };

  const generateVideo = async () => {
    const currentImage = imageUrl.split("?")[0];
    setVideoGenerating("generating");
    setMediaMessage("");
    try {
      const res = await fetch("/api/patients/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: currentImage,
          prompt: "Subtle natural movement: gentle breathing, slight eye blinks, micro facial expressions. The person stays still, looking forward with a calm, neutral presence. Photorealistic, no camera movement.",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al iniciar generación de video");

      setVideoGenerating("polling");
      setMediaMessage("Video en proceso... esto puede tomar 1-2 minutos");
      const genId = data.id;
      let attempts = 0;
      const maxAttempts = 60; // 5 min max

      const poll = async (): Promise<string> => {
        attempts++;
        if (attempts > maxAttempts) throw new Error("Tiempo de espera agotado (5 min). Intenta de nuevo.");
        const r = await fetch(`/api/patients/generate-video?id=${genId}`);
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Error consultando estado");
        if (d.state === "completed" && d.video_url) return d.video_url;
        if (d.state === "failed") throw new Error("Luma AI: la generación de video falló. Intenta con otra imagen.");
        setMediaMessage(`Generando video... (${attempts * 5}s)`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return poll();
      };
      const finalVideoUrl = await poll();

      // Upload to Supabase Storage
      const uploadRes = await fetch("/api/patients/upload-asset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: finalVideoUrl, slug, type: "video" }),
      });
      if (!uploadRes.ok) throw new Error("Error al subir video a storage");

      setVideoUrl(`${supabaseUrl}/storage/v1/object/public/patients/${slug}.mp4?t=${Date.now()}`);
      setVideoError(false);
      setMediaMessage("Video generado y guardado correctamente");
    } catch (e) {
      setMediaMessage("Error video: " + (e instanceof Error ? e.message : "desconocido"));
    } finally {
      setVideoGenerating(false);
    }
  };

  const [generatingBackstory, setGeneratingBackstory] = useState(false);

  const generateBackstory = async () => {
    setGeneratingBackstory(true);
    try {
      // Use the full profile generator and extract backstory
      const res = await fetch("/api/patients/generate-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          age: form.age,
          gender: "",
          occupation: form.occupation,
          countries: [form.country_origin || form.country_residence || "República Dominicana"],
          countryOrigin: form.country_origin || "",
          countryResidence: form.country_residence || "",
          context: "",
          motivo: form.presenting_problem || "Consulta general",
          archetype: "",
          personalityTraits: [],
          defenseMechanisms: [],
          openness: "",
          sensitiveTopics: [],
          variability: "",
          difficulty: form.difficulty_level,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al generar");
      if (data.backstory) update("backstory", data.backstory);
      if (data.presenting_problem && !form.presenting_problem) update("presenting_problem", data.presenting_problem);
      if (data.birthday && !form.birthday) update("birthday", data.birthday);
      if (data.neighborhood && !form.neighborhood) update("neighborhood", data.neighborhood);
      if (data.family_members?.length && form.family_members.length === 0) update("family_members", data.family_members);
    } catch (e) {
      setMessage("Error: " + (e instanceof Error ? e.message : "al generar historia"));
    } finally {
      setGeneratingBackstory(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage("");

    const res = await fetch(`/api/patients/${patient.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        age: form.age,
        occupation: form.occupation,
        quote: form.quote,
        presenting_problem: form.presenting_problem,
        backstory: form.backstory,
        system_prompt: form.system_prompt,
        difficulty_level: form.difficulty_level,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        skills_practiced: form.skills_practiced.split(",").map((t) => t.trim()).filter(Boolean),
        total_sessions: form.total_sessions,
        country_origin: form.country_origin || null,
        country_residence: form.country_residence || null,
        country: form.visible_countries,
        birthday: form.birthday || null,
        neighborhood: form.neighborhood || null,
        family_members: form.family_members,
        is_active: form.is_active,
      }),
    });

    if (res.ok) {
      setMessage("Guardado correctamente");
      router.refresh();
    } else {
      const data = await res.json();
      setMessage(data.error || "Error al guardar");
    }
    setSaving(false);
  };

  const update = (key: string, value: unknown) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-6">
      {/* Basic info */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Información básica</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
            <input value={form.name} onChange={(e) => update("name", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Edad</label>
            <input type="number" value={form.age} onChange={(e) => update("age", parseInt(e.target.value) || 0)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Ocupación</label>
            <input value={form.occupation} onChange={(e) => update("occupation", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Dificultad</label>
            <select value={form.difficulty_level} onChange={(e) => update("difficulty_level", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <option value="beginner">Principiante</option>
              <option value="intermediate">Intermedio</option>
              <option value="advanced">Avanzado</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">País de origen</label>
            <select value={form.country_origin} onChange={(e) => update("country_origin", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <option value="">Seleccionar...</option>
              {COUNTRY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">País de residencia</label>
            <select value={form.country_residence} onChange={(e) => update("country_residence", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <option value="">Seleccionar...</option>
              {COUNTRY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de nacimiento</label>
            <input type="date" value={form.birthday} onChange={(e) => update("birthday", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Barrio / sector</label>
            <input value={form.neighborhood} onChange={(e) => update("neighborhood", e.target.value)}
              placeholder="Ej: Villa Mella, Santo Domingo Norte"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Frase característica</label>
            <input value={form.quote} onChange={(e) => update("quote", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Activar para países</label>
            <p className="text-[11px] text-gray-400 mb-2">Selecciona en qué países será visible este paciente para los estudiantes</p>
            <div className="flex flex-wrap gap-2">
              {COUNTRY_OPTIONS.map((c) => {
                const isSelected = form.visible_countries.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      update(
                        "visible_countries",
                        isSelected
                          ? form.visible_countries.filter((v: string) => v !== c)
                          : [...form.visible_countries, c]
                      );
                    }}
                    className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                      isSelected
                        ? "bg-sidebar text-white border-sidebar"
                        : "bg-white text-gray-600 border-gray-200 hover:border-sidebar/40"
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Image & Video */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Imagen y video</h3>
        {mediaMessage && (
          <div className={`text-xs px-3 py-2 rounded-lg mb-4 ${
            mediaMessage.startsWith("Error") ? "bg-red-50 text-red-600" :
            mediaMessage.includes("proceso") || mediaMessage.includes("Generando") ? "bg-blue-50 text-blue-600" :
            "bg-green-50 text-green-600"
          }`}>
            {mediaMessage}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Image */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Foto del paciente</label>
            <div className="relative rounded-xl overflow-hidden bg-gray-100 aspect-square max-w-[240px]">
              {!imageError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt={patient.name}
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon size={40} className="text-gray-300" />
                </div>
              )}
            </div>
            <div className="mt-3 space-y-2">
              <button
                onClick={generateImage}
                disabled={imageLoading}
                className="flex items-center gap-2 text-xs bg-sidebar text-white px-3 py-2 rounded-lg font-medium hover:bg-[#354080] transition-colors disabled:opacity-50"
              >
                {imageLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {imageLoading ? "Generando..." : imageError ? "Generar imagen" : "Regenerar imagen"}
              </button>
              <button
                onClick={() => setShowImagePrompt(!showImagePrompt)}
                className="text-[11px] text-sidebar hover:underline"
              >
                {showImagePrompt ? "Ocultar prompt" : "Ver/editar prompt"}
              </button>
              {showImagePrompt && (
                <div className="space-y-2 animate-fade-in">
                  <textarea
                    value={imagePrompt || `Professional portrait of a ${form.age}-year-old person from ${form.country_origin || "Chile"}, ${form.occupation}. Realistic, natural lighting, neutral background. No text.`}
                    onChange={(e) => setImagePrompt(e.target.value)}
                    rows={3}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono resize-y"
                  />
                  <button
                    onClick={() => generateImage()}
                    disabled={imageLoading}
                    className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    Generar con este prompt
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Video */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Video del paciente</label>
            <div className="rounded-xl overflow-hidden bg-gray-100 aspect-square max-w-[240px]">
              {!videoError ? (
                <video
                  src={videoUrl}
                  className="w-full h-full object-cover"
                  controls
                  muted
                  onError={() => setVideoError(true)}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                  <Video size={40} className="text-gray-300" />
                  <p className="text-[11px] text-gray-400">Sin video</p>
                </div>
              )}
            </div>
            <div className="mt-3 space-y-2">
              <button
                onClick={generateVideo}
                disabled={!!videoGenerating || imageError}
                className="flex items-center gap-2 text-xs bg-sidebar text-white px-3 py-2 rounded-lg font-medium hover:bg-[#354080] transition-colors disabled:opacity-50 w-fit"
              >
                {videoGenerating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {videoGenerating === "generating"
                  ? "Iniciando..."
                  : videoGenerating === "polling"
                  ? "Generando video (puede tomar 1-2 min)..."
                  : videoError
                  ? "Generar video desde imagen"
                  : "Regenerar video"}
              </button>
              {imageError && (
                <p className="text-[11px] text-amber-600">Primero genera una imagen para poder crear el video.</p>
              )}
              <label className="flex items-center gap-2 text-xs text-gray-600 border border-gray-200 px-3 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors cursor-pointer w-fit">
                {videoUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {videoUploading ? "Subiendo..." : "O subir video (.mp4)"}
                <input
                  type="file"
                  accept="video/mp4"
                  className="hidden"
                  disabled={videoUploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleVideoUpload(file);
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Family members */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Grupo familiar</h3>
          <button
            type="button"
            onClick={() => update("family_members", [...form.family_members, { name: "", age: 0, relationship: "", notes: "" }])}
            className="text-xs text-sidebar hover:underline"
          >
            + Agregar familiar
          </button>
        </div>
        {form.family_members.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-3">Sin familiares registrados. Usa &quot;Generar con IA&quot; en la historia o agrega manualmente.</p>
        ) : (
          <div className="space-y-3">
            {form.family_members.map((member, i) => (
              <div key={i} className="grid grid-cols-[1fr_60px_1fr_1fr_32px] gap-2 items-end">
                <div>
                  {i === 0 && <label className="block text-[10px] text-gray-500 mb-0.5">Nombre</label>}
                  <input
                    value={member.name}
                    onChange={(e) => {
                      const updated = [...form.family_members];
                      updated[i] = { ...updated[i], name: e.target.value };
                      update("family_members", updated);
                    }}
                    placeholder="Nombre"
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div>
                  {i === 0 && <label className="block text-[10px] text-gray-500 mb-0.5">Edad</label>}
                  <input
                    type="number"
                    value={member.age || ""}
                    onChange={(e) => {
                      const updated = [...form.family_members];
                      updated[i] = { ...updated[i], age: parseInt(e.target.value) || 0 };
                      update("family_members", updated);
                    }}
                    placeholder="Edad"
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div>
                  {i === 0 && <label className="block text-[10px] text-gray-500 mb-0.5">Relación</label>}
                  <select
                    value={member.relationship}
                    onChange={(e) => {
                      const updated = [...form.family_members];
                      updated[i] = { ...updated[i], relationship: e.target.value };
                      update("family_members", updated);
                    }}
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="madre">Madre</option>
                    <option value="padre">Padre</option>
                    <option value="hermano/a">Hermano/a</option>
                    <option value="hijo/a">Hijo/a</option>
                    <option value="pareja">Pareja</option>
                    <option value="esposo/a">Esposo/a</option>
                    <option value="abuelo/a">Abuelo/a</option>
                    <option value="tío/a">Tío/a</option>
                    <option value="primo/a">Primo/a</option>
                    <option value="amigo/a cercano">Amigo/a cercano</option>
                  </select>
                </div>
                <div>
                  {i === 0 && <label className="block text-[10px] text-gray-500 mb-0.5">Nota</label>}
                  <input
                    value={member.notes}
                    onChange={(e) => {
                      const updated = [...form.family_members];
                      updated[i] = { ...updated[i], notes: e.target.value };
                      update("family_members", updated);
                    }}
                    placeholder="Nota breve"
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const updated = form.family_members.filter((_, j) => j !== i);
                    update("family_members", updated);
                  }}
                  className="text-gray-400 hover:text-red-500 text-xs pb-1"
                  title="Eliminar"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Clinical info */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Información clínica</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Motivo de consulta</label>
            <textarea value={form.presenting_problem} onChange={(e) => update("presenting_problem", e.target.value)}
              rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-gray-600">Historia del paciente</label>
              <button
                type="button"
                onClick={generateBackstory}
                disabled={generatingBackstory}
                className="flex items-center gap-1 text-[11px] text-sidebar hover:underline disabled:opacity-50"
              >
                {generatingBackstory ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {generatingBackstory ? "Generando..." : "Generar con IA"}
              </button>
            </div>
            <textarea value={form.backstory} onChange={(e) => update("backstory", e.target.value)}
              rows={5} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-y"
              placeholder="Historia de vida del paciente, contexto familiar, eventos relevantes..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Etiquetas (separadas por coma)</label>
            <input value={form.tags} onChange={(e) => update("tags", e.target.value)}
              placeholder="ansiedad, duelo, relaciones..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Habilidades practicadas (separadas por coma)</label>
            <input value={form.skills_practiced} onChange={(e) => update("skills_practiced", e.target.value)}
              placeholder="empatía, escucha activa..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
      </div>

      {/* System prompt */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">System prompt</h3>
        <p className="text-xs text-gray-400 mb-3">Instrucciones que recibe la IA para comportarse como este paciente</p>
        <textarea
          value={form.system_prompt}
          onChange={(e) => update("system_prompt", e.target.value)}
          rows={15}
          className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm font-mono resize-y"
        />
      </div>

      {/* Status & save */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => update("is_active", !form.is_active)} className="flex items-center gap-2">
              {form.is_active ? (
                <><ToggleRight size={24} className="text-green-600" /><span className="text-sm font-medium text-green-700">Activo</span></>
              ) : (
                <><ToggleLeft size={24} className="text-gray-400" /><span className="text-sm font-medium text-gray-500">Inactivo</span></>
              )}
            </button>
            <span className="text-xs text-gray-400">
              {form.is_active ? "Visible para estudiantes" : "Oculto para estudiantes"}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {message && (
              <span className={`text-xs ${message.includes("Error") ? "text-red-500" : "text-green-600"}`}>
                {message}
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-sidebar text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-sidebar-hover transition-colors disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
