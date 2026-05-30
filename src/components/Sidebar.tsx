"use client";

import {
  Home, User, History, BarChart3, BookOpen, Info,
  Users, ClipboardCheck, LayoutDashboard, Building2,
  FlaskConical, DollarSign, Activity, FileText,
  Briefcase, Rocket, Bell, ArrowLeft, ArrowRight,
} from "lucide-react";
import { TILE_ICON_BY_HREF } from "./SidebarTileIcons";
import { useSidebar } from "./SidebarContext";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import Portal from "@/components/Portal";
import { tryGuardedNavigation } from "@/lib/navigation-guard";

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
  { icon: History, label: "Mi historial", href: "/historial" },
  { icon: Info, label: "Sobre GlorIA", href: "/sobre" },
];

const instructorNav: NavItem[] = [
  { icon: LayoutDashboard, label: "Panel docente", href: "/docente/dashboard" },
  { icon: ClipboardCheck, label: "Revisiones", href: "/docente/revisiones" },
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

  const isStudent = !isAdmin && !isInstructor;
  const useTileLayout = isStudent || isInstructor;

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

  // Sidebar link click: chequea el navigation-guard antes de cerrar el
  // drawer y permitir la navegación. Si una página tiene un guard
  // registrado (ej: reflexión post-sesión sin enviar), el guard
  // intercepta y maneja la confirmación.
  const handleNavClick = (href: string, e: React.MouseEvent) => {
    if (tryGuardedNavigation(href, e)) return;
    closeSidebar();
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo + badge */}
      <div className={`flex-shrink-0 ${useTileLayout ? "pt-10 pb-5 mb-3 px-4 flex flex-col items-center gap-2 border-b border-white/10" : "px-6 pt-6 mb-6"}`}>
        <Link href={isAdmin ? "/admin/dashboard" : isInstructor ? "/docente/dashboard" : "/dashboard"} onClick={closeSidebar} className={useTileLayout ? "inline-flex px-4 py-2 rounded-xl bg-white/5" : ""}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/branding/gloria-side-logo.png" alt="GlorIA" className="h-9 w-auto" />
        </Link>
        {useTileLayout && isInstructor && (
          <span className="text-[10px] uppercase tracking-widest font-semibold text-white/50 bg-white/10 px-3 py-1 rounded-full">
            Docente
          </span>
        )}
      </div>

      {isAdmin && (
        <div className="px-6 mb-4 flex-shrink-0">
          <span className="text-[10px] uppercase tracking-widest font-semibold text-white/50 bg-white/10 px-3 py-1 rounded-full">
            {role === "superadmin" ? "Superadmin" : "Admin"}
          </span>
        </div>
      )}

      {/* Navigation — only this area scrolls */}
      <nav className="flex flex-col px-4 flex-1 min-h-0 overflow-y-auto gap-0.5">
        {navSections.map((section, si) => {
          // Admin/superadmin keeps dense grouping. Instructor uses the
          // breathable layout. Student gets the new icon-pill layout (24px
          // icons in a 40x40 rounded pill; the pill carries the active state).
          const iconSize = isStudent ? 24 : isAdmin ? 16 : 18;
          const linkCls = isStudent
            ? "text-[15px] px-2 py-1.5 gap-3.5"
            : isAdmin
            ? "text-[13px] px-4 py-2.5 gap-3"
            : "text-sm px-4 py-3 gap-3.5";
          return (
            <div key={si} className={!isAdmin ? "mb-1" : ""}>
              {section.title && (
                <p className={`text-[9px] uppercase tracking-wider text-white/30 font-semibold px-4 mb-1.5 ${si === 0 ? "mt-1" : "mt-4"}`}>
                  {section.title}
                </p>
              )}
              {section.items.map((item) => {
                const isActive = currentPath === item.href || currentPath.startsWith(item.href + "/");
                if (useTileLayout) {
                  const TileIcon = TILE_ICON_BY_HREF[item.href];
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={(e) => handleNavClick(item.href, e)}
                      className={`sidebar-tile-student flex flex-col items-center justify-center gap-1.5 h-[72px] w-[168px] mx-auto rounded-xl font-medium mb-2.5 transition-colors ${
                        isActive ? "active text-white" : "text-white/75"
                      }`}
                    >
                      <span className="sidebar-tile-icon flex items-center justify-center">
                        {TileIcon ? <TileIcon size={28} /> : <item.icon size={26} />}
                      </span>
                      <span className="text-[12.5px] leading-none">{item.label}</span>
                    </Link>
                  );
                }
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={(e) => handleNavClick(item.href, e)}
                    className={`sidebar-link flex items-center ${linkCls} rounded-lg font-medium w-full text-left ${
                      isActive ? "active text-white" : "text-white/70"
                    }`}
                  >
                    <item.icon size={iconSize} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Secondary nav — Configuración tile (student + instructor only).
          Sits between the main nav and the institution logo with a sutil
          divider. Admin/superadmin use the dense profile menu in the header. */}
      {useTileLayout && (
        <div className="px-4 pt-2 pb-1 flex-shrink-0">
          <div className="border-t border-white/10 mb-2" />
          {(() => {
            const isActive = currentPath === "/mi-perfil" || currentPath.startsWith("/mi-perfil/");
            const TileIcon = TILE_ICON_BY_HREF["/mi-perfil"];
            return (
              <Link
                href="/mi-perfil"
                onClick={(e) => handleNavClick("/mi-perfil", e)}
                className={`sidebar-tile-student flex flex-col items-center justify-center gap-1.5 h-[72px] w-[168px] mx-auto rounded-xl font-medium transition-colors ${
                  isActive ? "active text-white" : "text-white/75"
                }`}
              >
                <span className="sidebar-tile-icon flex items-center justify-center">
                  <TileIcon size={28} />
                </span>
                <span className="text-[12.5px] leading-none">Configuración</span>
              </Link>
            );
          })()}
        </div>
      )}

      {/* Footer — institution logo, always pinned to bottom */}
      <div className="px-6 pb-5 pt-3 flex-shrink-0">
        <div className="flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={establishmentLogoUrl || "/branding/ugm-logo.png"}
            alt="Institución"
            className="h-20 w-auto max-w-[180px] object-contain"
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
            style={{
              transform: drawerIn ? "translateX(0)" : "translateX(-100%)",
              // Respect iOS notch / Android top inset so the close button
              // and logo don't hide under the status bar.
              paddingTop: "env(safe-area-inset-top)",
              paddingBottom: "env(safe-area-inset-bottom)",
            }}
          >
            {/* Close button */}
            <button
              onClick={closeSidebar}
              className="absolute top-5 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer z-10"
              style={{ top: "calc(env(safe-area-inset-top) + 1.25rem)" }}
              aria-label="Cerrar menú"
            >
              <ArrowLeft size={18} />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Mobile hamburger button — fixed top-left, vertically centered on the
          TopHeader (h-12 = 48px). Respects iOS notch via safe-area. */}
      <button
        onClick={openSidebar}
        style={{ top: "calc(env(safe-area-inset-top) + 0.375rem)" }}
        className="md:hidden fixed left-3 z-40 w-9 h-9 rounded-lg bg-sidebar text-white flex items-center justify-center shadow-lg cursor-pointer hover:bg-white/10"
        aria-label="Abrir menú"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

    </>
  );
}
