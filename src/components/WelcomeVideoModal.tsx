"use client";

import { useState, useEffect } from "react";
import { X, MessageSquare, BookOpen, BarChart3, ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

const STORAGE_KEY = "gloria_welcome_seen";

const steps = [
  {
    icon: Sparkles,
    color: "from-sidebar to-indigo-600",
    title: "Bienvenido a GlorIA",
    subtitle: "Tu plataforma de entrenamiento clínico con IA",
    description:
      "Practica tus habilidades terapéuticas con pacientes simulados por inteligencia artificial. Cada paciente tiene su propia historia, personalidad y cuadro clínico.",
  },
  {
    icon: MessageSquare,
    color: "from-emerald-500 to-teal-600",
    title: "Conversa con pacientes",
    subtitle: "Sesiones realistas de práctica",
    description:
      "Elige un paciente, inicia una sesión y pon a prueba tus intervenciones. El paciente responderá de forma coherente con su perfil clínico. Puedes usar voz con la tecla Ctrl.",
  },
  {
    icon: BarChart3,
    color: "from-amber-500 to-orange-600",
    title: "Recibe retroalimentación",
    subtitle: "Evaluación por competencias",
    description:
      "Al terminar, reflexiona sobre tu sesión y recibe una evaluación detallada de tus competencias: empatía, escucha activa, preguntas abiertas y más. Tu docente revisará tus resultados.",
  },
  {
    icon: BookOpen,
    color: "from-purple-500 to-violet-600",
    title: "Aprende y mejora",
    subtitle: "Módulos interactivos + progreso",
    description:
      "Explora los módulos de aprendizaje con casos clínicos animados. Acumula XP, desbloquea logros y observa cómo mejoras sesión a sesión en tu radar de competencias.",
  },
];

export default function WelcomeVideoModal() {
  const [show, setShow] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) {
      const timer = setTimeout(() => setShow(true), 600);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setShow(false);
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  if (!show) return null;

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;
  const Icon = step.icon;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center animate-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-white shadow-lg flex items-center justify-center text-gray-500 hover:text-gray-900 transition-colors z-20"
        >
          <X size={18} />
        </button>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Hero section */}
          <div className={`bg-gradient-to-br ${step.color} px-8 pt-10 pb-8 text-center relative overflow-hidden`}>
            {/* Decorative circles */}
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10" />
            <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-white/10" />

            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-4 animate-pop">
                <Icon size={32} className="text-white" />
              </div>
              <h2 className="text-xl font-bold text-white mb-1">{step.title}</h2>
              <p className="text-sm text-white/80">{step.subtitle}</p>
            </div>
          </div>

          {/* Content */}
          <div className="px-8 py-6">
            <p className="text-sm text-gray-600 leading-relaxed text-center">
              {step.description}
            </p>
          </div>

          {/* Progress dots + actions */}
          <div className="px-8 pb-6 space-y-4">
            {/* Step indicators */}
            <div className="flex items-center justify-center gap-2">
              {steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentStep(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === currentStep
                      ? "w-6 bg-sidebar"
                      : i < currentStep
                      ? "w-1.5 bg-sidebar/40"
                      : "w-1.5 bg-gray-200"
                  }`}
                />
              ))}
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              {currentStep > 0 && (
                <button
                  onClick={() => setCurrentStep(currentStep - 1)}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Atrás
                </button>
              )}
              {isLast ? (
                <Link
                  href="/pacientes"
                  onClick={handleClose}
                  className="flex-1 bg-sidebar hover:bg-[#354080] text-white py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  Comenzar a practicar
                  <ArrowRight size={16} />
                </Link>
              ) : (
                <button
                  onClick={handleNext}
                  className="flex-1 bg-sidebar hover:bg-[#354080] text-white py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  Siguiente
                  <ArrowRight size={16} />
                </button>
              )}
            </div>

            {/* Skip link */}
            {!isLast && (
              <button
                onClick={handleClose}
                className="w-full text-center text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Saltar introducción
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
