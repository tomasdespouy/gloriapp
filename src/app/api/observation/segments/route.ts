import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const sessionId = formData.get("session_id") as string;
  const speaker = formData.get("speaker") as string;
  const duration = parseInt(formData.get("duration") as string) || 0;
  const order = parseInt(formData.get("order") as string) || 0;
  const audio = formData.get("audio") as File | null;

  let transcript = "";

  // Transcribe audio if available
  if (audio && audio.size > 500) {
    try {
      const openaiKey = process.env.OPENAI_API_KEY;
      if (openaiKey) {
        const whisperForm = new FormData();
        whisperForm.append("file", audio, "segment.webm");
        whisperForm.append("model", "whisper-1");
        whisperForm.append("language", "es");
        const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${openaiKey}` },
          body: whisperForm,
        });
        if (whisperRes.ok) {
          const whisperData = await whisperRes.json();
          transcript = whisperData.text || "";
        }
      }
    } catch { /* silent */ }
  }

  // Remove Whisper hallucination artifacts (silence → phantom subtitles)
  transcript = transcript
    .replace(/amara\.org/gi, "")
    .replace(/subt[ií]tulos?\s*(realizados?\s*)?por\s*(la\s*comunidad\s*de\s*)?/gi, "")
    .replace(/www\.\S+/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  const { data, error } = await supabase
    .from("observation_segments")
    .insert({
      session_id: sessionId,
      speaker,
      transcript,
      duration_seconds: duration,
      segment_order: order,
    })
    .select("id, transcript")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
