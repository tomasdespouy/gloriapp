import { NextRequest, NextResponse } from "next/server";

// Voice settings per patient personality
const VOICE_PROFILES: Record<string, { stability: number; similarity_boost: number; style: number }> = {
  // Vicente - Roberto Salas: formal, contenido, pausado
  "6WgXEzo1HGn3i7ilT4Fh": { stability: 0.45, similarity_boost: 0.85, style: 0.4 },
  // Camila - Fernanda Contreras: nerviosa, rápida, emocional
  "oJIuRMopN0sojGjwD6rQ": { stability: 0.25, similarity_boost: 0.75, style: 0.7 },
};

const DEFAULT_SETTINGS = { stability: 0.4, similarity_boost: 0.85, style: 0.5 };

export async function POST(req: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ELEVENLABS_API_KEY not configured" }, { status: 500 });
  }

  const { text, voiceId } = await req.json();

  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  // Clean text: remove stage directions like [se cruza de brazos]
  let cleanText = text.replace(/\[([^\]]+)\]/g, "").trim();
  if (!cleanText) {
    return NextResponse.json({ error: "No speakable text" }, { status: 400 });
  }

  cleanText = cleanText
    .replace(/\.{4,}/g, "...")
    .replace(/\s{2,}/g, " ")
    .trim();

  const voice = voiceId || process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
  const settings = VOICE_PROFILES[voice] || DEFAULT_SETTINGS;

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: cleanText,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          ...settings,
          use_speaker_boost: true,
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    console.error("ElevenLabs error:", err);
    return NextResponse.json({ error: "TTS failed" }, { status: 502 });
  }

  const audioBuffer = await response.arrayBuffer();

  return new NextResponse(audioBuffer, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
