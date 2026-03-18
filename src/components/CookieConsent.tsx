"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie-consent");
    if (!consent) setVisible(true);
  }, []);

  const accept = () => {
    localStorage.setItem("cookie-consent", "accepted");
    setVisible(false);
  };

  if (!visible) return null;

  // Detect locale from URL path
  const locale =
    typeof window !== "undefined"
      ? window.location.pathname.startsWith("/en")
        ? "en"
        : window.location.pathname.startsWith("/pt")
          ? "pt"
          : "es"
      : "es";

  const texts: Record<string, { message: string; link: string; accept: string }> = {
    es: {
      message: "Utilizamos cookies esenciales para la autenticación y el funcionamiento de la plataforma, y cookies analíticas para mejorar tu experiencia. Al continuar navegando, aceptas su uso. Más información en nuestra",
      link: "Política de Privacidad",
      accept: "Aceptar",
    },
    en: {
      message: "We use essential cookies for authentication and platform functionality, and analytics cookies to improve your experience. By continuing to browse, you accept their use. More information in our",
      link: "Privacy Policy",
      accept: "Accept",
    },
    pt: {
      message: "Utilizamos cookies essenciais para autenticação e funcionamento da plataforma, e cookies analíticos para melhorar sua experiência. Ao continuar navegando, você aceita seu uso. Mais informações em nossa",
      link: "Política de Privacidade",
      accept: "Aceitar",
    },
  };

  const t = texts[locale] || texts.es;
  const privacyHref = locale === "es" ? "/privacidad" : `/${locale}/privacidad`;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9998] bg-white border-t border-gray-200 shadow-lg px-4 sm:px-6 py-4 animate-slide-up">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6">
        <p className="text-xs text-gray-600 leading-relaxed flex-1">
          {t.message}{" "}
          <Link href={privacyHref} className="text-sidebar underline hover:text-sidebar-hover">
            {t.link}
          </Link>.
        </p>
        <button
          onClick={accept}
          className="px-5 py-2 bg-sidebar text-white text-xs font-semibold rounded-lg hover:bg-sidebar-hover transition-colors flex-shrink-0"
        >
          {t.accept}
        </button>
      </div>
    </div>
  );
}
