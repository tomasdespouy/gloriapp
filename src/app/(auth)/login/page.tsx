"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const validate = (cleanEmail: string, cleanPassword: string) => {
    const errs: typeof errors = {};
    if (!cleanEmail) errs.email = "El email es obligatorio.";
    else if (/\s/.test(cleanEmail)) errs.email = "El email no puede contener espacios.";
    if (!cleanPassword) errs.password = "La contraseña es obligatoria.";
    else if (/\s/.test(cleanPassword)) errs.password = "La contraseña no puede contener espacios.";
    return errs;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    // Trim outer whitespace on email (common copy/paste mistake); passwords
    // stay as typed but are rejected if they contain any whitespace.
    const cleanEmail = email.trim();
    const cleanPassword = password;
    const errs = validate(cleanEmail, cleanPassword);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    if (cleanEmail !== email) setEmail(cleanEmail);
    setErrors({});
    setLoading(true);

    const supabase = createClient();
    const { error, data } = await supabase.auth.signInWithPassword({ email: cleanEmail, password: cleanPassword });

    if (error) {
      setErrors({ general: "Credenciales incorrectas. Intenta de nuevo." });
      setLoading(false);
      return;
    }

    // Redirect based on role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    const role = profile?.role;
    if (role === "admin" || role === "superadmin") {
      router.push("/admin/dashboard");
    } else if (role === "instructor") {
      router.push("/docente/dashboard");
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <>
      {/* Logo */}
      <div className="flex justify-center mb-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/branding/gloria-logo.png" alt="GlorIA" className="h-12 w-auto" />
      </div>

      {/* Heading */}
      <h2 className="text-lg font-semibold text-gray-900 text-center mb-6">
        Iniciar sesión
      </h2>

      {/* Form */}
      <form onSubmit={handleLogin} className="space-y-4">
        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            E-mail
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value.replace(/\s/g, "")); setErrors((p) => ({ ...p, email: undefined })); }}
            onBlur={(e) => setEmail(e.target.value.trim())}
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
              onChange={(e) => { setPassword(e.target.value.replace(/\s/g, "")); setErrors((p) => ({ ...p, password: undefined })); }}
              onKeyDown={(e) => { if (e.key === " ") e.preventDefault(); }}
              className={`w-full px-4 py-2.5 pr-10 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.password ? "border-red-400" : "border-gray-300"}`}
              placeholder="••••••••"
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
              Ingresando...
            </>
          ) : (
            "Entrar"
          )}
        </button>
      </form>

      {/* Recover password */}
      <div className="mt-6 text-center">
        <Link
          href="/forgot-password"
          className="text-blue-600 text-sm hover:underline"
        >
          Recuperar contraseña
        </Link>
      </div>

      {/* Signup link */}
      <p className="text-center text-sm text-gray-500 mt-4">
        No tienes cuenta?{" "}
        <Link href="/signup" className="text-blue-600 font-medium hover:underline">
          Regístrate
        </Link>
      </p>
    </>
  );
}
