"use client";

import { useState } from "react";
import { Sparkles, Send, X, MessageCircle } from "lucide-react";

const DEMO_CONVERSATIONS: { q: string; a: string }[] = [
  {
    q: "¿Qué es la escucha activa?",
    a: "La escucha activa es la capacidad de prestar atención coherente tanto a la comunicación verbal como no verbal del paciente, respondiendo en congruencia. Implica no solo oír las palabras, sino captar emociones, pausas, gestos y lo que no se dice. Según Carl Rogers (1957), es uno de los pilares de la relación terapéutica efectiva.",
  },
  {
    q: "¿Cómo manejo un silencio en sesión?",
    a: "El silencio terapéutico es una herramienta, no un vacío. Permite al paciente procesar emociones y reflexionar. La clave es tolerar la incomodidad sin llenar el espacio. Puedes mantener contacto visual cálido, asentir suavemente, y cuando el silencio se extiende, ofrecer una invitación gentil: \"Tómate el tiempo que necesites\" o \"Parece que eso te generó algo...\"",
  },
  {
    q: "¿Qué hago si un paciente llora?",
    a: "El llanto es una expresión emocional valiosa en terapia. Tu rol es contener, no detener. Ofrece presencia silenciosa, un pañuelo si es presencial, y valida la emoción: \"Está bien llorar, es importante lo que sientes\". Evita frases como \"no llores\" o \"cálmate\". Según Greenberg (2015), permitir el procesamiento emocional es clave para la transformación terapéutica.",
  },
  {
    q: "¿Cómo establezco un buen setting?",
    a: "El setting terapéutico incluye explicitar el encuadre: duración de la sesión, confidencialidad, roles (tú eres el terapeuta, él/ella el paciente), y las reglas del espacio. Es importante hacerlo al inicio de la primera sesión y reforzarlo cuando sea necesario. Un buen setting genera seguridad y confianza, que son la base para cualquier intervención posterior.",
  },
];

export default function AskGloriaDemo() {
  const [open, setOpen] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [typing, setTyping] = useState(false);
  const [displayedText, setDisplayedText] = useState("");

  const handleSelect = (idx: number) => {
    if (typing) return;
    setSelectedIdx(idx);
    setDisplayedText("");
    setTyping(true);

    const fullText = DEMO_CONVERSATIONS[idx].a;
    let charIdx = 0;

    const interval = setInterval(() => {
      charIdx += 2;
      setDisplayedText(fullText.substring(0, charIdx));
      if (charIdx >= fullText.length) {
        clearInterval(interval);
        setTyping(false);
      }
    }, 15);
  };

  const reset = () => {
    setSelectedIdx(null);
    setDisplayedText("");
    setTyping(false);
  };

  return (
    <>
      {/* Floating bubble */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 left-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-[#4A55A2] to-[#354080] text-white shadow-lg shadow-[#4A55A2]/30 flex items-center justify-center hover:scale-110 transition-transform"
        >
          <Sparkles size={24} />
        </button>
      )}

      {/* Chat window */}
      {open && (
        <div className="fixed bottom-6 left-6 z-50 w-[360px] max-h-[520px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-pop">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-[#4A55A2] to-[#354080] text-white">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Sparkles size={14} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Pregúntale a GlorIA</p>
              <p className="text-[10px] text-white/60">Tutora pedagógica con IA</p>
            </div>
            <button onClick={() => { setOpen(false); reset(); }} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-4 min-h-[300px]">
            {selectedIdx === null ? (
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#4A55A2] to-[#354080] flex items-center justify-center mx-auto mb-3">
                  <Sparkles size={20} className="text-white" />
                </div>
                <p className="text-sm font-medium text-gray-800 mb-1">Hola, soy GlorIA</p>
                <p className="text-[11px] text-gray-400 mb-5">
                  Prueba preguntándome sobre competencias clínicas
                </p>
                <div className="flex flex-col gap-2">
                  {DEMO_CONVERSATIONS.map((conv, i) => (
                    <button
                      key={i}
                      onClick={() => handleSelect(i)}
                      className="text-left px-3.5 py-2.5 rounded-xl border border-gray-200 text-[11px] text-gray-600 hover:border-[#4A55A2]/40 hover:bg-[#4A55A2]/5 hover:text-[#4A55A2] transition-all"
                    >
                      {conv.q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* User message */}
                <div className="flex justify-end">
                  <div className="bg-[#4A55A2] text-white rounded-2xl rounded-br-md px-3.5 py-2 max-w-[85%]">
                    <p className="text-[12px]">{DEMO_CONVERSATIONS[selectedIdx].q}</p>
                  </div>
                </div>
                {/* GlorIA response */}
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#4A55A2] to-[#354080] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Sparkles size={10} className="text-white" />
                  </div>
                  <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-bl-md px-3.5 py-2.5 max-w-[88%]">
                    <p className="text-[12px] text-gray-700 leading-relaxed">
                      {displayedText}
                      {typing && <span className="inline-block w-0.5 h-3.5 bg-[#4A55A2] animate-pulse ml-0.5 align-middle" />}
                    </p>
                  </div>
                </div>

                {/* Try another */}
                {!typing && (
                  <div className="pt-2 space-y-1.5">
                    <p className="text-[10px] text-gray-300 text-center">Prueba otra pregunta</p>
                    {DEMO_CONVERSATIONS.filter((_, i) => i !== selectedIdx).map((conv) => (
                      <button
                        key={conv.q}
                        onClick={() => handleSelect(DEMO_CONVERSATIONS.indexOf(conv))}
                        className="block w-full text-left text-[11px] px-3 py-2 rounded-lg border border-gray-100 text-gray-500 hover:border-[#4A55A2]/30 hover:text-[#4A55A2] transition-all"
                      >
                        {conv.q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Fake input */}
          <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-2">
            <div className="flex-1 px-3.5 py-2 bg-gray-50 rounded-xl text-[11px] text-gray-300">
              Regístrate para conversar con GlorIA...
            </div>
            <div className="w-8 h-8 rounded-lg bg-[#4A55A2]/15 flex items-center justify-center">
              <Send size={13} className="text-[#4A55A2]/40" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
