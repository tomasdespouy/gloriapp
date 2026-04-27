/**
 * Lista los ultimos N jobs de Deep Research con detalle completo (error_message,
 * raw_summary head, citations count). Util para debug.
 *
 * Auth: superadmin.
 */
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
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

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get("limit") || "5");

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("research_jobs")
    .select(
      "id, response_id, model, scan_type, status, trigger_source, started_at, completed_at, error_message, opportunities_count, email_sent_at, poll_attempts, raw_summary, citations"
    )
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type JobRow = {
    id: string;
    response_id: string;
    model: string;
    scan_type: string;
    status: string;
    trigger_source: string;
    started_at: string;
    completed_at: string | null;
    error_message: string | null;
    opportunities_count: number | null;
    email_sent_at: string | null;
    poll_attempts: number | null;
    raw_summary: string | null;
    citations: unknown[] | null;
  };

  const jobs = (data as JobRow[]).map((j) => ({
    id: j.id,
    response_id: j.response_id,
    model: j.model,
    scan_type: j.scan_type,
    status: j.status,
    trigger_source: j.trigger_source,
    started_at: j.started_at,
    completed_at: j.completed_at,
    error_message: j.error_message,
    opportunities_count: j.opportunities_count,
    email_sent_at: j.email_sent_at,
    poll_attempts: j.poll_attempts,
    raw_summary_preview: j.raw_summary ? j.raw_summary.slice(0, 500) : null,
    raw_summary_length: j.raw_summary?.length ?? 0,
    citations_count: Array.isArray(j.citations) ? j.citations.length : 0,
  }));

  return NextResponse.json({ jobs });
}
