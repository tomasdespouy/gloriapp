import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { conversationId } = await params;

  const { error } = await supabase
    .from("conversations")
    .update({ status: "active", ended_at: null })
    .eq("id", conversationId)
    .eq("student_id", user.id)
    .eq("status", "abandoned");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
