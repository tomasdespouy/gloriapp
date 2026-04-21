import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { logAdminAction } from "@/lib/audit";

export async function POST(
  _request: Request,
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
  const admin = createAdminClient();

  // Get target user info
  const { data: target } = await admin.from("profiles").select("role, full_name, email, establishment_id, credentials_sent_at").eq("id", id).single();
  if (!target) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }
  if (target.role === "superadmin") {
    return NextResponse.json({ error: "No se puede restablecer la contraseña de un superadmin" }, { status: 403 });
  }

  // Admins can only issue credentials for students/instructors in their own
  // establishments. Superadmins retain full access (minus other superadmins).
  if (callerRole === "admin") {
    if (target.role !== "student" && target.role !== "instructor") {
      return NextResponse.json({ error: "Sin permisos para este rol" }, { status: 403 });
    }
    const { data: assignments } = await supabase
      .from("admin_establishments")
      .select("establishment_id")
      .eq("admin_id", user.id);
    const allowedIds = (assignments || []).map((a) => a.establishment_id);
    if (!target.establishment_id || !allowedIds.includes(target.establishment_id)) {
      return NextResponse.json({ error: "Usuario fuera de tu alcance" }, { status: 403 });
    }
  }

  // Generate new temporary password
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let tempPassword = "Gloria_";
  for (let i = 0; i < 6; i++) tempPassword += chars[Math.floor(Math.random() * chars.length)];

  // Update password via Supabase Admin API
  const { error: updateError } = await admin.auth.admin.updateUserById(id, {
    password: tempPassword,
  });

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Send email with credentials. The template differs depending on whether this
  // is the first delivery (welcome) or a password reset.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://gloria-app.vercel.app";
  const firstTime = target.credentials_sent_at == null;
  let emailSent = false;

  try {
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: "GlorIA <onboarding@resend.dev>",
        to: target.email,
        subject: firstTime
          ? "Bienvenido/a a GlorIA — Tus credenciales de acceso"
          : "GlorIA — Tu contraseña ha sido restablecida",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #4A55A2; padding: 24px 32px; border-radius: 12px 12px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">${firstTime ? "Bienvenido/a a GlorIA" : "Contraseña restablecida"}</h1>
              <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px;">Plataforma de Entrenamiento Clínico con IA</p>
            </div>
            <div style="background: #f9f9f9; padding: 32px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
              <p style="font-size: 15px; color: #333;">Hola <strong>${target.full_name || "usuario"}</strong>,</p>
              <p style="font-size: 14px; color: #555; line-height: 1.6;">
                ${firstTime
                  ? "Se ha creado tu cuenta en GlorIA. A continuación encontrarás tus credenciales de acceso:"
                  : "Tu contraseña en GlorIA ha sido restablecida por un administrador. A continuación encontrarás tus nuevas credenciales de acceso:"}
              </p>
              <div style="background: white; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <p style="margin: 0 0 8px; font-size: 13px; color: #888;">${firstTime ? "CREDENCIALES DE ACCESO" : "NUEVAS CREDENCIALES"}</p>
                <table style="width: 100%; font-size: 14px;">
                  <tr>
                    <td style="padding: 6px 0; color: #666; width: 120px;">Plataforma:</td>
                    <td style="padding: 6px 0;"><a href="${appUrl}/login" style="color: #4A55A2;">${appUrl}</a></td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #666;">Email:</td>
                    <td style="padding: 6px 0; font-weight: bold;">${target.email}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #666;">${firstTime ? "Contraseña:" : "Nueva contraseña:"}</td>
                    <td style="padding: 6px 0; font-weight: bold; font-family: monospace; font-size: 16px; letter-spacing: 1px;">${tempPassword}</td>
                  </tr>
                </table>
              </div>
              <p style="font-size: 14px; color: #555; line-height: 1.6;">
                <strong>${firstTime ? "Cómo ingresar:" : "Pasos a seguir:"}</strong>
              </p>
              <ol style="font-size: 14px; color: #555; line-height: 1.8; padding-left: 20px;">
                <li>Ingresa a <a href="${appUrl}/login" style="color: #4A55A2;">${appUrl}/login</a></li>
                <li>${firstTime ? "Escribe tu email y la contraseña temporal indicada arriba" : "Inicia sesión con tu email y la nueva contraseña temporal"}</li>
                <li>Te recomendamos cambiar tu contraseña ${firstTime ? "en tu primera sesión" : "desde tu perfil"}</li>
              </ol>
              <p style="font-size: 13px; color: #999; margin-top: 24px; border-top: 1px solid #eee; padding-top: 16px;">
                ${firstTime
                  ? "Si tienes problemas para acceder, contacta a tu docente o al equipo de soporte."
                  : "Si no solicitaste este cambio, contacta a tu docente o al equipo de soporte."}
              </p>
            </div>
          </div>
        `,
      });
      emailSent = true;
    }
  } catch {
    // Email failed but password was still changed
  }

  // Record the fact that credentials were delivered. Only set when email
  // actually went out — if email failed, the admin can retry.
  if (emailSent) {
    await admin
      .from("profiles")
      .update({ credentials_sent_at: new Date().toISOString() })
      .eq("id", id);
  }

  await logAdminAction({
    adminId: user.id,
    action: "reset_password",
    entityType: "user",
    entityId: id,
    details: { email: target.email, emailSent },
  });

  return NextResponse.json({ success: true, emailSent });
}
