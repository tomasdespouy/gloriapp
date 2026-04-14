"use client";

import { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

type Survey = { id: string; title: string };

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

const USABILIDAD_ITEMS = [
  { key: "navegacion", label: "Navegar por la plataforma me resultó intuitivo y cómodo." },
  { key: "performance", label: "El tiempo de carga, respuesta y funcionamiento general fue adecuado durante mi experiencia." },
  { key: "claridad",   label: "La plataforma explica claramente su propósito y lo que se espera del usuario." },
  { key: "feedback",   label: "La retroalimentación o mensajes del sistema fueron comprensibles y útiles." },
];

const FORMACION_ITEMS = [
  { key: "aplicacion",     label: "La plataforma me permitió aplicar conocimientos propios de mi formación." },
  { key: "habilidades",    label: "La simulación podría contribuir al desarrollo de habilidades profesionales relevantes." },
  { key: "incorporacion",  label: "Considero que esta herramienta debería incorporarse regularmente en los cursos de mi carrera." },
  { key: "verosimilitud",  label: "El comportamiento del personaje o escenario simulado fue verosímil y coherente." },
  { key: "atencion",       label: "La simulación logró mantener mi atención y compromiso durante toda la actividad." },
];

type LikertScores = Record<string, number>;

export default function SurveyModal() {
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [step, setStep] = useState<0 | 1>(0);
  const [sent, setSent] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 0 — likert grids (USABILIDAD + FORMACIÓN)
  const [usabilidad, setUsabilidad] = useState<LikertScores>({});
  const [formacion, setFormacion] = useState<LikertScores>({});

  // Step 1 — open questions
  const [masGusto, setMasGusto] = useState("");
  const [mejoras, setMejoras] = useState("");
  const [integracion, setIntegracion] = useState("");
  const [comentarios, setComentarios] = useState("");

  useEffect(() => {
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
  }, []);

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

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-pop">
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
                  onClick={() => setDismissed(true)}
                  className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer"
                >
                  Ahora no
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
        title="5. [USABILIDAD]"
        subtitle="Responde considerando que 1 es 'muy en desacuerdo' y 5 es 'muy de acuerdo'."
        items={USABILIDAD_ITEMS}
        scores={props.usabilidad}
        onChange={(key, value) =>
          props.setUsabilidad({ ...props.usabilidad, [key]: value })
        }
      />
      <LikertGrid
        title="6. [FORMACIÓN]"
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
        label="7. ¿Qué fue lo que más te gustó de la experiencia con la plataforma de simulación?"
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
        label="8. ¿Qué mejorarías para que la experiencia sea más útil o realista?"
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
        label="9. ¿Cómo crees que esta herramienta podría integrarse mejor en tu proceso formativo?"
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

      <Field label="10. [OPCIONAL] Algún comentario adicional que te gustaría compartir">
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
