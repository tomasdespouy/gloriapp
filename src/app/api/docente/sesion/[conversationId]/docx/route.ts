import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMonitorAuthority, canAccessStudent } from "@/lib/monitor/scope";
import { buildConversationDocx, conversationDocxFilename } from "@/lib/conversation-docx";
import { loadConversationDocxInput } from "@/lib/conversation-docx-data";
import { uuidSchema } from "@/lib/validation/schemas";

/**
 * Descarga de una conversación en .docx desde la mirada del docente.
 *
 * Mismo doble candado que el visor inline del monitor:
 *   (1) el que pide tiene autoridad de monitor (instructor, admin, superadmin,
 *       honrando impersonación), y
 *   (2) el alumno dueño de la conversación cae dentro de su alcance.
 *
 * El alumno se deriva de la conversación, no lo manda el cliente: así no hay
 * un id que validar. Quien ya podía leer la transcripción en pantalla puede
 * descargarla; esto no abre nada nuevo, solo cambia el formato.
 *
 * El estudiante descarga la suya por /api/sessions/[id]/docx, que arma el
 * mismo documento con otra autorización.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const auth = await getMonitorAuthority();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { conversationId } = await params;
  if (!uuidSchema.safeParse(conversationId).success) {
    return NextResponse.json({ error: "ID de conversación inválido" }, { status: 400 });
  }

  const admin = createAdminClient();
  const loaded = await loadConversationDocxInput(admin, conversationId);
  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  if (!(await canAccessStudent(auth, loaded.studentId))) {
    return NextResponse.json({ error: "Conversación fuera de su alcance" }, { status: 403 });
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
