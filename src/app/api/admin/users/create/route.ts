import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { logAdminAction } from "@/lib/audit";
import { createUserSchema, parseBody } from "@/lib/validation/schemas";
import { matchesScope, resolveAdminScopeRules } from "@/lib/admin-scope";
import { generateTempPassword } from "@/lib/credentials/temp-password";
import { renderCredentialsEmail } from "@/lib/emails/credentials-template";
import { sendTransactional } from "@/lib/emails/send";

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
    return NextResponse.json({ error: "Sin permisos para crear usuarios" }, { status: 403 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
  }
  const parsed = parseBody(createUserSchema, rawBody);
  if (!parsed.ok) return parsed.response;
  const { email, full_name, role, establishment_id, course_id, section_id, send_credentials } = parsed.data;

  // Admin can only create students and instructors. Superadmin is intentionally
  // excluded from this endpoint — it must be created directly in the database.
  const validRoles = callerRole === "superadmin"
    ? ["student", "instructor", "admin"]
    : ["student", "instructor"];
  if (role && !validRoles.includes(role)) {
    return NextResponse.json({ error: `No puedes crear usuarios con rol '${role}'` }, { status: 403 });
  }

  // Validate establishment_id scope for admin (superadmin can use any)
  let validatedEstablishmentId: string | undefined = establishment_id;
  if (callerRole === "admin") {
    const { data: assignments } = await supabase
      .from("admin_establishments")
      .select("establishment_id")
      .eq("admin_id", user.id);
    const allowedIds = (assignments || []).map((a) => a.establishment_id);

    if (allowedIds.length === 0) {
      return NextResponse.json(
        { error: "No tienes establecimientos asignados" },
        { status: 403 }
      );
    }

    // If admin didn't pass an establishment_id, default to their first one.
    // If they passed one, it must be in their allowed list.
    if (!validatedEstablishmentId) {
      validatedEstablishmentId = allowedIds[0];
    } else if (!allowedIds.includes(validatedEstablishmentId)) {
      return NextResponse.json(
        { error: "No tienes permiso para crear usuarios en ese establecimiento" },
        { status: 403 }
      );
    }
  }

  // Un admin acotado por asignatura/sección solo puede crear usuarios dentro de
  // su alcance (elegir sección implica su asignatura). Si tiene una única regla
  // acotada y no se especificó, se usa esa.
  let effCourseId: string | null = course_id ?? null;
  let effSectionId: string | null = section_id ?? null;
  if (callerRole === "admin" && validatedEstablishmentId) {
    const rules = (await resolveAdminScopeRules(supabase, user.id)).filter((r) => r.establishmentId === validatedEstablishmentId);
    const hasWide = rules.some((r) => !r.courseId && !r.sectionId);
    if (!hasWide) {
      if (!effCourseId && !effSectionId && rules.length === 1) {
        effCourseId = rules[0].courseId;
        effSectionId = rules[0].sectionId;
      }
      if (!matchesScope({ all: false, rules }, { establishment_id: validatedEstablishmentId, course_id: effCourseId, section_id: effSectionId })) {
        return NextResponse.json({ error: "La asignatura/sección elegida está fuera de tu alcance" }, { status: 403 });
      }
    }
  }

  const admin = createAdminClient();

  const tempPassword = generateTempPassword();

  // Create user via Supabase Admin API with password
  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      full_name,
      role: role || "student",
      establishment_id: validatedEstablishmentId || undefined,
    },
  });

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 500 });
  }

  // The `handle_new_user()` trigger always inserts profiles with role='student'
  // as a safeguard against public self-signup. Apply the intended role +
  // establishment explicitly here using the service-role client.
  if (newUser?.user?.id) {
    const updates: Record<string, unknown> = {
      role: role || "student",
      // Admin-created accounts get a temporary password → force a change on
      // first login (gate in the app layout → /cambiar-clave).
      must_change_password: true,
    };
    if (validatedEstablishmentId) updates.establishment_id = validatedEstablishmentId;
    if (effCourseId) updates.course_id = effCourseId;
    if (effSectionId) updates.section_id = effSectionId;
    const { error: profileError } = await admin.from("profiles").update(updates).eq("id", newUser.user.id);
    if (profileError) {
      console.error("[users/create] profile update failed", profileError);
    }

    // Un ADMIN ve a los usuarios por `admin_establishments` (NO por
    // profiles.establishment_id). Sin esta fila, un admin recién creado no ve a
    // NADIE. La creamos aquí para que "crear admin con establecimiento" otorgue
    // visibilidad de una vez (antes había que asignarlo aparte, y se olvidaba).
    if (role === "admin" && validatedEstablishmentId) {
      const { error: aeError } = await admin
        .from("admin_establishments")
        .insert({ admin_id: newUser.user.id, establishment_id: validatedEstablishmentId });
      if (aeError) console.error("[users/create] admin_establishments insert failed", aeError);
    }
  }

  // Entrega de credenciales. Toda la mecánica de correo vive en
  // src/lib/emails/*: la plantilla es la misma que usan el reenvío manual y el
  // worker programado, así que las tres rutas mandan exactamente el mismo HTML.
  let emailSent = false;
  let emailError: string | null = null;

  if (send_credentials) {
    // Marca institucional del correo (opcional: si no hay logo, se omite la fila).
    let institutionName: string | null = null;
    let institutionLogoUrl: string | null = null;
    if (validatedEstablishmentId) {
      const { data: est } = await admin
        .from("establishments")
        .select("name, logo_url")
        .eq("id", validatedEstablishmentId)
        .single();
      institutionName = est?.name ?? null;
      institutionLogoUrl = est?.logo_url ?? null;
    }

    const { subject, html } = renderCredentialsEmail({
      variant: "bienvenida",
      fullName: full_name,
      email,
      tempPassword,
      institutionName,
      institutionLogoUrl,
    });

    const res = await sendTransactional({
      to: email,
      subject,
      html,
      type: "credentials",
      userId: newUser?.user?.id ?? null,
    });
    emailSent = res.ok;
    emailError = res.error;
  }

  // Only mark credentials_sent_at when the email was actually sent.
  // This lets the admin retry from the UI if the initial send failed or was skipped.
  if (emailSent && newUser?.user?.id) {
    await admin
      .from("profiles")
      .update({ credentials_sent_at: new Date().toISOString() })
      .eq("id", newUser.user.id);
  }

  await logAdminAction({
    adminId: user.id,
    action: "create_user",
    entityType: "user",
    entityId: newUser?.user?.id,
    details: { email, role: role || "student", establishment_id: validatedEstablishmentId, send_credentials, emailSent, emailErrored: Boolean(emailError) },
  });

  return NextResponse.json({
    success: true,
    user: newUser,
    userId: newUser?.user?.id,
    tempPassword,
    emailSent,
    credentialsSent: emailSent,
    emailError,
  }, { status: 201 });
}
