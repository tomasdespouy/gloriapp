import { Quote } from "lucide-react";
import ScrollReveal from "./ScrollReveal";

export interface Testimonial {
  quote: string;
  name: string;
  year: string;
  career: string;
}

const fallbackTestimonials: Testimonial[] = [
  {
    quote:
      "Antes de GloriA, mi única práctica era con compañeros haciendo role-play. Conversar con un paciente que realmente reacciona a lo que digo cambió mi forma de entender la terapia.",
    name: "Valentina Rojas",
    year: "4to año",
    career: "Psicología Clínica",
  },
  {
    quote:
      "Me ayudó mucho a manejar silencios y pacientes resistentes. Con Carmen aprendí que presionar no funciona, y esa lección me la llevé a mi práctica profesional.",
    name: "Sebastián Contreras",
    year: "5to año",
    career: "Psicología Clínica",
  },
  {
    quote:
      "Lo uso antes de cada evaluación práctica. Puedo repetir la sesión, probar distintos enfoques y ver cómo cambia la respuesta del paciente. Es como un simulador de vuelo para terapeutas.",
    name: "Catalina Muñoz",
    year: "3er año",
    career: "Psicología",
  },
];

export default function TestimonialsSection({
  testimonials: externalTestimonials,
}: {
  testimonials?: Testimonial[];
}) {
  const testimonials =
    externalTestimonials && externalTestimonials.length > 0
      ? externalTestimonials
      : fallbackTestimonials;
  return (
    <section
      id="testimonios"
      className="py-12 lg:py-16"
      style={{
        background: "linear-gradient(135deg, #4A55A2 0%, #354080 100%)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">
              Lo que dicen nuestros estudiantes
            </h2>
            <p className="text-white/70 max-w-2xl mx-auto">
              Experiencias de quienes ya entrenan con GloriA
            </p>
          </div>
        </ScrollReveal>

        <div className="grid md:grid-cols-3 gap-5 lg:gap-6">
          {testimonials.map((t, i) => (
            <ScrollReveal key={t.name} delay={i * 100}>
              <div className="bg-white rounded-xl p-6 shadow-lg h-full flex flex-col">
                <Quote size={24} className="text-[#4A55A2]/30 mb-3" />
                <p className="text-sm text-gray-700 leading-relaxed flex-1 mb-4">
                  {t.quote}
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#4A55A2]/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-[#4A55A2]">
                      {t.name.split(" ").map((n) => n[0]).join("")}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{t.name}</p>
                    <p className="text-xs text-gray-500">
                      {t.year} &middot; {t.career}
                    </p>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
