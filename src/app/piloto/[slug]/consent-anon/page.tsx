import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { DEFAULT_CONSENT_TEXT_ANON } from "@/lib/consent-texts";
import AnonEnrollmentClient from "./AnonEnrollmentClient";

// Public, unauthenticated landing for anonymous pilot self-enrollment.
// URL: /piloto/{enrollment_slug}/consent-anon
// Only works when pilots.is_anonymous = true; otherwise redirects the
// student to the named consent page.

export const dynamic = "force-dynamic";

type PilotForAnonEnrollment = {
  id: string;
  name: string;
  institution: string;
  enrollment_slug: string;
  consent_text: string | null;
  consent_version: string;
  status: string;
  ended_at: string | null;
  logo_url: string | null;
  is_anonymous: boolean;
};

export default async function PilotAnonEnrollmentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const admin = createAdminClient();

  const { data: pilot } = await admin
    .from("pilots")
    .select(
      "id, name, institution, enrollment_slug, consent_text, consent_version, status, ended_at, logo_url, is_anonymous",
    )
    .eq("enrollment_slug", slug)
    .maybeSingle<PilotForAnonEnrollment>();

  if (!pilot) {
    notFound();
  }

  if (!pilot.is_anonymous) {
    return (
      <ClosedNotice
        title="Piloto no anónimo"
        message="Este piloto no está configurado para inscripción anónima. Por favor usa el enlace de inscripción normal que te compartió tu institución."
      />
    );
  }

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
        message="El período de inscripción de este piloto ya terminó."
      />
    );
  }
  if (pilot.ended_at && new Date(pilot.ended_at) < new Date()) {
    return (
      <ClosedNotice
        title="Piloto cerrado"
        message="La fecha de cierre de este piloto ya pasó."
      />
    );
  }

  return (
    <AnonEnrollmentClient
      pilot={{
        id: pilot.id,
        name: pilot.name,
        institution: pilot.institution,
        slug: pilot.enrollment_slug,
        consent_text: pilot.consent_text || DEFAULT_CONSENT_TEXT_ANON,
        consent_version: pilot.consent_version,
        logo_url: pilot.logo_url,
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
