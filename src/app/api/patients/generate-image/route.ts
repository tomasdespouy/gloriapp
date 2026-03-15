import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";
import { NextResponse } from "next/server";

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  return _openai;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { prompt } = await request.json();
  if (!prompt) return NextResponse.json({ error: "Prompt requerido" }, { status: 400 });

  try {
    const openai = getOpenAI();
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    });

    const imageUrl = response.data?.[0]?.url;
    if (!imageUrl) return NextResponse.json({ error: "No se generó imagen" }, { status: 500 });

    return NextResponse.json({ url: imageUrl, revised_prompt: response.data?.[0]?.revised_prompt });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error generando imagen";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
