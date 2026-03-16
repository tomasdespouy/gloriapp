import { chat, type ChatMessage } from "@/lib/ai";

/**
 * Narrative summary generator — produces and accumulates session summaries
 * for cross-session patient memory (compact alternative to raw transcripts).
 */

const SUMMARIZE_SYSTEM = `Eres un asistente clínico que genera resúmenes narrativos de sesiones terapéuticas simuladas.
Tu resumen será usado como MEMORIA del paciente en futuras sesiones, así que escribe en tercera persona desde la perspectiva del paciente.
Sé conciso pero incluye: temas tratados, emociones expresadas, momentos clave, y cómo terminó la sesión.
Escribe en español, máximo 300 palabras.`;

const MERGE_SYSTEM = `Eres un asistente clínico que mantiene un resumen narrativo ACUMULATIVO de todas las sesiones de un paciente.
Recibirás el resumen acumulativo previo y el resumen de la nueva sesión. Tu tarea es FUSIONARLOS en un único resumen coherente.

Reglas:
- Mantén la narrativa cronológica (sesiones anteriores primero, nueva sesión después)
- Conserva los temas recurrentes y la evolución del paciente
- Elimina redundancias pero no pierdas información clínica relevante
- Escribe en tercera persona desde la perspectiva del paciente
- Máximo 500 palabras para el resumen acumulativo
- Extrae los temas clave (máximo 8) como lista
- Escribe en español

Responde ÚNICAMENTE con JSON válido (sin markdown, sin backticks):
{
  "narrative": "El resumen acumulativo fusionado...",
  "key_themes": ["tema1", "tema2"]
}`;

/**
 * Generate a narrative summary of a single session from its transcript.
 */
export async function summarizeSession(transcript: string): Promise<string> {
  const response = await chat(
    [{ role: "user" as const, content: `Resume esta sesión terapéutica:\n\n${transcript}` }],
    SUMMARIZE_SYSTEM,
  );
  return response.trim();
}

/**
 * Merge a new session summary into the existing cumulative narrative.
 * If there's no previous narrative, just extract themes from the new summary.
 */
export async function mergeNarrative(
  previousNarrative: string,
  newSessionSummary: string,
  sessionNumber: number,
): Promise<{ narrative: string; key_themes: string[] }> {
  // First session — no merge needed, just extract themes
  if (!previousNarrative) {
    const response = await chat(
      [{ role: "user" as const, content: `Dado este resumen de la sesión 1, extrae los temas clave.

Resumen:
${newSessionSummary}

Responde ÚNICAMENTE con JSON válido (sin markdown, sin backticks):
{
  "narrative": "${newSessionSummary.replace(/"/g, '\\"')}",
  "key_themes": ["tema1", "tema2"]
}` }],
      "Extrae temas clave de resúmenes clínicos. Responde solo JSON.",
    );

    try {
      const json = JSON.parse(response.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
      return {
        narrative: json.narrative || newSessionSummary,
        key_themes: Array.isArray(json.key_themes) ? json.key_themes.slice(0, 8) : [],
      };
    } catch {
      return { narrative: newSessionSummary, key_themes: [] };
    }
  }

  // Merge with existing narrative
  const messages: ChatMessage[] = [
    { role: "user", content: `Resumen acumulativo previo (sesiones 1-${sessionNumber - 1}):
${previousNarrative}

Resumen de la sesión ${sessionNumber}:
${newSessionSummary}

Fusiona ambos en un resumen acumulativo coherente.` },
  ];

  const response = await chat(messages, MERGE_SYSTEM);

  try {
    const json = JSON.parse(response.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
    return {
      narrative: json.narrative || `${previousNarrative}\n\nSesión ${sessionNumber}: ${newSessionSummary}`,
      key_themes: Array.isArray(json.key_themes) ? json.key_themes.slice(0, 8) : [],
    };
  } catch {
    // Fallback: simple concatenation
    return {
      narrative: `${previousNarrative}\n\nSesión ${sessionNumber}: ${newSessionSummary}`,
      key_themes: [],
    };
  }
}
