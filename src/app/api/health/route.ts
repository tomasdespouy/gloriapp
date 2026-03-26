import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

/**
 * Health check endpoint — verifies all critical services.
 * GET /api/health
 *
 * Returns: { status, checks, timestamp }
 * Use this for uptime monitoring (UptimeRobot, Vercel, etc.)
 */
export async function GET() {
  const start = Date.now();
  const checks: Record<string, { ok: boolean; ms: number; error?: string }> = {};

  // 1. Database connectivity
  try {
    const dbStart = Date.now();
    const admin = createAdminClient();
    const { error } = await admin.from("profiles").select("id").limit(1);
    checks.database = { ok: !error, ms: Date.now() - dbStart, error: error?.message };
  } catch (e) {
    checks.database = { ok: false, ms: 0, error: e instanceof Error ? e.message : "unknown" };
  }

  // 2. Supabase Storage
  try {
    const storageStart = Date.now();
    const admin = createAdminClient();
    const { error } = await admin.storage.from("patients").list("", { limit: 1 });
    checks.storage = { ok: !error, ms: Date.now() - storageStart, error: error?.message };
  } catch (e) {
    checks.storage = { ok: false, ms: 0, error: e instanceof Error ? e.message : "unknown" };
  }

  // 3. OpenAI API key configured
  checks.openai = {
    ok: !!process.env.OPENAI_API_KEY,
    ms: 0,
    error: process.env.OPENAI_API_KEY ? undefined : "OPENAI_API_KEY not set",
  };

  // 4. LLM Provider configured
  checks.llm_provider = {
    ok: !!process.env.LLM_PROVIDER,
    ms: 0,
    error: process.env.LLM_PROVIDER ? undefined : "LLM_PROVIDER not set",
  };

  // 5. Resend configured (optional)
  checks.resend = {
    ok: !!process.env.RESEND_API_KEY,
    ms: 0,
    error: process.env.RESEND_API_KEY ? undefined : "not configured (optional)",
  };

  // Overall status: healthy | warning | degraded
  const criticalChecks = ["database", "openai", "llm_provider"];
  const allCriticalOk = criticalChecks.every((k) => checks[k]?.ok);

  const dbMs = checks.database?.ms ?? 0;
  const storageMs = checks.storage?.ms ?? 0;
  const highLatency = dbMs > 500 || storageMs > 2000;

  const status = !allCriticalOk
    ? "degraded"
    : highLatency
      ? "warning"
      : "healthy";

  return NextResponse.json({
    status,
    version: "2.0.0",
    uptime_ms: Date.now() - start,
    timestamp: new Date().toISOString(),
    checks,
  });
}
