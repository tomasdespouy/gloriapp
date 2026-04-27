/**
 * RESEARCH HEALTH — diagnostico del pipeline de investigacion
 * GET /api/admin/research/health
 *
 * Reporta estado de env vars + DB + manda un email de prueba via Resend.
 * Sirve para verificar el pipeline sin esperar al cron del lunes.
 * Acceso: solo superadmin.
 */
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { Resend } from "resend";

const DEFAULT_NOTIFY = "tomas.despouy@ugm.cl";
const DEFAULT_MODEL = "o4-mini-deep-research-2025-06-26";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "superadmin") {
    return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });
  }

  const notifyEmail = process.env.RESEARCH_NOTIFY_EMAIL || DEFAULT_NOTIFY;

  const checks: {
    env: Record<string, boolean | string>;
    db: Record<string, number | string | null>;
    email: { attempted: boolean; sent: boolean; error: string | null; to: string };
  } = {
    env: {
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
      RESEND_API_KEY: !!process.env.RESEND_API_KEY,
      CRON_SECRET: !!process.env.CRON_SECRET,
      PERPLEXITY_API_KEY_legacy: !!process.env.PERPLEXITY_API_KEY,
      RESEARCH_NOTIFY_EMAIL_resolved: notifyEmail,
      OPENAI_DEEP_RESEARCH_MODEL_resolved:
        process.env.OPENAI_DEEP_RESEARCH_MODEL || `(default) ${DEFAULT_MODEL}`,
    },
    db: {
      opportunities_total: 0,
      last_scan_date: null,
      jobs_total: 0,
      jobs_pending: 0,
      jobs_last_completed: null,
    },
    email: {
      attempted: false,
      sent: false,
      error: null,
      to: notifyEmail,
    },
  };

  const admin = createAdminClient();

  const { count: oppCount } = await admin
    .from("research_opportunities")
    .select("*", { count: "exact", head: true });
  checks.db.opportunities_total = oppCount ?? 0;

  const { data: lastScan } = await admin
    .from("research_opportunities")
    .select("scan_date")
    .order("scan_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  checks.db.last_scan_date = lastScan?.scan_date ?? null;

  try {
    const { count: jobsTotal } = await admin
      .from("research_jobs")
      .select("*", { count: "exact", head: true });
    checks.db.jobs_total = jobsTotal ?? 0;

    const { count: jobsPending } = await admin
      .from("research_jobs")
      .select("*", { count: "exact", head: true })
      .in("status", ["pending", "in_progress"]);
    checks.db.jobs_pending = jobsPending ?? 0;

    const { data: lastJob } = await admin
      .from("research_jobs")
      .select("completed_at")
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    checks.db.jobs_last_completed = lastJob?.completed_at ?? null;
  } catch {
    checks.db.jobs_total = "(tabla research_jobs aun no existe — pendiente migracion)";
  }

  if (process.env.RESEND_API_KEY) {
    checks.email.attempted = true;
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { data, error } = await resend.emails.send({
        from: "GlorIA Research <noreply@glor-ia.com>",
        to: notifyEmail,
        subject: "[GlorIA] Test pipeline research — verificacion",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #fafafa;">
            <div style="background: #4A55A2; padding: 18px 24px; border-radius: 10px 10px 0 0;">
              <h2 style="color: white; margin: 0; font-size: 18px;">Pipeline de email funcional</h2>
            </div>
            <div style="background: white; padding: 24px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 10px 10px;">
              <p style="margin: 0 0 16px; color: #1A1A1A;">
                Si recibes este correo, el pipeline Resend desde GlorIA funciona correctamente.
              </p>
              <table style="width: 100%; font-size: 13px; color: #555;">
                <tr><td style="padding: 4px 0;"><strong>Origen:</strong></td><td>/api/admin/research/health</td></tr>
                <tr><td style="padding: 4px 0;"><strong>Hora:</strong></td><td>${new Date().toISOString()}</td></tr>
                <tr><td style="padding: 4px 0;"><strong>Destinatario:</strong></td><td>${notifyEmail}</td></tr>
                <tr><td style="padding: 4px 0;"><strong>Modelo Deep Research:</strong></td><td>${process.env.OPENAI_DEEP_RESEARCH_MODEL || DEFAULT_MODEL}</td></tr>
              </table>
              <p style="margin: 20px 0 0; color: #888; font-size: 12px;">
                Proximo lunes a las 11:00 UTC el cron lanzara una busqueda Deep Research y un poll cron procesara los resultados ~10 min despues.
              </p>
            </div>
          </div>
        `,
      });
      if (error) {
        checks.email.error = typeof error === "string" ? error : JSON.stringify(error);
      } else {
        checks.email.sent = true;
        checks.env.last_send_id = data?.id || "(sin id)";
      }
    } catch (e) {
      checks.email.error = e instanceof Error ? e.message : "error desconocido";
    }
  } else {
    checks.email.error = "RESEND_API_KEY no configurada en este entorno";
  }

  return NextResponse.json(checks, { status: 200 });
}
