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
    { value: 119, suffix: "", label: "Participantes en pilotos", desc: "estudiantes y docentes de 4 universidades" },
    { value: 97, suffix: "%", label: "Satisfacci\u00f3n global", desc: "declaran estar satisfechos con GlorIA" },
    { value: 96, suffix: "%", label: "Lo recomendar\u00edan", desc: "a otros estudiantes de psicolog\u00eda" },
    { value: 10, suffix: "", label: "Competencias evaluadas", desc: "instrumento UGM calibrado" },
  ];

  const findings = [
    {
      stat: "97%",
      color: "#22c55e",
      title: "Vali\u00f3 la pena para su aprendizaje",
      desc: "El 97% de los participantes afirma que el tiempo dedicado a usar GlorIA vali\u00f3 la pena para su formaci\u00f3n cl\u00ednica.",
    },
    {
      stat: "92%",
      color: "#4A55A2",
      title: "F\u00e1cil de usar",
      desc: "Promedio de usabilidad y navegaci\u00f3n. El 97% dice que la plataforma es f\u00e1cil de navegar.",
    },
    {
      stat: "88%",
      color: "#eab308",
      title: "Realismo cl\u00ednico",
      desc: "Los pacientes simulados generan una sensaci\u00f3n similar a una sesi\u00f3n cl\u00ednica real, con coherencia emocional y narrativa.",
    },
    {
      stat: "3.5/5",
      color: "#8b5cf6",
      title: "V\u00ednculo terap\u00e9utico",
      desc: "Puntaje promedio en la dimensi\u00f3n de v\u00ednculo terap\u00e9utico, destacando aceptaci\u00f3n e incondicionalidad (4.0/5).",
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
              Pilotos internacionales 2025
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
              Resultados que respaldan la plataforma
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Datos de pilotos con universidades de Colombia, Per&uacute; y Rep. Dominicana entre noviembre y diciembre de 2025
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
                Hallazgos de las experiencias piloto
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {"Evaluaci\u00f3n de 119 usuarios en 4 universidades de 3 pa\u00edses latinoamericanos"}
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
            {"Datos obtenidos de las experiencias piloto internacionales de GlorIA (nov-dic 2025) con la Universidad de San Buenaventura (Colombia), Universidad Peruana de Ciencias Aplicadas, Universidad de San Mart\u00edn de Porres (Per\u00fa) y Universidad del Caribe (Rep. Dominicana). 100% de participantes firm\u00f3 consentimiento informado."}
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}
