import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import { NextResponse } from "next/server";
import { escapeHtml } from "@/lib/utils";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY no configurada");
    _resend = new Resend(key);
  }
  return _resend;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { subject, body } = await request.json();
  if (!subject?.trim() || !body?.trim()) {
    return NextResponse.json({ error: "Asunto y descripción son requeridos" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single();

  const userName = profile?.full_name || "Usuario";
  const userEmail = profile?.email || user.email || "sin-email";

  const resend = getResend();
  const { error } = await resend.emails.send({
    from: "GlorIA Soporte <onboarding@resend.dev>",
    to: process.env.SUPPORT_EMAIL || "tomasdespouy@gmail.com",
    replyTo: userEmail,
    subject: `[GlorIA Soporte] ${subject.trim()}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px;">
        <h2 style="color: #4A55A2;">Nueva solicitud de soporte</h2>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr>
            <td style="padding: 8px; color: #666; width: 120px;">Usuario</td>
            <td style="padding: 8px; font-weight: bold;">${escapeHtml(userName)}</td>
          </tr>
          <tr>
            <td style="padding: 8px; color: #666;">Email</td>
            <td style="padding: 8px;">${escapeHtml(userEmail)}</td>
          </tr>
          <tr>
            <td style="padding: 8px; color: #666;">Asunto</td>
            <td style="padding: 8px; font-weight: bold;">${escapeHtml(subject.trim())}</td>
          </tr>
        </table>
        <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; margin-top: 8px;">
          <p style="margin: 0; white-space: pre-wrap;">${escapeHtml(body.trim())}</p>
        </div>
        <p style="color: #999; font-size: 12px; margin-top: 24px;">
          Enviado desde GlorIA — Puedes responder directamente a este email.
        </p>
      </div>
    `,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
