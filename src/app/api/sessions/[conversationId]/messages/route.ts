import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify the conversation belongs to the user
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("student_id", user.id)
    .single();

  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: messages } = await supabase
    .from("messages")
    .select("role, content, created_at")
    .eq("conversation_id", conversationId)
    .neq("role", "system")
    .order("created_at", { ascending: true });

  return NextResponse.json(messages || []);
}
