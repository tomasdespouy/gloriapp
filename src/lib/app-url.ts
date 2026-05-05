/**
 * Dominio canonico de la aplicacion para construir URLs en emails,
 * invitaciones, links de reset, etc. Siempre consumir desde aca — NUNCA
 * leer process.env.NEXT_PUBLIC_APP_URL directo en otro archivo.
 *
 * Motivo: antes habia 7 callsites distintos con fallbacks inconsistentes
 * (algunos .vercel.app, otros glor-ia.com). Un usuario nuevo recibio un
 * email apuntando al dominio viejo de Vercel porque NEXT_PUBLIC_APP_URL
 * no estaba seteada en Vercel prod y el fallback era incorrecto. Al
 * centralizar acá, cualquier configuracion de un nuevo entorno toca un
 * solo lugar.
 *
 * En runtime (production Vercel), NEXT_PUBLIC_APP_URL debe estar seteada
 * a https://www.glor-ia.com (o el dominio canonico vigente). Si falta:
 *   - Client: fallback al origin del browser (window.location.origin)
 *   - Server: fallback a localhost en dev, y error visible en prod
 *
 * NEXT_PUBLIC_* es accesible tanto en server como client — el mismo
 * helper vale para ambos.
 */
const HARDCODED_PROD_FALLBACK = "https://www.glor-ia.com";

let loggedMissingInProd = false;

export function getAppUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL;
  if (raw && raw.trim()) {
    return raw.trim().replace(/\/$/, "");
  }

  // Env var faltante. Comportamiento por entorno:
  if (typeof window !== "undefined") {
    // Client-side: fallback al origin real del browser. Esto siempre
    // es correcto — si el usuario esta viendo la app desde app.glor-ia.com
    // los links generados van a usar ese host.
    return window.location.origin.replace(/\/$/, "");
  }

  // Server-side
  if (process.env.NODE_ENV === "production" && !loggedMissingInProd) {
    // Solo logueamos una vez por boot para no inundar los logs.
    // eslint-disable-next-line no-console
    console.error(
      "[app-url] NEXT_PUBLIC_APP_URL no esta seteada en production — " +
      "cayendo al hardcoded fallback. Setear en Vercel env vars.",
    );
    loggedMissingInProd = true;
  }

  if (process.env.NODE_ENV === "production") {
    return HARDCODED_PROD_FALLBACK;
  }
  return "http://localhost:3000";
}
