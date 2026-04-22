"use client";

import { useState } from "react";
import { ConsentRenderer } from "@/lib/consent-render";

type Pilot = {
  id: string;
  name: string;
  institution: string;
  slug: string;
  consent_text: string;
  consent_version: string;
  logo_url: string | null;
};

type Step = "consent" | "done";

type EnrollResponse = {
  success: true;
  anonymous: true;
  email: string;
  tempPassword: string;
  loginUrl: string;
};

type Errors = Partial<
  Record<"accepted" | "age" | "role" | "general", string>
>;

export default function AnonEnrollmentClient({ pilot }: { pilot: Pilot }) {
  const [step, setStep] = useState<Step>("consent");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const [accepted, setAccepted] = useState(false);
  const [age, setAge] = useState("");
  const [role, setRole] = useState("");

  const [result, setResult] = useState<EnrollResponse | null>(null);

  function validate(): boolean {
    const e: Errors = {};
    if (!accepted) {
      e.accepted = "Debes marcar “Acepto” para continuar.";
    }
    if (age.trim() !== "") {
      const n = parseInt(age, 10);
      if (isNaN(n) || n < 15 || n > 99) {
        e.age = "La edad debe estar entre 15 y 99.";
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);
    setErrors({});

    try {
      const body: Record<string, unknown> = {
        accepted: true,
        consent_version: pilot.consent_version,
      };
      if (age.trim() !== "") body.age = parseInt(age, 10);
      if (role !== "") body.role = role;

      const res = await fetch(
        `/api/public/pilot-enroll-anon/${pilot.slug}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setErrors({
          general:
            data.error ||
            "No pudimos procesar tu inscripción. Intenta nuevamente.",
        });
        setSubmitting(false);
        return;
      }
      setResult(data as EnrollResponse);
      setStep("done");
    } catch {
      setErrors({
        general:
          "Error de conexión. Verifica tu internet y vuelve a intentarlo.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col">
      <header className="bg-white border-b border-[#E5E5E5]">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/branding/gloria-logo.png"
              alt="GlorIA"
              className="h-9 w-auto"
            />
            {pilot.logo_url && (
              <>
                <span className="text-gray-300 text-xl font-light">×</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pilot.logo_url}
                  alt={pilot.institution}
                  className="h-9 w-auto object-contain"
                />
              </>
            )}
          </div>
          <span className="text-xs text-gray-500 font-medium hidden sm:inline">
            Inscripción anónima
          </span>
        </div>
      </header>

      <main className="flex-1 flex justify-center px-4 sm:px-6 py-10">
        <div className="w-full max-w-2xl">
          <div className="mb-8 text-center">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1A1A1A] mb-2">
              {pilot.name}
            </h1>
            <p className="text-sm text-gray-600">{pilot.institution}</p>
            <div className="mt-4 inline-block bg-[#F0F0FF] border border-[#D1D5FF] rounded-full px-3 py-1 text-[11px] text-[#4A55A2] font-medium">
              Participación anónima — no se piden datos personales
            </div>
          </div>

          <div className="bg-white border border-[#E5E5E5] rounded-2xl p-6 sm:p-10 shadow-sm">
            {step === "consent" && (
              <StepConsent
                consentText={pilot.consent_text}
                accepted={accepted}
                setAccepted={setAccepted}
                age={age}
                setAge={setAge}
                role={role}
                setRole={setRole}
                errors={errors}
                submitting={submitting}
                onSubmit={handleSubmit}
              />
            )}

            {step === "done" && result && (
              <StepDone pilot={pilot} result={result} />
            )}
          </div>

          <p className="text-center text-xs text-gray-400 mt-8">
            GlorIA — Plataforma de entrenamiento clínico con inteligencia artificial
          </p>
        </div>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Step — consent
// ─────────────────────────────────────────────────────────────────────

function StepConsent(props: {
  consentText: string;
  accepted: boolean;
  setAccepted: (v: boolean) => void;
  age: string;
  setAge: (v: string) => void;
  role: string;
  setRole: (v: string) => void;
  errors: Errors;
  submitting: boolean;
  onSubmit: () => void;
}) {
  const e = props.errors;
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-[#1A1A1A]">
        Consentimiento informado — participación anónima
      </h2>
      <p className="text-sm text-gray-600">
        Lee con calma. Si tienes dudas, escríbenos a{" "}
        <a
          href="mailto:soporte@glor-ia.com"
          className="text-[#4A55A2] underline"
        >
          soporte@glor-ia.com
        </a>{" "}
        antes de aceptar.
      </p>

      <ConsentRenderer
        text={props.consentText}
        className="bg-[#FAFAFA] border border-[#E5E5E5] rounded-xl p-5 text-sm leading-relaxed text-gray-800"
      />

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-900 mb-1.5">
          Importante
        </p>
        <p className="text-xs text-amber-900 leading-relaxed">
          Al ser una participación anónima, tus credenciales de acceso se
          generarán automáticamente y se mostrarán una sola vez en la siguiente
          pantalla. Guárdalas en un lugar seguro: si las pierdes, no hay forma
          de recuperar tu cuenta ni las conversaciones.
        </p>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={props.accepted}
          onChange={(ev) => props.setAccepted(ev.target.checked)}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-[#4A55A2] focus:ring-[#4A55A2]"
        />
        <span className="text-sm text-gray-800">
          He leído y comprendo el consentimiento informado. Acepto participar
          de forma anónima y entiendo que las credenciales son únicas y no se
          pueden recuperar.
        </span>
      </label>
      {e.accepted && (
        <p className="text-xs text-red-600 -mt-3">{e.accepted}</p>
      )}

      <div className="border-t border-[#E5E5E5] pt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
          Opcional — solo para análisis agregado
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field label="Edad" error={e.age}>
            <input
              type="number"
              min={15}
              max={99}
              value={props.age}
              onChange={(ev) => props.setAge(ev.target.value)}
              className={inputCls(!!e.age)}
              placeholder="Ej: 22"
            />
          </Field>
          <Field label="Rol">
            <select
              value={props.role}
              onChange={(ev) => props.setRole(ev.target.value)}
              className={inputCls(false)}
            >
              <option value="">Selecciona</option>
              <option value="estudiante">Estudiante</option>
              <option value="docente">Docente</option>
              <option value="coordinador">Coordinador/a</option>
            </select>
          </Field>
        </div>
        <p className="text-[11px] text-gray-500 mt-2">
          Estos datos no te identifican y solo se usan para reportes agregados
          del piloto.
        </p>
      </div>

      {e.general && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {e.general}
        </div>
      )}

      <button
        type="button"
        onClick={props.onSubmit}
        disabled={props.submitting}
        className="w-full bg-[#4A55A2] hover:bg-[#5C6BB5] text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50"
      >
        {props.submitting ? "Procesando…" : "Acepto y generar mi cuenta"}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Step — done
// ─────────────────────────────────────────────────────────────────────

function StepDone({
  pilot,
  result,
}: {
  pilot: Pilot;
  result: EnrollResponse;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    const text = credentialsText({ pilot, result });
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => setCopied(false),
    );
  }

  function handleDownload() {
    const text = credentialsText({ pilot, result });
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `credenciales-gloria-${pilot.slug}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-4">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#10B981"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-[#1A1A1A]">
          Firma registrada
        </h2>
        <p className="text-sm text-gray-600 max-w-md mx-auto mt-2">
          Tu cuenta anónima para el piloto <strong>{pilot.name}</strong> fue
          creada. Guarda estas credenciales antes de continuar.
        </p>
      </div>

      <div className="bg-[#FAFAFA] border border-[#E5E5E5] rounded-xl p-5 text-left">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
          Tus credenciales (únicas, no se pueden recuperar)
        </p>
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-gray-500 text-xs mb-0.5">Email</p>
            <p className="font-mono font-semibold break-all">{result.email}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-0.5">Contraseña</p>
            <p className="font-mono font-semibold tracking-wide text-[#4A55A2]">
              {result.tempPassword}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-xs text-amber-900 leading-relaxed">
          <strong>Importante:</strong> descarga o copia estas credenciales
          ahora. Al salir de esta página no habrá forma de volver a verlas.
          Nadie en GlorIA podrá recuperarlas por ti: es el precio del anonimato.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={handleDownload}
          className="border border-[#4A55A2] text-[#4A55A2] hover:bg-[#F0F0FF] font-semibold py-3 rounded-xl transition-colors"
        >
          Descargar credenciales (.txt)
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className="border border-[#E5E5E5] text-gray-700 hover:bg-gray-50 font-semibold py-3 rounded-xl transition-colors"
        >
          {copied ? "Copiado al portapapeles" : "Copiar al portapapeles"}
        </button>
      </div>

      <div className="pt-2 text-center">
        <a
          href={result.loginUrl}
          className="inline-block bg-[#4A55A2] hover:bg-[#5C6BB5] text-white font-semibold px-6 py-3 rounded-xl text-sm"
        >
          Ir al login
        </a>
      </div>
    </div>
  );
}

function credentialsText({
  pilot,
  result,
}: {
  pilot: Pilot;
  result: EnrollResponse;
}): string {
  return [
    "GlorIA — Credenciales de acceso (participación anónima)",
    "",
    `Piloto: ${pilot.name}`,
    `Institución: ${pilot.institution}`,
    "",
    `Email: ${result.email}`,
    `Contraseña: ${result.tempPassword}`,
    "",
    `Login: ${result.loginUrl}`,
    "",
    "IMPORTANTE: estas credenciales son únicas y no se pueden recuperar.",
    "Si las pierdes, perderás el acceso a tu cuenta y a las conversaciones.",
  ].join("\n");
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#1A1A1A] mb-1.5">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

function inputCls(hasError: boolean) {
  const base =
    "w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4A55A2] focus:border-[#4A55A2] bg-white";
  return hasError ? `${base} border-red-400` : `${base} border-[#E5E5E5]`;
}
