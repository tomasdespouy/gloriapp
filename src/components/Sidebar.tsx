"use client";

import {
  Home, User, History, BarChart3, BookOpen, Info,
  Users, ClipboardCheck, LayoutDashboard, Building2,
  Accessibility, LifeBuoy, FlaskConical, DollarSign, Activity, FileText,
  Briefcase, Rocket, Bell, Radio, ArrowLeft, ArrowRight,
} from "lucide-react";
import { useSidebar } from "./SidebarContext";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import Portal from "@/components/Portal";

type NavItem = {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  href: string;
};
type NavSection = { title?: string; items: NavItem[] };

const studentNav: NavItem[] = [
  { icon: Home, label: "Inicio", href: "/dashboard" },
  { icon: BarChart3, label: "Mi progreso", href: "/progreso" },
  { icon: BookOpen, label: "Aprendizaje", href: "/aprendizaje" },
  { icon: User, label: "Pacientes", href: "/pacientes" },
  { icon: Radio, label: "Grabar en vivo", href: "/observacion" },
  { icon: History, label: "Mi historial", href: "/historial" },
  { icon: Info, label: "Sobre GlorIA", href: "/sobre" },
];

const instructorNav: NavItem[] = [
  { icon: LayoutDashboard, label: "Panel docente", href: "/docente/dashboard" },
  { icon: ClipboardCheck, label: "Revisiones", href: "/docente/revisiones" },
  { icon: User, label: "Pacientes", href: "/perfiles" },
  { icon: BarChart3, label: "Métricas", href: "/docente/metricas" },
  { icon: Info, label: "Sobre GlorIA", href: "/sobre" },
];

const adminSections = (isSuperadmin: boolean): NavSection[] =>
  isSuperadmin
    ? [
        {
          title: "Principal",
          items: [
            { icon: LayoutDashboard, label: "Panel", href: "/admin/dashboard" },
            { icon: Building2, label: "Instituciones", href: "/admin/establecimientos" },
            { icon: Users, label: "Usuarios", href: "/admin/usuarios" },
          ],
        },
        {
          title: "Académico",
          items: [
            { icon: User, label: "Pacientes IA", href: "/perfiles" },
            { icon: BookOpen, label: "Retroalimentación", href: "/admin/retroalimentacion" },
            { icon: BarChart3, label: "Métricas", href: "/admin/metricas" },
            { icon: Rocket, label: "Pilotos", href: "/admin/pilotos" },
          ],
        },
        {
          title: "Operaciones",
          items: [
            { icon: DollarSign, label: "Costos", href: "/admin/costos" },
            { icon: Activity, label: "Monitoreo", href: "/admin/monitoreo" },
            { icon: Bell, label: "Notificaciones", href: "/admin/notificaciones" },
          ],
        },
        {
          title: "Estrategia",
          items: [
            { icon: FlaskConical, label: "Investigación y Fondos", href: "/admin/investigacion" },
            { icon: FileText, label: "Informes técnicos", href: "/admin/informes" },
            { icon: Briefcase, label: "CRM", href: "/admin/crm" },
          ],
        },
      ]
    : [
        {
          items: [
            { icon: LayoutDashboard, label: "Panel", href: "/admin/dashboard" },
            { icon: Users, label: "Usuarios", href: "/admin/usuarios" },
            { icon: User, label: "Pacientes IA", href: "/perfiles" },
            { icon: BookOpen, label: "Retroalimentación", href: "/admin/retroalimentacion" },
            { icon: BarChart3, label: "Métricas", href: "/admin/metricas" },
            { icon: Info, label: "Sobre GlorIA", href: "/sobre" },
          ],
        },
      ];

const MODULE_NAV_MAP: Record<string, string> = {
  grabacion: "/observacion",
  aprendizaje: "/aprendizaje",
  progreso: "/progreso",
};

