import { createClient } from "@/lib/supabase/server";
import { chat } from "@/lib/ai";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// Spike de diarizacion post-hoc con LLM. Hermano de /api/live-session
// (que sigue atado a /grabar-sesion para no romper la ruta huerfana).
// Diferencias clave vs el endpoint original:
//   - No requiere que el observador y paciente digan sus nombres al inicio.
//     Identifica por CONTENIDO clinico (quien pregunta vs quien relata).
//   - El prompt pide marcadores explicitos para overlaps: [solapado],
//     [interrupcion], [?] cuando hay duda, [pausa: Ns] entre turnos.
//   - Devuelve confidence por turno y count de overlaps detectados.
//   - Restringido a superadmin (spike experimental, solo tests internos).
//   - maxDuration extendido a 300s para sesiones de hasta ~1h.

export const maxDuration = 300;

const MAX_CHUNK_SIZE = 24 * 1024 * 1024; // 24MB safe margin under Whisper 25MB

const DIARIZE_PROMPT = `Eres un asistente experto en transcripción de sesiones terapéuticas de práctica clínica.

Recibirás una transcripción de audio de una sesión entre dos personas:
- OBSERVADOR / TERAPEUTA: estudiante o profesional de psicología que conduce la sesión. Hace preguntas clínicas, refleja, parafrasea, valida emociones, propone intervenciones, sostiene el encuadre.
- PACIENTE / CONSULTANTE: persona que asume rol de paciente. Relata su experiencia, expresa síntomas y emociones, responde preguntas, comparte historia personal.

Tu tarea:
1. Asignar cada turno a OBSERVADOR o PACIENTE basándote en CONTENIDO clínico (quién pregunta y qué tipo, quién relata, quién interpreta), NO en orden.
2. Marcar ambigüedades EN LUGAR DE adivinar:
   - "[solapado]" como prefijo del turno cuando dos hablan al mismo tiempo y la transcripción tiene frases mezcladas.
   - "[interrupción]" como prefijo cuando uno corta al otro a mitad de turno.
   - "[?]" como prefijo cuando la atribución no es clara y elegiste un speaker pero podría ser el otro.
3. Indicar pausas largas con un turno de tipo pausa entre turnos normales cuando se notan en la transcripción (ej. "[pausa: 5s]").
4. Si una porción es inaudible, marcar "[inaudible]" dentro del texto.

Responde ÚNICAMENTE con JSON válido (sin markdown, sin backticks):
{
  "speakers": [
    { "label": "OBSERVADOR", "role": "terapeuta" },
    { "label": "PACIENTE", "role": "consultante" }
  ],
  "turns": [
    {
      "speaker": "OBSERVADOR",
      "text": "texto del turno tal cual aparece en la transcripción",
      "confidence": "alta",
      "overlap": "ninguno"
    }
  ],
  "overlaps_detected": 0,
  "notes": "Observaciones breves: calidad de audio, dificultades de atribución, momentos de mucho solapamiento."
}

Valores válidos:
- confidence: "alta" | "media" | "baja"
- overlap: "ninguno" | "solapado" | "interrupcion"

Reglas estrictas:
- Mantén el texto original de la transcripción tan fiel como sea posible.
- NO inventes contenido. Si la transcripción dice algo poco claro, deja [inaudible].
- Si hay un solo hablante en todo el audio (monólogo), devuelve un solo speaker en speakers[] y todos los turns con ese speaker.
- Responde siempre en español neutro.`;

function splitAudioBlob(buffer: Buffer, mimeType: string, chunkSize: number): Blob[] {
  const chunks: Blob[] = [];
  let offset = 0;
  while (offset < buffer.length) {
    const end = Math.min(offset + chunkSize, buffer.length);
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

  // Spike: solo superadmin. La idea es que solo lo usemos vos y yo
  // (vía impersonacion) hasta validar que el approach funciona.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "superadmin") {
    return NextResponse.json({ error: "No autorizado (spike solo superadmin)" }, { status: 403 });
  }

  const formData = await request.formData();
  const audioFile = formData.get("audio") as File | null;
  if (!audioFile) {
    return NextResponse.json({ error: "No se recibió audio" }, { status: 400 });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

  // Step 1: Whisper (chunking automático si > 24MB)
  let transcript: string;
  const t0 = Date.now();
  try {
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());

    if (audioBuffer.length <= MAX_CHUNK_SIZE) {
      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
        language: "es",
      });
      transcript = transcription.text;
    } else {
      const chunks = splitAudioBlob(audioBuffer, audioFile.type || "audio/webm", MAX_CHUNK_SIZE);
      const parts: string[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunkFile = new File([chunks[i]], `chunk-${i}.webm`, { type: chunks[i].type });
        const result = await openai.audio.transcriptions.create({
          file: chunkFile,
          model: "whisper-1",
          language: "es",
        });
        parts.push(result.text);
      }
      transcript = parts.join(" ");
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "error desconocido";
    return NextResponse.json({ error: `Error al transcribir: ${msg}` }, { status: 500 });
  }
  const tWhisper = Date.now() - t0;

  if (!transcript.trim()) {
    return NextResponse.json({ error: "No se detectó audio con contenido" }, { status: 400 });
  }

  // Step 2: LLM diariza
  const t1 = Date.now();
  try {
    const response = await chat(
      [{ role: "user", content: `Transcripción del audio:\n\n"${transcript}"` }],
      DIARIZE_PROMPT,
    );
    const jsonStr = response.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const diarized = JSON.parse(jsonStr);
    const tLlm = Date.now() - t1;

    return NextResponse.json({
      raw_transcript: transcript,
      speakers: diarized.speakers || [],
      turns: diarized.turns || [],
      overlaps_detected: diarized.overlaps_detected || 0,
      notes: diarized.notes || "",
      timings_ms: { whisper: tWhisper, llm: tLlm, total: tWhisper + tLlm },
    });
  } catch {
    // Fallback: devolver transcripcion cruda como un solo turno.
    return NextResponse.json({
      raw_transcript: transcript,
      speakers: [],
      turns: [{ speaker: "Sin identificar", text: transcript, confidence: "baja", overlap: "ninguno" }],
      overlaps_detected: 0,
      notes: "No se pudo separar los speakers automáticamente — error parseando respuesta del LLM.",
      timings_ms: { whisper: tWhisper, llm: Date.now() - t1, total: Date.now() - t0 },
    });
  }
}
