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
- TERAPEUTA: estudiante o profesional de psicología que conduce la sesión. Hace preguntas clínicas, refleja, parafrasea, valida emociones, propone intervenciones, sostiene el encuadre.
- PACIENTE: persona que asume rol de paciente. Relata su experiencia, expresa síntomas y emociones, responde preguntas, comparte historia personal.

═══════════════════════════════════════════════════════════════
REGLA CRÍTICA — FIDELIDAD COMPLETA AL RAW TRANSCRIPT
═══════════════════════════════════════════════════════════════
DEBES incluir CADA palabra del raw transcript en algún turno. NO omitas, NO resumas, NO edites.

Antes de responder, valida MENTALMENTE:
1. Concatena el texto de todos los turnos en orden.
2. Compara con el raw transcript (ignorando espacios extra y diferencias de puntuación menores).
3. Si falta algo, agregalo a un turno existente cercano o crea un turno nuevo con prefijo "[?]" para fragmentos que no sabés a quién atribuir.

Esta regla supera a cualquier criterio estético. Es preferible un turno torpe pero completo a un turno limpio pero incompleto.

═══════════════════════════════════════════════════════════════
TU TAREA
═══════════════════════════════════════════════════════════════
1. Asignar cada turno a TERAPEUTA o PACIENTE basándote en CONTENIDO clínico (quién pregunta y qué tipo, quién relata, quién interpreta), NO en orden.
2. Marcar ambigüedades EN LUGAR DE adivinar:
   - "[solapado]" como prefijo del turno cuando dos hablan al mismo tiempo y la transcripción tiene frases mezcladas.
   - "[interrupción]" como prefijo cuando uno corta al otro a mitad de turno.
   - "[?]" como prefijo cuando la atribución no es clara o el fragmento es difícil de ubicar.
3. Si una porción es inaudible, marcar "[inaudible]" dentro del texto (sin omitirla).

═══════════════════════════════════════════════════════════════
FORMATO DE RESPUESTA (JSON estricto, sin markdown ni backticks)
═══════════════════════════════════════════════════════════════
{
  "speakers": [
    { "label": "TERAPEUTA", "role": "terapeuta" },
    { "label": "PACIENTE", "role": "consultante" }
  ],
  "turns": [
    {
      "speaker": "TERAPEUTA",
      "text": "texto del turno tal cual aparece en la transcripción",
      "confidence": "alta",
      "overlap": "ninguno"
    }
  ],
  "overlaps_detected": 0,
  "notes": "Observaciones breves: calidad de audio, dificultades de atribución, fragmentos marcados con [?]."
}

Valores válidos:
- confidence: "alta" | "media" | "baja"
- overlap: "ninguno" | "solapado" | "interrupcion"

Reglas adicionales:
- Mantén el texto original lo más fiel posible (puntuación + ortografía).
- NO inventes contenido.
- Si hay un solo hablante en todo el audio (monólogo), devuelve un solo speaker y todos los turnos con ese speaker.
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

// Normaliza texto para comparar: lower, sin puntuacion ni simbolos,
// espacios colapsados.
function normalizeText(s: string): string {
  return s.toLowerCase()
    // Quita marcadores que el LLM agrega y no estan en el raw.
    .replace(/\[\?\]/g, "")
    .replace(/\[(solapado|interrupci[oó]n|inaudible|pausa[^\]]*)\]/gi, "")
    .replace(/[\p{P}\p{S}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Coverage = chars normalizados de turnos / chars normalizados de raw.
// Detecta omisiones grandes (caso reportado: el LLM "comio" frases).
// No detecta sustituciones (raw="hola" → turn="chau"); para spike OK.
function computeCoverage(raw: string, turns: Array<{ text: string }>): number {
  const rawNorm = normalizeText(raw);
  if (!rawNorm) return 100;
  const turnsText = turns.map((t) => t.text || "").join(" ");
  const turnsNorm = normalizeText(turnsText);
  return Math.min(100, Math.round((turnsNorm.length / rawNorm.length) * 100));
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

    const turns = diarized.turns || [];
    const coveragePct = computeCoverage(transcript, turns);
    let notes = diarized.notes || "";
    if (coveragePct < 95) {
      const warning = `⚠ Cobertura ${coveragePct}%: el LLM omitió fragmentos del raw transcript. Revisar y agregar manualmente lo que falte.`;
      notes = notes ? `${warning}  ${notes}` : warning;
    }

    return NextResponse.json({
      raw_transcript: transcript,
      speakers: diarized.speakers || [],
      turns,
      overlaps_detected: diarized.overlaps_detected || 0,
      coverage_pct: coveragePct,
      notes,
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
