import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

interface UserRow {
  email: string;
  full_name: string;
  role?: string;
}

export async function POST(request: Request) {
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

  const body = await request.json();
  const { users, role, establishment_id, course_id, section_id } = body as {
    users: UserRow[];
    role: string;
    establishment_id?: string;
    course_id?: string;
    section_id?: string;
  };

  if (!users || !Array.isArray(users) || users.length === 0) {
    return NextResponse.json({ error: "Lista de usuarios vacía" }, { status: 400 });
  }

  if (users.length > 200) {
    return NextResponse.json({ error: "Máximo 200 usuarios por carga" }, { status: 400 });
  }

  // Admin can only create students and instructors. Superadmin is intentionally
  // excluded from this endpoint — it must be created directly in the database.
  const allowedRoles = callerRole === "superadmin"
    ? ["student", "instructor", "admin"]
    : ["student", "instructor"];
  const targetRole = role || "student";
  if (!allowedRoles.includes(targetRole)) {
    return NextResponse.json({ error: `No puedes crear usuarios con rol '${targetRole}'` }, { status: 403 });
  }

  const admin = createAdminClient();
  const results: { email: string; success: boolean; error?: string }[] = [];

  for (const row of users) {
    if (!row.email || !row.full_name) {
      results.push({ email: row.email || "sin email", success: false, error: "Datos incompletos" });
      continue;
    }

    // Per-row role must also be within the caller's allowed set.
    const rowRole = row.role || targetRole;
    if (!allowedRoles.includes(rowRole)) {
      results.push({ email: row.email, success: false, error: `Rol no permitido: ${rowRole}` });
      continue;
    }

    try {
      const { data: newUser, error: createError } = await admin.auth.admin.createUser({
        email: row.email.trim().toLowerCase(),
        email_confirm: true,
        user_metadata: {
          full_name: row.full_name.trim(),
          role: rowRole,
          establishment_id: establishment_id || undefined,
        },
      });

      if (createError) {
        results.push({ email: row.email, success: false, error: createError.message });
        continue;
      }

      // The `handle_new_user()` trigger forces role='student'; apply the
      // intended role + establishment + course/section here explicitly.
      if (newUser?.user?.id) {
        const updates: Record<string, unknown> = { role: rowRole };
        if (establishment_id) updates.establishment_id = establishment_id;
        if (course_id) updates.course_id = course_id;
        if (section_id) updates.section_id = section_id;
        const { error: profileError } = await admin.from("profiles").update(updates).eq("id", newUser.user.id);
        if (profileError) {
          console.error("[users/bulk] profile update failed", profileError);
        }
      }

      results.push({ email: row.email, success: true });
    } catch (e) {
      results.push({ email: row.email, success: false, error: e instanceof Error ? e.message : "Error desconocido" });
    }
  }

  const created = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  return NextResponse.json({ created, failed, results });
}
