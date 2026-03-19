import { Users, MessageCircle, TrendingUp } from "lucide-react";
import ScrollReveal from "./ScrollReveal";

export default function HowItWorks() {
  const steps = [
    {
      number: "01",
      icon: Users,
      title: "Elige un paciente",
      description: "Selecciona entre pacientes con distintas historias, personalidades y niveles de dificultad cl\u00ednica.",
    },
    {
      number: "02",
      icon: MessageCircle,
      title: "Conversa en tiempo real",
      description: "Pr\u00e1ctica tus habilidades terap\u00e9uticas en una conversaci\u00f3n natural. El paciente reacciona a tu enfoque.",
    },
    {
      number: "03",
      icon: TrendingUp,
      title: "Reflexiona y mejora",
      description: "Recibe retroalimentaci\u00f3n sobre tu sesi\u00f3n y desarrolla tus competencias cl\u00ednicas progresivamente.",
    },
  ];

  return (
    <section id="como-funciona" className="bg-white py-12 lg:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
              Como funciona
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Tres pasos para comenzar a desarrollar tus habilidades cl&iacute;nicas
            </p>
          </div>
        </ScrollReveal>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-10">
          {steps.map((step, i) => (
            <ScrollReveal key={step.number} delay={i * 100}>
              <div className="text-center space-y-3">
                <span className="text-5xl font-bold text-[#4A55A2]/10">
                  {step.number}
                </span>
                <div className="w-12 h-12 mx-auto bg-[#4A55A2]/10 rounded-xl flex items-center justify-center">
                  <step.icon size={24} className="text-[#4A55A2]" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {step.title}
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
