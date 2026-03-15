"use client";

import {
  Home, User, History, BarChart3, BookOpen, Info,
  Users, ClipboardCheck, LayoutDashboard, Building2,
  Accessibility, LifeBuoy,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import Portal from "@/components/Portal";

const studentNav = [
  { icon: Home, label: "Inicio", href: "/dashboard" },
  { icon: BarChart3, label: "Mi progreso", href: "/progreso" },
  { icon: BookOpen, label: "Aprendizaje", href: "/aprendizaje" },
  { icon: User, label: "Pacientes", href: "/pacientes" },
  { icon: History, label: "Mi historial", href: "/historial" },
  { icon: Info, label: "Sobre GlorIA", href: "/sobre" },
];

const instructorNav = [
  { icon: LayoutDashboard, label: "Panel docente", href: "/docente/dashboard" },
  { icon: Users, label: "Mis alumnos", href: "/docente/dashboard" },
  { icon: ClipboardCheck, label: "Sesiones", href: "/docente/dashboard#sesiones" },
  { icon: User, label: "Pacientes", href: "/perfiles" },
  { icon: Info, label: "Sobre GlorIA", href: "/sobre" },
];

const adminNav = (isSuperadmin: boolean) => [
  { icon: LayoutDashboard, label: "Panel admin", href: "/admin/dashboard" },
  ...(isSuperadmin ? [{ icon: Building2, label: "Instituciones", href: "/admin/establecimientos" }] : []),
  { icon: Users, label: "Usuarios", href: "/admin/usuarios" },
  { icon: BarChart3, label: "Métricas", href: "/admin/metricas" },
  { icon: BookOpen, label: "Retroalimentación", href: "/admin/retroalimentacion" },
  { icon: User, label: "Pacientes IA", href: "/perfiles" },
  { icon: Info, label: "Sobre GlorIA", href: "/sobre" },
];

export default function Sidebar({ role = "student" }: { role?: string }) {
  const pathname = usePathname();
  const isAdmin = role === "admin" || role === "superadmin";
  const isInstructor = role === "instructor";
  const navItems = isAdmin ? adminNav(role === "superadmin") : isInstructor ? instructorNav : studentNav;
  const [showAccessibility, setShowAccessibility] = useState(false);
  const [showSupport, setShowSupport] = useState(false);

  return (
    <aside className="fixed left-0 top-0 h-screen w-[260px] bg-sidebar flex flex-col text-white z-50">
      {/* Logo */}
      <div className="px-6 pt-6 mb-10">
        <Link href={isAdmin ? "/admin/dashboard" : isInstructor ? "/docente/dashboard" : "/dashboard"}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/branding/gloria-side-logo.png" alt="GlorIA" className="h-9 w-auto" />
        </Link>
      </div>

      {/* Role badge */}
      {(isAdmin || isInstructor) && (
        <div className="px-6 mb-4">
          <span className="text-[10px] uppercase tracking-widest font-semibold text-white/50 bg-white/10 px-3 py-1 rounded-full">
            {role === "superadmin" ? "Superadmin" : role === "admin" ? "Admin" : "Docente"}
          </span>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex flex-col gap-2 px-6">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`sidebar-link flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium w-full text-left ${
                isActive ? "active text-white" : "text-white/70"
              }`}
            >
              <item.icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="mt-auto px-6 pb-6 space-y-3">
        {/* Accessibility button — above support */}
        <button
          onClick={() => setShowAccessibility(true)}
          className="sidebar-btn sidebar-btn-access flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-white/15 bg-white/5 text-white/70 text-sm"
        >
          <Accessibility size={20} />
          <span className="font-medium">Accesibilidad</span>
        </button>

        {/* Support button — below accessibility */}
        <button
          onClick={() => setShowSupport(true)}
          className="sidebar-btn sidebar-btn-support flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-white/10 text-white/70 text-sm"
        >
          <LifeBuoy size={20} />
          <span className="font-medium">Soporte t&eacute;cnico</span>
        </button>

        {/* UGM Logo */}
        <div className="flex items-center justify-center pt-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/branding/ugm-logo.png" alt="Universidad Gabriela Mistral" className="h-12 w-auto" />
        </div>
      </div>

      {/* Modals rendered via Portal (outside aside to avoid z-index/overflow issues) */}
      {showAccessibility && (
        <Portal>
          <AccessibilityModal onClose={() => setShowAccessibility(false)} />
        </Portal>
      )}
      {showSupport && (
        <Portal>
          <SupportModal onClose={() => setShowSupport(false)} />
        </Portal>
      )}
    </aside>
  );
}

// ——— Contrast theme definitions ———
const CONTRAST_THEMES = [
  { id: "none", label: "Sin filtro", className: "", preview: "bg-white border-gray-200 text-gray-800" },
  { id: "high", label: "Alto contraste", className: "contrast-high", preview: "bg-black text-yellow-300 border-yellow-400" },
  { id: "inverted", label: "Colores invertidos", className: "contrast-inverted", preview: "bg-gray-900 text-white border-gray-400" },
  { id: "warm", label: "C\u00e1lido (sepia)", className: "contrast-warm", preview: "bg-amber-50 text-amber-900 border-amber-300" },
  { id: "cool", label: "Fr\u00edo (azul)", className: "contrast-cool", preview: "bg-blue-50 text-blue-900 border-blue-300" },
];

function AccessibilityModal({ onClose }: { onClose: () => void }) {
  const [fontSize, setFontSize] = useState(() => {
    if (typeof document !== "undefined") {
      const current = document.documentElement.style.fontSize;
      return current ? parseInt(current) : 100;
    }
    return 100;
  });

  const [activeTheme, setActiveTheme] = useState(() => {
    if (typeof document === "undefined") return "none";
    for (const t of CONTRAST_THEMES) {
      if (t.className && document.documentElement.classList.contains(t.className)) return t.id;
    }
    return "none";
  });

  const applyFontSize = (size: number) => {
    setFontSize(size);
    document.documentElement.style.fontSize = `${size}%`;
  };

  const applyTheme = (themeId: string) => {
    // Remove all contrast classes
    CONTRAST_THEMES.forEach((t) => {
      if (t.className) document.documentElement.classList.remove(t.className);
    });
    // Apply selected
    const theme = CONTRAST_THEMES.find((t) => t.id === themeId);
    if (theme?.className) {
      document.documentElement.classList.add(theme.className);
    }
    setActiveTheme(themeId);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-sidebar/10 flex items-center justify-center">
              <Accessibility size={22} className="text-sidebar" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Accesibilidad</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {/* Font size */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Tama&ntilde;o de texto</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => applyFontSize(Math.max(75, fontSize - 10))}
              className="w-10 h-10 rounded-lg bg-gray-100 text-sm font-bold text-gray-700 hover:bg-gray-200 transition-colors"
            >
              A-
            </button>
            <div className="flex-1 bg-gray-100 rounded-full h-2 relative">
              <div
                className="bg-sidebar h-2 rounded-full transition-all"
                style={{ width: `${((fontSize - 75) / 75) * 100}%` }}
              />
            </div>
            <button
              onClick={() => applyFontSize(Math.min(150, fontSize + 10))}
              className="w-10 h-10 rounded-lg bg-gray-100 text-sm font-bold text-gray-700 hover:bg-gray-200 transition-colors"
            >
              A+
            </button>
            <span className="text-sm text-gray-500 w-12 text-center">{fontSize}%</span>
            <button
              onClick={() => applyFontSize(100)}
              className="text-xs text-sidebar hover:underline"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Contrast themes */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-3">Modo de contraste</p>
          <div className="grid grid-cols-2 gap-2">
            {CONTRAST_THEMES.map((theme) => (
              <button
                key={theme.id}
                onClick={() => applyTheme(theme.id)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 transition-all text-left ${
                  activeTheme === theme.id
                    ? "border-sidebar ring-2 ring-sidebar/20"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className={`w-6 h-6 rounded border flex-shrink-0 ${theme.preview}`} />
                <span className="text-xs font-medium text-gray-700">{theme.label}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-sidebar text-white py-2.5 rounded-xl text-sm font-medium hover:bg-sidebar-hover transition-colors"
        >
          Listo
        </button>
      </div>
    </div>
  );
}

function SupportModal({ onClose }: { onClose: () => void }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) return;
    setSending(true);
    setError("");

    const res = await fetch("/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: subject.trim(), body: body.trim() }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Error al enviar. Intenta de nuevo.");
      setSending(false);
      return;
    }

    setSent(true);
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
              <LifeBuoy size={22} className="text-amber-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Soporte t&eacute;cnico</h2>
              <p className="text-xs text-gray-500">Tu mensaje llegar&aacute; a idea@ugm.cl</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {sent ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3 animate-pop">
              <span className="text-green-500 text-2xl">&#10003;</span>
            </div>
            <p className="text-sm font-medium text-gray-900">¡Mensaje enviado!</p>
            <p className="text-xs text-gray-500 mt-1">Te responderemos a la brevedad a tu correo.</p>
            <button
              onClick={onClose}
              className="mt-4 bg-sidebar text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-sidebar-hover transition-colors"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Asunto</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Describe brevemente el problema"
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sidebar"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripci&oacute;n</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Describe tu problema o solicitud con el mayor detalle posible..."
                rows={5}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sidebar"
              />
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex items-center gap-3">
              <button
                onClick={handleSend}
                disabled={!subject.trim() || !body.trim() || sending}
                className="flex-1 bg-sidebar text-white py-2.5 rounded-xl text-sm font-medium hover:bg-sidebar-hover transition-colors disabled:opacity-50"
              >
                {sending ? "Enviando..." : "Enviar mensaje"}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
