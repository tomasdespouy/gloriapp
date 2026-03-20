"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Ingresa tu email.");
      return;
    }
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  return (
    <>
      {/* Logo */}
      <div className="flex justify-center mb-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/branding/gloria-logo.png" alt="GlorIA" className="h-12 w-auto" />
      </div>

      {/* Heading */}
      <h2 className="text-lg font-semibold text-gray-900 text-center mb-2">
        Recuperar contraseña
      </h2>
      <p className="text-gray-500 text-sm text-center mb-6">
        Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.
      </p>

      {success ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <svg className="mx-auto mb-3 text-green-500" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Correo enviado</h3>
          <p className="text-gray-600 text-sm mb-5">
            Si el email est&aacute; registrado, recibir&aacute;s un enlace para restablecer tu contrase&ntilde;a.
          </p>
          <Link
            href="/login"
            className="inline-block bg-[#0B1425] hover:bg-[#162a4a] text-white py-2.5 px-8 rounded-lg text-sm font-medium transition-colors"
          >
            Volver al login
          </Link>
        </div>
      ) : (
        <>
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${error ? "border-red-400" : "border-gray-300"}`}
                placeholder="tu@email.com"
              />
              {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0B1425] hover:bg-[#162a4a] text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Enviando...
                </>
              ) : (
                "Enviar enlace"
              )}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            <Link href="/login" className="text-blue-600 font-medium hover:underline">
              Volver a Iniciar Sesión
            </Link>
          </p>
        </>
      )}
    </>
  );
}