export default function Sidebar({
  role = "student",
  establishmentLogoUrl,
  activeModules,
}: {
  role?: string;
  establishmentLogoUrl?: string | null;
  activeModules?: string[] | null;
}) {
  const pathname = usePathname();
  const isAdmin = role === "admin" || role === "superadmin";
  const isInstructor = role === "instructor";

  // Build nav sections
  const navSections: NavSection[] = isAdmin
    ? adminSections(role === "superadmin")
    : (() => {
        const flat = isInstructor ? instructorNav : studentNav;
        const filtered =
          !isInstructor && activeModules
            ? (() => {
                const disabledPaths = new Set(
                  Object.entries(MODULE_NAV_MAP)
                    .filter(([key]) => !activeModules.includes(key))
                    .map(([, path]) => path)
                );
                return flat.filter((item) => !disabledPaths.has(item.href));
              })()
            : flat;
        return [{ items: filtered }];
      })();

  const { collapsed, toggleSidebar, ready } = useSidebar();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [drawerIn, setDrawerIn] = useState(false);

  const openSidebar = () => {
    setMobileOpen(true);
    setTimeout(() => setDrawerIn(true), 10);
  };

  const closeSidebar = () => {
    setDrawerIn(false);
    setTimeout(() => setMobileOpen(false), 200);
  };

  // Close on route change (instant, no animation)
  const currentPath = pathname;
  useEffect(() => {
    setMobileOpen(false);
    setDrawerIn(false);
  }, [currentPath]);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo + badge */}
      <div className="px-6 pt-6 mb-6 flex-shrink-0">
        <Link href={isAdmin ? "/admin/dashboard" : isInstructor ? "/docente/dashboard" : "/dashboard"} onClick={closeSidebar}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/branding/gloria-side-logo.png" alt="GlorIA" className="h-9 w-auto" />
        </Link>
      </div>

      {(isAdmin || isInstructor) && (
        <div className="px-6 mb-4 flex-shrink-0">
          <span className="text-[10px] uppercase tracking-widest font-semibold text-white/50 bg-white/10 px-3 py-1 rounded-full">
            {role === "superadmin" ? "Superadmin" : role === "admin" ? "Admin" : "Docente"}
          </span>
        </div>
      )}

      {/* Navigation — only this area scrolls */}
      <nav className="flex flex-col px-4 flex-1 min-h-0 overflow-y-auto">
        {navSections.map((section, si) => (
          <div key={si}>
            {section.title && (
              <p className={`text-[9px] uppercase tracking-wider text-white/30 font-semibold px-4 mb-1.5 ${si === 0 ? "mt-1" : "mt-4"}`}>
                {section.title}
              </p>
            )}
            {section.items.map((item) => {
              const isActive = currentPath === item.href || currentPath.startsWith(item.href + "/");
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={closeSidebar}
                  className={`sidebar-link flex items-center gap-3 px-4 py-2.5 rounded-lg text-[13px] font-medium w-full text-left ${
                    isActive ? "active text-white" : "text-white/70"
                  }`}
                >
                  <item.icon size={16} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer — institution logo, always pinned to bottom */}
      <div className="px-6 pb-5 pt-3 flex-shrink-0">
        <div className="flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={establishmentLogoUrl || "/branding/ugm-logo.png"}
            alt="Institución"
            className="h-10 w-auto"
          />
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar — hidden on mobile */}
      <aside
        className={`hidden md:flex fixed left-0 top-0 h-screen w-[260px] bg-sidebar flex-col text-white z-50 overflow-hidden ${
          ready ? "transition-transform duration-200 ease-out" : ""
        } ${collapsed ? "-translate-x-full" : "translate-x-0"}`}
      >
        {sidebarContent}
      </aside>

      {/* Desktop collapse/expand toggle.
          Sits on the sidebar's outer edge, half inside / half outside. The
          asymmetric rounded-r matches the button's "flag" look against the
          dark sidebar background. border-l stabilizes the visual seam when
          the button sits flush next to the sidebar. */}
      <button
        onClick={toggleSidebar}
        style={{
          left: collapsed ? 0 : 260,
          transition: ready ? "left 200ms ease-out" : "none",
        }}
        className="hidden md:flex fixed top-1/2 -translate-y-1/2 z-[51] w-6 h-12 rounded-r-md items-center justify-center cursor-pointer bg-sidebar/95 text-white/70 hover:text-white hover:bg-sidebar-hover shadow-md border-l border-white/10"
        aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
      >
        {collapsed ? <ArrowRight size={14} /> : <ArrowLeft size={14} />}
      </button>

      {/* Mobile overlay + drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50 cursor-pointer transition-opacity duration-200"
            style={{ opacity: drawerIn ? 1 : 0 }}
            onClick={closeSidebar}
          />
          <aside
            className="absolute left-0 top-0 h-full w-[280px] bg-sidebar flex flex-col text-white transition-transform duration-200 ease-out"
            style={{ transform: drawerIn ? "translateX(0)" : "translateX(-100%)" }}
          >
            {/* Close button */}
            <button
              onClick={closeSidebar}
              className="absolute top-5 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer z-10"
              aria-label="Cerrar menú"
            >
              <ArrowLeft size={18} />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Mobile hamburger button — fixed top-left */}
      <button
        onClick={openSidebar}
        className="md:hidden fixed top-3 left-3 z-40 w-10 h-10 rounded-lg bg-sidebar text-white flex items-center justify-center shadow-lg cursor-pointer hover:bg-white/10"
        aria-label="Abrir menú"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

    </>
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
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none cursor-pointer">&times;</button>
        </div>

        {/* Font size */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Tama&ntilde;o de texto</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => applyFontSize(Math.max(75, fontSize - 10))}
              className="w-10 h-10 rounded-lg bg-gray-100 text-sm font-bold text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
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
              className="w-10 h-10 rounded-lg bg-gray-100 text-sm font-bold text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
            >
              A+
            </button>
            <span className="text-sm text-gray-500 w-12 text-center">{fontSize}%</span>
            <button
              onClick={() => applyFontSize(100)}
              className="text-xs text-sidebar hover:underline cursor-pointer"
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
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 transition-all text-left cursor-pointer ${
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
          className="w-full bg-sidebar text-white py-2.5 rounded-xl text-sm font-medium hover:bg-sidebar-hover transition-colors cursor-pointer"
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
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none cursor-pointer">&times;</button>
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
              className="mt-4 bg-sidebar text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-sidebar-hover transition-colors cursor-pointer"
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
                className="flex-1 bg-sidebar text-white py-2.5 rounded-xl text-sm font-medium hover:bg-sidebar-hover transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                {sending ? "Enviando..." : "Enviar mensaje"}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
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
