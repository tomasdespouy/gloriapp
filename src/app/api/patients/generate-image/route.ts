import { createClient } from "@/lib/supabase/server";
import { GoogleGenAI, PersonGeneration } from "@google/genai";
import { NextResponse } from "next/server";

let _gemini: GoogleGenAI | null = null;
function getGemini() {
  if (!_gemini) _gemini = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });
  return _gemini;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { prompt } = await request.json();
  if (!prompt) return NextResponse.json({ error: "Prompt requerido" }, { status: 400 });

  try {
    const gemini = getGemini();
    const response = await gemini.models.generateImages({
      model: "imagen-4.0-generate-001",
      prompt,
      config: {
        numberOfImages: 1,
        aspectRatio: "1:1",
        personGeneration: PersonGeneration.ALLOW_ADULT,
        outputMimeType: "image/png",
      },
    });

    const image = response.generatedImages?.[0];
    if (!image?.image?.imageBytes) {
      return NextResponse.json({ error: "No se generó imagen" }, { status: 500 });
    }

    // Return as base64 data URL
    const base64 = image.image.imageBytes;
    const dataUrl = `data:image/png;base64,${base64}`;

    return NextResponse.json({ url: dataUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error generando imagen";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
