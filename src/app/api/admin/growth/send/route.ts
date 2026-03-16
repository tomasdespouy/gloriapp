import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { Resend } from "resend";

async function requireSuperadmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "superadmin") {
    return { error: NextResponse.json({ error: "Solo superadmin" }, { status: 403 }) };
  }

  return { supabase, user };
}

// Send a campaign to selected contacts
export async function POST(request: Request) {
  const auth = await requireSuperadmin();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase } = auth as { supabase: Awaited<ReturnType<typeof createClient>>; user: { id: string } };

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: "RESEND_API_KEY no configurada" }, { status: 500 });
  }

  const body = await request.json();
  const { campaign_id, contact_ids } = body;

  if (!campaign_id || !contact_ids?.length) {
    return NextResponse.json({ error: "campaign_id y contact_ids son requeridos" }, { status: 400 });
  }

  // Get campaign
  const { data: campaign, error: campError } = await supabase
    .from("growth_campaigns")
    .select("*")
    .eq("id", campaign_id)
    .single();

  if (campError || !campaign) {
    return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
  }

  // Get contacts
  const { data: contacts, error: contError } = await supabase
    .from("growth_contacts")
    .select("id, email, full_name, growth_schools(name)")
    .in("id", contact_ids)
    .eq("status", "active");

  if (contError || !contacts?.length) {
    return NextResponse.json({ error: "No hay contactos activos seleccionados" }, { status: 400 });
  }

  // Update campaign status
  await supabase
    .from("growth_campaigns")
    .update({ status: "sending" })
    .eq("id", campaign_id);

  const resend = new Resend(resendKey);
  const fromEmail = process.env.GROWTH_FROM_EMAIL || "GlorIA <onboarding@resend.dev>";
  let sentCount = 0;
  const errors: string[] = [];

  for (const contact of contacts) {
    // Personalize HTML: replace {{nombre}}, {{escuela}}
    const schoolName = (contact.growth_schools as unknown as { name: string } | null)?.name || "";
    const personalizedHtml = campaign.html_body
      .replace(/\{\{nombre\}\}/g, contact.full_name)
      .replace(/\{\{escuela\}\}/g, schoolName);

    const personalizedSubject = campaign.subject
      .replace(/\{\{nombre\}\}/g, contact.full_name)
      .replace(/\{\{escuela\}\}/g, schoolName);

    try {
      const { data: emailResult } = await resend.emails.send({
        from: fromEmail,
        to: contact.email,
        subject: personalizedSubject,
        html: personalizedHtml,
      });

      await supabase.from("growth_email_log").insert({
        contact_id: contact.id,
        campaign_id: campaign_id,
        subject: personalizedSubject,
        status: "sent",
        resend_id: emailResult?.id || null,
      });

      sentCount++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      errors.push(`${contact.email}: ${msg}`);

      await supabase.from("growth_email_log").insert({
        contact_id: contact.id,
        campaign_id: campaign_id,
        subject: personalizedSubject,
        status: "failed",
      });
    }
  }

  // Update campaign
  await supabase
    .from("growth_campaigns")
    .update({
      status: errors.length === contacts.length ? "failed" : "sent",
      sent_at: new Date().toISOString(),
      total_sent: sentCount,
    })
    .eq("id", campaign_id);

  return NextResponse.json({
    success: true,
    sent: sentCount,
    total: contacts.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
