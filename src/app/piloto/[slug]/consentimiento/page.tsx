import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import EnrollmentClient from "./EnrollmentClient";

// Public, unauthenticated landing for pilot self-enrollment.
// URL: /piloto/{enrollment_slug}/consentimiento
// Whitelisted in src/lib/supabase/middleware.ts.

export const dynamic = "force-dynamic";

type PilotForEnrollment = {
  id: string;
  name: string;
  institution: string;
  enrollment_slug: string;
  consent_text: string | null;
  consent_version: string;
  test_mode: boolean;
  status: string;
  ended_at: string | null;
};

export default async function PilotEnrollmentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const admin = createAdminClient();

  const { data: pilot } = await admin
    .from("pilots")
    .select(
      "id, name, institution, enrollment_slug, consent_text, consent_version, test_mode, status, ended_at",
    )
    .eq("enrollment_slug", slug)
    .maybeSingle<PilotForEnrollment>();

  if (!pilot) {
    notFound();
  }

  // Reject pilots that aren't open for enrollment
  if (pilot.status === "cancelado") {
    return (
      <ClosedNotice
        title="Piloto no disponible"
        message="Este piloto fue desactivado. Si crees que es un error, escríbenos a soporte@glor-ia.com."
      />
    );
  }
  if (pilot.status === "finalizado") {
    return (
      <ClosedNotice
        title="Piloto finalizado"
        message="El período de inscripción de este piloto ya terminó. Para más información, escríbenos a soporte@glor-ia.com."
      />
    );
  }
  if (pilot.ended_at && new Date(pilot.ended_at) < new Date()) {
    return (
      <ClosedNotice
        title="Piloto cerrado"
        message="La fecha de cierre de este piloto ya pasó. Si necesitas acceso, contacta al equipo de GlorIA."
      />
    );
  }

  // The consent text may be empty for new pilots — fall back to a generic
  // placeholder so the page never crashes during early authoring.
  const defaultConsent =
    "Al firmar este formulario, acepto participar voluntariamente en el piloto institucional " +
    "de GlorIA y autorizo el uso de mis datos de práctica clínica simulada para fines de " +
    "investigación académica en el marco del proyecto. Mis datos serán tratados de forma " +
    "confidencial y agregada en cualquier publicación o reporte.";

  return (
    <EnrollmentClient
      pilot={{
        id: pilot.id,
        name: pilot.name,
        institution: pilot.institution,
        slug: pilot.enrollment_slug,
        consent_text: pilot.consent_text || defaultConsent,
        consent_version: pilot.consent_version,
        test_mode: pilot.test_mode,
      }}
    />
  );
}

function ClosedNotice({ title, message }: { title: string; message: string }) {
  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center px-6">
      <div className="max-w-md w-full bg-white border border-[#E5E5E5] rounded-2xl p-10 text-center shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/branding/gloria-logo.png"
          alt="GlorIA"
          className="h-10 w-auto mx-auto mb-6"
        />
        <h1 className="text-xl font-semibold text-[#1A1A1A] mb-3">{title}</h1>
        <p className="text-sm text-gray-600 leading-relaxed">{message}</p>
      </div>
    </div>
  );
}
