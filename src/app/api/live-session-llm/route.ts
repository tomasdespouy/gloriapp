import { createClient } from "@/lib/supabase/server";
import { chat } from "@/lib/ai";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { checkProfanity, checkClinicalRisk } from "@/lib/content-safety";

// Spike de diarizacion post-hoc con LLM. Hermano de /api/live-session
// (que sigue atado a /grabar-sesion para no romper la ruta huerfana).
//
// Esta es la 3ra iteracion del spike, agrega:
//   - Whisper con verbose_json para tener segments + timestamps (pista
//     temporal para el LLM al diarizar).
//   - Inputs opcionales de therapistName / patientName para anclar
//     identidades cuando los hablantes se mencionan por nombre.
//   - Output extendido del LLM: summary, conversation_temperature,
//     tone por turno.
//   - Post-procesamiento: checkProfanity + checkClinicalRisk por turno
//     usando @/lib/content-safety. Marca cada turno con safety_flag y
//     agrega lista de alertas globales.
//
// maxDuration 300 (Vercel Pro). Restringido a superadmin.

export const maxDuration = 300;

const MAX_CHUNK_SIZE = 24 * 1024 * 1024;

type WhisperSegment = { start: number; end: number; text: string };

const VALID_TEMPERATURES = ["tranquila", "exploratoria", "emocional", "tensa", "fragmentada"] as const;
const VALID_TONES = ["calmado", "emocional", "evasivo", "asertivo", "neutro"] as const;

function buildPrompt(opts: { therapistName?: string; patientName?: string }): string {
  const idHint = (opts.therapistName || opts.patientName)
    ? `\n═══════════════════════════════════════════════════════════════
CONTEXTO DE IDENTIDAD (proporcionado por el observador antes de grabar)
═══════════════════════════════════════════════════════════════
${opts.therapistName ? `- Nombre del/la TERAPEUTA: ${opts.therapistName}` : ""}
${opts.patientName ? `- Nombre del/la PACIENTE: ${opts.patientName}` : ""}
Si en la transcripción aparecen estos nombres (por ejemplo "Hola, soy Tomás" o "...Josefina, te quería preguntar..."), úsalos para anclar la atribución de cada turno.
`
    : "";

  return `Eres un asistente experto en transcripción de sesiones terapéuticas de práctica clínica.

Recibirás una transcripción de audio de una sesión entre dos personas:
- TERAPEUTA: estudiante o profesional de psicología que conduce la sesión. Hace preguntas clínicas, refleja, parafrasea, valida emociones, propone intervenciones, sostiene el encuadre.
- PACIENTE: persona que asume rol de paciente. Relata su experiencia, expresa síntomas y emociones, responde preguntas, comparte historia personal.${idHint}

═══════════════════════════════════════════════════════════════
REGLA CRÍTICA — FIDELIDAD COMPLETA AL RAW TRANSCRIPT
═══════════════════════════════════════════════════════════════
DEBES incluir CADA palabra del raw transcript en algún turno. NO omitas, NO resumas, NO edites.

Antes de responder, valida MENTALMENTE:
1. Concatena el texto de todos los turnos en orden.
2. Compara con el raw transcript.
3. Si falta algo, agregalo a un turno existente cercano o crea un turno nuevo con prefijo "[?]" para fragmentos que no sabés a quién atribuir.

═══════════════════════════════════════════════════════════════
USAR TIMESTAMPS PARA DETECTAR CAMBIOS DE TURNO
═══════════════════════════════════════════════════════════════
La transcripción viene con marcas [t=Xs] indicando el tiempo en segundos donde empieza cada segmento. Un gap mayor a 1.5s entre segmentos suele indicar un cambio de turno (alguien terminó de hablar y empieza otro).
Usá los gaps temporales como PISTA para decidir donde cortar los turnos. NO copies los marcadores [t=Xs] al texto final.

═══════════════════════════════════════════════════════════════
TU TAREA
═══════════════════════════════════════════════════════════════
1. Asignar cada turno a TERAPEUTA o PACIENTE basándote en CONTENIDO clínico.
2. Marcar ambigüedades: "[solapado]", "[interrupción]", "[?]" como prefijo del turno.
3. Si una porción es inaudible, marcar "[inaudible]" dentro del texto.
4. Para cada turno, identificar el TONO predominante:
   - "calmado": habla pausada, tono neutro o reflexivo, sin carga emocional fuerte.
   - "emocional": tristeza, angustia, llanto, ansiedad, expresiones intensas.
   - "evasivo": respuestas cortas, cambios de tema, evita profundizar.
   - "asertivo": claridad, decisión, contenido directo.
   - "neutro": charla operativa o sin marcas claras.
5. Resumir la sesión completa en summary (3-4 frases).
6. Etiquetar conversation_temperature globalmente:
   - "tranquila": fluidez normal, tono bajo, alianza estable.
   - "exploratoria": indagación activa del terapeuta, paciente colaborativo.
   - "emocional": momentos intensos del paciente, llanto, angustia.
   - "tensa": resistencia, defensividad, ruptura potencial de alianza.
   - "fragmentada": muchas interrupciones, ideas inconexas, audio difícil.

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
      "overlap": "ninguno",
      "tone": "calmado"
    }
  ],
  "overlaps_detected": 0,
  "summary": "Resumen breve de 3-4 frases de la sesión: motivo de consulta planteado, intervenciones del terapeuta, reacciones del paciente, cómo cierra.",
  "conversation_temperature": "tranquila",
  "temperature_reason": "Breve justificación (1 frase) de por qué elegiste esa temperatura.",
  "notes": "Observaciones breves del LLM sobre la calidad de la diarización."
}

Valores válidos:
- confidence: "alta" | "media" | "baja"
- overlap: "ninguno" | "solapado" | "interrupcion"
- tone: "calmado" | "emocional" | "evasivo" | "asertivo" | "neutro"
- conversation_temperature: "tranquila" | "exploratoria" | "emocional" | "tensa" | "fragmentada"

Reglas adicionales:
- Mantén el texto original lo más fiel posible.
- NO inventes contenido. Si la transcripción no permite resumir bien, deja summary vacío.
- Responde siempre en español neutro.`;
}

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

