import { createClient } from "@/lib/supabase/server";
import { chat } from "@/lib/ai";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const MAX_CHUNK_SIZE = 24 * 1024 * 1024; // 24MB (safe margin under 25MB Whisper limit)

const DIARIZE_PROMPT = `Eres un asistente experto en transcripción de sesiones terapéuticas.

Recibirás una transcripción de audio de una sesión entre dos personas. Al inicio de la grabación, cada persona dijo su nombre para identificarse.

Tu trabajo es:
1. Identificar quién es cada persona basándote en los nombres que dijeron al inicio
2. Separar la transcripción en turnos de habla, atribuyendo cada segmento a la persona correcta
3. Usar el contexto de la conversación (quién pregunta vs quién responde, roles terapéuticos) para resolver ambigüedades

Responde ÚNICAMENTE con JSON válido (sin markdown, sin backticks):
{
  "speakers": [
    { "name": "Nombre1", "role": "terapeuta" },
    { "name": "Nombre2", "role": "consultante" }
  ],
  "turns": [
    { "speaker": "Nombre1", "text": "texto de lo que dijo..." },
    { "speaker": "Nombre2", "text": "texto de lo que dijo..." }
  ],
  "notes": "Observaciones breves sobre la calidad del audio o dificultades de atribución"
}

Reglas:
- Mantén el texto original lo más fiel posible
- Si no puedes determinar quién habla en un segmento, usa el contexto conversacional (el terapeuta tiende a preguntar, el consultante a relatar)
- Los nombres se dicen al inicio de la grabación, úsalos para todo el resto
- No inventes contenido, solo organiza lo que está en la transcripción
- Si hay fragmentos inaudibles o confusos, márcalos con [inaudible]
- Responde siempre en español`;

/**
 * Split a large audio blob into chunks under the Whisper size limit.
 * Returns an array of Blob objects ready for the API.
 */
function splitAudioBlob(buffer: Buffer, mimeType: string, chunkSize: number): Blob[] {
  const chunks: Blob[] = [];
  let offset = 0;

  while (offset < buffer.length) {
    const end = Math.min(offset + chunkSize, buffer.length);
    // Copy to a new ArrayBuffer to avoid SharedArrayBuffer TS issues
    const ab = buffer.buffer.slice(buffer.byteOffset + offset, buffer.byteOffset + end) as ArrayBuffer;
    chunks.push(new Blob([ab], { type: mimeType }));
    offset = end;
  }

  return chunks;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const formData = await request.formData();
  const audioFile = formData.get("audio") as File | null;

  if (!audioFile) {
    return NextResponse.json({ error: "No se recibió audio" }, { status: 400 });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

  // Step 1: Transcribe with Whisper (chunking if > 24MB)
  let transcript: string;
  try {
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());

    if (audioBuffer.length <= MAX_CHUNK_SIZE) {
      // Small file — single request
      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
        language: "es",
      });
      transcript = transcription.text;
    } else {
      // Large file — split into chunks and transcribe each
      const chunks = splitAudioBlob(audioBuffer, audioFile.type || "audio/webm", MAX_CHUNK_SIZE);
      const transcriptions: string[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunkFile = new File([chunks[i]], `chunk-${i}.webm`, { type: chunks[i].type });
        const result = await openai.audio.transcriptions.create({
          file: chunkFile,
          model: "whisper-1",
          language: "es",
        });
        transcriptions.push(result.text);
      }

      transcript = transcriptions.join(" ");
    }
  } catch {
    return NextResponse.json({ error: "Error al transcribir el audio" }, { status: 500 });
  }

  if (!transcript.trim()) {
    return NextResponse.json({ error: "No se detectó audio con contenido" }, { status: 400 });
  }

  // Step 2: Use LLM to diarize (identify speakers)
  try {
    const response = await chat(
      [{ role: "user", content: `Transcripción del audio de la sesión:\n\n"${transcript}"` }],
      DIARIZE_PROMPT
    );

    const jsonStr = response.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const diarized = JSON.parse(jsonStr);

    return NextResponse.json({
      raw_transcript: transcript,
      speakers: diarized.speakers || [],
      turns: diarized.turns || [],
      notes: diarized.notes || "",
    });
  } catch {
    // If diarization fails, return raw transcript
    return NextResponse.json({
      raw_transcript: transcript,
      speakers: [],
      turns: [{ speaker: "Sin identificar", text: transcript }],
      notes: "No se pudo separar los speakers automáticamente.",
    });
  }
}
