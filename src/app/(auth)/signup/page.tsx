"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

function getPasswordStrength(password: string): { level: number; label: string; color: string } {
  if (!password) return { level: 0, label: "", color: "bg-gray-200" };
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { level: 1, label: "Debil", color: "bg-red-400" };
  if (score <= 2) return { level: 2, label: "Regular", color: "bg-orange-400" };
  if (score <= 3) return { level: 3, label: "Buena", color: "bg-yellow-400" };
  return { level: 4, label: "Fuerte", color: "bg-green-500" };
}

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ fullName?: string; email?: string; password?: string; general?: string }>({});
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const strength = getPasswordStrength(password);

  const validate = () => {
    const errs: typeof errors = {};
    if (!fullName.trim()) errs.fullName = "El nombre es obligatorio.";
    if (!email) errs.email = "El email es obligatorio.";
    if (!password) errs.password = "La contraseña es obligatoria.";
    else if (password.length < 6) errs.password = "Mínimo 6 caracteres.";
    return errs;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });

    if (error) {
      setErrors({ general: error.message });
      setLoading(false);
      return;
    }

    // Supabase returns identities: [] when the email already exists
    if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
      setErrors({ email: "Este correo ya est\u00e1 registrado. Intenta iniciar sesi\u00f3n." });
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div className="text-center">
        <div className="flex justify-center mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/branding/gloria-logo.png" alt="GlorIA" className="h-12 w-auto" />
        </div>

        <div className="bg-green-50 border border-green-200 rounded-xl p-6">
          <svg className="mx-auto mb-3 text-green-500" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Cuenta creada</h2>
          <p className="text-gray-600 text-sm mb-5">
            Revisa tu correo para confirmar tu cuenta. Luego podrás iniciar sesión.
          </p>
          <Link
            href="/login"
            className="inline-block bg-[#0B1425] hover:bg-[#162a4a] text-white py-2.5 px-8 rounded-lg text-sm font-medium transition-colors"
          >
            Ir a Iniciar Sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Logo */}
      <div className="flex justify-center mb-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/branding/gloria-logo.png" alt="GlorIA" className="h-12 w-auto" />
      </div>

      {/* Heading */}
      <h2 className="text-lg font-semibold text-gray-900 text-center mb-6">
        Crea tu cuenta
      </h2>

      {/* Form */}
      <form onSubmit={handleSignup} className="space-y-4">
        {/* Full name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Nombre completo
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => { setFullName(e.target.value); setErrors((p) => ({ ...p, fullName: undefined })); }}
            className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.fullName ? "border-red-400" : "border-gray-300"}`}
            placeholder="Juan Perez"
          />
          {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName}</p>}
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            E-mail
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined })); }}
            className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.email ? "border-red-400" : "border-gray-300"}`}
            placeholder="tu@email.com"
          />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Contraseña
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined })); }}
              className={`w-full px-4 py-2.5 pr-10 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.password ? "border-red-400" : "border-gray-300"}`}
              placeholder="Mínimo 6 caracteres"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              tabIndex={-1}
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
          {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}

          {/* Password strength indicator */}
          {password && (
            <div className="mt-2">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                      i <= strength.level ? strength.color : "bg-gray-200"
                    }`}
                  />
                ))}
              </div>
              <p className={`text-xs mt-1 ${
                strength.level <= 1 ? "text-red-500" :
                strength.level <= 2 ? "text-orange-500" :
                strength.level <= 3 ? "text-yellow-600" :
                "text-green-600"
              }`}>
                {strength.label}
              </p>
            </div>
          )}
        </div>

        {/* General error */}
        {errors.general && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
            <p className="text-red-600 text-sm">{errors.general}</p>
          </div>
        )}

        {/* Submit */}
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
              Creando cuenta...
            </>
          ) : (
            "Registrarme"
          )}
        </button>
      </form>

      {/* Login link */}
      <p className="text-center text-sm text-gray-500 mt-6">
        Ya tienes cuenta?{" "}
        <Link href="/login" className="text-blue-600 font-medium hover:underline">
          Iniciar Sesión
        </Link>
      </p>
    </>
  );
}
