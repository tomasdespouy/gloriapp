/**
 * CRON: sonda de los proveedores LLM.
 *
 * Hace una llamada mínima a OpenAI y a Gemini, también al que hoy no atiende:
 * el corte de oct-2026 duró días sin que nadie lo viera porque el failover
 * disimulaba al proveedor caído. /api/health no sirve para esto: solo revisa que
 * las variables existan, no que el proveedor responda.
 *
 * Auth: Bearer CRON_SECRET. Corre cada 30 minutos (vercel.json).
 */

import { NextResponse } from "next/server";
import { requireCron } from "@/lib/cron-auth";
import { pingProvider } from "@/lib/ai";
import { classifyBillingError, type LlmProvider } from "@/lib/llm-outage";
import { processProbeResults, type ProbeResult } from "@/lib/llm-health";

export const maxDuration = 60;

async function probe(provider: LlmProvider): Promise<ProbeResult> {
  try {
    await pingProvider(provider);
    return { provider, status: "ok" };
  } catch (err) {
    const kind = classifyBillingError(err);
    const detail = (err instanceof Error ? err.message : String(err)).slice(0, 300);
    return kind ? { provider, status: "billing", kind, detail } : { provider, status: "error", detail };
  }
}

export async function GET(request: Request) {
  const rejected = requireCron(request);
  if (rejected) return rejected;

  const results = await Promise.all((["gemini", "openai"] as const).map(probe));
  const actions = await processProbeResults(results);
  // Deja rastro de cada corrida: sin esto, "todo sano" se ve igual que "no corrió".
  console.log(`[llm-health] corrida: ${results.map((r) => `${r.provider}=${r.status}`).join(" ")}`);
  return NextResponse.json({ results, actions });
}
