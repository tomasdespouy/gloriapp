/**
 * CRON: Research kickoff — Lunes 11:00 UTC (~07:00-08:00 Chile).
 * Inicia un job de OpenAI Deep Research en background mode y guarda response_id.
 * El procesamiento (poll, parse, insert, email) lo hace /api/cron/research/poll.
 *
 * Auth: Bearer ${CRON_SECRET}
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import {
  DEFAULT_DEEP_RESEARCH_MODEL,
  DEEP_RESEARCH_SYSTEM,
  buildResearchPrompt,
} from "@/lib/research/deep-research";

export const maxDuration = 60;

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

  // Skip si ya hay job activo en las ultimas 6h (idempotencia).
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
        scan_type: "mixed",
        status: "pending",
        trigger_source: "cron",
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
        "Deep Research iniciada en background. El cron de polling procesara los resultados en ~5-15 min.",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error iniciando Deep Research" },
      { status: 500 }
    );
  }
}
