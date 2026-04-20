/**
 * CRON: Auto-transition pilot status based on scheduled/ended timestamps
 *
 * Runs hourly via Vercel Cron. Keeps the UI status badge in sync with the
 * pilot's actual lifecycle so admins don't have to flip states manually:
 *
 *   borrador + scheduled_at <= now  →  enviado       (pilot is now live)
 *   enviado  + ended_at     <= now  →  finalizado    (pilot has wrapped)
 *
 * Terminal states (cancelado, finalizado) are never touched. Pilots with
 * NULL scheduled_at / ended_at are also left alone — only admins who
 * actually set those dates get auto-transitions.
 *
 * Note: student access is already date-gated in (app)/layout.tsx, so
 * these transitions are cosmetic for the admin view — they don't change
 * what participants can or can't do.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: activated, error: activateErr } = await admin
    .from("pilots")
    .update({ status: "enviado", updated_at: nowIso })
    .eq("status", "borrador")
    .not("scheduled_at", "is", null)
    .lte("scheduled_at", nowIso)
    .select("id, name");

  const { data: finalized, error: finalizeErr } = await admin
    .from("pilots")
    .update({ status: "finalizado", updated_at: nowIso })
    .eq("status", "enviado")
    .not("ended_at", "is", null)
    .lte("ended_at", nowIso)
    .select("id, name");

  const errors = [activateErr, finalizeErr].filter(Boolean).map((e) => e!.message);

  return NextResponse.json({
    now: nowIso,
    activated: activated?.map((p) => ({ id: p.id, name: p.name })) || [],
    finalized: finalized?.map((p) => ({ id: p.id, name: p.name })) || [],
    errors,
  });
}