function normalizeText(s: string): string {
  return s.toLowerCase()
    .replace(/\[\?\]/g, "")
    .replace(/\[(solapado|interrupci[oó]n|inaudible|pausa[^\]]*)\]/gi, "")
    .replace(/[\p{P}\p{S}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function computeCoverage(raw: string, turns: Array<{ text: string }>): number {
  const rawNorm = normalizeText(raw);
  if (!rawNorm) return 100;
  const turnsText = turns.map((t) => t.text || "").join(" ");
  const turnsNorm = normalizeText(turnsText);
  return Math.min(100, Math.round((turnsNorm.length / rawNorm.length) * 100));
}

// Convierte segments de Whisper a un texto enriquecido con marcas
// [t=Xs] cada vez que hay un gap > 1.5s. El LLM usa esos marcadores
// como pista para detectar cambios de turno.
function buildEnrichedTranscript(segments: WhisperSegment[]): string {
  if (!segments || segments.length === 0) return "";
  const lines: string[] = [];
  let lastEnd = 0;
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    const gap = s.start - lastEnd;
    if (i === 0 || gap > 1.5) {
      lines.push(`[t=${s.start.toFixed(1)}s] ${s.text.trim()}`);
    } else {
      // Mismo turno probable: concatenar al ultimo
      lines[lines.length - 1] += " " + s.text.trim();
    }
    lastEnd = s.end;
  }
  return lines.join("\n");
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

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
  const therapistName = (formData.get("therapistName") as string | null)?.trim() || undefined;
  const patientName = (formData.get("patientName") as string | null)?.trim() || undefined;
  if (!audioFile) {
    return NextResponse.json({ error: "No se recibió audio" }, { status: 400 });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

  // Step 1: Whisper con verbose_json (segments + timestamps).
  let rawTranscript = "";
  const allSegments: WhisperSegment[] = [];
  const t0 = Date.now();
  try {
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());

    if (audioBuffer.length <= MAX_CHUNK_SIZE) {
      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
        language: "es",
        response_format: "verbose_json",
        timestamp_granularities: ["segment"],
      });
      rawTranscript = transcription.text;
      const segments = (transcription as unknown as { segments?: WhisperSegment[] }).segments;
      if (segments) allSegments.push(...segments);
    } else {
      // Chunked: cada chunk arranca en t=0, hay que offset-ar.
      const chunks = splitAudioBlob(audioBuffer, audioFile.type || "audio/webm", MAX_CHUNK_SIZE);
      const parts: string[] = [];
      let timeOffset = 0;
      for (let i = 0; i < chunks.length; i++) {
        const chunkFile = new File([chunks[i]], `chunk-${i}.webm`, { type: chunks[i].type });
        const result = await openai.audio.transcriptions.create({
          file: chunkFile,
          model: "whisper-1",
          language: "es",
          response_format: "verbose_json",
          timestamp_granularities: ["segment"],
        });
        parts.push(result.text);
        const segments = (result as unknown as { segments?: WhisperSegment[]; duration?: number }).segments;
        if (segments) {
          for (const s of segments) {
            allSegments.push({ start: s.start + timeOffset, end: s.end + timeOffset, text: s.text });
          }
        }
        const dur = (result as unknown as { duration?: number }).duration;
        timeOffset += typeof dur === "number" ? dur : (segments?.[segments.length - 1]?.end ?? 0);
      }
      rawTranscript = parts.join(" ");
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "error desconocido";
    return NextResponse.json({ error: `Error al transcribir: ${msg}` }, { status: 500 });
  }
  const tWhisper = Date.now() - t0;

  if (!rawTranscript.trim()) {
    return NextResponse.json({ error: "No se detectó audio con contenido" }, { status: 400 });
  }

  const enrichedTranscript = allSegments.length > 0 ? buildEnrichedTranscript(allSegments) : rawTranscript;

  // Step 2: LLM diariza con prompt extendido.
  const t1 = Date.now();
  try {
    const prompt = buildPrompt({ therapistName, patientName });
    const response = await chat(
      [{ role: "user", content: `Transcripción del audio (con marcas temporales):\n\n${enrichedTranscript}` }],
      prompt,
    );
    const jsonStr = response.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const diarized = JSON.parse(jsonStr);
    const tLlm = Date.now() - t1;

    type RawTurn = { speaker?: string; text?: string; confidence?: string; overlap?: string; tone?: string };
    const turnsRaw: RawTurn[] = diarized.turns || [];

    // Step 3: post-procesar safety por turno.
    type Turn = {
      speaker: string;
      text: string;
      confidence: string;
      overlap: string;
      tone: string;
      safety_flags: { profanity: string[]; clinical_risk: string[] };
    };
    const turns: Turn[] = turnsRaw.map((t) => {
      const text = t.text || "";
      return {
        speaker: t.speaker || "Sin identificar",
        text,
        confidence: t.confidence || "baja",
        overlap: t.overlap || "ninguno",
        tone: t.tone || "neutro",
        safety_flags: {
          profanity: checkProfanity(text),
          clinical_risk: checkClinicalRisk(text),
        },
      };
    });

    const profanityTotal = turns.filter((t) => t.safety_flags.profanity.length > 0).length;
    const riskTotal = turns.filter((t) => t.safety_flags.clinical_risk.length > 0).length;

    const coveragePct = computeCoverage(rawTranscript, turns);
    let notes = diarized.notes || "";
    if (coveragePct < 95) {
      const warning = `⚠ Cobertura ${coveragePct}%: el LLM omitió fragmentos del raw transcript. Revisar y agregar manualmente lo que falte.`;
      notes = notes ? `${warning}  ${notes}` : warning;
    }

    const conversationTemperature = VALID_TEMPERATURES.includes(diarized.conversation_temperature)
      ? diarized.conversation_temperature
      : "tranquila";

    return NextResponse.json({
      raw_transcript: rawTranscript,
      enriched_transcript: enrichedTranscript,
      speakers: diarized.speakers || [],
      turns,
      overlaps_detected: diarized.overlaps_detected || 0,
      coverage_pct: coveragePct,
      summary: diarized.summary || "",
      conversation_temperature: conversationTemperature,
      temperature_reason: diarized.temperature_reason || "",
      safety_summary: {
        profanity_turns: profanityTotal,
        clinical_risk_turns: riskTotal,
      },
      notes,
      timings_ms: { whisper: tWhisper, llm: tLlm, total: tWhisper + tLlm },
    });
  } catch {
    // Fallback: devolver transcripcion cruda como un solo turno.
    return NextResponse.json({
      raw_transcript: rawTranscript,
      enriched_transcript: enrichedTranscript,
      speakers: [],
      turns: [{
        speaker: "Sin identificar", text: rawTranscript,
        confidence: "baja", overlap: "ninguno", tone: "neutro",
        safety_flags: {
          profanity: checkProfanity(rawTranscript),
          clinical_risk: checkClinicalRisk(rawTranscript),
        },
      }],
      overlaps_detected: 0,
      coverage_pct: 100,
      summary: "",
      conversation_temperature: "tranquila",
      temperature_reason: "",
      safety_summary: { profanity_turns: 0, clinical_risk_turns: 0 },
      notes: "No se pudo separar los speakers automáticamente — error parseando respuesta del LLM.",
      timings_ms: { whisper: tWhisper, llm: Date.now() - t1, total: Date.now() - t0 },
    });
  }
}
