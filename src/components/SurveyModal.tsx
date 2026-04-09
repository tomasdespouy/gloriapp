"use client";

import { useState, useEffect } from "react";

type Survey = { id: string; title: string };

const NPS_EMOJIS = ["😡", "😠", "😤", "😕", "😐", "🙂", "😊", "😃", "😄", "🤩", "🌟"];

export default function SurveyModal() {
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [positives, setPositives] = useState("");
  const [improvements, setImprovements] = useState("");
  const [comments, setComments] = useState("");
  const [sent, setSent] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const fetchActive = () => {
      fetch("/api/surveys/active")
        .then(r => r.json())
        .then((data: Survey[]) => {
          if (Array.isArray(data) && data.length > 0) setSurvey(data[0]);
        })
        .catch(() => {});
    };

    // Initial fetch on mount (legacy behavior — picks up surveys when
    // the user navigates to any page in the (app) layout).
    fetchActive();

    // Re-fetch the moment a student submits a session reflection. This
    // is the canonical "post-evaluation" moment when the experience
    // survey for a pilot should pop up — handled via a global custom
    // event so ReviewClient does not have to import this component
    // directly.
    const handler = () => fetchActive();
    window.addEventListener("gloria:reflection-submitted", handler);
    return () => window.removeEventListener("gloria:reflection-submitted", handler);
  }, []);

  if (!survey || dismissed) return null;

  const handleSubmit = async () => {
    if (score === null || sending) return;
    setSending(true);
    try {
      await fetch("/api/surveys/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          survey_id: survey.id,
          nps_score: score,
          positives: positives.trim() || null,
          improvements: improvements.trim() || null,
          comments: comments.trim() || null,
        }),
      });
      setSent(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-pop">
        {/* Header */}
        <div className="bg-gradient-to-r from-sidebar to-[#354080] px-6 py-4 text-white">
          <h2 className="text-lg font-bold">{survey.title}</h2>
          <p className="text-sm text-white/80">Tu opinión nos ayuda a mejorar</p>
        </div>

        {sent ? (
          <div className="p-10 text-center animate-fade-in">
            <div className="text-5xl animate-bounce-once">🎉</div>
            <p className="text-base font-semibold text-gray-900 mt-4">¡Gracias por tu respuesta!</p>
            <p className="text-sm text-gray-500 mt-1">Tu retroalimentación nos ayuda a mejorar GlorIA</p>
            <button
              onClick={() => setSurvey(null)}
              className="mt-5 text-sm text-sidebar hover:underline cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            {/* NPS 0-10 */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">¿Qué tan probable es que recomiendes GlorIA a un compañero?</p>
              <div className="flex items-center justify-between gap-0.5 mb-1">
                {NPS_EMOJIS.map((emoji, i) => (
                  <button
                    key={i}
                    onClick={() => setScore(i)}
                    className={`flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-xl transition-all duration-200 flex-1 min-w-0 cursor-pointer ${
                      score === i
                        ? "bg-sidebar/10 ring-2 ring-sidebar scale-110 shadow-sm"
                        : score !== null && score !== i
                        ? "opacity-50 hover:opacity-100 hover:bg-gray-50"
                        : "hover:bg-gray-50 hover:scale-105"
                    }`}
                  >
                    <span className="text-xl sm:text-2xl">{emoji}</span>
                    <span className="text-[9px] font-medium text-gray-400">{i}</span>
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-gray-400 px-1">
                <span>Nada probable</span>
                <span>Muy probable</span>
              </div>
            </div>

            {/* Positives */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">¿Qué es lo que más te gusta de GlorIA?</label>
              <textarea value={positives} onChange={(e) => setPositives(e.target.value)} rows={2}
                placeholder="Lo que funciona bien..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sidebar/20 transition-shadow" />
            </div>

            {/* Improvements */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">¿Qué podría ser mejor?</label>
              <textarea value={improvements} onChange={(e) => setImprovements(e.target.value)} rows={2}
                placeholder="Sugerencias de mejora..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sidebar/20 transition-shadow" />
            </div>

            {/* Comments */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Otros comentarios (opcional)</label>
              <textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={2}
                placeholder="Cualquier otra cosa que quieras decirnos..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sidebar/20 transition-shadow" />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleSubmit}
                disabled={score === null || sending}
                className="flex-1 bg-sidebar text-white py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:bg-[#354080] enabled:hover:shadow-md enabled:hover:-translate-y-0.5 enabled:active:translate-y-0 enabled:active:shadow-sm cursor-pointer"
              >
                {sending ? "Enviando..." : "Enviar"}
              </button>
              <button onClick={() => setDismissed(true)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all duration-200 cursor-pointer">
                Ahora no
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
