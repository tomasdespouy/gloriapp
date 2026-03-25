export const MODULE_DEFINITIONS: Record<string, { label: string; description: string }> = {
  grabacion: {
    label: "Grabar en vivo",
    description: "Permite grabar sesiones de observaci\u00f3n en vivo",
  },
  aprendizaje: {
    label: "Aprendizaje",
    description: "M\u00f3dulo de aprendizaje con materiales y competencias cl\u00ednicas",
  },
  progreso: {
    label: "Mi progreso",
    description: "Dashboard de progreso del estudiante con niveles y logros",
  },
};

export type ModuleKey = keyof typeof MODULE_DEFINITIONS;
export const ALL_MODULE_KEYS = Object.keys(MODULE_DEFINITIONS);

/** Maps module keys to student nav paths that should be hidden when disabled */
export const MODULE_NAV_MAP: Record<string, string> = {
  grabacion: "/observacion",
  aprendizaje: "/aprendizaje",
  progreso: "/progreso",
};
