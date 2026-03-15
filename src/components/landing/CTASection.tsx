import Link from "next/link";
import ScrollReveal from "./ScrollReveal";

export default function CTASection() {
  return (
    <section
      className="py-12 lg:py-16"
      style={{
        background:
          "linear-gradient(180deg, #FFFFFF 0%, #EEF0F9 50%, #E0E3F1 100%)",
      }}
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <ScrollReveal>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
            Comienza a practicar hoy
          </h2>
          <p className="text-gray-600 mb-6 max-w-xl mx-auto">
            Crea tu cuenta y empieza a entrenar tus habilidades clínicas con
            pacientes que responden como personas reales.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center font-semibold text-white bg-[#4A55A2] px-8 py-3.5 rounded-xl hover:bg-[#3D4890] transition-colors text-lg shadow-lg shadow-[#4A55A2]/25"
          >
            Crear cuenta gratis
          </Link>
          <p className="mt-3 text-sm text-gray-500">
            Ya tienes cuenta?{" "}
            <Link
              href="/login"
              className="text-[#4A55A2] hover:underline font-medium"
            >
              Iniciar sesión
            </Link>
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}
