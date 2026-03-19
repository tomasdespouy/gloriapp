import Link from "next/link";
import Image from "next/image";

export default function LandingFooter() {
  return (
    <footer className="bg-gray-900 text-white py-10 lg:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
          {/* Logo & tagline */}
          <div className="space-y-3">
            <Image src="/branding/gloria-side-logo.png" alt="GlorIA" width={112} height={28} className="h-7 w-auto" />
            <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
              {"Plataforma de entrenamiento cl\u00ednico con pacientes simulados por inteligencia artificial."}
            </p>
          </div>

          {/* Links */}
          <div className="space-y-3">
            <h4 className="font-semibold text-xs uppercase tracking-wider text-gray-400">
              Plataforma
            </h4>
            <nav className="flex flex-col gap-1.5">
              <Link
                href="/signup"
                className="text-gray-300 hover:text-white text-sm transition-colors"
              >
                Crear cuenta
              </Link>
              <Link
                href="/login"
                className="text-gray-300 hover:text-white text-sm transition-colors"
              >
                {"Iniciar sesi\u00f3n"}
              </Link>
              <Link
                href="/privacidad"
                className="text-gray-300 hover:text-white text-sm transition-colors"
              >
                {"Pol\u00edtica de Privacidad"}
              </Link>
              <Link
                href="/terminos"
                className="text-gray-300 hover:text-white text-sm transition-colors"
              >
                {"T\u00e9rminos y Condiciones"}
              </Link>
            </nav>
          </div>

          {/* University */}
          <div className="space-y-3">
            <h4 className="font-semibold text-xs uppercase tracking-wider text-gray-400">
              Proyecto impulsado por
            </h4>
            <div className="flex items-center">
              <Image src="/branding/ugm-logo.png" alt="Universidad Gabriela Mistral" width={160} height={40} className="h-10 w-auto" />
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-5">
          <p className="text-gray-500 text-xs text-center">
            &copy; 2026 GloriA. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
