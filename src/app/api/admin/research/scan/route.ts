/**
 * RESEARCH SCAN — trigger manual desde supradmin UI.
 * POST: inicia un job de Deep Research en background y retorna job_id.
 * GET: lista oportunidades guardadas.
 *
 * Auth: superadmin (cookie session).
 * El procesamiento real (parse + insert + email) lo hace /api/cron/research/poll
 * cuando se ejecuta despues, o se puede forzar con GET /api/admin/research/scan/poll.
 */
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import {
  DEFAULT_DEEP_RESEARCH_MODEL,
  DEEP_RESEARCH_SYSTEM,
  buildResearchPrompt,
} from "@/lib/research/deep-research";

export const maxDuration = 60;

export async function POST(request: Request) {
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

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY no configurada" }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const scanType: "mixed" | "conferences" | "funds" = body.scanType || "mixed";

  const admin = createAdminClient();

  // Idempotencia: skip si ya hay job activo en las ultimas 6h.
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data: activeJob } = await admin
    .from("research_jobs")
    .select("id, response_id, status, started_at")
    .in("status", ["pending", "in_progress"])
    .gte("started_at", sixHoursAgo)
    .limit(1)
    .maybeSingle();

  if (activeJob) {
    return NextResponse.json({
      skipped: true,
      reason: "Ya existe un job activo iniciado en las ultimas 6 horas",
      activeJob,
    });
  }

  const model = process.env.OPENAI_DEEP_RESEARCH_MODEL || DEFAULT_DEEP_RESEARCH_MODEL;
  const today = new Date().toISOString().split("T")[0];
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const response = await openai.responses.create({
      model,
      input: [
        {
          role: "developer",
          content: [{ type: "input_text", text: DEEP_RESEARCH_SYSTEM }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: buildResearchPrompt(today) }],
        },
      ],
      tools: [{ type: "web_search_preview" }],
      reasoning: { summary: "auto" },
      background: true,
    });

    const { data: job, error: insertError } = await admin
      .from("research_jobs")
      .insert({
        response_id: response.id,
        model,
        scan_type: scanType,
        status: "pending",
        trigger_source: "manual",
      })
      .select("id")
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      job_id: job.id,
      response_id: response.id,
      model,
      message:
        "Deep Research iniciada en background. Tarda 5-15 min. Recibiras un email cuando termine.",
      hint: "El cron de polling procesa cada 15min los lunes 11-14 UTC; manualmente puedes forzar con GET /api/admin/research/scan/poll.",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error iniciando Deep Research" },
      { status: 500 }
    );
  }
}

// GET — lista oportunidades guardadas (sin cambios respecto al endpoint previo)
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get("limit") || "50");

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("research_opportunities")
    .select("*")
    .order("scan_date", { ascending: false })
    .order("gloria_fit", { ascending: true })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}
