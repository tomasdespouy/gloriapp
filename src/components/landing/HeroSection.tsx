"use client";

import Link from "next/link";
import ScrollReveal from "./ScrollReveal";

export default function HeroSection() {
  return (
    <section className="min-h-[calc(100vh-64px)] flex items-center bg-white pt-16 relative overflow-hidden">
      {/* Decorative background blurs */}
      <div className="absolute top-20 left-1/4 w-72 h-72 bg-[#4A55A2]/5 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-1/4 w-80 h-80 bg-[#4DD0E1]/8 rounded-full blur-3xl" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14 text-center relative z-10">
        <ScrollReveal>
          <div className="space-y-6">
            {/* UGM Badge */}
            <div className="flex justify-center">
              <div className="inline-flex items-center gap-2 bg-[#4A55A2]/8 px-4 py-1.5 rounded-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/universities/ugm.png"
                  alt="Universidad Gabriela Mistral"
                  className="h-5 w-auto"
                />
                <span className="text-xs text-[#4A55A2] font-medium">
                  Universidad Gabriela Mistral
                </span>
              </div>
            </div>

            {/* Main headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-[1.1] max-w-3xl mx-auto">
              Formando a los{" "}
              <span className="text-[#4A55A2]">psicolog@s</span> que el
              futuro necesita
            </h1>

            {/* Subtitle */}
            <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Practica terapéutica con pacientes simulados por IA. Un entorno
              seguro para aprender, equivocarte y crecer.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center font-medium text-white bg-[#4A55A2] px-8 py-3.5 rounded-xl hover:bg-[#3D4890] transition-colors text-base shadow-lg shadow-[#4A55A2]/20"
              >
                Comenzar gratis
              </Link>
              <a
                href="#como-funciona"
                onClick={(e) => {
                  e.preventDefault();
                  document
                    .getElementById("como-funciona")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
                className="inline-flex items-center justify-center font-medium text-[#4A55A2] border border-[#4A55A2]/30 px-8 py-3.5 rounded-xl hover:bg-[#4A55A2]/5 transition-colors text-base"
              >
                Ver como funciona
              </a>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
