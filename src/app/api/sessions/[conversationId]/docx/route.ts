import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildConversationDocx, conversationDocxFilename } from "@/lib/conversation-docx";
import { loadConversationDocxInput } from "@/lib/conversation-docx-data";
import { uuidSchema } from "@/lib/validation/schemas";

/**
 * El estudiante descarga SU propia conversación en .docx.
 *
 * La autorización es la más simple posible y por eso la más segura: la
 * conversación tiene que ser suya. No hay alcance, ni rol, ni parámetro del
 * cliente que pueda ampliarla — se compara el dueño de la conversación contra
 * la sesión autenticada y nada más.
 *
 * Es el mismo documento que descarga el docente (misma carga de datos, mismo
 * generador). Un estudiante ya puede leer su transcripción completa en el
 * historial, así que esto solo cambia el formato.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { conversationId } = await params;
  if (!uuidSchema.safeParse(conversationId).success) {
    return NextResponse.json({ error: "ID de conversación inválido" }, { status: 400 });
  }

  const admin = createAdminClient();
  const loaded = await loadConversationDocxInput(admin, conversationId);
  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  // 404 y no 403 a propósito: pedir una conversación ajena no debería
  // confirmarle a nadie que existe.
  if (loaded.studentId !== user.id) {
    return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
  }

  const buffer = await buildConversationDocx(loaded.input);
  const filename = conversationDocxFilename(loaded.input);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "no-store",
    },
  });
}
