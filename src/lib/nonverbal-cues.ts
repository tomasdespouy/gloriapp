/**
 * Gestos que el paciente mostró durante una sesión.
 *
 * El paciente los escribe entre corchetes en medio de su mensaje —"[suspira]
 * Pues, Camila…"— y ahí se leen como decoración. En UPC, el 61% de los
 * mensajes del paciente traía uno y los estudiantes nombraron CERO en 1.709
 * mensajes. No es que los ignoren a propósito: no los ven.
 *
 * Extraerlos permite devolvérselos en la autorreflexión, que es el momento más
 * barato para que se enteren de que estaban ahí.
 *
 * Sin dependencias a propósito, para poder probarla aislada.
 */

/** Un corchete de una sola palabra suele ser ruido de formato, no un gesto. */
const MIN_PALABRAS = 2;
const MAX_LARGO = 90;

export function extraerGestos(mensajesDelPaciente: string[]): string[] {
  const vistos = new Set<string>();
  const gestos: string[] = [];

  for (const m of mensajesDelPaciente) {
    // Corchetes no anidados. El contenido no puede tener saltos de línea:
    // un corchete que abarca párrafos es casi siempre texto mal formateado.
    for (const match of (m || "").matchAll(/\[([^\]\n]{3,})\]/g)) {
      const bruto = match[1].trim().replace(/\s+/g, " ");
      if (bruto.length > MAX_LARGO) continue;
      if (bruto.split(" ").length < MIN_PALABRAS) continue;

      // Se normaliza solo para deduplicar: "[Suspira]" y "[suspira]" son el
      // mismo gesto, pero al estudiante se le muestra la primera forma real.
      const clave = bruto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      gestos.push(bruto);
    }
  }

  return gestos;
}
