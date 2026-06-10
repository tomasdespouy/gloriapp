import Link from "next/link";
import ScrollReveal from "./ScrollReveal";

export default function CTASection() {
  return (
    <section
      className="py-16 lg:py-24"
      style={{
        background:
          "linear-gradient(180deg, #FFFFFF 0%, #EEF0F9 50%, #E0E3F1 100%)",
      }}
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <ScrollReveal>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
            {"¿Ya formas parte de GlorIA?"}
          </h2>
          <p className="text-gray-500 mb-8 max-w-xl mx-auto text-lg">
            Inicia sesión para continuar tu práctica con pacientes simulados por IA.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center font-semibold text-white bg-[#4A55A2] px-10 py-4 rounded-xl hover:bg-[#3D4890] transition-colors text-lg shadow-xl shadow-[#4A55A2]/25"
          >
            {"Iniciar sesión"}
          </Link>
        </ScrollReveal>
      </div>
    </section>
  );
}
