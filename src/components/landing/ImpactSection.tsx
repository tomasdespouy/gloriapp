"use client";

import { useEffect, useRef, useState } from "react";
import ScrollReveal from "./ScrollReveal";

function useCountUp(target: number, isVisible: boolean, duration = 1800) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!isVisible) return;
    const start = performance.now();
    function tick(now: number) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - p) * (1 - p);
      setCount(Math.floor(eased * target));
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [isVisible, target, duration]);
  return count;
}

export default function ImpactSection() {
  const metrics = [
    { value: 24, suffix: "", label: "Sesiones simuladas", desc: "en estudio comparativo de 3 niveles" },
    { value: 85, suffix: "%", label: "Ahorro en costos API", desc: "con estrategia de modelo dual" },
    { value: 10, suffix: "", label: "Competencias evaluadas", desc: "instrumento UGM calibrado" },
    { value: 5, suffix: "", label: "Pa\u00edses representados", desc: "con diversidad cultural y cl\u00ednica" },
  ];

  const findings = [
    {
      stat: "3.5x",
      color: "#22c55e",
      title: "Mayor reducci\u00f3n de resistencia",
      desc: "Terapeutas avanzados reducen la resistencia del paciente 3.5 veces m\u00e1s que terapeutas b\u00e1sicos en 8 sesiones.",
    },
    {
      stat: "2.7x",
      color: "#4A55A2",
      title: "Mayor alianza terap\u00e9utica",
      desc: "La alianza construida por terapeutas avanzados es 2.7 veces m\u00e1s fuerte que con intervenciones directivas.",
    },
    {
      stat: "0%",
      color: "#ef4444",
      title: "Mejora con directividad",
      desc: "Los terapeutas que dan consejos prematuros no mejoran la sintomatolog\u00eda del paciente en ninguna sesi\u00f3n.",
    },
    {
      stat: "90s",
      color: "#eab308",
      title: "Reactividad del paciente",
      desc: "El paciente reacciona si el terapeuta guarda silencio por m\u00e1s de 90 segundos, como en la vida real.",
    },
  ];

  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setIsVisible(true); obs.unobserve(e.target); } },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section className="bg-gradient-to-b from-[#F8F9FC] to-white py-16 lg:py-24" ref={ref}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="text-center mb-12">
            <p className="text-xs font-semibold text-[#4A55A2] uppercase tracking-widest mb-2">
              Evidencia de impacto
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
              Resultados que respaldan la plataforma
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Datos reales de pilotos y estudios comparativos que demuestran la efectividad del motor cl&iacute;nico adaptativo de GlorIA
            </p>
          </div>
        </ScrollReveal>

        {/* Metric counters */}
        <ScrollReveal>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {metrics.map((m) => {
              const count = useCountUp(m.value, isVisible);
              return (
                <div key={m.label} className="bg-white rounded-2xl border border-gray-200 p-6 text-center hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                  <p className="text-3xl sm:text-4xl font-bold text-[#4A55A2]">
                    {count}{m.suffix}
                  </p>
                  <p className="text-sm font-semibold text-gray-900 mt-2">{m.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{m.desc}</p>
                </div>
              );
            })}
          </div>
        </ScrollReveal>

        {/* Key findings */}
        <ScrollReveal delay={200}>
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-100 bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-900">
                Hallazgos del estudio comparativo
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {"3 niveles de terapeuta (b\u00e1sico, intermedio, avanzado) x 8 sesiones con el mismo paciente"}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
              {findings.map((f, i) => (
                <div key={i} className="p-6 lg:p-8 flex gap-5 items-start hover:bg-gray-50/50 transition-colors">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: f.color + "15" }}
                  >
                    <span className="text-xl font-black" style={{ color: f.color }}>
                      {f.stat}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{f.title}</p>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ScrollReveal>

        {/* Bottom note */}
        <ScrollReveal delay={300}>
          <p className="text-center text-xs text-gray-400 mt-8 max-w-xl mx-auto">
            {"Datos obtenidos del estudio comparativo de niveles terap\u00e9uticos con el paciente Roberto Salas (52 a\u00f1os, duelo) usando el motor adaptativo de GlorIA con clasificador NLP de intervenciones, RAG sem\u00e1ntico y Memory-Context Processing (MCP)."}
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}
