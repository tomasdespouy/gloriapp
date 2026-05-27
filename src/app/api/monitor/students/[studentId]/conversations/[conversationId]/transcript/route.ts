import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMonitorAuthority, canAccessStudent } from "@/lib/monitor/scope";

// Transcripción de una conversación para el visor inline del monitor.
// Doble candado: (1) el alumno debe caer en el alcance del que pide y
// (2) la conversación debe pertenecer a ese alumno. Ambos server-side,
// porque los reads usan service role (sin RLS).

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ studentId: string; conversationId: string }> },
) {
  const auth = await getMonitorAuthority();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { studentId, conversationId } = await params;
  if (!(await canAccessStudent(auth, studentId))) {
    return NextResponse.json({ error: "Alumno fuera de su alcance" }, { status: 403 });
  }

  const admin = createAdminClient();

  // La conversación debe ser de ese alumno (no basta con conocer el id).
  const { data: convo } = await admin
    .from("conversations")
    .select("id, student_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (!convo || convo.student_id !== studentId) {
    return NextResponse.json({ error: "Conversación no pertenece al alumno" }, { status: 404 });
  }

  const { data: messages } = await admin
    .from("messages")
    .select("role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  return NextResponse.json({ messages: messages || [] });
}
