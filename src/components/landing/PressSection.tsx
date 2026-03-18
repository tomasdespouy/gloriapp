"use client";

import { ExternalLink } from "lucide-react";
import ScrollReveal from "./ScrollReveal";

const PRESS_ITEMS = [
  {
    source: "Cooperativa Ciencia",
    title: "GlorIA: La IA chilena que actúa como paciente para entrenar a futuros psicólogos",
    excerpt: "Un equipo interdisciplinario creó identidades complejas de pacientes con historias de vida ricas, basadas en la distribución de patologías de salud mental más prevalentes en la población chilena.",
    url: "https://www.cooperativaciencia.cl/radiociencia/2026/01/27/gloria-la-ia-chilena-que-actua-como-paciente-para-entrenar-a-futuros-psicologos/",
    date: "27 enero 2026",
    highlight: true,
  },
  {
    source: "La Tercera",
    title: "Sergio Mena, rector de la U. Gabriela Mistral: \"Estamos en medio de la revolución del aprendizaje\"",
    excerpt: "El rector de la UGM discute cómo la universidad está incorporando IA en sus programas y desarrollando recursos educativos basados en inteligencia artificial.",
    url: "https://www.latercera.com/educacion/noticia/sergio-mena-rector-de-la-u-gabriela-mistral-estamos-en-medio-de-la-revolucion-del-aprendizaje/",
    date: "30 junio 2025",
    highlight: false,
  },
  {
    source: "Portal Innova",
    title: "100% de los docentes de la UGM se certifican en Inteligencia Artificial usando Google Cloud",
    excerpt: "Todos los docentes de la Universidad Gabriela Mistral completaron el programa de certificación en IA generativa de Google Cloud para educadores.",
    url: "https://portalinnova.cl/100-de-los-docentes-de-la-universidad-gabriela-mistral-se-certifican-en-inteligencia-artificial-usando-google-cloud/",
    date: "Agosto 2024",
    highlight: false,
  },
  {
    source: "G5 Noticias",
    title: "Psicóloga de la UGM advierte sobre la ética de la IA en salud mental",
    excerpt: "Fernanda Orrego, directora de la Escuela de Psicología de la UGM, analiza los desafíos éticos de la inteligencia artificial y su impacto en las relaciones interpersonales.",
    url: "https://g5noticias.cl/2025/10/11/psicologa-de-la-universidad-gabriela-mistral-advierte-que-la-ia-no-tiene-etica-y-no-le-interesa-el-bien-de-la-persona/",
    date: "11 octubre 2025",
    highlight: false,
  },
];

interface PressSectionProps {
  dict: Record<string, string>;
}

export default function PressSection({ dict }: PressSectionProps) {
  const t = (key: string) => dict[key] || key;
  return (
    <section className="bg-white py-16 lg:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
              {t("press.title")}
            </h2>
            <p className="text-gray-500 text-sm max-w-lg mx-auto">
              {t("press.subtitle")}
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {PRESS_ITEMS.map((item, i) => (
            <ScrollReveal key={i}>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`block rounded-xl border p-6 transition-all hover:shadow-md hover:-translate-y-0.5 group ${
                  item.highlight
                    ? "border-sidebar/20 bg-sidebar/[0.02] lg:col-span-2"
                    : "border-gray-200 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${
                        item.highlight ? "text-sidebar" : "text-gray-400"
                      }`}>
                        {item.source}
                      </span>
                      <span className="text-[10px] text-gray-300">·</span>
                      <span className="text-[10px] text-gray-400">{item.date}</span>
                    </div>
                    <h3 className="text-sm font-bold text-gray-900 mb-2 group-hover:text-sidebar transition-colors leading-snug">
                      {item.title}
                    </h3>
                    <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
                      {item.excerpt}
                    </p>
                  </div>
                  <ExternalLink size={14} className="text-gray-300 group-hover:text-sidebar transition-colors flex-shrink-0 mt-1" />
                </div>
              </a>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
