"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Camera, Check, Eye, EyeOff, Loader2, RotateCcw,
  User as UserIcon, Sparkles, Settings as SettingsIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type A11yPrefs = { fontSize?: "m" | "l" | "xl"; contrast?: "default" | "high" | "sepia" };

interface Props {
  userId: string;
  fullName: string;
  email: string;
  role: string;
  avatarUrl: string | null;
  establishmentName: string | null;
  a11yPrefs: A11yPrefs;
}

const ROLE_LABELS: Record<string, string> = {
  student: "Estudiante",
  instructor: "Docente",
  admin: "Administrador",
  superadmin: "Superadmin",
};

type SectionKey = "cuenta" | "apariencia" | "onboarding";

const SECTIONS: { key: SectionKey; label: string; icon: React.ComponentType<{ size?: number; className?: string }>; description: string }[] = [
  { key: "cuenta", label: "Cuenta", icon: UserIcon, description: "Tus datos y contraseña" },
  { key: "apariencia", label: "Apariencia y accesibilidad", icon: Sparkles, description: "Tamaño de letra y contraste" },
  { key: "onboarding", label: "Onboarding y tour", icon: SettingsIcon, description: "Reiniciar bienvenida" },
];

export default function ProfileClient({
  userId,
  fullName,
  email,
  role,
  avatarUrl,
  establishmentName,
  a11yPrefs: initialA11y,
}: Props) {
  const router = useRouter();
  const [section, setSection] = useState<SectionKey>("cuenta");

  return (
    <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
      {/* Sidebar de secciones */}
      <aside className="bg-white rounded-2xl border border-gray-200 p-2 h-fit md:sticky md:top-4">
        <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
          {SECTIONS.map((s) => {
            const active = s.key === section;
            return (
              <button
                key={s.key}
                onClick={() => setSection(s.key)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors flex-shrink-0 md:flex-shrink md:w-full cursor-pointer ${
                  active
                    ? "bg-sidebar/10 text-sidebar"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <s.icon size={16} className={active ? "text-sidebar" : "text-gray-400"} />
                <span className="text-sm font-medium whitespace-nowrap md:whitespace-normal">{s.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Contenido de la sección activa */}
      <div className="min-w-0">
        {section === "cuenta" && (
          <CuentaSection
            userId={userId}
            fullName={fullName}
            email={email}
            role={role}
            avatarUrl={avatarUrl}
            establishmentName={establishmentName}
            onAvatarChange={() => router.refresh()}
          />
        )}
        {section === "apariencia" && <AparienciaSection initial={initialA11y} />}
        {section === "onboarding" && <OnboardingSection />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SECCIÓN: CUENTA
// ─────────────────────────────────────────────────────────────────

function CuentaSection({
  userId,
  fullName,
  email,
  role,
  avatarUrl,
  establishmentName,
  onAvatarChange,
}: {
  userId: string;
  fullName: string;
  email: string;
  role: string;
  avatarUrl: string | null;
  establishmentName: string | null;
  onAvatarChange: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatar, setAvatar] = useState(avatarUrl);
  const [uploading, setUploading] = useState(false);

  // Password
  const [showPwSection, setShowPwSection] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const initials = fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 2 * 1024 * 1024) return;

    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${userId}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });

    if (error) {
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const publicUrl = urlData.publicUrl;

    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatar_url: publicUrl }),
    });

    setAvatar(publicUrl);
    setUploading(false);
    onAvatarChange();
  };

  const handlePasswordChange = async () => {
    setPwMsg(null);
    if (newPw.length < 6) {
      setPwMsg({ type: "err", text: "La contraseña debe tener al menos 6 caracteres" });
      return;
    }
    if (newPw !== confirmPw) {
      setPwMsg({ type: "err", text: "Las contraseñas no coinciden" });
      return;
    }
    setPwSaving(true);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ new_password: newPw }),
    });
    if (res.ok) {
      setPwMsg({ type: "ok", text: "Contraseña actualizada correctamente" });
      setNewPw("");
      setConfirmPw("");
      setShowPwSection(false);
    } else {
      const data = await res.json();
      setPwMsg({ type: "err", text: data.error || "Error al actualizar" });
    }
    setPwSaving(false);
  };

  return (
    <div className="space-y-6">
      {/* Avatar + Basic info */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-start gap-5">
          <div className="relative group">
            <div className="w-20 h-20 rounded-full bg-sidebar/10 flex items-center justify-center overflow-hidden">
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-sidebar">{initials}</span>
              )}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
            >
              {uploading ? <Loader2 size={20} className="text-white animate-spin" /> : <Camera size={20} className="text-white" />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900">{fullName}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{email}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-sidebar bg-sidebar/10 px-2.5 py-0.5 rounded-full">
                {ROLE_LABELS[role] || role}
              </span>
              {establishmentName && (
                <span className="text-[10px] text-gray-400">{establishmentName}</span>
              )}
            </div>
          </div>
        </div>
        <p className="text-[11px] text-gray-400 mt-4">
          Haz click sobre tu avatar para cambiar la foto de perfil. Máximo 2 MB.
        </p>
      </div>

      {/* Read-only fields */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Información de cuenta</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ReadField label="Nombre completo" value={fullName} />
          <ReadField label="Correo electrónico" value={email} />
          <ReadField label="Rol" value={ROLE_LABELS[role] || role} />
          <ReadField label="Institución" value={establishmentName || "Sin asignar"} />
        </div>
        <p className="text-[11px] text-gray-400 mt-3">
          Estos datos son administrados por tu institución y no pueden ser modificados directamente.
        </p>
      </div>

      {/* Password */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Contraseña</h3>
          {!showPwSection && (
            <button
              onClick={() => setShowPwSection(true)}
              className="text-xs text-sidebar font-medium hover:underline cursor-pointer"
            >
              Cambiar contraseña
            </button>
          )}
        </div>

        {pwMsg && (
          <div className={`text-xs px-3 py-2 rounded-lg mb-3 ${
            pwMsg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
          }`}>
            {pwMsg.text}
          </div>
        )}

        {showPwSection && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nueva contraseña</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm pr-10"
                  placeholder="Mínimo 6 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer"
                >
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Confirmar contraseña</label>
              <input
                type={showPw ? "text" : "password"}
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Repite la contraseña"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handlePasswordChange}
                disabled={pwSaving || !newPw || !confirmPw}
                className="flex items-center gap-1.5 bg-sidebar text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-sidebar-hover disabled:opacity-50 transition-colors cursor-pointer"
              >
                {pwSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Guardar
              </button>
              <button
                onClick={() => { setShowPwSection(false); setNewPw(""); setConfirmPw(""); setPwMsg(null); }}
                className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {!showPwSection && !pwMsg && (
          <p className="text-xs text-gray-400">
            Tu contraseña se puede cambiar en cualquier momento.
          </p>
        )}
      </div>
    </div>
  );
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <p className="text-sm text-gray-900 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
        {value || "—"}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SECCIÓN: APARIENCIA Y ACCESIBILIDAD
// ─────────────────────────────────────────────────────────────────

const FONT_OPTIONS: { key: NonNullable<A11yPrefs["fontSize"]>; label: string; sample: string }[] = [
  { key: "m", label: "Medio", sample: "Aa" },
  { key: "l", label: "Grande", sample: "Aa" },
  { key: "xl", label: "Extra grande", sample: "Aa" },
];

const CONTRAST_OPTIONS: {
  key: NonNullable<A11yPrefs["contrast"]>;
  label: string;
  description: string;
  swatchClass: string;
}[] = [
  {
    key: "default",
    label: "Estándar",
    description: "Colores normales de la plataforma",
    swatchClass: "bg-white border-gray-300",
  },
  {
    key: "high",
    label: "Alto contraste",
    description: "Fondo oscuro y texto claro, máxima legibilidad",
    swatchClass: "bg-neutral-900 border-yellow-400",
  },
  {
    key: "sepia",
    label: "Sepia",
    description: "Tonos cálidos, mejor para lectura prolongada",
    swatchClass: "bg-[#f5efe0] border-[#d6c9a8]",
  },
];

function applyPrefsToDom(prefs: A11yPrefs) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("a11y-font-m", "a11y-font-l", "a11y-font-xl");
  root.classList.add(`a11y-font-${prefs.fontSize || "m"}`);
  root.classList.remove("contrast-high", "contrast-sepia");
  if (prefs.contrast === "high") root.classList.add("contrast-high");
  if (prefs.contrast === "sepia") root.classList.add("contrast-sepia");
}

function AparienciaSection({ initial }: { initial: A11yPrefs }) {
  const [prefs, setPrefs] = useState<A11yPrefs>(initial);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    applyPrefsToDom(prefs);
  }, [prefs]);

  const save = (next: A11yPrefs) => {
    setPrefs(next);
    applyPrefsToDom(next);
    fetch("/api/profile/a11y", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    })
      .then(() => setSavedAt(Date.now()))
      .catch(() => { /* noop */ });
  };

  const justSaved = savedAt && Date.now() - savedAt < 2000;

  return (
    <div className="space-y-6">
      {/* Tamaño de letra */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Tamaño de letra</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Afecta el chat, los mensajes y los formularios.
            </p>
          </div>
          {justSaved && (
            <span className="text-[11px] text-emerald-600 flex items-center gap-1">
              <Check size={12} /> Guardado
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {FONT_OPTIONS.map((opt) => {
            const active = (prefs.fontSize || "m") === opt.key;
            const sampleSize = opt.key === "xl" ? "text-2xl" : opt.key === "l" ? "text-lg" : "text-base";
            return (
              <button
                key={opt.key}
                onClick={() => save({ ...prefs, fontSize: opt.key })}
                className={`flex flex-col items-center gap-1 py-4 rounded-xl border-2 transition-colors cursor-pointer ${
                  active
                    ? "border-sidebar bg-sidebar/5 text-sidebar"
                    : "border-gray-200 hover:border-gray-300 text-gray-700"
                }`}
              >
                <span className={`font-semibold ${sampleSize}`}>{opt.sample}</span>
                <span className="text-[11px]">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tema */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Tema</h3>
        <p className="text-xs text-gray-500 mb-4">
          Cambia el fondo, texto y bordes de la plataforma. Las fotos y el banner se mantienen igual.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {CONTRAST_OPTIONS.map((opt) => {
            const active = (prefs.contrast || "default") === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => save({ ...prefs, contrast: opt.key })}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors text-center cursor-pointer ${
                  active
                    ? "border-sidebar bg-sidebar/5"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <span className={`w-12 h-12 rounded-full border-2 flex items-center justify-center ${opt.swatchClass}`}>
                  {active && (
                    <Check
                      size={16}
                      className={
                        opt.key === "high" ? "text-yellow-400" : opt.key === "sepia" ? "text-[#3a2e1f]" : "text-sidebar"
                      }
                    />
                  )}
                </span>
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${active ? "text-sidebar" : "text-gray-900"}`}>
                    {opt.label}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">{opt.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-[11px] text-gray-400">
        Tus preferencias se guardan automáticamente y te siguen entre dispositivos.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SECCIÓN: ONBOARDING
// ─────────────────────────────────────────────────────────────────

function OnboardingSection() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <RotateCcw size={14} className="text-sidebar" />
              Reiniciar onboarding
            </h3>
            <p className="text-xs text-gray-500 max-w-md">
              Restaura el video de bienvenida y el tour del chat como si entraras
              por primera vez. Útil si quieres volver a verlos o si estás
              probando la plataforma.
            </p>
          </div>
          <button
            onClick={() => {
              if (typeof window === "undefined") return;
              localStorage.removeItem("gloria_welcome_seen");
              localStorage.removeItem("gloria_chat_tour_done");
              alert(
                "Listo. Recarga la página (F5) y al volver al dashboard verás el video de bienvenida. " +
                "El tour del chat aparece la próxima vez que inicies una sesión nueva con un paciente.",
              );
            }}
            className="flex-shrink-0 px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg transition-colors cursor-pointer"
          >
            Reiniciar
          </button>
        </div>
      </div>
    </div>
  );
}
