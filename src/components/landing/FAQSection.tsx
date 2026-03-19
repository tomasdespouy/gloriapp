"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export default function FAQSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const FAQS = [
    { q: "\u00bfLos pacientes son personas reales?", a: "No. Todos los pacientes de GlorIA son personajes ficticios simulados por inteligencia artificial, con personalidades y cuadros cl\u00ednicos dise\u00f1ados por profesionales de salud mental. Sus rostros y voces tambi\u00e9n son generados por IA." },
    { q: "\u00bfMis conversaciones son confidenciales?", a: "S\u00ed. Tus sesiones son privadas y solo t\u00fa y los docentes autorizados por tu instituci\u00f3n pueden acceder a ellas con fines acad\u00e9micos. Nunca compartimos el contenido de tus conversaciones con terceros fuera del contexto formativo." },
    { q: "\u00bfQu\u00e9 pasa si digo algo incorrecto en la sesi\u00f3n?", a: "Nada malo. GlorIA est\u00e1 dise\u00f1ada para que practiques y aprendas de tus errores en un entorno seguro y sin consecuencias reales. El paciente IA reaccionar\u00e1 de forma realista, lo que te permite observar el impacto de tus intervenciones y mejorar." },
    { q: "\u00bfEl paciente IA puede reaccionar a lo que digo?", a: "S\u00ed. Cada paciente responde en tiempo real seg\u00fan su personalidad, historia de vida y el contexto de la conversaci\u00f3n. Si demuestras empat\u00eda, lo notar\u00e1. Si lo interrumpes, tambi\u00e9n. Es una experiencia de pr\u00e1ctica realista." },
    { q: "\u00bfC\u00f3mo se eval\u00faan mis competencias?", a: "Al finalizar cada sesi\u00f3n, la IA eval\u00faa 10 competencias cl\u00ednicas bas\u00e1ndose en un instrumento desarrollado por la Universidad Gabriela Mistral, inspirado en modelos de competencias terap\u00e9uticas como los de Roth y Pilling (2007), el marco de la APA para competencias en psicolog\u00eda cl\u00ednica, y los factores comunes de Lambert y Barley (2001). Las competencias incluyen escucha activa, contenci\u00f3n de afectos, setting terap\u00e9utico, actitud no valorativa (Rogers, 1957), entre otras." },
    { q: "\u00bfPuedo usar GlorIA desde mi celular?", a: "S\u00ed. GlorIA funciona en cualquier navegador moderno, incluyendo Chrome y Safari en dispositivos m\u00f3viles. No necesitas instalar ninguna aplicaci\u00f3n." },
    { q: "\u00bfMi universidad puede ver mis sesiones?", a: "Los docentes autorizados pueden ver tu progreso, evaluaciones y competencias como parte del proceso formativo. El detalle de las conversaciones puede ser revisado con fines pedag\u00f3gicos, igual que una supervisi\u00f3n cl\u00ednica presencial." },
    { q: "\u00bfNecesito instalar algo?", a: "No. GlorIA funciona directamente en tu navegador web. Solo necesitas conexi\u00f3n a internet y una cuenta institucional activa." },
    { q: "\u00bfEs \u00e9tico practicar con pacientes de IA?", a: "S\u00ed. La simulaci\u00f3n con IA sigue los mismos principios \u00e9ticos que el role-playing y los pacientes estandarizados usados en formaci\u00f3n m\u00e9dica hace d\u00e9cadas. GlorIA permite practicar sin riesgo para personas reales, reduce la exposici\u00f3n prematura de estudiantes a casos complejos, y ofrece un espacio seguro para cometer errores y aprender. Todos los escenarios cl\u00ednicos son ficticios y est\u00e1n dise\u00f1ados bajo supervisi\u00f3n profesional. Cumplimos con la Ley 21.719 de Protecci\u00f3n de Datos y los principios del proyecto de Ley de Inteligencia Artificial de Chile." },
    { q: "\u00bfLa IA reemplaza a los docentes o supervisores cl\u00ednicos?", a: "No. GlorIA es una herramienta complementaria. La supervisi\u00f3n humana sigue siendo fundamental en la formaci\u00f3n cl\u00ednica. La plataforma ampl\u00eda las oportunidades de pr\u00e1ctica entre sesiones de supervisi\u00f3n, pero las evaluaciones de IA son orientativas y no reemplazan el criterio profesional del docente." },
  ];

  return (
    <section className="bg-[#FAFAFA] py-16 lg:py-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
            Preguntas frecuentes
          </h2>
          <p className="text-gray-500 text-sm max-w-lg mx-auto">
            Todo lo que necesitas saber sobre GlorIA antes de comenzar a practicar.
          </p>
        </div>

        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden transition-shadow hover:shadow-sm"
            >
              <button
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left"
              >
                <span className="text-sm font-semibold text-gray-900 pr-4">{faq.q}</span>
                <ChevronDown
                  size={18}
                  className={`text-gray-400 flex-shrink-0 transition-transform duration-200 ${
                    openIdx === i ? "rotate-180" : ""
                  }`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-200 ${
                  openIdx === i ? "max-h-60 opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <p className="px-5 pb-4 text-sm text-gray-600 leading-relaxed">
                  {faq.a}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
