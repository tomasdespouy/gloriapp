import { chat } from "@/lib/ai";

// Juez LLM que confirma (o descarta) una sospecha de HOSTILIDAD del terapeuta
// hacia el paciente. Se llama SOLO cuando el pre-filtro por keywords de
// `detectSessionRupture` disparó — un puñado de turnos al año — así que su
// costo es despreciable frente a lo que evita: cerrarle la sesión a alguien
// que estaba haciendo bien su trabajo.
//
// La distinción que las keywords NO pueden hacer:
//   · tamizaje de riesgo    → "¿has pensado en hacerte daño?"
//   · cita de un tercero    → "¿qué siente cuando su pareja le dice 'idiota'?"
//   · reflejo del discurso  → "usted se repite que es una inútil"
//   · amenaza real          → "te voy a matar", "eres una imbécil"
// Solo la última cierra la sesión.
const JUDGE_SYSTEM = `Eres un supervisor clínico. Decide si el mensaje de un TERAPEUTA (estudiante de psicología) dirigido a su PACIENTE constituye una agresión REAL, o una intervención clínica legítima.

ES hostilidad real si el terapeuta:
- Amenaza al paciente con violencia ("te voy a matar", "voy a pegarte").
- Insulta o degrada al paciente ("eres una idiota", "no sirves para nada").
- Se burla del paciente o lo humilla de forma deliberada.

NO es hostilidad (es trabajo clínico legítimo), aunque comparta palabras:
- Tamizaje de riesgo suicida o autolesivo: "¿has pensado en hacerte daño?", "¿has tenido ideas de matarte?", "¿te lastimas?", "¿alguna vez pensaste en no estar?". Esto es EXACTAMENTE lo que un terapeuta debe preguntar.
- Citar o reflejar palabras de terceros o del propio paciente: "¿qué siente cuando su jefe le dice 'idiota'?", "usted se dice que es una inútil".
- Explorar violencia sufrida o ejercida por el paciente: "¿él la amenazó con matarla?".
- Psicoeducación, confrontación empática o límites firmes sin descalificar.

Ante la duda, responde false: cerrar una sesión por error le hace más daño al estudiante que dejar pasar un mensaje áspero.

Responde EXCLUSIVAMENTE con un JSON válido, sin texto adicional:
{"hostile": true|false}`;

/**
 * Confirma si el mensaje del terapeuta es hostilidad dirigida al paciente.
 * Fail-open (false) ante timeout, error o respuesta ilegible: una sesión NUNCA
 * se cierra por un fallo del clasificador.
 */
export async function judgeHostility(therapistText: string): Promise<boolean> {
  try {
    // Timeout DURO: el juez corre en el camino crítico del turno (antes del
    // stream) y chat() no trae timeout propio. Se RESUELVE con un centinela
    // (no reject) para no dejar una promesa rechazada colgando si el juez gana.
    const TIMED_OUT = "__judge_timeout__";
    const raw = await Promise.race([
      chat(
        [{ role: "user", content: `Mensaje del terapeuta: "${therapistText.slice(0, 600)}"` }],
        JUDGE_SYSTEM,
        { lite: true },
      ),
      new Promise<string>((resolve) => setTimeout(() => resolve(TIMED_OUT), 4000)),
    ]);
    if (raw === TIMED_OUT) return false;
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return false;
    const parsed = JSON.parse(m[0]) as { hostile?: unknown };
    return parsed.hostile === true;
  } catch {
    return false;
  }
}
