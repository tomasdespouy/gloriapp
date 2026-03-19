import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY no configurada");
    _resend = new Resend(key);
  }
  return _resend;
}

async function requireSuperadmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "superadmin") return null;
  return user;
}

// POST — Send notification
export async function POST(request: Request) {
  try {
    const user = await requireSuperadmin();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const reqBody = await request.json();
    const { subject, body, roles, countries, establishmentIds, individualEmails } = reqBody;

    if (!subject?.trim() || !body?.trim()) {
      return NextResponse.json({ error: "Asunto y mensaje son requeridos" }, { status: 400 });
    }

    const admin = createAdminClient();
    const emailSet = new Set<string>();

    // Individual emails
    if (individualEmails?.length > 0) {
      individualEmails.forEach((e: string) => emailSet.add(e.trim().toLowerCase()));
    }

    // By roles (multi-select)
    if (roles?.length > 0) {
      const { data: profiles } = await admin.from("profiles").select("email").in("role", roles);
      (profiles || []).forEach(p => { if (p.email) emailSet.add(p.email.toLowerCase()); });
    }

    // By countries (multi-select)
    if (countries?.length > 0) {
      const { data: establishments } = await admin.from("establishments").select("id").in("country", countries);
      if (establishments?.length) {
        const estIds = establishments.map(e => e.id);
        const { data: profiles } = await admin.from("profiles").select("email").in("establishment_id", estIds);
        (profiles || []).forEach(p => { if (p.email) emailSet.add(p.email.toLowerCase()); });
      }
    }

    // By establishments (multi-select)
    if (establishmentIds?.length > 0) {
      const { data: profiles } = await admin.from("profiles").select("email").in("establishment_id", establishmentIds);
      (profiles || []).forEach(p => { if (p.email) emailSet.add(p.email.toLowerCase()); });
    }

    const emails = Array.from(emailSet);
    if (emails.length === 0) {
      return NextResponse.json({ error: "No se encontraron destinatarios con los filtros seleccionados" }, { status: 400 });
    }

    // Send emails in batches
    const resend = getResend();
    let sent = 0;
    let failed = 0;
    let lastError = "";

    for (let i = 0; i < emails.length; i += 50) {
      const batch = emails.slice(i, i + 50);
      try {
        const result = await resend.emails.send({
          from: "GlorIA <noreply@glor-ia.com>",
          to: batch.length === 1 ? batch[0] : "noreply@glor-ia.com",
          ...(batch.length > 1 ? { bcc: batch } : {}),
          subject: subject.trim(),
          html: `
            <div style="font-family: Calibri, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1A1A1A;">
              <div style="background: #4A55A2; padding: 20px 28px; border-radius: 12px 12px 0 0; display: flex; align-items: center; justify-content: space-between;">
                <div>
                  <h1 style="color: white; margin: 0; font-size: 18px;">${subject.trim()}</h1>
                  <p style="color: rgba(255,255,255,0.7); margin: 4px 0 0; font-size: 12px;">Plataforma de Entrenamiento Cl\u00ednico con IA</p>
                </div>
                <img src="https://ndwmnxlwbfqfwwtekjun.supabase.co/storage/v1/object/public/patients/gloria-side-logo.png" alt="GlorIA" style="height: 36px;" />
              </div>
              <div style="background: #FAFAFA; padding: 28px 28px 20px; border: 1px solid #E5E5E5; border-top: none; border-radius: 0 0 12px 12px;">
                <div style="font-size: 14px; color: #333; line-height: 1.7;">
                  ${body.trim().replace(/\n/g, "<br />")}
                </div>
                <div style="margin-top: 24px; border-top: 1px solid #eee; padding-top: 16px;">
                  <p style="font-size: 13px; color: #555; margin: 0;">Con entusiasmo,</p>
                  <p style="font-size: 13px; color: #333; margin: 4px 0 0; font-weight: 700;">Equipo GlorIA</p>
                </div>
              </div>
              <div style="text-align: center; padding: 14px 0; font-size: 11px; color: #bbb;">
                GlorIA — Simulaci\u00f3n cl\u00ednica con inteligencia artificial
              </div>
            </div>
          `,
        });
        if (result.error) {
          lastError = result.error.message || "Error de Resend";
          failed += batch.length;
        } else {
          sent += batch.length;
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : "Error desconocido";
        failed += batch.length;
      }
    }

    // Log to DB
    try {
      await admin.from("notification_log").insert({
        subject: subject.trim(),
        body: body.trim(),
        recipient_count: emails.length,
        sent_count: sent,
        failed_count: failed,
        filters: { roles, countries, establishmentIds, individualEmails },
        sent_by: user.id,
      });
    } catch { /* ignore logging errors */ }

    if (sent === 0 && failed > 0) {
      return NextResponse.json({ error: `Error al enviar: ${lastError}` }, { status: 500 });
    }

    return NextResponse.json({ sent, failed, total: emails.length });
  } catch (err) {
    console.error("Notification API error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error interno del servidor" }, { status: 500 });
  }
}

// GET — Fetch notification history
export async function GET() {
  const user = await requireSuperadmin();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const admin = createAdminClient();
  const { data: logs } = await admin
    .from("notification_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json(logs || []);
}
