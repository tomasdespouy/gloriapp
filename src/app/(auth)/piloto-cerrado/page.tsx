"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const MESSAGES: Record<string, { title: string; body: string }> = {
  not_yet: {
    title: "El piloto aún no ha comenzado",
    body: "Tu acceso a GlorIA estará disponible en la fecha y hora indicadas en tu correo de invitación. Recibirás acceso automáticamente cuando se inicie el piloto.",
  },
  ended: {
    title: "El piloto ha finalizado",
    body: "El periodo de acceso al piloto en GlorIA ha terminado. Si necesitas continuar usando la plataforma, contacta al equipo a soporte@glor-ia.com.",
  },
  cancelado: {
    title: "El piloto fue desactivado",
    body: "El piloto en el que participabas ha sido desactivado por el administrador. Si crees que es un error, contacta a soporte@glor-ia.com.",
  },
};

function PilotoCerradoContent() {
  const params = useSearchParams();
  const reason = params.get("reason") || "ended";
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    // Sign out so the user can't bounce back into the app via cached cookies
    const supabase = createClient();
    supabase.auth.signOut().finally(() => setSignedOut(true));
  }, []);

  const msg = MESSAGES[reason] || MESSAGES.ended;

  return (
    <>
      <div className="flex justify-center mb-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/branding/gloria-logo.png" alt="GlorIA" className="h-12 w-auto" />
      </div>

      <h2 className="text-lg font-semibold text-gray-900 text-center mb-2">
        {msg.title}
      </h2>

      <p className="text-sm text-gray-600 text-center leading-relaxed mb-6">
        {msg.body}
      </p>

      <Link
        href="/login"
        className="block w-full text-center bg-[#0B1425] hover:bg-[#162a4a] text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
      >
        Volver al inicio
      </Link>

      {!signedOut && (
        <p className="text-[11px] text-gray-400 text-center mt-3">
          Cerrando tu sesión…
        </p>
      )}
    </>
  );
}

export default function PilotoCerradoPage() {
  return (
    <Suspense fallback={<div className="text-sm text-gray-400 text-center py-8">Cargando…</div>}>
      <PilotoCerradoContent />
    </Suspense>
  );
}
