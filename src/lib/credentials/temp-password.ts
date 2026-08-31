/**
 * Contraseña temporal de GlorIA — fuente única.
 *
 * Antes de este módulo el mismo bloque estaba copiado literalmente en cuatro
 * rutas (users/create, users/[id]/reset-password, pilots/[id]/send-invites y
 * public/pilot-enroll/[slug]) y el prefijo estaba hardcodeado por quinta vez
 * como validación en (auth)/cambiar-clave/page.tsx. Cualquier cambio al
 * alfabeto o al largo tenía que replicarse a mano en cinco lugares.
 *
 * El alfabeto omite a propósito los caracteres ambiguos (I, l, 1, O, 0) porque
 * estas claves se dictan por teléfono y se transcriben desde un correo.
 */

export const TEMP_PASSWORD_PREFIX = "Gloria_";

/**
 * Reconoce una contraseña que sigue siendo la temporal entregada por la
 * plataforma. Se construye desde la constante para que el prefijo viva en un
 * solo lugar; `cambiar-clave` lo usa para impedir que alguien "cambie" su
 * clave dejando otra que también empieza con Gloria_.
 */
export const TEMP_PASSWORD_RE = new RegExp("^" + TEMP_PASSWORD_PREFIX, "i");

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const SUFFIX_LENGTH = 6;

/**
 * Genera una contraseña temporal nueva, del tipo "Gloria_bK7mQx".
 *
 * Usa crypto.getRandomValues (disponible en el runtime Node de Vercel y en el
 * navegador) en vez de Math.random, que era lo que hacían las cuatro copias
 * anteriores. Math.random no es criptográficamente seguro y estas claves son
 * el único factor de acceso a la cuenta hasta que la persona entra.
 */
export function generateTempPassword(): string {
  const bytes = new Uint32Array(SUFFIX_LENGTH);
  crypto.getRandomValues(bytes);

  let out = TEMP_PASSWORD_PREFIX;
  for (let i = 0; i < SUFFIX_LENGTH; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}
