"use client";

import { useState, useEffect } from "react";
import { X, ArrowRight, ClipboardCheck, Brain, Sparkles } from "lucide-react";

const STORAGE_KEY = "gloria_instructor_onboarding_done";

const STEPS = [
  {
    icon: ClipboardCheck,
    title: "Revisa sesiones pendientes",
    description: "En \"Revisiones\" encontrar\u00e1s todas las sesiones de tus alumnos que necesitan tu evaluaci\u00f3n. Las sesiones con pacientes de riesgo se marcan en rojo.",
  },
  {
    icon: Brain,
    title: "Edita la evaluaci\u00f3n de la IA",
    description: "Al revisar una sesi\u00f3n, puedes editar los puntajes y comentarios que gener\u00f3 la IA. Esto mejora la calidad de la retroalimentaci\u00f3n para tus alumnos.",
  },
  {
    icon: Sparkles,
    title: "Aprueba y genera accionables",
    description: "Cuando est\u00e9s conforme, aprueba la retroalimentaci\u00f3n para que el alumno pueda verla. Tambi\u00e9n puedes generar accionables personalizados con IA.",
  },
];

export default function InstructorOnboarding() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, "true");
  };

  if (!visible) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40" onClick={dismiss}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
            Bienvenido a GlorIA &middot; Paso {step + 1} de {STEPS.length}
          </p>
          <button onClick={dismiss} className="text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-sidebar/10 flex items-center justify-center mx-auto mb-4">
            <Icon size={28} className="text-sidebar" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">{current.title}</h3>
          <p className="text-sm text-gray-500 leading-relaxed">{current.description}</p>
        </div>

        {/* Step dots */}
        <div className="flex justify-center gap-1.5 mb-5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === step ? "bg-sidebar" : "bg-gray-200"
              }`}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={dismiss}
            className="flex-1 px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
          >
            Omitir
          </button>
          <button
            onClick={() => isLast ? dismiss() : setStep(step + 1)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-sidebar hover:bg-sidebar-hover rounded-xl transition-colors"
          >
            {isLast ? "Comenzar" : "Siguiente"}
            {!isLast && <ArrowRight size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}
