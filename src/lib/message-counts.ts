import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cuenta mensajes por conversación, sin que PostgREST trunque el resultado.
 *
 * La trampa: `select("conversation_id").in("conversation_id", ids)` devuelve
 * como máximo 1000 filas y NO avisa que cortó. Con 40 conversaciones de 30
 * mensajes ya se pasa, y el resultado es que las últimas conversaciones
 * aparecen con cero mensajes. Eso es peligroso donde el conteo decide algo
 * irreversible —descartar una sesión y marcarla como ya atendida— porque el
 * error se ve exactamente igual que "esta conversación fue muy corta".
 *
 * Acá se pagina explícitamente con .range() hasta que una página vuelve
 * incompleta, que es la única señal fiable de que ya no queda nada.
 */

const PAGE = 1000;
const CHUNK = 50;

export async function countMessagesByConversation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, any, any>,
  conversationIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const id of conversationIds) counts.set(id, 0);

  for (let i = 0; i < conversationIds.length; i += CHUNK) {
    const chunk = conversationIds.slice(i, i + CHUNK);
    let desde = 0;
    for (;;) {
      const { data, error } = await admin
        .from("messages")
        .select("conversation_id")
        .in("conversation_id", chunk)
        .range(desde, desde + PAGE - 1);
      if (error) throw new Error(`No se pudieron contar los mensajes: ${error.message}`);
      for (const m of data || []) {
        counts.set(m.conversation_id, (counts.get(m.conversation_id) || 0) + 1);
      }
      if (!data || data.length < PAGE) break;
      desde += PAGE;
    }
  }

  return counts;
}
