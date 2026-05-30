/**
 * Sidebar tile icons — custom inline SVGs with named sub-parts so
 * each icon can be animated meaningfully on hover. Used by both the
 * student and instructor (docente) tile sidebars. Duotone aesthetic
 * matches Phosphor weight="duotone" — currentColor fills at ~22% opacity
 * for backgrounds, full opacity for strokes/details.
 *
 * The animations live in globals.css and target the inner classes
 * (.house-roof, .chart-bar-N, .book-page-left/right, .user-head,
 * .clock-hand-hour/minute, .info-dot, .panel-cell-N, .clip-check).
 */

import * as React from "react";

type IconProps = { size?: number };

const STROKE = "currentColor";
const DUO_FILL = "currentColor";
const DUO_OPACITY = 0.22;

const baseSvg = (size: number): React.SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
});

// ── Shared (student + instructor) ─────────────────────────────────

export function HouseIcon({ size = 28 }: IconProps) {
  return (
    <svg {...baseSvg(size)} className="icon-house">
      <path d="M5 11 L5 20 L19 20 L19 11 Z" fill={DUO_FILL} fillOpacity={DUO_OPACITY} stroke={STROKE} strokeWidth="1.5" strokeLinejoin="round" />
      <path className="house-roof" d="M3 12 L12 3.5 L21 12" fill={DUO_FILL} fillOpacity={DUO_OPACITY} stroke={STROKE} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M10 20 L10 14.5 L14 14.5 L14 20" stroke={STROKE} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export function ChartBarIcon({ size = 28 }: IconProps) {
  return (
    <svg {...baseSvg(size)} className="icon-chart">
      <rect className="chart-bar chart-bar-1" x="4" y="13" width="3.5" height="7" rx="0.6" fill={DUO_FILL} fillOpacity={DUO_OPACITY} stroke={STROKE} strokeWidth="1.5" />
      <rect className="chart-bar chart-bar-2" x="10.25" y="9" width="3.5" height="11" rx="0.6" fill={DUO_FILL} fillOpacity={DUO_OPACITY} stroke={STROKE} strokeWidth="1.5" />
      <rect className="chart-bar chart-bar-3" x="16.5" y="5" width="3.5" height="15" rx="0.6" fill={DUO_FILL} fillOpacity={DUO_OPACITY} stroke={STROKE} strokeWidth="1.5" />
    </svg>
  );
}

export function BookOpenIcon({ size = 28 }: IconProps) {
  return (
    <svg {...baseSvg(size)} className="icon-book">
      <path className="book-page book-page-left" d="M12 6 C 9.5 5 7 5 4.5 5.5 L4.5 19 C 7 18.5 9.5 18.5 12 19.5 Z" fill={DUO_FILL} fillOpacity={DUO_OPACITY} stroke={STROKE} strokeWidth="1.5" strokeLinejoin="round" />
      <path className="book-page book-page-right" d="M12 6 C 14.5 5 17 5 19.5 5.5 L19.5 19 C 17 18.5 14.5 18.5 12 19.5 Z" fill={DUO_FILL} fillOpacity={DUO_OPACITY} stroke={STROKE} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export function UserIcon({ size = 28 }: IconProps) {
  return (
    <svg {...baseSvg(size)} className="icon-user">
      <circle className="user-head" cx="12" cy="8.5" r="3.8" fill={DUO_FILL} fillOpacity={DUO_OPACITY} stroke={STROKE} strokeWidth="1.5" />
      <path d="M4.5 20 C 4.5 16 8 14 12 14 C 16 14 19.5 16 19.5 20" fill={DUO_FILL} fillOpacity={DUO_OPACITY} stroke={STROKE} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function ClockIcon({ size = 28 }: IconProps) {
  return (
    <svg {...baseSvg(size)} className="icon-clock">
      <circle cx="12" cy="12" r="8.5" fill={DUO_FILL} fillOpacity={DUO_OPACITY} stroke={STROKE} strokeWidth="1.5" />
      <line className="clock-hand clock-hand-hour" x1="12" y1="12" x2="12" y2="7.5" stroke={STROKE} strokeWidth="1.8" strokeLinecap="round" />
      <line className="clock-hand clock-hand-minute" x1="12" y1="12" x2="15.5" y2="12" stroke={STROKE} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="12" r="0.9" fill={STROKE} />
    </svg>
  );
}

export function InfoIcon({ size = 28 }: IconProps) {
  return (
    <svg {...baseSvg(size)} className="icon-info">
      <circle cx="12" cy="12" r="8.5" fill={DUO_FILL} fillOpacity={DUO_OPACITY} stroke={STROKE} strokeWidth="1.5" />
      <line x1="12" y1="11" x2="12" y2="17" stroke={STROKE} strokeWidth="1.8" strokeLinecap="round" />
      <circle className="info-dot" cx="12" cy="7.7" r="1" fill={STROKE} />
    </svg>
  );
}

// Ampolleta para "Sobre GlorIA". El filamento (.bulb-filament) se
// enciende con un glow amarillo cálido en hover — ver globals.css.
export function LightbulbIcon({ size = 28 }: IconProps) {
  return (
    <svg {...baseSvg(size)} className="icon-lightbulb">
      {/* Cristal de la ampolleta */}
      <path
        d="M12 2.5 C 8 2.5 5 5.5 5 9.5 C 5 11.8 6.3 13.8 8 15 L 8 17 C 8 17.6 8.4 18 9 18 L 15 18 C 15.6 18 16 17.6 16 17 L 16 15 C 17.7 13.8 19 11.8 19 9.5 C 19 5.5 16 2.5 12 2.5 Z"
        fill={DUO_FILL}
        fillOpacity={DUO_OPACITY}
        stroke={STROKE}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Filamento — el que se enciende */}
      <path
        className="bulb-filament"
        d="M10 11 Q 11 8.5 12 11 Q 13 8.5 14 11"
        fill="none"
        stroke={STROKE}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Base / rosca */}
      <line x1="9.5" y1="20" x2="14.5" y2="20" stroke={STROKE} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="10.5" y1="21.5" x2="13.5" y2="21.5" stroke={STROKE} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ── Instructor-only ───────────────────────────────────────────────

export function PanelIcon({ size = 28 }: IconProps) {
  return (
    <svg {...baseSvg(size)} className="icon-panel">
      <rect className="panel-cell panel-cell-1" x="3.5" y="3.5" width="7.5" height="7.5" rx="1.2" fill={DUO_FILL} fillOpacity={DUO_OPACITY} stroke={STROKE} strokeWidth="1.5" />
      <rect className="panel-cell panel-cell-2" x="13"  y="3.5" width="7.5" height="4.5" rx="1.2" fill={DUO_FILL} fillOpacity={DUO_OPACITY} stroke={STROKE} strokeWidth="1.5" />
      <rect className="panel-cell panel-cell-3" x="13"  y="10"  width="7.5" height="10.5" rx="1.2" fill={DUO_FILL} fillOpacity={DUO_OPACITY} stroke={STROKE} strokeWidth="1.5" />
      <rect className="panel-cell panel-cell-4" x="3.5" y="13"  width="7.5" height="7.5" rx="1.2" fill={DUO_FILL} fillOpacity={DUO_OPACITY} stroke={STROKE} strokeWidth="1.5" />
    </svg>
  );
}

export function ClipboardCheckIcon({ size = 28 }: IconProps) {
  return (
    <svg {...baseSvg(size)} className="icon-clipboard">
      <rect x="4.5" y="5" width="15" height="16.5" rx="1.8" fill={DUO_FILL} fillOpacity={DUO_OPACITY} stroke={STROKE} strokeWidth="1.5" />
      <rect x="8.5" y="3" width="7" height="4" rx="1" fill={DUO_FILL} fillOpacity={DUO_OPACITY} stroke={STROKE} strokeWidth="1.5" />
      <path className="clip-check" d="M8 13.8 L11 16.7 L16 11.2" fill="none" stroke={STROKE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" pathLength={1} />
    </svg>
  );
}

// ── Configuración (student + instructor) ─────────────────────────
// Engranaje duotone con dientes. La animación (.gear-cog → rotación lenta)
// vive en globals.css. El círculo central queda fijo para que la rotación
// se sienta sutil, no mareadora.

export function SettingsIcon({ size = 28 }: IconProps) {
  // Engranaje regular de 8 dientes, generado por math (no a ojo):
  //   16 vértices alternando radio exterior (R=8.5) e interior (r=6)
  //   en pasos de 22.5°, comenzando desde el top (12, 3.5).
  // Esto garantiza simetría radial — al rotar no se ve deformado.
  return (
    <svg {...baseSvg(size)} className="icon-settings">
      <g className="gear-cog">
        <path
          d="M 12 3.5 L 14.30 6.46 L 18.01 5.99 L 17.54 9.70 L 20.5 12 L 17.54 14.30 L 18.01 18.01 L 14.30 17.54 L 12 20.5 L 9.70 17.54 L 5.99 18.01 L 6.46 14.30 L 3.5 12 L 6.46 9.70 L 5.99 5.99 L 9.70 6.46 Z"
          fill={DUO_FILL}
          fillOpacity={DUO_OPACITY}
          stroke={STROKE}
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </g>
      <circle cx="12" cy="12" r="3" fill="none" stroke={STROKE} strokeWidth="1.4" />
    </svg>
  );
}

// ── Routing ───────────────────────────────────────────────────────

export const TILE_ICON_BY_HREF: Record<string, React.ComponentType<IconProps>> = {
  // Student
  "/dashboard": HouseIcon,
  "/progreso": ChartBarIcon,
  "/aprendizaje": BookOpenIcon,
  "/pacientes": UserIcon,
  "/historial": ClockIcon,
  "/sobre": LightbulbIcon,
  // Instructor
  "/docente/dashboard": PanelIcon,
  "/docente/revisiones": ClipboardCheckIcon,
  "/docente/metricas": ChartBarIcon,
  // Shared (config tile en student + instructor)
  "/mi-perfil": SettingsIcon,
};
