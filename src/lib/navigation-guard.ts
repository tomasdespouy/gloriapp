/**
 * Mini "navigation guard" para interceptar navegación interna desde el
 * sidebar cuando una página tiene trabajo pendiente.
 *
 * Caso de uso actual: /review/[conversationId] con step="reflect". Si el
 * estudiante intenta salir clickeando el sidebar, mostrar el modal
 * "continuar o salir sin enviar" en vez de navegar directo.
 *
 * Diseño: estado a nivel de módulo (no React context) para que el
 * Sidebar pueda consultarlo sin tener que pasar props desde un layout.
 * El handler es un callback que la página guardada registra; al
 * intentar navegar, se llama con la URL solicitada y se devuelve true
 * (la página manejará la confirmación). Si no hay guard activo, el
 * sidebar navega normal.
 */

type GuardHandler = (href: string) => void;

let active = false;
let handler: GuardHandler | null = null;

export function setNavigationGuard(isActive: boolean, onAttempt?: GuardHandler) {
  active = isActive;
  handler = isActive ? onAttempt ?? null : null;
}

/**
 * Llamado por los Link del sidebar en su onClick. Retorna true si la
 * navegación fue interceptada (el caller debe detener la navegación
 * por defecto). Retorna false si puede proceder.
 */
export function tryGuardedNavigation(href: string, e?: { preventDefault: () => void }): boolean {
  if (active && handler) {
    e?.preventDefault();
    handler(href);
    return true;
  }
  return false;
}
