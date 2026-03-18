"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
    setTimeout(() => router.push("/login"), 3000);
  };

  return (
    <>
      <div className="flex justify-center mb-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/branding/gloria-logo.png" alt="GlorIA" className="h-12 w-auto" />
      </div>

      <h2 className="text-lg font-semibold text-gray-900 text-center mb-2">
        Restablecer contraseña
      </h2>
      <p className="text-gray-500 text-sm text-center mb-6">
        Ingresa tu nueva contraseña.
      </p>

      {success ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Contraseña actualizada</h3>
          <p className="text-gray-600 text-sm mb-5">
            Tu contraseña ha sido cambiada exitosamente. Serás redirigido al login.
          </p>
          <Link
            href="/login"
            className="inline-block bg-[#0B1425] hover:bg-[#162a4a] text-white py-2.5 px-8 rounded-lg text-sm font-medium transition-colors"
          >
            Ir al login
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Nueva contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Confirmar contraseña
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
              className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${error ? "border-red-400" : "border-gray-300"}`}
              placeholder="Repite tu contraseña"
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
                Actualizando...
              </>
            ) : (
              "Cambiar contraseña"
            )}
          </button>
        </form>
      )}
    </>
  );
}
