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

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9998] bg-white border-t border-gray-200 shadow-lg px-4 sm:px-6 py-4 animate-slide-up">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6">
        <p className="text-xs text-gray-600 leading-relaxed flex-1">
          {"Utilizamos cookies esenciales para la autenticaci\u00f3n y el funcionamiento de la plataforma, y cookies anal\u00edticas para mejorar tu experiencia. Al continuar navegando, aceptas su uso. M\u00e1s informaci\u00f3n en nuestra "}
          <Link href="/privacidad" className="text-sidebar underline hover:text-sidebar-hover">
            {"Pol\u00edtica de Privacidad"}
          </Link>.
        </p>
        <button
          onClick={accept}
          className="px-5 py-2 bg-sidebar text-white text-xs font-semibold rounded-lg hover:bg-sidebar-hover transition-colors flex-shrink-0"
        >
          Aceptar
        </button>
      </div>
    </div>
  );
}
