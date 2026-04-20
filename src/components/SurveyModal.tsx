"use client";

import { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

type Survey = { id: string; title: string; form_version?: string | null };

// ─────────────────────────────────────────────────────────────────────
// UGM "Evaluación de plataforma de simulación con el uso de IA"
// Replicated from the Microsoft Form (https://forms.office.com/r/3HfKGdUvbv).
//
// The original form has 10 questions but the first 4 are demographics
// (carrera, género, edad, rol) which we already capture during pilot
// enrollment via pilot_consents. The server enriches each survey
// response with those fields automatically, so the user only fills
// the 6 questions that actually require their input:
//   - Q5/Q6 likert grids (usabilidad / formación)
//   - Q7-Q10 open-text answers
//
// All 10 fields land in survey_responses.answers as flat JSONB.
// ─────────────────────────────────────────────────────────────────────

// Questions are labeled 1..13 correlatively for the student. The `key`
// values below (navegacion, performance, ...) remain as the payload
// identifiers stored in survey_responses.answers — never renumber them
// in payload keys or reports break.
const USABILIDAD_ITEMS = [
  { key: "navegacion", label: "1. Navegar por la plataforma me resultó intuitivo y cómodo." },
  { key: "performance", label: "2. El tiempo de carga, respuesta y funcionamiento general fue adecuado durante mi experiencia." },
  { key: "claridad",   label: "3. La plataforma explica claramente su propósito y lo que se espera del usuario." },
  { key: "feedback",   label: "4. La retroalimentación o mensajes del sistema fueron comprensibles y útiles." },
];

const FORMACION_ITEMS = [
  { key: "aplicacion",     label: "5. La plataforma me permitió aplicar conocimientos propios de mi formación." },
  { key: "habilidades",    label: "6. La simulación podría contribuir al desarrollo de habilidades profesionales relevantes." },
  { key: "incorporacion",  label: "7. Considero que esta herramienta debería incorporarse regularmente en los cursos de mi carrera." },
  { key: "verosimilitud",  label: "8. El comportamiento del personaje o escenario simulado fue verosímil y coherente." },
  { key: "atencion",       label: "9. La simulación logró mantener mi atención y compromiso durante toda la actividad." },
];

type LikertScores = Record<string, number>;

export default function SurveyModal({
  welcomeVideoSeen = true,
}: {
  /** If false, the survey is suppressed until the welcome video has
      been dismissed. Prevents the survey and the welcome video from
      popping at the same time on a user's first pilot session. */
  welcomeVideoSeen?: boolean;
}) {
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [step, setStep] = useState<0 | 1>(0);
  const [sent, setSent] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Persist an explicit "No realizar" decline. POSTs {decline: true} so
  // the server writes a survey_responses row with status='not_taken';
  // superadmin can count declines separately from silent non-respondents.
  // Hides the modal regardless of network outcome — a failed decline
  // still honors the user's UI intent to dismiss.
  async function declineSurvey(surveyId: string) {
    if (declining) return;
    setDeclining(true);
    try {
      await fetch("/api/surveys/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ survey_id: surveyId, decline: true }),
      });
    } catch {
      // Silent: network failure shouldn't block the user from closing.
    } finally {
      setDeclining(false);
      setDismissed(true);
    }
  }

  // Tracks whether the welcome video has been dismissed in this
  // browser session. Starts as the server truth, flips to true when
  // the user closes the welcome modal (via a custom event dispatched
  // by WelcomeVideoModal), so we don't need a full page reload.
  const [videoSeen, setVideoSeen] = useState(welcomeVideoSeen);

  // Step 0 — likert grids (USABILIDAD + FORMACIÓN)
  const [usabilidad, setUsabilidad] = useState<LikertScores>({});
  const [formacion, setFormacion] = useState<LikertScores>({});

  // Step 1 — open questions
  const [masGusto, setMasGusto] = useState("");
  const [mejoras, setMejoras] = useState("");
  const [integracion, setIntegracion] = useState("");
  const [comentarios, setComentarios] = useState("");

  // Always listen for the welcome-video-closed event so the gate can
  // lift mid-session without a reload.
  useEffect(() => {
    const onVideoClosed = () => setVideoSeen(true);
    window.addEventListener("gloria:welcome-video-closed", onVideoClosed);
    return () =>
      window.removeEventListener("gloria:welcome-video-closed", onVideoClosed);
  }, []);

  useEffect(() => {
    // Priority: welcome video first. Once it has been seen (server
    // flag or user just closed it), we start polling for active
    // surveys.
    if (!videoSeen) return;

    const fetchActive = () => {
      fetch("/api/surveys/active")
        .then((r) => r.json())
        .then((data: Survey[]) => {
          if (Array.isArray(data) && data.length > 0) setSurvey(data[0]);
        })
        .catch(() => {});
    };

    fetchActive();

    // Re-fetch after a student submits a session reflection. Wired up
    // by ReviewClient via window.dispatchEvent so the modal pops the
    // moment the student finishes their post-session reflection. Reset
    // dismissed so that if the user said "Ahora no" the first time the
    // modal showed (e.g. on landing), the post-session trigger can open
    // it again.
    const handler = () => {
      setDismissed(false);
      fetchActive();
    };
    window.addEventListener("gloria:reflection-submitted", handler);
    return () =>
      window.removeEventListener("gloria:reflection-submitted", handler);
  }, [videoSeen]);

  if (!survey || dismissed) return null;

  // ─── Validation ───────────────────────────────────────────────────
  function validateStep0(): string | null {
    for (const item of USABILIDAD_ITEMS) {
      if (!usabilidad[item.key]) return `Falta responder: "${item.label}"`;
    }
    for (const item of FORMACION_ITEMS) {
      if (!formacion[item.key]) return `Falta responder: "${item.label}"`;
    }
    return null;
  }

  function validateStep1(): string | null {
    if (!masGusto.trim()) return "Cuéntanos qué te gustó.";
    if (!mejoras.trim()) return "Cuéntanos qué mejorarías.";
    if (!integracion.trim()) return "Cuéntanos cómo se podría integrar mejor.";
    return null;
  }

  function next() {
    const err = validateStep0();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep(1);
  }

  function back() {
    setError(null);
    setStep(0);
  }

  async function handleSubmit() {
    const err = validateStep1();
    if (err) {
      setError(err);
      return;
    }
    if (!survey || sending) return;

    setSending(true);
    setError(null);

    // Demographics (q1-q4) are NOT collected here — the user already
    // gave them at pilot enrollment. The server enriches the response
    // with those fields from pilot_consents before storing.
    const answers = {
      q5_usabilidad: usabilidad,
      q6_formacion: formacion,
      q7_mas_gusto: masGusto.trim(),
      q8_mejoras: mejoras.trim(),
      q9_integracion: integracion.trim(),
      q10_comentarios: comentarios.trim() || null,
    };

    try {
      const res = await fetch("/api/surveys/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ survey_id: survey.id, answers }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "No pudimos enviar tu respuesta.");
        setSending(false);
        return;
      }
      setSent(true);
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setSending(false);
    }
  }

  // Render the new pilot v2 questionnaire when the backing survey row
  // was seeded with form_version='v2_pilot'. Legacy surveys (NULL) keep
  // rendering the original v1 form below, unchanged.
  if (survey.form_version === "v2_pilot") {
    return (
      <SurveyModalV2
        survey={survey}
        onDismiss={() => setDismissed(true)}
        onDecline={() => declineSurvey(survey.id)}
        declining={declining}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92dvh] flex flex-col overflow-hidden animate-pop">
        {/* Header */}
        <div className="bg-gradient-to-r from-sidebar to-[#354080] px-6 py-4 text-white flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-base sm:text-lg font-bold leading-tight">
                Evaluación de plataforma de simulación con el uso de IA
              </h2>
              <p className="text-xs text-white/80 mt-1 leading-snug">
                Encuesta anónima. Tu opinión nos ayuda a mejorar la formación
                clínica de los estudiantes.
              </p>
            </div>
            <button
              onClick={() => setDismissed(true)}
              className="flex-shrink-0 w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer"
              title="Cerrar"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {sent ? (
          <div className="p-10 text-center animate-fade-in">
            <div className="text-5xl animate-bounce-once">🎉</div>
            <p className="text-base font-semibold text-gray-900 mt-4">
              ¡Gracias por tu respuesta!
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Tu retroalimentación nos ayuda a mejorar GlorIA y a entender mejor
              cómo apoyar tu proceso formativo.
            </p>
            <button
              onClick={() => setDismissed(true)}
              className="mt-5 text-sm text-sidebar hover:underline cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <>
            {/* Stepper */}
            <div className="px-6 pt-4 pb-2 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2 text-xs">
                {(["Usabilidad y formación", "Tu opinión"] as const).map((label, i) => (
                  <div key={label} className="flex items-center gap-2">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                        i === step
                          ? "bg-sidebar text-white"
                          : i < step
                          ? "bg-sidebar/15 text-sidebar"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {i + 1}
                    </div>
                    <span
                      className={`hidden sm:inline ${
                        i === step ? "text-gray-900 font-medium" : "text-gray-400"
                      }`}
                    >
                      {label}
                    </span>
                    {i < 1 && <span className="text-gray-300">›</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Body — scrollable */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {step === 0 && (
                <StepLikerts
                  usabilidad={usabilidad} setUsabilidad={setUsabilidad}
                  formacion={formacion} setFormacion={setFormacion}
                />
              )}
              {step === 1 && (
                <StepOpen
                  masGusto={masGusto} setMasGusto={setMasGusto}
                  mejoras={mejoras} setMejoras={setMejoras}
                  integracion={integracion} setIntegracion={setIntegracion}
                  comentarios={comentarios} setComentarios={setComentarios}
                />
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-100 flex-shrink-0 bg-white">
              {error && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
                  {error}
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={() => declineSurvey(survey.id)}
                  disabled={declining}
                  className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {declining ? "Registrando…" : "No realizar"}
                </button>
                <div className="flex items-center gap-2">
                  {step > 0 && (
                    <button
                      onClick={back}
                      className="flex items-center gap-1 px-3 py-2 border border-gray-200 hover:bg-gray-50 rounded-lg text-xs font-medium text-gray-700 cursor-pointer"
                    >
                      <ChevronLeft size={14} /> Atrás
                    </button>
                  )}
                  {step < 1 ? (
                    <button
                      onClick={next}
                      className="flex items-center gap-1 px-4 py-2 bg-sidebar hover:bg-[#354080] text-white rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Siguiente <ChevronRight size={14} />
                    </button>
                  ) : (
                    <button
                      onClick={handleSubmit}
                      disabled={sending}
                      className="px-5 py-2 bg-sidebar hover:bg-[#354080] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      {sending ? "Enviando…" : "Enviar respuesta"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Step 0 — Likert grids (USABILIDAD + FORMACIÓN)
// ─────────────────────────────────────────────────────────────────────

function StepLikerts(props: {
  usabilidad: LikertScores; setUsabilidad: (v: LikertScores) => void;
  formacion: LikertScores; setFormacion: (v: LikertScores) => void;
}) {
  return (
    <div className="space-y-8">
      <LikertGrid
        title="[USABILIDAD]"
        subtitle="Responde considerando que 1 es 'muy en desacuerdo' y 5 es 'muy de acuerdo'."
        items={USABILIDAD_ITEMS}
        scores={props.usabilidad}
        onChange={(key, value) =>
          props.setUsabilidad({ ...props.usabilidad, [key]: value })
        }
      />
      <LikertGrid
        title="[FORMACIÓN]"
        subtitle="Responde considerando que 1 es 'muy en desacuerdo' y 5 es 'muy de acuerdo'."
        items={FORMACION_ITEMS}
        scores={props.formacion}
        onChange={(key, value) =>
          props.setFormacion({ ...props.formacion, [key]: value })
        }
      />
    </div>
  );
}

function LikertGrid(props: {
  title: string;
  subtitle: string;
  items: { key: string; label: string }[];
  scores: LikertScores;
  onChange: (key: string, value: number) => void;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900">{props.title}</h3>
      <p className="text-xs text-gray-500 mt-0.5 mb-4">{props.subtitle}</p>
      <div className="space-y-4">
        {props.items.map((item) => (
          <div key={item.key} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
            <p className="text-xs sm:text-sm text-gray-800 mb-2 leading-snug">
              {item.label}
            </p>
            <div className="flex items-center justify-between gap-1 sm:gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => props.onChange(item.key, n)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    props.scores[item.key] === n
                      ? "bg-sidebar text-white shadow-sm scale-105"
                      : "bg-white border border-gray-200 text-gray-500 hover:border-sidebar/50"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-[9px] text-gray-400 mt-1 px-1">
              <span>Muy en desacuerdo</span>
              <span>Muy de acuerdo</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Step 1 — Open questions
// ─────────────────────────────────────────────────────────────────────

function StepOpen(props: {
  masGusto: string; setMasGusto: (v: string) => void;
  mejoras: string; setMejoras: (v: string) => void;
  integracion: string; setIntegracion: (v: string) => void;
  comentarios: string; setComentarios: (v: string) => void;
}) {
  return (
    <div className="space-y-5">
      <Field
        label="10. ¿Qué fue lo que más te gustó de la experiencia con la plataforma de simulación?"
        required
      >
        <textarea
          value={props.masGusto}
          onChange={(e) => props.setMasGusto(e.target.value)}
          rows={3}
          placeholder="Cuéntanos lo que mejor funcionó para ti…"
          className={`${inputCls} resize-none`}
        />
      </Field>

      <Field
        label="11. ¿Qué mejorarías para que la experiencia sea más útil o realista?"
        required
      >
        <textarea
          value={props.mejoras}
          onChange={(e) => props.setMejoras(e.target.value)}
          rows={3}
          placeholder="Sugerencias concretas…"
          className={`${inputCls} resize-none`}
        />
      </Field>

      <Field
        label="12. ¿Cómo crees que esta herramienta podría integrarse mejor en tu proceso formativo?"
        required
      >
        <textarea
          value={props.integracion}
          onChange={(e) => props.setIntegracion(e.target.value)}
          rows={3}
          placeholder="Tareas, asignaturas, espacios formativos…"
          className={`${inputCls} resize-none`}
        />
      </Field>

      <Field label="13. [OPCIONAL] Algún comentario adicional que te gustaría compartir">
        <textarea
          value={props.comentarios}
          onChange={(e) => props.setComentarios(e.target.value)}
          rows={2}
          placeholder="Espacio libre…"
          className={`${inputCls} resize-none`}
        />
      </Field>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

const inputCls =
  "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sidebar/30 focus:border-sidebar transition-shadow";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-800 mb-2">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// V2 pilot questionnaire (2026-04)
//
// User-facing numbering runs 1..10 correlatively (5 Likert sections +
// 5 open questions). Demographics + consent are captured at pilot
// enrollment, same as v1, so they are not re-asked here.
//
// Payload shape (stable — DO NOT rename these keys, analytics depend on
// them): q7_usabilidad, q8_realismo, q9_pertinencia, q10_diseno,
// q11_satisfaccion, q12_mas_gusto, q13_menos_gusto, q14_cambio,
// q15_incomodidad, q16_comentarios. The q7..q16 key offset is
// historical — kept as-is so reports/exports don't need a rename.
// ─────────────────────────────────────────────────────────────────────

const V2_USABILIDAD_ITEMS = [
  { key: "registro",       label: "El proceso de registro e inicio de sesión fue sencillo." },
  { key: "navegacion",     label: "La plataforma es fácil de navegar (encontrar opciones, menús, etc.)." },
  { key: "inicio_sesion",  label: "Iniciar una sesión de chat con un paciente simulado fue intuitivo." },
  { key: "dialogo",        label: "Mantener la conversación y dialogar con el paciente simulado fue simple." },
  { key: "general",        label: "En general, considero que Glor-IA es fácil de usar." },
];

const V2_REALISMO_ITEMS = [
  { key: "respuestas",     label: "Las respuestas del paciente simulado se sintieron realistas." },
  { key: "personalidad",   label: "La personalidad y el motivo de consulta del paciente fueron creíbles y coherentes." },
  { key: "comprension",    label: "El paciente virtual entendió y respondió adecuadamente a mis preguntas e intervenciones." },
  { key: "sesion_real",    label: "La interacción con el paciente simulado me generó una sensación similar a lo que espero de una sesión clínica real." },
  { key: "emocional",      label: "Las reacciones emocionales del paciente simulado fueron consistentes con su historia y motivo de consulta." },
];

const V2_PERTINENCIA_ITEMS = [
  { key: "lenguaje",       label: "El lenguaje utilizado por el paciente simulado es pertinente a mi contexto cultural." },
  { key: "experiencias",   label: "Las experiencias presentadas por los pacientes son coherentes con mi realidad local." },
  { key: "tematica",       label: "La temática del paciente virtual es pertinente a las problemáticas de salud mental de mi contexto." },
  { key: "estereotipos",   label: "La interacción evita estereotipos ofensivos o poco realistas hacia personas o grupos específicos." },
  { key: "sensibilidad",   label: "Considero que Glor-IA es sensible a las particularidades del contexto en el que podría ejercer." },
];

const V2_DISENO_ITEMS = [
  { key: "visual",         label: "El diseño visual (colores, tipografía, organización) de la plataforma es agradable y coherente." },
  { key: "informacion",    label: "La información en pantalla (chat, ficha, menús) está bien organizada y es fácil de leer." },
  { key: "fluidez",        label: "Durante mi uso, la plataforma funcionó de manera fluida (sin caídas o lentitud excesiva)." },
  { key: "interactivos",   label: "Los elementos interactivos (botones, enlaces, opciones) son claros y fáciles de identificar." },
  { key: "adaptacion",     label: "La plataforma se adaptó correctamente al dispositivo que utilicé (computador, tablet o celular)." },
];

const V2_SATISFACCION_ITEMS = [
  { key: "satisfaccion",   label: "Estoy satisfecho/a con mi experiencia general utilizando Glor-IA." },
  { key: "volver_usar",    label: "Me gustaría volver a usar Glor-IA en otros cursos o actividades de práctica." },
  { key: "recomendar",     label: "Recomendaría el uso de Glor-IA a otros estudiantes de psicología." },
  { key: "incorporacion",  label: "Considero que sería valioso que Glor-IA se incorporase formalmente en la formación clínica." },
  { key: "tiempo_valio",   label: "Siento que el tiempo dedicado a usar Glor-IA valió la pena para mi aprendizaje." },
];

function SurveyModalV2({
  survey,
  onDismiss,
  onDecline,
  declining,
}: {
  survey: Survey;
  /** Close without recording anything — used by the X header button
      so the student can hide the modal temporarily and see it again
      on next navigation. */
  onDismiss: () => void;
  /** Persist an explicit "No realizar" decline in survey_responses
      with status='not_taken'. Irreversible from UI. */
  onDecline: () => void;
  /** True while the decline POST is in flight. */
  declining: boolean;
}) {
  const [step, setStep] = useState<0 | 1>(0);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [q7, setQ7] = useState<LikertScores>({});
  const [q8, setQ8] = useState<LikertScores>({});
  const [q9, setQ9] = useState<LikertScores>({});
  const [q10, setQ10] = useState<LikertScores>({});
  const [q11, setQ11] = useState<LikertScores>({});
  const [q12, setQ12] = useState("");
  const [q13, setQ13] = useState("");
  const [q14, setQ14] = useState("");
  const [q15, setQ15] = useState("");
  const [q16, setQ16] = useState("");

  function validateStep0(): string | null {
    const groups: [string, LikertScores, { key: string; label: string }[]][] = [
      ["1. Usabilidad y navegación", q7, V2_USABILIDAD_ITEMS],
      ["2. Realismo Clínico", q8, V2_REALISMO_ITEMS],
      ["3. Pertinencia cultural y contextual", q9, V2_PERTINENCIA_ITEMS],
      ["4. Diseño, interfaz y funcionamiento técnico", q10, V2_DISENO_ITEMS],
      ["5. Satisfacción global e intención de uso futuro", q11, V2_SATISFACCION_ITEMS],
    ];
    for (const [group, scores, items] of groups) {
      for (const item of items) {
        if (!scores[item.key]) return `Falta responder en "${group}": ${item.label}`;
      }
    }
    return null;
  }

  function validateStep1(): string | null {
    if (!q12.trim()) return "Cuéntanos qué te gustó más (pregunta 6).";
    if (!q13.trim()) return "Cuéntanos qué te gustó menos (pregunta 7).";
    if (!q14.trim()) return "Cuéntanos qué cambiarías (pregunta 8).";
    if (!q15.trim()) return "Cuéntanos si hubo algo que te generó incomodidad (pregunta 9).";
    return null;
  }

  function goNext() {
    const err = validateStep0();
    if (err) { setError(err); return; }
    setError(null);
    setStep(1);
  }
  function goBack() { setError(null); setStep(0); }

  async function handleSubmit() {
    const err = validateStep1();
    if (err) { setError(err); return; }
    if (sending) return;
    setSending(true);
    setError(null);
    const answers = {
      form_version: "v2_pilot",
      q7_usabilidad: q7,
      q8_realismo: q8,
      q9_pertinencia: q9,
      q10_diseno: q10,
      q11_satisfaccion: q11,
      q12_mas_gusto: q12.trim(),
      q13_menos_gusto: q13.trim(),
      q14_cambio: q14.trim(),
      q15_incomodidad: q15.trim(),
      q16_comentarios: q16.trim() || null,
    };
    try {
      const res = await fetch("/api/surveys/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ survey_id: survey.id, answers }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "No pudimos enviar tu respuesta.");
        setSending(false);
        return;
      }
      setSent(true);
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92dvh] flex flex-col overflow-hidden animate-pop">
        <div className="bg-gradient-to-r from-sidebar to-[#354080] px-6 py-4 text-white flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-base sm:text-lg font-bold leading-tight">
                Evaluación de plataforma de simulación con el uso de IA
              </h2>
              <p className="text-xs text-white/80 mt-1 leading-snug">
                Encuesta anónima. Tu opinión nos ayuda a mejorar la formación
                clínica de los estudiantes.
              </p>
            </div>
            <button
              onClick={onDismiss}
              className="flex-shrink-0 w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer"
              title="Cerrar"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {sent ? (
          <div className="p-10 text-center animate-fade-in">
            <div className="text-5xl animate-bounce-once">🎉</div>
            <p className="text-base font-semibold text-gray-900 mt-4">
              ¡Gracias por tu respuesta!
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Tu retroalimentación nos ayuda a mejorar GlorIA y a entender mejor
              cómo apoyar tu proceso formativo.
            </p>
            <button
              onClick={onDismiss}
              className="mt-5 text-sm text-sidebar hover:underline cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <>
            <div className="px-6 pt-4 pb-2 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2 text-xs">
                {(["Escalas Likert", "Preguntas abiertas"] as const).map((label, i) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                      i === step ? "bg-sidebar text-white"
                        : i < step ? "bg-sidebar/15 text-sidebar"
                        : "bg-gray-100 text-gray-400"}`}>
                      {i + 1}
                    </div>
                    <span className={`hidden sm:inline ${i === step ? "text-gray-900 font-medium" : "text-gray-400"}`}>
                      {label}
                    </span>
                    {i < 1 && <span className="text-gray-300">›</span>}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {step === 0 ? (
                <div className="space-y-8">
                  <LikertGrid
                    title="1. [Usabilidad y navegación]"
                    subtitle="1 = Totalmente en desacuerdo, 5 = Totalmente de acuerdo."
                    items={V2_USABILIDAD_ITEMS}
                    scores={q7}
                    onChange={(k, v) => setQ7({ ...q7, [k]: v })}
                  />
                  <LikertGrid
                    title="2. [Realismo Clínico]"
                    subtitle="1 = Totalmente en desacuerdo, 5 = Totalmente de acuerdo."
                    items={V2_REALISMO_ITEMS}
                    scores={q8}
                    onChange={(k, v) => setQ8({ ...q8, [k]: v })}
                  />
                  <LikertGrid
                    title="3. [Pertinencia cultural y contextual]"
                    subtitle="1 = Totalmente en desacuerdo, 5 = Totalmente de acuerdo."
                    items={V2_PERTINENCIA_ITEMS}
                    scores={q9}
                    onChange={(k, v) => setQ9({ ...q9, [k]: v })}
                  />
                  <LikertGrid
                    title="4. [Diseño, interfaz y funcionamiento técnico]"
                    subtitle="1 = Totalmente en desacuerdo, 5 = Totalmente de acuerdo."
                    items={V2_DISENO_ITEMS}
                    scores={q10}
                    onChange={(k, v) => setQ10({ ...q10, [k]: v })}
                  />
                  <LikertGrid
                    title="5. [Satisfacción global e intención de uso futuro]"
                    subtitle="1 = Totalmente en desacuerdo, 5 = Totalmente de acuerdo."
                    items={V2_SATISFACCION_ITEMS}
                    scores={q11}
                    onChange={(k, v) => setQ11({ ...q11, [k]: v })}
                  />
                </div>
              ) : (
                <div className="space-y-5">
                  <Field label="6. ¿Qué es lo que MÁS te gustó de usar la plataforma Glor-IA?" required>
                    <textarea value={q12} onChange={(e) => setQ12(e.target.value)} rows={3} className={`${inputCls} resize-none`} />
                  </Field>
                  <Field label="7. ¿Qué es lo que MENOS te gustó o qué problemas/dificultades encontraste al usarla?" required>
                    <textarea value={q13} onChange={(e) => setQ13(e.target.value)} rows={3} className={`${inputCls} resize-none`} />
                  </Field>
                  <Field label="8. Si pudieras cambiar o agregar UNA cosa a Glor-IA, ¿qué sería?" required>
                    <textarea value={q14} onChange={(e) => setQ14(e.target.value)} rows={3} className={`${inputCls} resize-none`} />
                  </Field>
                  <Field label="9. Durante la interacción con el paciente simulado, ¿hubo algo que te generó incomodidad emocional o piensas que dificultó tu aprendizaje?" required>
                    <textarea value={q15} onChange={(e) => setQ15(e.target.value)} rows={3} className={`${inputCls} resize-none`} />
                  </Field>
                  <Field label="10. [Opcional] Si quieres puedes dejar alguna consulta o comentario en este espacio">
                    <textarea value={q16} onChange={(e) => setQ16(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
                  </Field>
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-gray-100 flex-shrink-0 bg-white">
              {error && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
                  {error}
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={onDecline}
                  disabled={declining}
                  className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {declining ? "Registrando…" : "No realizar"}
                </button>
                <div className="flex items-center gap-2">
                  {step > 0 && (
                    <button onClick={goBack} className="flex items-center gap-1 px-3 py-2 border border-gray-200 hover:bg-gray-50 rounded-lg text-xs font-medium text-gray-700 cursor-pointer">
                      <ChevronLeft size={14} /> Atrás
                    </button>
                  )}
                  {step < 1 ? (
                    <button onClick={goNext} className="flex items-center gap-1 px-4 py-2 bg-sidebar hover:bg-[#354080] text-white rounded-lg text-xs font-semibold cursor-pointer">
                      Siguiente <ChevronRight size={14} />
                    </button>
                  ) : (
                    <button onClick={handleSubmit} disabled={sending} className="px-5 py-2 bg-sidebar hover:bg-[#354080] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold cursor-pointer">
                      {sending ? "Enviando…" : "Enviar respuesta"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
