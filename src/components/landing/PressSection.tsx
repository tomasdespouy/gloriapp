"use client";

import { ExternalLink } from "lucide-react";
import ScrollReveal from "./ScrollReveal";
import { PRESS_ITEMS } from "@/lib/press-items";

export default function PressSection() {
  return (
    <section id="noticias" className="bg-white py-16 lg:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
              GlorIA en los medios
            </h2>
            <p className="text-gray-500 text-sm max-w-lg mx-auto">
              {"Lo que dicen sobre la plataforma y la innovaci\u00f3n en formaci\u00f3n cl\u00ednica con IA."}
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
                      <span className="text-[10px] text-gray-300">&middot;</span>
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
