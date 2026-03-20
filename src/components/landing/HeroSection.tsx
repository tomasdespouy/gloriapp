"use client";

import Link from "next/link";
import Image from "next/image";
import ScrollReveal from "./ScrollReveal";

export default function HeroSection() {
  return (
    <section className="relative min-h-[calc(100vh-64px)] flex items-center overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0">
        <Image
          src="/branding/hero-bg.jpg"
          alt=""
          fill
          priority
          className="object-cover"
        />
        {/* Light overlay to ensure readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#2D3561]/60 via-[#2D3561]/50 to-[#4A55A2]/40" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 text-center">
        <ScrollReveal>
          {/* Title */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.08] mb-6">
            {"Formaci\u00f3n cl\u00ednica que el "}
            <span className="text-[#C5CAE9]">futuro necesita</span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-white/80 max-w-2xl mx-auto mb-10 leading-relaxed">
            Pr&aacute;ctica terap&eacute;utica con pacientes simulados por IA. Un entorno seguro para aprender, equivocarte y crecer.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center font-semibold text-white bg-[#4A55A2] px-8 py-3.5 rounded-xl hover:bg-[#5C6BB5] transition-colors text-base shadow-lg shadow-[#4A55A2]/30"
            >
              Comienza tu Pr&aacute;ctica
              <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
            <a
              href="#contacto"
              onClick={(e) => {
                e.preventDefault();
                const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
                document.getElementById("contacto")?.scrollIntoView({ behavior: prefersReduced ? "instant" : "smooth" });
              }}
              className="inline-flex items-center justify-center font-medium text-white/90 border border-white/30 px-8 py-3.5 rounded-xl hover:bg-white/10 transition-colors text-base"
            >
              Solicitar demo
            </a>
          </div>
        </ScrollReveal>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent" />
    </section>
  );
}
