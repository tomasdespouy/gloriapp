import { Quote } from "lucide-react";
import ScrollReveal from "./ScrollReveal";

export default function TestimonialsSection() {
  const testimonials = [
    {
      quote: "Me gusta que simula perfectamente un paciente de la edad que le corresponde. Se expresa igual, tiene una problem\u00e1tica acorde a la edad y realmente parece que est\u00e1s hablando con una persona.",
      name: "Docente UPC",
      year: "28 a\u00f1os",
      career: "Universidad Peruana de Ciencias Aplicadas, Per\u00fa",
    },
    {
      quote: "La interacci\u00f3n con el paciente del simulador fue una experiencia fascinante para m\u00ed. Al principio ten\u00eda temor de equivocarme, pero al final entend\u00ed que era justo para esto: ayudarnos como futuros psic\u00f3logos a interactuar en una consulta.",
      name: "Estudiante UNICARIBE",
      year: "37 a\u00f1os",
      career: "Universidad del Caribe, Rep. Dominicana",
    },
    {
      quote: "La presentaci\u00f3n del caso fue muy acertada y cercana a lo que se puede presentar en la vida real. El personaje sostuvo la l\u00ednea de su motivo de consulta y aquello que le aquejaba.",
      name: "Estudiante USB Cali",
      year: "19 a\u00f1os",
      career: "Universidad de San Buenaventura, Colombia",
    },
    {
      quote: "Nunca hab\u00eda realizado un proceso de evaluaci\u00f3n a un paciente. Me ayud\u00f3 bastante a entender el cuidado de las preguntas y la importancia de preguntar ciertas cosas cuidadosamente para poder saber c\u00f3mo ayudarlo.",
      name: "Estudiante USMP",
      year: "22 a\u00f1os",
      career: "Universidad de San Mart\u00edn de Porres, Per\u00fa",
    },
    {
      quote: "Es una herramienta muy valiosa e importante para los estudiantes de psicolog\u00eda. Est\u00e1 incre\u00edble que ahora se pueda usar la IA como un apoyo para formarnos como profesionales, adem\u00e1s de que ayuda a practicar continuamente.",
      name: "Estudiante UPC",
      year: "23 a\u00f1os",
      career: "Universidad Peruana de Ciencias Aplicadas, Per\u00fa",
    },
    {
      quote: "Tener esta experiencia virtual es una forma en la que nosotros podemos practicar y sentirnos un poco m\u00e1s preparados al momento de tener un acercamiento con un paciente en la vida real.",
      name: "Estudiante USB Cali",
      year: "24 a\u00f1os",
      career: "Universidad de San Buenaventura, Colombia",
    },
  ];

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
              Voces de los pilotos internacionales
            </h2>
            <p className="text-white/70 max-w-2xl mx-auto">
              119 estudiantes y docentes de 4 universidades en Colombia, Per&uacute; y Rep. Dominicana ya entrenaron con GlorIA
            </p>
          </div>
        </ScrollReveal>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
          {testimonials.map((item, i) => (
            <ScrollReveal key={`${item.name}-${i}`} delay={i * 100}>
              <div className="bg-white rounded-xl p-6 shadow-lg h-full flex flex-col">
                <Quote size={24} className="text-[#4A55A2]/30 mb-3" />
                <p className="text-sm text-gray-700 leading-relaxed flex-1 mb-4">
                  {item.quote}
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#4A55A2]/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-[#4A55A2]">
                      {item.name.split(" ").map((n) => n[0]).join("")}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-500">
                      {item.year} &middot; {item.career}
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
