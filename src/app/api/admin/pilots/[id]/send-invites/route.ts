import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
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

  if (profile?.role !== "superadmin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id } = await params;

  // Get pilot details
  const { data: pilot, error: pilotError } = await supabase
    .from("pilots")
    .select("*")
    .eq("id", id)
    .single();

  if (pilotError || !pilot) {
    return NextResponse.json({ error: "Piloto no encontrado" }, { status: 404 });
  }

  // Get pending participants
  const { data: participants, error: partError } = await supabase
    .from("pilot_participants")
    .select("*")
    .eq("pilot_id", id)
    .eq("status", "pendiente");

  if (partError) {
    return NextResponse.json({ error: partError.message }, { status: 500 });
  }

  if (!participants || participants.length === 0) {
    return NextResponse.json({ error: "No hay participantes pendientes" }, { status: 400 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: "RESEND_API_KEY no configurada" }, { status: 500 });
  }

  const admin = createAdminClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://gloria-app.vercel.app";

  const results: {
    email: string;
    success: boolean;
    error?: string;
    tempPassword?: string;
  }[] = [];

  for (const participant of participants) {
    try {
      // Generate temporary password
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
      let tempPassword = "Gloria_";
      for (let i = 0; i < 6; i++) {
        tempPassword += chars[Math.floor(Math.random() * chars.length)];
      }

      // Create auth user
      const { data: newUser, error: createError } = await admin.auth.admin.createUser({
        email: participant.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: participant.full_name,
          role: participant.role,
          pilot_id: id,
        },
      });

      if (createError) {
        results.push({ email: participant.email, success: false, error: createError.message });
        continue;
      }

      // Update participant with user_id
      if (newUser?.user?.id) {
        await supabase
          .from("pilot_participants")
          .update({
            user_id: newUser.user.id,
            status: "invitado",
            invite_sent_at: new Date().toISOString(),
          })
          .eq("id", participant.id);
      }

      // Send invitation email
      const roleLabel = participant.role === "instructor" ? "Docente" : "Estudiante";
      const emailHtml = generateInviteEmail({
        fullName: participant.full_name,
        email: participant.email,
        tempPassword,
        roleLabel,
        institution: pilot.institution,
        pilotName: pilot.name,
        appUrl,
      });

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "GlorIA <info@gloria-app.cl>",
          to: participant.email,
          subject: `Bienvenido/a a GlorIA — Tus credenciales de acceso`,
          html: emailHtml,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`Resend error for ${participant.email}:`, errText);
        results.push({ email: participant.email, success: true, tempPassword, error: "Usuario creado pero error al enviar email" });
      } else {
        results.push({ email: participant.email, success: true, tempPassword });
      }
    } catch (err) {
      results.push({
        email: participant.email,
        success: false,
        error: err instanceof Error ? err.message : "Error desconocido",
      });
    }
  }

  // Update pilot status
  const successCount = results.filter((r) => r.success).length;
  if (successCount > 0) {
    await supabase
      .from("pilots")
      .update({
        status: "enviado",
        email_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
  }

  return NextResponse.json({
    total: results.length,
    success: successCount,
    failed: results.length - successCount,
    results,
  });
}

function generateInviteEmail(opts: {
  fullName: string;
  email: string;
  tempPassword: string;
  roleLabel: string;
  institution: string;
  pilotName: string;
  appUrl: string;
}) {
  return `
    <div style="font-family: Calibri, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1A1A1A;">
      <div style="background: #4A55A2; padding: 24px 32px; border-radius: 12px 12px 0 0;">
        <img src="${opts.appUrl}/branding/gloria-logo.png" alt="GlorIA" style="height: 36px; margin-bottom: 8px;" />
        <h1 style="color: white; margin: 0; font-size: 22px;">Bienvenido/a a GlorIA</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 6px 0 0; font-size: 13px;">
          Plataforma de Entrenamiento Cl\u00ednico con IA
        </p>
      </div>

      <div style="background: #FAFAFA; padding: 32px; border: 1px solid #E5E5E5; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="font-size: 15px; color: #333;">
          Hola <strong>${opts.fullName}</strong>,
        </p>

        <p style="font-size: 14px; color: #555; line-height: 1.6;">
          Has sido invitado/a a participar en el piloto <strong>${opts.pilotName}</strong>
          de <strong>${opts.institution}</strong> como <strong>${opts.roleLabel}</strong>.
        </p>

        <p style="font-size: 14px; color: #555; line-height: 1.6;">
          GlorIA es una plataforma de simulaci\u00f3n terap\u00e9utica donde podr\u00e1s practicar
          entrevistas cl\u00ednicas con pacientes virtuales impulsados por inteligencia artificial.
        </p>

        <div style="background: white; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <p style="margin: 0 0 12px; font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px;">
            Credenciales de acceso
          </p>
          <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666; width: 120px;">Plataforma:</td>
              <td style="padding: 8px 0;">
                <a href="${opts.appUrl}/login" style="color: #4A55A2; text-decoration: none;">${opts.appUrl}</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Email:</td>
              <td style="padding: 8px 0; font-weight: bold;">${opts.email}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Contrase\u00f1a:</td>
              <td style="padding: 8px 0; font-weight: bold; font-family: monospace; font-size: 16px; letter-spacing: 1px; color: #4A55A2;">
                ${opts.tempPassword}
              </td>
            </tr>
          </table>
        </div>

        <p style="font-size: 14px; color: #555; font-weight: 600;">C\u00f3mo ingresar:</p>
        <ol style="font-size: 14px; color: #555; line-height: 2; padding-left: 20px;">
          <li>Ingresa a <a href="${opts.appUrl}/login" style="color: #4A55A2;">${opts.appUrl}/login</a></li>
          <li>Escribe tu email y la contrase\u00f1a temporal indicada arriba</li>
          <li>Explora los pacientes virtuales y comienza tu primera sesi\u00f3n</li>
        </ol>

        <div style="background: #F0F0FF; border-radius: 8px; padding: 16px; margin-top: 20px;">
          <p style="font-size: 13px; color: #4A55A2; margin: 0; font-weight: 600;">
            Recomendaci\u00f3n: cambia tu contrase\u00f1a al ingresar por primera vez.
          </p>
        </div>

        <p style="font-size: 13px; color: #999; margin-top: 24px; border-top: 1px solid #eee; padding-top: 16px;">
          Si tienes problemas para acceder, contacta al equipo coordinador del piloto
          o escribe a soporte desde la plataforma.
        </p>
      </div>

      <div style="text-align: center; padding: 16px 0; font-size: 11px; color: #ccc;">
        GlorIA — Universidad Gabriela Mistral
      </div>
    </div>
  `;
}
