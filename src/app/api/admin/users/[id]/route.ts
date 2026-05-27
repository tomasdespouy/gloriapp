import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { logAdminAction } from "@/lib/audit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "superadmin") {
    return NextResponse.json({ error: "Solo superadmin puede modificar usuarios" }, { status: 403 });
  }

  const { id } = await params;
  const adminClient = createAdminClient();

  // Block modifications to superadmin accounts
  const { data: target } = await adminClient.from("profiles").select("role").eq("id", id).single();
  if (target?.role === "superadmin") {
    return NextResponse.json({ error: "No se puede modificar una cuenta superadmin" }, { status: 403 });
  }

  const body = await request.json();
  const { full_name, role, establishment_id, course_id, section_id, is_disabled } = body;

  const updates: Record<string, unknown> = {};
  if (full_name !== undefined) updates.full_name = full_name;
  if (role !== undefined) updates.role = role;
  if (establishment_id !== undefined) updates.establishment_id = establishment_id;
  if (course_id !== undefined) updates.course_id = course_id;
  if (section_id !== undefined) updates.section_id = section_id;
  if (is_disabled !== undefined) updates.is_disabled = is_disabled;

  const { data, error } = await adminClient
    .from("profiles")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction({
    adminId: user.id,
    action: "update_user",
    entityType: "user",
    entityId: id,
    details: updates,
  });

  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "superadmin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // Block deletion of superadmin accounts
  const { id } = await params;
  const adminDel = createAdminClient();

  const { data: target } = await adminDel.from("profiles").select("role").eq("id", id).single();
  if (target?.role === "superadmin") {
    return NextResponse.json({ error: "No se puede eliminar una cuenta superadmin" }, { status: 403 });
  }

  // ── Clean up data that references the user, otherwise Supabase can't delete
  // the account (FK constraints) and the request fails. Two kinds of refs:
  //  • OWNED (the user's own data) → delete the rows.
  //  • AUTHORED (rows that belong to OTHERS but cite this user as
  //    teacher/approver/creator) → null the reference so the other person's
  //    data survives; if the column is NOT NULL, delete the row.
  const OWNED: [string, string][] = [
    ["session_feedback", "student_id"], ["session_competencies", "student_id"],
    ["student_progress", "student_id"], ["student_achievements", "student_id"],
    ["learning_progress", "student_id"], ["session_summaries", "student_id"],
    ["action_items", "student_id"], ["notifications", "user_id"],
    ["survey_responses", "user_id"], ["support_tickets", "user_id"],
    ["platform_activity", "user_id"], ["pilot_participants", "user_id"],
    ["pilot_consents", "user_id"], ["observation_sessions", "student_id"],
    ["chat_alerts", "student_id"], ["admin_establishments", "admin_id"],
  ];
  const AUTHORED: [string, string][] = [
    ["session_competencies", "approved_by"], ["session_feedback", "teacher_id"],
    ["action_items", "teacher_id"], ["chat_alerts", "reviewed_by"],
    ["surveys", "created_by"], ["crm_activities", "created_by"],
    ["crm_email_templates", "created_by"], ["technical_reports", "uploaded_by"],
    ["pilots", "created_by"], ["pilot_reports", "created_by"],
    ["notification_log", "sent_by"], ["establishment_patients", "granted_by"],
    ["enrichment_history", "approved_by"], ["admin_audit_log", "admin_id"],
  ];

  // Delete messages of the user's conversations first (in case the FK to
  // conversations isn't ON DELETE CASCADE), then the conversations.
  const { data: convs } = await adminDel.from("conversations").select("id").eq("student_id", id);
  const convIds = (convs || []).map((c) => c.id);
  if (convIds.length) {
    await adminDel.from("messages").delete().in("conversation_id", convIds);
    await adminDel.from("conversations").delete().eq("student_id", id);
  }

  for (const [table, col] of OWNED) {
    await adminDel.from(table).delete().eq(col, id);
  }
  for (const [table, col] of AUTHORED) {
    const { error: nullErr } = await adminDel.from(table).update({ [col]: null }).eq(col, id);
    if (nullErr) await adminDel.from(table).delete().eq(col, id); // column is NOT NULL
  }

  // Delete auth user (cascades to the profile row)
  const { error } = await adminDel.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction({
    adminId: user.id,
    action: "delete_user",
    entityType: "user",
    entityId: id,
  });

  return NextResponse.json({ success: true });
}
