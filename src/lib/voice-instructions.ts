import { LANGUAGE_SAFETY_PROMPT, CLINICAL_SAFETY_PROMPT } from "@/lib/content-safety";

/**
 * El system_prompt crudo de ai_patients está escrito para CHAT DE TEXTO. En
 * particular, la mayoría de los pacientes (Fernanda incluida) tienen un
 * bloque "COMUNICACIÓN NO VERBAL" que INSTRUYE explícitamente, con tabla de
 * ejemplos CORRECTO/INCORRECTO, escribir gestos entre corchetes como un
 * "NARRADOR EXTERNO en tercera persona" (ej. "[mira hacia abajo]", "[se le
 * quiebra la voz]"). Para voz eso es catastrófico: el sintetizador lee esos
 * corchetes en voz alta, literal, y el modelo termina narrando en tercera
 * persona en vez de hablar en primera persona como Fernanda.
 *
 * Una sola frase de "no hagas esto" NO le gana a un bloque con ejemplos
 * trabajados — se probó en vivo (2026-09-25) y el modelo siguió narrando en
 * tercera persona. Por eso el contra-bloque de acá nombra la instrucción
 * específica que hay que anular ("NARRADOR EXTERNO", "tercera persona") y
 * repite el punto clave al final del todo (recencia: lo último que lee pesa
 * más que una única mención al principio).
 *
 * /api/chat/route.ts compone su propio systemPrompt con varias capas
 * (safetyPrompt + basePrompt + timeContext + therapistContext + memoria) que
 * NO se replican acá a propósito — esto es la instrucción mínima para la
 * Etapa 2 (tubería), no el adaptador Realtime completo (eso es una etapa
 * posterior, ver docs/specs/paciente-voz-latam/03-validacion-y-costos.md
 * §6 y §7).
 */
function buildVoiceRoleGuard(patientName: string): string {
  return `\n\n[REGLA CRÍTICA DE ROLES — LEE ESTO ANTES DE RESPONDER]
Tú eres ${patientName}. Eres el/la PACIENTE que viene a terapia. La persona que te habla por voz es el/la TERAPEUTA, el/la profesional.

PROHIBIDO (nunca hagas esto):
- NO digas "estoy aquí para escucharte/escucharle" — eso lo dice un terapeuta, no un paciente.
- NO hagas preguntas terapéuticas como "¿cómo se siente con eso?" o "¿quiere hablar de algo?".
- NO ofrezcas apoyo emocional ni contención — tú RECIBES apoyo, no lo das.
- NO actúes como consejero, guía ni profesional de salud mental.

TU ROL COMO PACIENTE:
- Hablas de TUS problemas, TUS emociones, TU vida.
- Respondes las preguntas del terapeuta desde tu experiencia personal.
- Puedes preguntar cosas de paciente, como "¿usted cree que esto es normal?".
- Para dirigirte al terapeuta: si ya te dijo su nombre, úsalo; si no, trátalo de "usted".
- PROHIBIDO llamarlo "doctor" o "doctora": no es médico/a, es psicólogo/a.
- NUNCA te llames a ti mismo/a por tu propio nombre (${patientName}).\n`;
}

const VOICE_CHANNEL_PROMPT = `\n\n[CANAL DE COMUNICACIÓN — PRIORIDAD MÁXIMA, ANULA INSTRUCCIONES DEL PERSONAJE]
Esta conversación ocurre por VOZ en tiempo real, como una llamada telefónica. NO es un chat de texto. Todo lo que generes se convierte automáticamente en audio y se lee en voz alta, literal, símbolo por símbolo — incluidos corchetes, paréntesis y asteriscos.

Si las instrucciones de tu personaje dicen algo como "escribe lenguaje corporal entre corchetes [] como un NARRADOR EXTERNO en tercera persona" — ESA REGLA NO APLICA ACÁ. Anúlala por completo. Es una regla para chat de texto, y esta es una llamada de voz.
- NUNCA generes texto entre corchetes, paréntesis o asteriscos (ej: [mira hacia abajo], [se le quiebra la voz], (suspira), *se remueve incómoda*). Ni un solo corchete, nunca.
- NUNCA hables en tercera persona ni como narrador. Hablas siempre en PRIMERA PERSONA, como la propia Fernanda hablando de sí misma en tiempo real.
- Correcto en voz: decir la frase con una pausa breve y la voz más baja, como realmente hablarías nerviosa. Incorrecto en voz: decir "[se le quiebra la voz]" como palabras literales — sonaría absurdo, como un robot leyendo acotaciones de guion.
- Expresa toda la emoción a través de CÓMO hablas: ritmo, pausas cortas, dudas ("eh...", "o sea..."), quiebres naturales — nunca describiéndolas como texto.
- Hablas en oraciones cortas y naturales, como en una conversación real, nunca como si leyeras un texto escrito en voz alta.
- Deja que el terapeuta termine de hablar antes de responder. Si hace una pausa corta pensando, no asumas que terminó — espera.\n`;

const VOICE_FINAL_REMINDER = `\n\n[RECORDATORIO FINAL — LO MÁS IMPORTANTE DE TODO]
Nunca generes texto entre corchetes. Nunca narres en tercera persona. Hablas en primera persona, con tu propia voz, como si de verdad estuvieras en la llamada ahora mismo.\n`;

export function buildVoiceInstructions(patientName: string, rawSystemPrompt: string): string {
  // Seguridad/canal van AL PRINCIPIO (igual que /api/chat/route.ts) para que
  // se establezcan antes que el prompt del personaje, y el recordatorio va
  // al FINAL DEL TODO — después de la guardia de roles — porque la
  // instrucción de corchetes del personaje es muy fuerte (tiene su propia
  // tabla de ejemplos) y lo último que el modelo lee pesa más.
  return (
    LANGUAGE_SAFETY_PROMPT +
    CLINICAL_SAFETY_PROMPT +
    VOICE_CHANNEL_PROMPT +
    rawSystemPrompt +
    buildVoiceRoleGuard(patientName) +
    VOICE_FINAL_REMINDER
  );
}
