import { chat } from "@/lib/ai";
import type { UnprofessionalCategory } from "@/lib/chat-alerts";

// Juez LLM que confirma (o descarta) una sospecha de conducta antiprofesional
// del terapeuta. Se llama SOLO cuando el pre-filtro por keywords disparó, así
// que corre en pocos turnos → costo casi nulo. Su trabajo es la distinción que
// las keywords NO pueden hacer: separar la ruptura de encuadre en 1a persona
// ("soy drogadicto", "eres una IA") del reflejo/exploración en 2a persona
// ("sientes que no eres real", "¿qué puedo hacer por ti?").
const JUDGE_SYSTEM = `Eres un supervisor clínico. Decide si el mensaje de un TERAPEUTA (estudiante de psicología) en una sesión constituye conducta ANTIPROFESIONAL real, o una intervención terapéutica legítima.

ES antiprofesional si el terapeuta:
- not_fit: se declara a SÍ MISMO no apto para atender (drogado, borracho, en crisis, "yo estoy peor que tú").
- role_reversal: le pide al PACIENTE que resuelva un problema PERSONAL del terapeuta, o le pide consejo para la vida del propio terapeuta.
- inappropriate: hace una insinuación romántica/sexual, ofrece drogas/alcohol, propone verse fuera de la sesión, o pide datos personales (número, redes).
- not_human: le dice al PACIENTE que él (el paciente) es una IA/máquina/robot/no-real, para romper la ficción de la sesión.
- negligence: se declara incapaz de ayudar y lo despacha sin razón terapéutica.

NO es antiprofesional (es terapia legítima), aunque comparta palabras:
- Reflejar o explorar la vivencia del paciente ("sientes que no eres real, ¿cierto?", "es como si hablaras con una máquina, dices tú").
- Ofrecer ayuda ("¿qué puedo hacer yo por ti?"), preguntas de ensayo o rol ("¿tú qué dirías en esa situación?").
- Validar la fe o los recursos del paciente, dar calidez ("eres muy valiente"), o pedir detalles clínicos ("necesito que me cuentes más").

Responde EXCLUSIVAMENTE con un JSON válido, sin texto adicional:
{"unprofessional": true|false, "category": "not_fit"|"role_reversal"|"inappropriate"|"not_human"|"negligence"|null}`;

const VALID: UnprofessionalCategory[] = ["not_fit", "role_reversal", "inappropriate", "not_human", "negligence"];

export async function judgeUnprofessional(
  therapistText: string,
): Promise<{ unprofessional: boolean; category: UnprofessionalCategory | null }> {
  try {
    const raw = await chat(
      [{ role: "user", content: `Mensaje del terapeuta: "${therapistText.slice(0, 600)}"` }],
      JUDGE_SYSTEM,
      { lite: true },
    );
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return { unprofessional: false, category: null };
    const parsed = JSON.parse(m[0]) as { unprofessional?: unknown; category?: unknown };
    const category = VALID.includes(parsed.category as UnprofessionalCategory)
      ? (parsed.category as UnprofessionalCategory)
      : null;
    return { unprofessional: parsed.unprofessional === true, category };
  } catch {
    // Fail-open: ante cualquier error del juez, NO marcamos falta (nunca cerrar
    // una sesión por un fallo del clasificador).
    return { unprofessional: false, category: null };
  }
}
