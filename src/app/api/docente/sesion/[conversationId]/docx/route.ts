import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMonitorAuthority, canAccessStudent } from "@/lib/monitor/scope";
import { buildConversationDocx, conversationDocxFilename } from "@/lib/conversation-docx";
import { cappedActiveSeconds } from "@/lib/active-seconds";
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

  const { data: convo } = await admin
    .from("conversations")
    .select(
      "id, student_id, session_number, status, created_at, started_at, ended_at, active_seconds, end_reason, ai_patients(name, age, occupation)",
    )
    .eq("id", conversationId)
    .maybeSingle();

  if (!convo) {
    return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
  }
  if (!(await canAccessStudent(auth, convo.student_id))) {
    return NextResponse.json({ error: "Conversación fuera de su alcance" }, { status: 403 });
  }

  const { data: student } = await admin
    .from("profiles")
    .select("full_name, email, establishment_id, section_id")
    .eq("id", convo.student_id)
    .maybeSingle();

  // Establecimiento y sección son contexto para el encabezado; si faltan, el
  // documento sale igual sin esa fila.
  const [{ data: establishment }, { data: section }] = await Promise.all([
    student?.establishment_id
      ? admin.from("establishments").select("name").eq("id", student.establishment_id).maybeSingle()
      : Promise.resolve({ data: null }),
    student?.section_id
      ? admin.from("sections").select("name").eq("id", student.section_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const { data: messages } = await admin
    .from("messages")
    .select("role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  const patient = convo.ai_patients as unknown as {
    name: string; age: number | null; occupation: string | null;
  } | null;

  const input = {
    studentName: student?.full_name || "Estudiante",
    studentEmail: student?.email || null,
    patientName: patient?.name || "Paciente",
    patientAge: patient?.age ?? null,
    patientOccupation: patient?.occupation ?? null,
    sessionNumber: convo.session_number ?? null,
    createdAt: convo.created_at,
    activeSeconds: cappedActiveSeconds(convo),
    status: convo.status,
    endReason: convo.end_reason,
    establishmentName: establishment?.name || null,
    sectionName: section?.name || null,
    messages: messages || [],
  };

  const buffer = await buildConversationDocx(input);
  const filename = conversationDocxFilename(input);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "no-store",
    },
  });
}
