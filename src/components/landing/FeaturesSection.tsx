"use client";

import { Brain, Shield, BarChart3 } from "lucide-react";
import ScrollReveal from "./ScrollReveal";

const features = [
  {
    icon: Brain,
    title: "Pacientes con personalidad",
    description:
      "Cada paciente tiene rasgos de personalidad, mecanismos de defensa y respuestas emocionales únicas. Se abren si confian en ti, se cierran si te apuras.",
    highlights: [
      "Reacciones emocionales dinámicas",
      "Resistencia clínica realista",
      "Revelaciones graduales según la alianza",
    ],
    videoSlug: "lucia-mendoza",
  },
  {
    icon: Shield,
    title: "Entorno seguro para aprender",
    description:
      "Práctica sin miedo a equivocarte. Explora distintos enfoques terapéuticos, comete errores y aprende de ellos sin consecuencias reales.",
    highlights: [
      "Sin riesgo para pacientes reales",
      "Práctica ilimitada las 24 horas",
      "Ideal para complementar tu formación",
    ],
    videoSlug: "marcos-herrera",
  },
  {
    icon: BarChart3,
    title: "Retroalimentación inteligente",
    description:
      "Al finalizar cada sesión, recibe una reflexión sobre tu desempeno. Identifica fortalezas y areas de mejora en tus habilidades clínicas.",
    highlights: [
      "Analisis post-sesión con IA",
      "Seguimiento de competencias",
      "Mejora continua y medible",
    ],
    videoSlug: "carmen-torres",
  },
];

export default function FeaturesSection() {
  return (
    <section className="bg-white py-12 lg:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
              Por que elegir GloriA
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Herramientas disenadas para la formación clínica del siglo XXI
            </p>
          </div>
        </ScrollReveal>

        <div className="space-y-10">
          {features.map((feature, i) => (
            <ScrollReveal key={feature.title}>
              <div
                className={`flex flex-col ${
                  i % 2 === 1 ? "lg:flex-row-reverse" : "lg:flex-row"
                } gap-8 items-center`}
              >
                {/* Video circle */}
                <div className="flex-shrink-0 flex justify-center">
                  <div className="w-40 h-40 lg:w-52 lg:h-52 rounded-full overflow-hidden bg-[#4A55A2] border-4 border-[#4A55A2]/10 shadow-lg">
                    <video
                      src={`/patients/${feature.videoSlug}.mp4`}
                      poster={`/patients/${feature.videoSlug}.webp`}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.style.display = "none";
                        const el = target.parentElement!;
                        el.classList.add("flex", "items-center", "justify-center");
                        const icon = document.createElement("div");
                        icon.innerHTML = `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`;
                        el.appendChild(icon);
                      }}
                    />
                  </div>
                </div>

                {/* Text */}
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#4A55A2]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <feature.icon size={20} className="text-[#4A55A2]" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">
                      {feature.title}
                    </h3>
                  </div>
                  <p className="text-gray-600 leading-relaxed">
                    {feature.description}
                  </p>
                  <ul className="space-y-1.5">
                    {feature.highlights.map((h) => (
                      <li
                        key={h}
                        className="flex items-center gap-2 text-sm text-gray-700"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-[#4A55A2] flex-shrink-0" />
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
