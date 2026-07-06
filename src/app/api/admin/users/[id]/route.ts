import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { logAdminAction } from "@/lib/audit";
import { matchesScope, resolveAdminScopeRules, sectionInScope, courseInScope } from "@/lib/admin-scope";

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

  const callerRole = profile?.role;
  if (!callerRole || !["admin", "superadmin"].includes(callerRole)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { id } = await params;
  const adminClient = createAdminClient();

  // Target: rol + alcance (para el chequeo del admin). Nadie modifica superadmins.
  const { data: target } = await adminClient
    .from("profiles")
    .select("role, establishment_id, course_id, section_id")
    .eq("id", id)
    .single();
  if (!target) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  if (target.role === "superadmin") {
    return NextResponse.json({ error: "No se puede modificar una cuenta superadmin" }, { status: 403 });
  }

  const body = await request.json();
  const { full_name, role, establishment_id, course_id, section_id, is_disabled, admin_scope } = body;

  // ── Autorización del ADMIN (el superadmin no pasa por acá) ──
  // Un admin solo edita ESTUDIANTES/DOCENTES DE SU ALCANCE, y solo puede cambiar
  // nombre / asignatura-sección / activar-desactivar. NO puede: cambiar el rol,
  // mover de establecimiento, gestionar admins, ni tocar a otros admins/superadmins.
  // Para un admin, el curso/sección finales se RESUELVEN y VALIDAN acá y se
  // fuerzan en `updates` (no se confía en el course_id/section_id del cliente).
  let adminEffCourse: string | null = null;
  let adminEffSection: string | null = null;
  if (callerRole === "admin") {
    if (target.role !== "student" && target.role !== "instructor") {
      return NextResponse.json({ error: "Como admin solo puedes editar estudiantes y docentes" }, { status: 403 });
    }
    const scope = { all: false as const, rules: await resolveAdminScopeRules(supabase, user.id) };
    if (!matchesScope(scope, target)) {
      return NextResponse.json({ error: "Usuario fuera de tu alcance" }, { status: 403 });
    }
    if (role !== undefined && role !== target.role) {
      return NextResponse.json({ error: "No puedes cambiar el rol de un usuario" }, { status: 403 });
    }
    if (establishment_id !== undefined && establishment_id !== target.establishment_id) {
      return NextResponse.json({ error: "No puedes cambiar el establecimiento de un usuario" }, { status: 403 });
    }
    if (admin_scope !== undefined) {
      return NextResponse.json({ error: "Solo un superadmin puede asignar administradores" }, { status: 403 });
    }
    // Reasignación: resolver el destino REAL desde la BD. Si dan sección, su
    // asignatura sale de la BD (no del body), cerrando el hueco de matchesScope.
    const wantSection = section_id !== undefined ? section_id : target.section_id;
    const wantCourse = course_id !== undefined ? course_id : target.course_id;
    if (wantSection) {
      const r = await sectionInScope(adminClient, scope, wantSection);
      if (!r.ok || r.establishmentId !== target.establishment_id) {
        return NextResponse.json({ error: "Sección fuera de tu alcance" }, { status: 403 });
      }
      adminEffSection = wantSection;
      adminEffCourse = r.courseId; // consistencia: la asignatura real de la sección
    } else if (wantCourse) {
      const r = await courseInScope(adminClient, scope, wantCourse);
      if (!r.ok || r.establishmentId !== target.establishment_id) {
        return NextResponse.json({ error: "Asignatura fuera de tu alcance" }, { status: 403 });
      }
      adminEffCourse = wantCourse;
    } else {
      // Dejar sin asignatura/sección solo si el alcance del admin cubre "todo el
      // establecimiento" (regla sin acotar); si no, lo sacaría de su propia vista.
      if (!matchesScope(scope, { establishment_id: target.establishment_id, course_id: null, section_id: null })) {
        return NextResponse.json({ error: "No puedes dejar sin asignatura a este usuario" }, { status: 403 });
      }
    }
  }

  const updates: Record<string, unknown> = {};
  if (full_name !== undefined) updates.full_name = full_name;
  if (role !== undefined) updates.role = role;
  if (establishment_id !== undefined) updates.establishment_id = establishment_id;
  if (course_id !== undefined) updates.course_id = course_id;
  if (section_id !== undefined) updates.section_id = section_id;
  if (is_disabled !== undefined) updates.is_disabled = is_disabled;

  // Admin: nunca escribe rol ni establecimiento (defensa en profundidad, ya
  // rechazados arriba si venían distintos), y curso/sección van a los valores
  // VALIDADOS/RESUELTOS (no los del cliente) → sin inconsistencias ni fuga.
  if (callerRole === "admin") {
    delete updates.role;
    delete updates.establishment_id;
    updates.course_id = adminEffCourse;
    updates.section_id = adminEffSection;
  }

  // Alcance del ADMIN (asignatura/sección): la fuente de verdad es
  // admin_establishments (abajo). Además ESPEJAMOS curso/sección en el PERFIL
  // para que la lista y la ficha lo muestren (assigned=false o "Todas" → NULL).
  const manageAdminScope = !!admin_scope && role === "admin" && !!establishment_id;
  let scopeCourse: string | null = null;
  let scopeSection: string | null = null;
  if (manageAdminScope && admin_scope.assigned) {
    scopeCourse = admin_scope.course_id ?? null;
    scopeSection = admin_scope.section_id ?? null;
    if (scopeSection && !scopeCourse) {
      const { data: sec } = await adminClient.from("sections").select("course_id").eq("id", scopeSection).maybeSingle();
      scopeCourse = sec?.course_id ?? null;
    }
  }
  if (manageAdminScope) {
    updates.course_id = scopeCourse;
    updates.section_id = scopeSection;
  }

  const { data, error } = await adminClient
    .from("profiles")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Deshabilitar/rehabilitar debe tener DIENTES: se banea/des-banea también en
  // Supabase Auth, porque el flag `is_disabled` por sí solo NO bloquea el login.
  if (is_disabled !== undefined) {
    const { error: banErr } = await adminClient.auth.admin.updateUserById(id, {
      ban_duration: is_disabled ? "876000h" : "none",
    });
    if (banErr) console.error("[admin/users] ban/unban error:", banErr.message);
  }

  // Fuente de verdad del alcance: admin_establishments.
  //   assigned=false → "Sin asignar" (no ve nada) → sin fila.
  //   assigned=true, course/section NULL → "Todas" (todo el establecimiento).
  if (manageAdminScope) {
    await adminClient.from("admin_establishments").delete().eq("admin_id", id).eq("establishment_id", establishment_id);
    if (admin_scope.assigned) {
      await adminClient.from("admin_establishments").insert({
        admin_id: id, establishment_id, course_id: scopeCourse, section_id: scopeSection,
      });
    }
  }

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
