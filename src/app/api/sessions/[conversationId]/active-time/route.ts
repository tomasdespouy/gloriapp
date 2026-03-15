import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { conversationId } = await params;
  const { active_seconds } = await request.json();

  if (typeof active_seconds !== "number" || active_seconds < 0) {
    return NextResponse.json({ error: "active_seconds inválido" }, { status: 400 });
  }

  await supabase
    .from("conversations")
    .update({ active_seconds })
    .eq("id", conversationId)
    .eq("student_id", user.id);

  return NextResponse.json({ success: true });
}
