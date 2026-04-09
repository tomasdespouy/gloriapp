"use client";

import { useState } from "react";

type Pilot = {
  id: string;
  name: string;
  institution: string;
  slug: string;
  consent_text: string;
  consent_version: string;
  test_mode: boolean;
  logo_url: string | null;
};

type Step = "data" | "consent" | "done";

type EnrollResponse = {
  success: true;
  email: string;
  // Only present when test_mode = true
  testMode?: boolean;
  tempPassword?: string;
  loginUrl?: string;
};

type Errors = Partial<
  Record<
    | "full_name"
    | "email"
    | "age"
    | "gender"
    | "role"
    | "university"
    | "signed_name"
    | "accepted"
    | "general",
    string
  >
>;

export default function EnrollmentClient({ pilot }: { pilot: Pilot }) {
  const [step, setStep] = useState<Step>("data");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  // Step 1 — personal data
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [role, setRole] = useState("");
  const [university, setUniversity] = useState(pilot.institution);

  // Step 2 — consent
  const [accepted, setAccepted] = useState(false);
  const [signedName, setSignedName] = useState("");

  // Step 3 — confirmation
  const [result, setResult] = useState<EnrollResponse | null>(null);

  function validateStep1(): boolean {
    const e: Errors = {};
    if (!fullName.trim()) e.full_name = "Ingresa tu nombre completo.";
    if (!email.trim()) e.email = "Ingresa tu correo.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      e.email = "Correo inválido.";
    const ageNum = parseInt(age, 10);
    if (!age) e.age = "Ingresa tu edad.";
    else if (isNaN(ageNum) || ageNum < 15 || ageNum > 99)
      e.age = "Edad debe estar entre 15 y 99.";
    if (!gender) e.gender = "Selecciona una opción.";
    if (!role) e.role = "Selecciona tu rol en el piloto.";
    if (!university.trim()) e.university = "Ingresa tu universidad o institución.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateStep2(): boolean {
    const e: Errors = {};
    if (!accepted) e.accepted = "Debes aceptar el consentimiento para continuar.";
    if (!signedName.trim())
      e.signed_name = "Escribe tu nombre completo como firma.";
    else if (
      signedName.trim().toLowerCase() !== fullName.trim().toLowerCase()
    )
      e.signed_name =
        "La firma debe coincidir exactamente con el nombre que ingresaste antes.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validateStep2()) return;
    setSubmitting(true);
    setErrors({});

    try {
      const res = await fetch(`/api/public/pilot-enroll/${pilot.slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          age: parseInt(age, 10),
          gender,
          role,
          university: university.trim(),
          signed_name: signedName.trim(),
          accepted: true,
          consent_version: pilot.consent_version,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors({
          general: data.error || "No pudimos procesar tu inscripción. Intenta nuevamente.",
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
      {/* Header */}
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
            Inscripción al piloto
          </span>
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 flex justify-center px-4 sm:px-6 py-10">
        <div className="w-full max-w-2xl">
          {/* Pilot title */}
          <div className="mb-8 text-center">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1A1A1A] mb-2">
              {pilot.name}
            </h1>
            <p className="text-sm text-gray-600">{pilot.institution}</p>
            {pilot.test_mode && (
              <div className="mt-4 inline-block bg-amber-50 border border-amber-200 rounded-full px-3 py-1 text-[11px] text-amber-800 font-medium">
                Modo de prueba: las credenciales se mostrarán en pantalla
              </div>
            )}
          </div>

          {/* Stepper */}
          <Stepper currentStep={step} />

          {/* Card */}
          <div className="bg-white border border-[#E5E5E5] rounded-2xl p-6 sm:p-10 shadow-sm">
            {step === "data" && (
              <Step1Data
                fullName={fullName}
                setFullName={setFullName}
                email={email}
                setEmail={setEmail}
                age={age}
                setAge={setAge}
                gender={gender}
                setGender={setGender}
                role={role}
                setRole={setRole}
                university={university}
                setUniversity={setUniversity}
                errors={errors}
                onNext={() => {
                  if (validateStep1()) setStep("consent");
                }}
              />
            )}

            {step === "consent" && (
              <Step2Consent
                consentText={pilot.consent_text}
                accepted={accepted}
                setAccepted={setAccepted}
                signedName={signedName}
                setSignedName={setSignedName}
                fullNameHint={fullName}
                errors={errors}
                submitting={submitting}
                onBack={() => setStep("data")}
                onSubmit={handleSubmit}
              />
            )}

            {step === "done" && result && (
              <Step3Done pilot={pilot} result={result} />
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
// Stepper
// ─────────────────────────────────────────────────────────────────────

function Stepper({ currentStep }: { currentStep: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "data", label: "Datos personales" },
    { key: "consent", label: "Consentimiento" },
    { key: "done", label: "Confirmación" },
  ];
  const idx = steps.findIndex((s) => s.key === currentStep);

  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center">
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold ${
              i <= idx
                ? "bg-[#4A55A2] text-white"
                : "bg-white border border-[#E5E5E5] text-gray-400"
            }`}
          >
            {i + 1}
          </div>
          <span
            className={`ml-2 text-xs hidden sm:inline ${
              i <= idx ? "text-[#1A1A1A] font-medium" : "text-gray-400"
            }`}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <div
              className={`mx-3 w-8 sm:w-12 h-px ${
                i < idx ? "bg-[#4A55A2]" : "bg-[#E5E5E5]"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Step 1 — personal data
// ─────────────────────────────────────────────────────────────────────

function Step1Data(props: {
  fullName: string;
  setFullName: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  age: string;
  setAge: (v: string) => void;
  gender: string;
  setGender: (v: string) => void;
  role: string;
  setRole: (v: string) => void;
  university: string;
  setUniversity: (v: string) => void;
  errors: Errors;
  onNext: () => void;
}) {
  const e = props.errors;
  return (
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        props.onNext();
      }}
      className="space-y-5"
    >
      <h2 className="text-lg font-semibold text-[#1A1A1A] mb-2">
        Cuéntanos quién eres
      </h2>
      <p className="text-sm text-gray-600 mb-6">
        Esta información se usa solo para vincular tu cuenta y para reportes
        agregados del piloto. No será compartida individualmente con terceros.
      </p>

      <Field label="Nombre completo" error={e.full_name}>
        <input
          type="text"
          autoComplete="name"
          value={props.fullName}
          onChange={(ev) => props.setFullName(ev.target.value)}
          className={inputCls(!!e.full_name)}
          placeholder="Ej: María Antonia Pérez González"
        />
      </Field>

      <Field
        label="Correo electrónico"
        hint="Aquí recibirás tus credenciales de acceso."
        error={e.email}
      >
        <input
          type="email"
          autoComplete="email"
          value={props.email}
          onChange={(ev) => props.setEmail(ev.target.value)}
          className={inputCls(!!e.email)}
          placeholder="tu@correo.cl"
        />
      </Field>

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

        <Field label="Género" error={e.gender}>
          <select
            value={props.gender}
            onChange={(ev) => props.setGender(ev.target.value)}
            className={inputCls(!!e.gender)}
          >
            <option value="">Selecciona</option>
            <option value="femenino">Femenino</option>
            <option value="masculino">Masculino</option>
            <option value="prefiere_no_decir">Prefiero no decir</option>
          </select>
        </Field>
      </div>

      <Field label="Rol en el piloto" error={e.role}>
        <select
          value={props.role}
          onChange={(ev) => props.setRole(ev.target.value)}
          className={inputCls(!!e.role)}
        >
          <option value="">Selecciona</option>
          <option value="estudiante">Estudiante</option>
          <option value="docente">Docente</option>
          <option value="coordinador">Coordinador/a</option>
        </select>
      </Field>

      <Field label="Universidad o institución" error={e.university}>
        <input
          type="text"
          value={props.university}
          onChange={(ev) => props.setUniversity(ev.target.value)}
          className={inputCls(!!e.university)}
          placeholder="Universidad…"
        />
      </Field>

      <button
        type="submit"
        className="w-full bg-[#4A55A2] hover:bg-[#5C6BB5] text-white font-semibold py-3 rounded-xl transition-colors mt-2"
      >
        Continuar al consentimiento
      </button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Step 2 — consent
// ─────────────────────────────────────────────────────────────────────

function Step2Consent(props: {
  consentText: string;
  accepted: boolean;
  setAccepted: (v: boolean) => void;
  signedName: string;
  setSignedName: (v: string) => void;
  fullNameHint: string;
  errors: Errors;
  submitting: boolean;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const e = props.errors;
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-[#1A1A1A]">
        Consentimiento informado
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

      <div className="bg-[#FAFAFA] border border-[#E5E5E5] rounded-xl p-5 max-h-96 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
        {props.consentText}
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={props.accepted}
          onChange={(ev) => props.setAccepted(ev.target.checked)}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-[#4A55A2] focus:ring-[#4A55A2]"
        />
        <span className="text-sm text-gray-800">
          He leído el consentimiento informado y acepto participar
          voluntariamente en este piloto. Autorizo el uso de mis datos para
          fines de investigación académica del proyecto, en condiciones de
          confidencialidad y agregación.
        </span>
      </label>
      {e.accepted && (
        <p className="text-xs text-red-600 -mt-3">{e.accepted}</p>
      )}

      <Field
        label="Firma (escribe tu nombre completo tal como lo ingresaste antes)"
        error={e.signed_name}
      >
        <input
          type="text"
          value={props.signedName}
          onChange={(ev) => props.setSignedName(ev.target.value)}
          className={inputCls(!!e.signed_name)}
          placeholder={props.fullNameHint || "Escribe aquí tu nombre completo"}
        />
      </Field>

      {e.general && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {e.general}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={props.onBack}
          disabled={props.submitting}
          className="flex-1 border border-[#E5E5E5] text-gray-700 font-medium py-3 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Volver
        </button>
        <button
          type="button"
          onClick={props.onSubmit}
          disabled={props.submitting}
          className="flex-1 bg-[#4A55A2] hover:bg-[#5C6BB5] text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50"
        >
          {props.submitting ? "Procesando…" : "Firmar y crear mi cuenta"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Step 3 — done
// ─────────────────────────────────────────────────────────────────────

function Step3Done({
  pilot,
  result,
}: {
  pilot: Pilot;
  result: EnrollResponse;
}) {
  return (
    <div className="text-center space-y-5">
      <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
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
      <h2 className="text-xl font-semibold text-[#1A1A1A]">¡Listo!</h2>
      <p className="text-sm text-gray-600 max-w-md mx-auto">
        Firmaste tu consentimiento y tu cuenta fue creada para el piloto{" "}
        <strong>{pilot.name}</strong>.
      </p>

      {pilot.test_mode && result.tempPassword ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-left">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-900 mb-3">
            Credenciales de prueba (no se envió email)
          </p>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-600">Email:</span>{" "}
              <span className="font-mono font-semibold">{result.email}</span>
            </div>
            <div>
              <span className="text-gray-600">Contraseña temporal:</span>{" "}
              <span className="font-mono font-semibold tracking-wide">
                {result.tempPassword}
              </span>
            </div>
            <div className="pt-3 border-t border-amber-200">
              <a
                href={result.loginUrl || "/login"}
                className="inline-block bg-[#4A55A2] hover:bg-[#5C6BB5] text-white font-semibold px-5 py-2 rounded-lg text-sm"
              >
                Ir al login
              </a>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[#F0F0FF] border border-[#D1D5FF] rounded-xl p-5 text-sm text-gray-700">
          Te enviamos las credenciales de acceso a{" "}
          <strong>{result.email}</strong>. Revisa tu bandeja de entrada y la
          carpeta de spam. Si no llega en los próximos 5 minutos, escríbenos
          a <strong>soporte@glor-ia.com</strong>.
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Field & helpers
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
