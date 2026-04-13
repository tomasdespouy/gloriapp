import { createClient } from "@/lib/supabase/server";
import { chat } from "@/lib/ai";
import { NextResponse } from "next/server";
import { checkProfanity, checkClinicalRisk } from "@/lib/content-safety";

// Structural rules every patient prompt MUST follow
const RULES_CHECKLIST = [
  { id: "sections", label: "Secciones estructuradas", test: (p: string) => ["HISTORIA:", "PERSONALIDAD:", "COMPORTAMIENTO", "REGLAS:"].filter(s => p.includes(s)).length >= 3 },
  { id: "bullets", label: "Usa bullets (-) en vez de texto corrido", test: (p: string) => (p.match(/^- /gm) || []).length >= 5 },
  { id: "brackets", label: "Lenguaje no verbal entre corchetes [...]", test: (p: string) => /\[.+\]/.test(p) },
  { id: "no_repeat", label: "Regla anti-repetición incluida", test: (p: string) => p.toLowerCase().includes("nunca repitas") },
  { id: "max_sentences", label: "Límite de 1-4 oraciones", test: (p: string) => /1-4 oraciones|1 a 4 oraciones|maximo.*oracion/i.test(p) },
  { id: "no_ai", label: "Regla 'NUNCA digas que eres IA'", test: (p: string) => p.toLowerCase().includes("nunca digas que eres una ia") || p.toLowerCase().includes("nunca digas que eres ia") },
  { id: "no_therapist", label: "Regla 'NUNCA des consejos terapéuticos'", test: (p: string) => p.toLowerCase().includes("nunca des consejos") },
  { id: "stay_character", label: "Regla 'NUNCA salgas del personaje'", test: (p: string) => p.toLowerCase().includes("nunca salgas del personaje") },
  { id: "secrets", label: "Sección de secretos/revelaciones graduales", test: (p: string) => p.includes("NO REVELAS") || p.includes("no revelas") || p.toLowerCase().includes("secreto") || p.toLowerCase().includes("no revela") },
  { id: "example_phrases", label: "Frases ejemplo del paciente entre comillas", test: (p: string) => (p.match(/"/g) || []).length >= 4 },
  { id: "length", label: "Extensión mínima (800+ caracteres)", test: (p: string) => p.length >= 800 },
  { id: "gradual", label: "Apertura gradual (no revela todo al inicio)", test: (p: string) => /gradual|progresiv|poco a poco|eventualmente|con el tiempo|sesion.*avanzad/i.test(p) },
  { id: "no_profanity", label: "Sin vulgaridades en el prompt", test: (p: string) => checkProfanity(p).length === 0 },
  { id: "no_clinical_risk", label: "Sin contenido de riesgo clínico no permitido", test: (p: string) => checkClinicalRisk(p).length === 0 },
];

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { form, systemPrompt, testConversation } = await request.json();

  // 1. Structural validation
  const structuralChecks = RULES_CHECKLIST.map(rule => ({
    id: rule.id,
    label: rule.label,
    pass: rule.test(systemPrompt),
  }));

  // 2. Test conversation validation (if provided)
  let conversationChecks: { label: string; pass: boolean; detail: string }[] = [];
  if (testConversation && Array.isArray(testConversation)) {
    const patientMsgs = testConversation.filter((m: { role: string; content: string }) => m.role === "paciente").map((m: { content: string }) => m.content);

    // Check for repeated messages
    const uniqueMsgs = new Set(patientMsgs);
    conversationChecks.push({
      label: "Sin respuestas repetidas",
      pass: uniqueMsgs.size === patientMsgs.length,
      detail: uniqueMsgs.size === patientMsgs.length ? "Todas las respuestas son únicas" : `${patientMsgs.length - uniqueMsgs.size} respuesta(s) repetida(s)`,
    });

    // Check for bracket usage in non-verbal
    const hasBrackets = patientMsgs.some((m: string) => /\[.+\]/.test(m));
    conversationChecks.push({
      label: "Usa corchetes para lenguaje no verbal",
      pass: hasBrackets,
      detail: hasBrackets ? "Correcto: usa [corchetes]" : "No usó corchetes para expresiones no verbales",
    });

    // Check response length
    const longMsgs = patientMsgs.filter((m: string) => m.split(/[.!?]+/).filter(Boolean).length > 5);
    conversationChecks.push({
      label: "Respuestas de 1-4 oraciones",
      pass: longMsgs.length === 0,
      detail: longMsgs.length === 0 ? "Todas dentro del límite" : `${longMsgs.length} respuesta(s) demasiado larga(s)`,
    });

    // Check no therapist language
    const therapistPhrases = ["estoy aquí para escucharte", "puedes compartir", "cómo te sientes con eso"];
    const hasTherapist = patientMsgs.some((m: string) => therapistPhrases.some(p => m.toLowerCase().includes(p)));
    conversationChecks.push({
      label: "Sin lenguaje de terapeuta",
      pass: !hasTherapist,
      detail: hasTherapist ? "El paciente usó frases de terapeuta" : "Correcto: habla como paciente",
    });

    // Check gradual opening
    const firstMsg = patientMsgs[0] || "";
    const lastMsg = patientMsgs[patientMsgs.length - 1] || "";
    const firstLength = firstMsg.length;
    const lastLength = lastMsg.length;
    conversationChecks.push({
      label: "Apertura gradual (no revela todo al inicio)",
      pass: firstLength <= lastLength * 1.5,
      detail: `Primera respuesta: ${firstLength} chars, última: ${lastLength} chars`,
    });
  }

  // 3. AI coherence analysis
  const validationPrompt = `Analiza este system prompt de paciente simulado.

VARIABLES: ${form.name}, ${form.age} años, ${form.gender}, ${form.occupation}, ${(form.countries || []).join("/")}, ${form.motivo}, ${form.archetype}, rasgos: ${(form.personalityTraits || []).join(", ")}, defensas: ${(form.defenseMechanisms || []).join(", ")}.

PROMPT:
${systemPrompt.slice(0, 1500)}

Evalúa en máximo 150 palabras:
1. ¿Es coherente con las variables?
2. ¿Falta algo importante?
3. Sugerencias concretas (si las hay).`;

  const suggestion = await chat(
    [{ role: "user", content: validationPrompt }],
    "Eres un supervisor clínico experto. Responde en español, conciso."
  );

  return NextResponse.json({
    suggestion,
    structuralChecks,
    conversationChecks,
  });
}
