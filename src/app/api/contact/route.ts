import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) return null;
    _resend = new Resend(key);
  }
  return _resend;
}

export async function POST(request: Request) {
  const body = await request.json();
  const { institution, country, city, contact_name, contact_email, contact_phone, program_name, estimated_students, message } = body;

  // Validation
  if (!institution?.trim() || !contact_name?.trim() || !contact_email?.trim() || !country?.trim()) {
    return NextResponse.json({ error: "Institución, nombre, email y país son requeridos" }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(contact_email.trim())) {
    return NextResponse.json({ error: "Email inválido" }, { status: 400 });
  }

  let dbOk = false;
  let emailOk = false;

  // 1. Try inserting into CRM
  try {
    const supabase = createAdminClient();
    const { data: university, error: dbError } = await supabase
      .from("crm_universities")
      .insert({
        name: institution.trim(),
        country: country.trim(),
        city: (city || "").trim() || "No especificada",
        contact_name: contact_name.trim(),
        contact_email: contact_email.trim(),
        contact_phone: (contact_phone || "").trim() || null,
        program_name: (program_name || "").trim() || "Psicología",
        estimated_students: estimated_students ? parseInt(estimated_students) : null,
        notes: message?.trim() || null,
        status: "prospecto",
        priority: "alta",
        type: "privada",
      })
      .select()
      .single();

    if (dbError) {
      console.error("CRM insert error:", dbError);
    } else {
      dbOk = true;
      // Log activity
      if (university) {
        await supabase.from("crm_activities").insert({
          university_id: university.id,
          type: "otro",
          description: `Contacto recibido desde formulario del landing page. ${message ? `Mensaje: "${message.trim()}"` : "Sin mensaje adicional."}`,
        });
      }
    }
  } catch (err) {
    console.error("CRM insert exception:", err);
  }

  // 2. Send notification email (always attempt, even if DB failed)
  try {
    const resend = getResend();
    if (resend) {
      await resend.emails.send({
        from: "GlorIA <noreply@glor-ia.com>",
        to: "info@glor-ia.com",
        subject: `Nuevo contacto institucional: ${institution.trim()}`,
        html: `
          <div style="font-family: Calibri, Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4A55A2;">Nuevo contacto desde el landing</h2>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; width: 160px;">Institución</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${institution.trim()}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">País / Ciudad</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${country.trim()} — ${(city || "No especificada").trim()}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Contacto</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${contact_name.trim()}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Email</td><td style="padding: 8px; border-bottom: 1px solid #eee;"><a href="mailto:${contact_email.trim()}">${contact_email.trim()}</a></td></tr>
              ${contact_phone ? `<tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Teléfono</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${contact_phone.trim()}</td></tr>` : ""}
              ${program_name ? `<tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Programa</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${program_name.trim()}</td></tr>` : ""}
              ${estimated_students ? `<tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Est. estudiantes</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${estimated_students}</td></tr>` : ""}
              ${message ? `<tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Mensaje</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${message.trim()}</td></tr>` : ""}
            </table>
            <p style="margin-top: 20px; font-size: 12px; color: #999;">
              ${dbOk ? 'Este contacto fue registrado automáticamente en el CRM con prioridad alta y estado "prospecto".' : "Nota: no se pudo registrar en el CRM automáticamente. Registrar manualmente."}
            </p>
          </div>
        `,
      });
      emailOk = true;
    }
  } catch (emailErr) {
    console.error("Contact notification email failed:", emailErr);
  }

  if (!dbOk && !emailOk) {
    return NextResponse.json({ error: "No se pudo procesar tu solicitud. Escríbenos a info@glor-ia.com." }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
