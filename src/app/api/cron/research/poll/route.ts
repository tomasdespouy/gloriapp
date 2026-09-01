/**
 * CRON: Research polling — corre cada 15 min los lunes 11:00-14:45 UTC.
 * Para cada job pending/in_progress: hace responses.retrieve, actualiza estado,
 * y si esta completed: parsea, inserta oportunidades, envia digest por email.
 *
 * Auth: Bearer ${CRON_SECRET}
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { Resend } from "resend";
import {
  DEFAULT_NOTIFY_EMAIL,
  DEADLINE_WINDOW_DAYS,
  extractDeepResearchOutput,
  parseReportToOpportunities,
  filterByDeadlineWindow,
  renderEmailHtml,
  sendDigestEmail,
  type Opportunity,
} from "@/lib/research/deep-research";

export const maxDuration = 300; // hasta 5 min: parsing + insert + email

type JobRow = {
  id: string;
  response_id: string;
  model: string;
  status: string;
  poll_attempts: number;
  trigger_source: string;
  started_at: string;
};

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY no configurada" }, { status: 500 });
  }

  const admin = createAdminClient();
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Jobs pendientes de las ultimas 24h (descartar zombies viejos).
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: jobs, error } = await admin
    .from("research_jobs")
    .select("id, response_id, model, status, poll_attempts, trigger_source, started_at")
    .in("status", ["pending", "in_progress"])
    .gte("started_at", dayAgo)
    .order("started_at", { ascending: true })
    .returns<JobRow[]>();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!jobs || jobs.length === 0) {
    return NextResponse.json({ message: "Sin jobs pendientes", processed: 0 });
  }

  const results: Array<Record<string, unknown>> = [];

  for (const job of jobs) {
    try {
      const r = await openai.responses.retrieve(job.response_id);
      const status = (r as { status?: string }).status || "unknown";

      // Update poll_attempts y status segun corresponda
      if (status === "queued" || status === "in_progress") {
        await admin
          .from("research_jobs")
          .update({
            status: "in_progress",
            poll_attempts: (job.poll_attempts ?? 0) + 1,
          })
          .eq("id", job.id);
        results.push({ job_id: job.id, status, action: "still_in_progress" });
        continue;
      }

      if (status === "failed" || status === "incomplete" || status === "cancelled") {
        const errMsg =
          (r as { error?: { message?: string } }).error?.message ||
          (r as { incomplete_details?: { reason?: string } }).incomplete_details?.reason ||
          status;
        await admin
          .from("research_jobs")
          .update({
            status: "failed",
            error_message: errMsg,
            completed_at: new Date().toISOString(),
            poll_attempts: (job.poll_attempts ?? 0) + 1,
          })
          .eq("id", job.id);
        results.push({ job_id: job.id, status: "failed", error: errMsg });
        continue;
      }

      if (status !== "completed") {
        // estado desconocido, log y next
        results.push({ job_id: job.id, status: `unknown:${status}` });
        continue;
      }

      // === COMPLETED ===
      const { text: reportMd, annotations } = extractDeepResearchOutput(r);

      let opps: Opportunity[] = [];
      let parseError: string | null = null;
      try {
        opps = await parseReportToOpportunities(openai, reportMd, new Date().toISOString().split("T")[0]);
      } catch (e) {
        parseError = e instanceof Error ? e.message : "Error parseando reporte";
      }

      // Insert opportunities
      let insertedCount = 0;
      if (opps.length > 0) {
        const today = new Date().toISOString().split("T")[0];
        const toInsert = opps.map((o) => ({
          scan_date: today,
          name: o.name,
          type: o.type,
          organizer: o.organizer,
          deadline: o.deadline,
          event_date: o.event_date,
          location: o.location,
          url: o.url,
          gloria_fit: o.gloria_fit,
          gloria_fit_summary: o.gloria_fit_summary,
          advantages: o.advantages,
          weaknesses: o.weaknesses,
          approach: o.approach,
          registration_cost: o.registration_cost,
          deliverable: o.deliverable,
          indexing: o.indexing,
          success_probability: o.success_probability,
          probability_reason: o.probability_reason,
          application_difficulty: o.application_difficulty,
          difficulty_reason: o.difficulty_reason,
          source_job_id: job.id,
          status: "new",
        }));
        const { error: insErr, count } = await admin
          .from("research_opportunities")
          .insert(toInsert, { count: "exact" });
        if (!insErr) insertedCount = count ?? toInsert.length;
      }

      // Filter para email digest (deadlines proximos)
      const today = new Date();
      const oppsForEmail = filterByDeadlineWindow(opps, today, DEADLINE_WINDOW_DAYS);

      // Send email
      let emailSentAt: string | null = null;
      let emailError: string | null = null;
      const notifyEmail = process.env.RESEARCH_NOTIFY_EMAIL || DEFAULT_NOTIFY_EMAIL;
      if (process.env.RESEND_API_KEY) {
        const { subject, html } = renderEmailHtml({
          today: today.toISOString().split("T")[0],
          opps: oppsForEmail,
          totalScanned: opps.length,
          citations: annotations,
          model: job.model,
          windowDays: DEADLINE_WINDOW_DAYS,
        });
        const resend = new Resend(process.env.RESEND_API_KEY);
        const sendRes = await sendDigestEmail({ resend, to: notifyEmail, subject, html });
        if (sendRes.error) emailError = sendRes.error;
        else emailSentAt = new Date().toISOString();
      } else {
        emailError = "RESEND_API_KEY no configurada";
      }

      await admin
        .from("research_jobs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          opportunities_count: insertedCount,
          email_sent_at: emailSentAt,
          error_message: parseError || emailError,
          raw_summary: reportMd.slice(0, 60000),
          citations: annotations,
          poll_attempts: (job.poll_attempts ?? 0) + 1,
        })
        .eq("id", job.id);

      results.push({
        job_id: job.id,
        status: "completed",
        opps_inserted: insertedCount,
        opps_in_email: oppsForEmail.length,
        email_sent: !!emailSentAt,
        email_error: emailError,
        parse_error: parseError,
      });
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Error procesando job";
      await admin
        .from("research_jobs")
        .update({
          poll_attempts: (job.poll_attempts ?? 0) + 1,
          error_message: errMsg,
        })
        .eq("id", job.id);
      results.push({ job_id: job.id, status: "error", error: errMsg });
    }
  }

  return NextResponse.json({ processed: jobs.length, results });
}
