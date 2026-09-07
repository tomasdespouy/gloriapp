import type { SupabaseClient } from "@supabase/supabase-js";
import { cappedActiveSeconds } from "./active-seconds";
import type { ConversationDocxInput } from "./conversation-docx";

/**
 * Arma los datos del .docx de una conversación.
 *
 * Vive separado del generador (conversation-docx.ts, que no sabe de Supabase)
 * y separado de la autorización: cada ruta decide primero si el que pide tiene
 * derecho a esta conversación, y recién entonces llama acá. Así el docente y
 * el estudiante descargan exactamente el mismo documento y no hay dos consultas
 * que se puedan ir separando con el tiempo.
 *
 * Devuelve también `studentId` para que la ruta que llama pueda usarlo en su
 * chequeo de alcance sin repetir la consulta.
 */

export type ConversationDocxLoad =
  | { ok: true; studentId: string; input: ConversationDocxInput }
  | { ok: false; status: number; error: string };

export async function loadConversationDocxInput(
  // El cliente de servicio (sin RLS): la autorización ya la hizo la ruta.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, any, any>,
  conversationId: string,
): Promise<ConversationDocxLoad> {
  const { data: convo } = await admin
    .from("conversations")
    .select(
      "id, student_id, session_number, status, created_at, started_at, ended_at, active_seconds, end_reason, ai_patients(name, age, occupation)",
    )
    .eq("id", conversationId)
    .maybeSingle();

  if (!convo) {
    return { ok: false, status: 404, error: "Conversación no encontrada" };
  }

  const { data: student } = await admin
    .from("profiles")
    .select("full_name, email, establishment_id, section_id")
    .eq("id", convo.student_id)
    .maybeSingle();

  // Establecimiento y sección son contexto del encabezado; si faltan, el
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

  return {
    ok: true,
    studentId: convo.student_id,
    input: {
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
    },
  };
}
