"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function CambiarClavePage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    // The temporary password follows the "Gloria_XXXXXX" pattern — block it so
    // the user can't keep (a variant of) the credential we emailed them.
    if (/^Gloria_/i.test(password)) {
      setError("Elige una contraseña distinta a la temporal que te enviamos.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    // Clear the must_change_password flag so the layout gate lets the user in.
    await fetch("/api/profile/clear-password-flag", { method: "POST" }).catch(() => {});

    // Full navigation so the server layout re-evaluates the (now cleared) gate.
    window.location.href = "/dashboard";
  };

  return (
    <>
      <div className="flex justify-center mb-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/branding/gloria-logo.png" alt="GlorIA" className="h-12 w-auto" />
      </div>

      <h2 className="text-lg font-semibold text-gray-900 text-center mb-2">
        Crea tu contraseña
      </h2>
      <p className="text-gray-500 text-sm text-center mb-6">
        Por seguridad, cambia la contraseña temporal antes de continuar.
      </p>

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
            placeholder="Mínimo 8 caracteres"
            autoFocus
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
              Guardando...
            </>
          ) : (
            "Guardar y continuar"
          )}
        </button>
      </form>
    </>
  );
}
