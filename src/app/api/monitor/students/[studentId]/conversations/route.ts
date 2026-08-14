import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMonitorAuthority, canAccessStudent } from "@/lib/monitor/scope";

// Conversaciones de un alumno, enriquecidas con paciente, métricas y score.
// Generaliza el endpoint equivalente de pilotos: aquí la autorización no es
// "¿pertenece al piloto?" sino "¿este alumno cae en el alcance del que pide?".
// El chequeo es server-side y previo a devolver cualquier dato.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const auth = await getMonitorAuthority();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { studentId } = await params;
  if (!(await canAccessStudent(auth, studentId))) {
    return NextResponse.json({ error: "Alumno fuera de su alcance" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: conversations } = await admin
    .from("conversations")
    .select(`
      id,
      ai_patient_id,
      status,
      session_number,
      started_at,
      ended_at,
      created_at,
      active_seconds,
      end_reason,
      ai_patients ( name )
    `)
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });

  const convoList = (conversations || []) as unknown as Array<{
    id: string;
    ai_patient_id: string;
    status: string;
    session_number: number | null;
    started_at: string | null;
    ended_at: string | null;
    created_at: string;
    active_seconds: number | null;
    end_reason: string | null;
    ai_patients: { name: string } | { name: string }[] | null;
  }>;

  if (convoList.length === 0) {
    return NextResponse.json({ conversations: [] });
  }

  const conversationIds = convoList.map((c) => c.id);
  const [{ data: msgCounts }, { data: comps }] = await Promise.all([
    admin.from("messages").select("conversation_id").in("conversation_id", conversationIds),
    admin
      .from("session_competencies")
      .select("conversation_id, overall_score_v2, ai_commentary, feedback_status")
      .in("conversation_id", conversationIds),
  ]);

  const messageCountMap = new Map<string, number>();
  for (const m of msgCounts || []) {
    messageCountMap.set(m.conversation_id, (messageCountMap.get(m.conversation_id) || 0) + 1);
  }
  const compMap = new Map<string, { score: number | null; commentary: string | null; status: string | null }>();
  for (const c of comps || []) {
    compMap.set(c.conversation_id, {
      score: typeof c.overall_score_v2 === "number" ? c.overall_score_v2 : null,
      commentary: c.ai_commentary || null,
      status: c.feedback_status || null,
    });
  }

  const enriched = convoList.map((c) => {
    const patientObj = Array.isArray(c.ai_patients) ? c.ai_patients[0] : c.ai_patients;
    const comp = compMap.get(c.id);
    return {
      id: c.id,
      patient_name: patientObj?.name || "(paciente desconocido)",
      status: c.status,
      session_number: c.session_number,
      started_at: c.started_at,
      ended_at: c.ended_at,
      created_at: c.created_at,
      active_seconds: c.active_seconds || 0,
      end_reason: c.end_reason,
      message_count: messageCountMap.get(c.id) || 0,
      overall_score: comp?.score ?? null,
      feedback_status: comp?.status ?? null,
      ai_commentary: comp?.commentary ?? null,
    };
  });

  return NextResponse.json({ conversations: enriched });
}
