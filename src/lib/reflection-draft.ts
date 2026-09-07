/**
 * Borrador local de la autorreflexión.
 *
 * El problema que resuelve: el estudiante escribe cinco respuestas largas y
 * cierra el navegador antes de enviarlas. Hoy eso se pierde entero y, cuando
 * vuelve, encuentra el formulario en blanco. Volver a escribirlo es
 * suficientemente pesado como para que muchos no lo hagan.
 *
 * Va en localStorage a propósito: guardar borradores en el servidor obliga a
 * una tabla, RLS y un endpoint por cada tecla. Acá lo único que se pierde es
 * lo que el estudiante todavía no mandó, y solo si cambia de computador — que
 * es exactamente el caso que igual iba a perderse.
 *
 * El borrador se borra al enviar. Si no se borrara, el estudiante vería sus
 * respuestas viejas la próxima vez que abra CUALQUIER sesión.
 */

const PREFIJO = "gloria:reflexion:";
// Un borrador viejo es más confuso que útil: si volvió una semana después,
// probablemente ya no se acuerda de qué estaba respondiendo.
const VIGENCIA_MS = 7 * 24 * 60 * 60 * 1000;

export type ReflectionDraft = {
  allianceFraming: string;
  ruptureMoment: string;
  nonverbalCues: string;
  interventionTypes: string;
  clinicalHypothesis: string;
};

const VACIO: ReflectionDraft = {
  allianceFraming: "",
  ruptureMoment: "",
  nonverbalCues: "",
  interventionTypes: "",
  clinicalHypothesis: "",
};

const clave = (conversationId: string) => `${PREFIJO}${conversationId}`;

export function guardarBorrador(conversationId: string, d: ReflectionDraft): void {
  try {
    const vacio = Object.values(d).every((v) => !v.trim());
    if (vacio) {
      window.localStorage.removeItem(clave(conversationId));
      return;
    }
    window.localStorage.setItem(clave(conversationId), JSON.stringify({ ...d, ts: Date.now() }));
  } catch {
    // Modo incógnito o almacenamiento lleno: el borrador es una comodidad,
    // nunca puede romper el formulario.
  }
}

export function leerBorrador(conversationId: string): ReflectionDraft | null {
  try {
    const crudo = window.localStorage.getItem(clave(conversationId));
    if (!crudo) return null;
    const d = JSON.parse(crudo) as Partial<ReflectionDraft> & { ts?: number };
    if (!d.ts || Date.now() - d.ts > VIGENCIA_MS) {
      window.localStorage.removeItem(clave(conversationId));
      return null;
    }
    const draft: ReflectionDraft = { ...VACIO };
    for (const k of Object.keys(VACIO) as (keyof ReflectionDraft)[]) {
      if (typeof d[k] === "string") draft[k] = d[k] as string;
    }
    return Object.values(draft).some((v) => v.trim()) ? draft : null;
  } catch {
    return null;
  }
}

export function borrarBorrador(conversationId: string): void {
  try {
    window.localStorage.removeItem(clave(conversationId));
  } catch {
    // noop
  }
}
