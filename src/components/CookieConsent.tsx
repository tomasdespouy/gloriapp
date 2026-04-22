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
    <div
      className="fixed bottom-0 left-0 right-0 z-[9998] bg-white border-t border-gray-200 shadow-lg px-4 sm:px-6 py-2.5 sm:py-4 animate-slide-up"
      style={{ paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}
    >
      <div className="max-w-4xl mx-auto flex flex-row items-center gap-3 sm:gap-6">
        <p className="text-[11px] sm:text-xs text-gray-600 leading-snug sm:leading-relaxed flex-1 line-clamp-2 sm:line-clamp-none">
          {"Usamos cookies esenciales y anal\u00edticas para mejorar tu experiencia. Al continuar, aceptas su uso. "}
          <Link href="/privacidad" className="text-sidebar underline hover:text-sidebar-hover">
            {"Pol\u00edtica de Privacidad"}
          </Link>.
        </p>
        <button
          onClick={accept}
          className="px-4 sm:px-5 py-1.5 sm:py-2 bg-sidebar text-white text-[11px] sm:text-xs font-semibold rounded-lg hover:bg-sidebar-hover transition-colors flex-shrink-0"
        >
          Aceptar
        </button>
      </div>
    </div>
  );
}
