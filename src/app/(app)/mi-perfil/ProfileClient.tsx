"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, Eye, EyeOff, Loader2, RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  userId: string;
  fullName: string;
  email: string;
  role: string;
  avatarUrl: string | null;
  establishmentName: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  student: "Estudiante",
  instructor: "Docente",
  admin: "Administrador",
  superadmin: "Superadmin",
};

export default function ProfileClient({
  userId,
  fullName,
  email,
  role,
  avatarUrl,
  establishmentName,
}: Props) {
  const router = useRouter();
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

    // Validate
    if (!file.type.startsWith("image/")) return;
    if (file.size > 2 * 1024 * 1024) return; // 2MB max

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

    const { data: urlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(path);

    const publicUrl = urlData.publicUrl;

    // Update profile
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatar_url: publicUrl }),
    });

    setAvatar(publicUrl);
    setUploading(false);
    router.refresh();
  };

  const handlePasswordChange = async () => {
    setPwMsg(null);
    if (newPw.length < 6) {
      setPwMsg({ type: "err", text: "La contrase\u00f1a debe tener al menos 6 caracteres" });
      return;
    }
    if (newPw !== confirmPw) {
      setPwMsg({ type: "err", text: "Las contrase\u00f1as no coinciden" });
      return;
    }

    setPwSaving(true);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ new_password: newPw }),
    });

    if (res.ok) {
      setPwMsg({ type: "ok", text: "Contrase\u00f1a actualizada correctamente" });
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
          {/* Avatar */}
          <div className="relative group">
            <div className="w-20 h-20 rounded-full bg-[#4A55A2]/10 flex items-center justify-center overflow-hidden">
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-[#4A55A2]">{initials}</span>
              )}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
            >
              {uploading ? (
                <Loader2 size={20} className="text-white animate-spin" />
              ) : (
                <Camera size={20} className="text-white" />
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900">{fullName}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{email}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[#4A55A2] bg-[#4A55A2]/10 px-2.5 py-0.5 rounded-full">
                {ROLE_LABELS[role] || role}
              </span>
              {establishmentName && (
                <span className="text-[10px] text-gray-400">
                  {establishmentName}
                </span>
              )}
            </div>
          </div>
        </div>
        <p className="text-[11px] text-gray-400 mt-4">
          Haz click sobre tu avatar para cambiar la foto de perfil. M&aacute;ximo 2 MB.
        </p>
      </div>

      {/* Read-only fields */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Informaci&oacute;n de cuenta</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nombre completo</label>
            <p className="text-sm text-gray-900 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
              {fullName || "\u2014"}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Correo electr&oacute;nico</label>
            <p className="text-sm text-gray-900 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
              {email || "\u2014"}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Rol</label>
            <p className="text-sm text-gray-900 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
              {ROLE_LABELS[role] || role}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Instituci&oacute;n</label>
            <p className="text-sm text-gray-900 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
              {establishmentName || "Sin asignar"}
            </p>
          </div>
        </div>
        <p className="text-[11px] text-gray-400 mt-3">
          Estos datos son administrados por tu instituci&oacute;n y no pueden ser modificados directamente.
        </p>
      </div>

      {/* Password */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Contrase&ntilde;a</h3>
          {!showPwSection && (
            <button
              onClick={() => setShowPwSection(true)}
              className="text-xs text-[#4A55A2] font-medium hover:underline"
            >
              Cambiar contrase&ntilde;a
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
              <label className="block text-xs font-medium text-gray-600 mb-1">Nueva contrase&ntilde;a</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm pr-10"
                  placeholder="M\u00ednimo 6 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Confirmar contrase&ntilde;a</label>
              <input
                type={showPw ? "text" : "password"}
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Repite la contrase&ntilde;a"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handlePasswordChange}
                disabled={pwSaving || !newPw || !confirmPw}
                className="flex items-center gap-1.5 bg-[#4A55A2] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#354080] disabled:opacity-50 transition-colors"
              >
                {pwSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Guardar
              </button>
              <button
                onClick={() => { setShowPwSection(false); setNewPw(""); setConfirmPw(""); setPwMsg(null); }}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {!showPwSection && !pwMsg && (
          <p className="text-xs text-gray-400">
            Tu contrase&ntilde;a se puede cambiar en cualquier momento.
          </p>
        )}
      </div>

      {/* Reset onboarding — re-trigger welcome video and chat tour */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <RotateCcw size={14} className="text-[#4A55A2]" />
              Reiniciar onboarding
            </h3>
            <p className="text-xs text-gray-500 max-w-md">
              Restaura el video de bienvenida y el tour del chat como si entraras
              por primera vez. &Uacute;til si quieres volver a verlos o si est&aacute;s
              probando la plataforma.
            </p>
          </div>
          <button
            onClick={() => {
              if (typeof window === "undefined") return;
              localStorage.removeItem("gloria_welcome_seen");
              localStorage.removeItem("gloria_chat_tour_done");
              alert(
                "Listo. Recarga la p\u00e1gina (F5) y al volver al dashboard ver\u00e1s el video de bienvenida. " +
                "El tour del chat aparece la pr\u00f3xima vez que inicies una sesi\u00f3n nueva con un paciente.",
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
