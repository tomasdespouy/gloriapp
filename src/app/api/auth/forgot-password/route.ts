import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getAppUrl } from "@/lib/app-url";
import { logEmail } from "@/lib/email-log";

/**
 * Self-service de "Recuperar contraseña".
 *
 * Por qué existe esta ruta (y no usamos supabase.auth.resetPasswordForEmail
 * directo desde el cliente): ese método manda el correo por el email NATIVO de
 * Supabase, que en producción no entrega de forma confiable (sin SMTP propio /
 * tope de pocos correos por hora). Todo el resto de la plataforma manda correos
 * por Resend (dominio verificado glor-ia.com), así que enrutamos el reset por la
 * misma vía: generamos el enlace de recuperación con la Admin API y lo enviamos
 * nosotros vía Resend.
 *
 * Reglas:
 *   - Solo se envía correo si el usuario EXISTE (no gastar créditos Resend en
 *     direcciones que no están registradas).
 *   - La respuesta es SIEMPRE genérica ("si está registrado, recibirás un
 *     enlace") para no filtrar qué correos existen (anti-enumeración).
 *   - La contraseña actual NO cambia hasta que el usuario fija una nueva en
 *     /reset-password — un tercero no puede dejar fuera al titular pidiendo reset.
 */
export async function POST(request: Request) {
  let email: string | undefined;
  try {
    ({ email } = await request.json());
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const normalized = (email || "").trim().toLowerCase();
  // Respuesta genérica reutilizable: misma forma exista o no el usuario.
  const generic = NextResponse.json({ success: true });

  if (!normalized || !normalized.includes("@")) {
    return NextResponse.json({ error: "Ingresa un email válido." }, { status: 400 });
  }

  const admin = createAdminClient();

  // 1) ¿Existe el usuario? Si no, no enviamos nada (regla de no gastar Resend
  //    en cuentas inexistentes) pero respondemos genérico igual.
  const { data: profile } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .eq("email", normalized)
    .maybeSingle();

  if (!profile) {
    return generic;
  }

  // 2) Generamos el token de recuperación SIN que Supabase mande correo.
  //    Usamos el token_hash con NUESTRA ruta /auth/confirm (verifyOtp server-side)
  //    en vez del action_link nativo: ese redirige con los tokens en el fragmento
  //    (#access_token=...), que el servidor no ve, y la sesión de recuperación
  //    nunca se establecía. Ver src/app/auth/confirm/route.ts.
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: profile.email || normalized,
  });

  const tokenHash = linkData?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    console.error("[auth/forgot-password] generateLink error", { email: normalized, linkError });
    await logEmail("password_reset", normalized, false);
    return generic; // No filtramos el fallo al cliente.
  }

  const actionLink = `${getAppUrl()}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=recovery&next=/reset-password`;

  // 3) Enviamos el enlace por Resend.
  let emailSent = false;
  try {
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const resend = new Resend(resendKey);
      const appUrl = getAppUrl();
      const firstName = profile.full_name?.split(" ")[0] || "";
      const { error: sendError } = await resend.emails.send({
        from: "GlorIA <noreply@glor-ia.com>",
        to: profile.email || normalized,
        subject: "GlorIA — Restablecer tu contraseña",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #4A55A2; padding: 24px 32px; border-radius: 12px 12px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Restablecer contraseña</h1>
              <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px;">Plataforma de Entrenamiento Clínico con IA</p>
            </div>
            <div style="background: #f9f9f9; padding: 32px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
              <p style="font-size: 15px; color: #333;">Hola <strong>${firstName}</strong>,</p>
              <p style="font-size: 14px; color: #555; line-height: 1.6;">
                Recibimos una solicitud para restablecer la contraseña de tu cuenta en GlorIA.
                Haz clic en el botón para crear una nueva contraseña:
              </p>
              <div style="text-align: center; margin: 28px 0;">
                <a href="${actionLink}" style="background: #4A55A2; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-size: 15px; font-weight: bold; display: inline-block;">
                  Crear nueva contraseña
                </a>
              </div>
              <p style="font-size: 13px; color: #777; line-height: 1.6;">
                Si el botón no funciona, copia y pega este enlace en tu navegador:
              </p>
              <p style="font-size: 12px; color: #4A55A2; word-break: break-all;">${actionLink}</p>
              <p style="font-size: 13px; color: #777; line-height: 1.6; margin-top: 20px;">
                Este enlace es de un solo uso y caduca por seguridad. Si no solicitaste este cambio,
                puedes ignorar este correo: tu contraseña no cambiará.
              </p>
              <p style="font-size: 13px; color: #999; margin-top: 24px; border-top: 1px solid #eee; padding-top: 16px;">
                ¿Problemas para acceder? Escribe a <a href="mailto:info@glor-ia.com" style="color: #4A55A2;">info@glor-ia.com</a> o contacta a tu docente. — <a href="${appUrl}/login" style="color: #4A55A2;">${appUrl}/login</a>
              </p>
            </div>
          </div>
        `,
      });
      if (sendError) {
        console.error("[auth/forgot-password] resend error", { email: normalized, sendError });
      } else {
        emailSent = true;
      }
    }
  } catch (e) {
    console.error("[auth/forgot-password] resend threw", { email: normalized, error: e });
  }

  await logEmail("password_reset", normalized, emailSent);

  return generic;
}
