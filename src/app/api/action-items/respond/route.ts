import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id, status, comment } = await request.json();
  if (!id || !["accepted", "rejected"].includes(status)) {
    return NextResponse.json({ error: "id y status (accepted/rejected) requeridos" }, { status: 400 });
  }

  const { error } = await supabase
    .from("action_items")
    .update({
      status,
      student_comment: comment || null,
      responded_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("student_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
