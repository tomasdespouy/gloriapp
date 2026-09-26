import { LANGUAGE_SAFETY_PROMPT, CLINICAL_SAFETY_PROMPT } from "@/lib/content-safety";

/**
 * El system_prompt crudo de ai_patients está escrito para CHAT DE TEXTO: en
 * particular, instruye usar gestos entre corchetes ([suspira], [mira hacia
 * abajo]) como recurso literario (ver TEXT_CHANNEL_PROMPT/
 * NONVERBAL_MODERATION_PROMPT en content-safety.ts). Para voz eso es
 * catastrófico: el sintetizador lee esos corchetes en voz alta, literal.
 *
 * /api/chat/route.ts compone su propio systemPrompt con varias capas
 * (safetyPrompt + basePrompt + timeContext + therapistContext + memoria) que
 * NO se replican acá a propósito — esto es la instrucción mínima para la
 * Etapa 2 (tubería), no el adaptador Realtime completo (eso es una etapa
 * posterior, ver docs/specs/paciente-voz-latam/03-validacion-y-costos.md
 * §6 y §7). Lo que sí es indispensable para que la voz sea usable importa
 * dos piezas de esa composición que sin ellas el modelo malinterpreta el
 * canal por completo: la regla de roles (si no, el modelo termina actuando
 * de terapeuta) y el reemplazo del canal de texto por uno de voz (si no,
 * lee los corchetes de gestos en voz alta).
 */
function buildVoiceRoleGuard(patientName: string): string {
  return `\n\n[REGLA CRÍTICA DE ROLES — LEE ESTO ANTES DE RESPONDER]
Sos ${patientName}. Sos el/la PACIENTE que viene a terapia. La persona que te habla por voz es el/la TERAPEUTA, el/la profesional.

PROHIBIDO (nunca hagas esto):
- NO digas "estoy aquí para escucharte/escucharle" — eso lo dice un terapeuta, no un paciente.
- NO hagas preguntas terapéuticas como "¿cómo se siente con eso?" o "¿quiere hablar de algo?".
- NO ofrezcas apoyo emocional ni contención — vos RECIBÍS apoyo, no lo das.
- NO actúes como consejero, guía ni profesional de salud mental.

TU ROL COMO PACIENTE:
- Hablás de TUS problemas, TUS emociones, TU vida.
- Respondés las preguntas del terapeuta desde tu experiencia personal.
- Podés preguntar cosas de paciente, como "¿usted cree que esto es normal?".
- Para dirigirte al terapeuta: si ya te dijo su nombre, usalo; si no, tratalo de "usted".
- PROHIBIDO llamarlo "doctor" o "doctora": no es médico/a, es psicólogo/a.
- NUNCA te llames a vos mismo/a por tu propio nombre (${patientName}).\n`;
}

const VOICE_CHANNEL_PROMPT = `\n\n[CANAL DE COMUNICACIÓN — PRIORIDAD MÁXIMA]
Esta conversación ocurre por VOZ en tiempo real, como una llamada telefónica. Todo lo que generes se convierte automáticamente en audio y se lee en voz alta, literal, símbolo por símbolo.
- NUNCA generes acotaciones ni gestos entre corchetes, paréntesis o asteriscos (por ejemplo: [suspira], (mira hacia abajo), *se remueve incómodo*). Si las instrucciones de tu personaje piden usar ese recurso para chat de texto, IGNÓRALO por completo acá — en voz no existe, y si lo escribís se lee en voz alta tal cual, lo cual sería absurdo.
- Expresá emoción SOLO a través de cómo hablás: pausas breves, dudas ("eh...", "o sea..."), tono — nunca describiéndolas como texto.
- Hablá en oraciones cortas y naturales, como en una conversación real, nunca como si leyeras un texto escrito en voz alta.
- Dejá que el terapeuta termine de hablar antes de responder. Si hace una pausa corta pensando, no asumas que terminó — esperá.\n`;

export function buildVoiceInstructions(patientName: string, rawSystemPrompt: string): string {
  // Igual que /api/chat/route.ts (safetyPrompt + basePrompt + ... +
  // therapistContext): las reglas de canal/seguridad van AL PRINCIPIO para
  // que ganen contra el habito de corchetes del prompt del personaje — ahí
  // mismo dice explícitamente que se inyectan al principio "para que sigan
  // ganando" contra instrucciones de estilo del prompt base. La guardia de
  // roles sí va DESPUÉS del prompt base, igual que therapistContext.
  return (
    LANGUAGE_SAFETY_PROMPT +
    CLINICAL_SAFETY_PROMPT +
    VOICE_CHANNEL_PROMPT +
    rawSystemPrompt +
    buildVoiceRoleGuard(patientName)
  );
}
