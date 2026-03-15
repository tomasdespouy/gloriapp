import { createClient } from "@/lib/supabase/server";
import LumaAI from "lumaai";
import { NextResponse } from "next/server";

let _luma: LumaAI | null = null;
function getLuma() {
  if (!_luma) {
    const key = process.env.LUMA_API_KEY;
    if (!key) throw new Error("LUMA_API_KEY no configurada");
    _luma = new LumaAI({ authToken: key });
  }
  return _luma;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { image_url, prompt } = await request.json();
  if (!image_url) return NextResponse.json({ error: "image_url requerido" }, { status: 400 });

  try {
    const luma = getLuma();
    const generation = await luma.generations.create({
      model: "ray-2",
      prompt: prompt || "Subtle natural movement: gentle breathing, slight eye blinks, micro facial expressions. The person stays still, looking forward with a calm, neutral presence. Photorealistic, no camera movement.",
      keyframes: {
        frame0: {
          type: "image",
          url: image_url,
        },
      },
    });

    return NextResponse.json({
      id: generation.id,
      state: generation.state,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error generando video";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Poll for completion
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const generationId = searchParams.get("id");
  if (!generationId) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  try {
    const luma = getLuma();
    const generation = await luma.generations.get(generationId);

    return NextResponse.json({
      id: generation.id,
      state: generation.state,
      video_url: generation.assets?.video || null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error consultando estado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
