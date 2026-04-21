import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { logAdminAction } from "@/lib/audit";
import { createUserSchema, parseBody } from "@/lib/validation/schemas";

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

  const admin = createAdminClient();

  // Generate temporary password
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let tempPassword = "Gloria_";
  for (let i = 0; i < 6; i++) tempPassword += chars[Math.floor(Math.random() * chars.length)];

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
    };
    if (validatedEstablishmentId) updates.establishment_id = validatedEstablishmentId;
    if (course_id) updates.course_id = course_id;
    if (section_id) updates.section_id = section_id;
    const { error: profileError } = await admin.from("profiles").update(updates).eq("id", newUser.user.id);
    if (profileError) {
      console.error("[users/create] profile update failed", profileError);
    }
  }

  // Send welcome email with credentials (only if requested)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://gloria-app.vercel.app";
  const roleLabels: Record<string, string> = {
    student: "Estudiante", instructor: "Docente", admin: "Administrador", superadmin: "Superadministrador",
  };
  let emailSent = false;

  let emailError: unknown = null;
  if (send_credentials) {
    try {
      const resendKey = process.env.RESEND_API_KEY;
      if (resendKey) {
        const resend = new Resend(resendKey);
        const { error: sendError } = await resend.emails.send({
          from: "GlorIA <onboarding@resend.dev>",
          to: email,
          subject: "Bienvenido/a a GlorIA — Tus credenciales de acceso",
          html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #4A55A2; padding: 24px 32px; border-radius: 12px 12px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Bienvenido/a a GlorIA</h1>
              <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px;">Plataforma de Entrenamiento Clínico con IA</p>
            </div>
            <div style="background: #f9f9f9; padding: 32px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
              <p style="font-size: 15px; color: #333;">Hola <strong>${full_name}</strong>,</p>
              <p style="font-size: 14px; color: #555; line-height: 1.6;">
                Se ha creado tu cuenta en GlorIA con el rol de <strong>${roleLabels[role || "student"]}</strong>.
                A continuación encontrarás tus credenciales de acceso:
              </p>
              <div style="background: white; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <p style="margin: 0 0 8px; font-size: 13px; color: #888;">CREDENCIALES DE ACCESO</p>
                <table style="width: 100%; font-size: 14px;">
                  <tr>
                    <td style="padding: 6px 0; color: #666; width: 120px;">Plataforma:</td>
                    <td style="padding: 6px 0;"><a href="${appUrl}/login" style="color: #4A55A2;">${appUrl}</a></td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #666;">Email:</td>
                    <td style="padding: 6px 0; font-weight: bold;">${email}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #666;">Contraseña:</td>
                    <td style="padding: 6px 0; font-weight: bold; font-family: monospace; font-size: 16px; letter-spacing: 1px;">${tempPassword}</td>
                  </tr>
                </table>
              </div>
              <p style="font-size: 14px; color: #555; line-height: 1.6;">
                <strong>Cómo ingresar:</strong>
              </p>
              <ol style="font-size: 14px; color: #555; line-height: 1.8; padding-left: 20px;">
                <li>Ingresa a <a href="${appUrl}/login" style="color: #4A55A2;">${appUrl}/login</a></li>
                <li>Escribe tu email y la contraseña temporal indicada arriba</li>
                <li>Te recomendamos cambiar tu contraseña en tu primera sesión</li>
              </ol>
              <p style="font-size: 13px; color: #999; margin-top: 24px; border-top: 1px solid #eee; padding-top: 16px;">
                Si tienes problemas para acceder, contacta a tu docente o al equipo de soporte.
              </p>
            </div>
          </div>
        `,
        });
        if (sendError) {
          // Resend didn't throw — it returned an error object. Log so the
          // failure is visible in Vercel logs and leave emailSent=false.
          console.error("[users/create] resend error", { email, sendError });
          emailError = sendError;
        } else {
          emailSent = true;
        }
      }
    } catch (e) {
      console.error("[users/create] resend threw", { email, error: e });
      emailError = e;
    }
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
    emailError: emailError ? String((emailError as { message?: string })?.message || emailError) : null,
  }, { status: 201 });
}
