import { createClient } from "@/lib/supabase/server";
import { chat } from "@/lib/ai";
import { classifyWithLLM } from "@/lib/clinical-state-engine";
import { NextResponse } from "next/server";

/**
 * NLP Classification endpoint — classifies a therapist intervention
 * using LLM for higher accuracy (κ≥0.60 target).
 *
 * Reuses the same classifyWithLLM function used in real-time chat,
 * with optional context for better accuracy in post-hoc analysis.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { text, context } = await request.json();

  const classification = await classifyWithLLM(text, chat, context);

  return NextResponse.json({ classification, text });
}
