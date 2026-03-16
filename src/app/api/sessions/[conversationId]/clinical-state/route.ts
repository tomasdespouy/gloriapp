import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET clinical state evolution for a conversation.
 * Teachers always see it; students only if feedback is approved.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // Check user role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isInstructor = ["instructor", "admin", "superadmin"].includes(profile?.role || "");

  // Verify access: student must own the conversation and feedback must be approved
  if (!isInstructor) {
    const { data: conv } = await supabase
      .from("conversations")
      .select("id, student_id")
      .eq("id", conversationId)
      .single();

    if (!conv || conv.student_id !== user.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Check approval
    const { data: comp } = await admin
      .from("session_competencies")
      .select("feedback_status")
      .eq("conversation_id", conversationId)
      .maybeSingle();

    if (comp?.feedback_status !== "approved") {
      return NextResponse.json({ error: "Pendiente de aprobación" }, { status: 403 });
    }
  }

  // Fetch clinical state log
  const { data: stateLog } = await admin
    .from("clinical_state_log")
    .select("turn_number, intervention_type, resistencia, alianza, apertura_emocional, sintomatologia, disposicion_cambio")
    .eq("conversation_id", conversationId)
    .order("turn_number", { ascending: true });

  return NextResponse.json({ data: stateLog || [] });
}
