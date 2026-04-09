import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pilotEnrollSchema, parseBody } from "@/lib/validation/schemas";

// Public endpoint — no auth check (the public consent page hits this).
// Whitelisted in src/lib/supabase/middleware.ts via /api/public/ prefix.
//
// What it does:
//  1. Validates body against pilotEnrollSchema (Zod).
//  2. Looks up the pilot by enrollment_slug and rejects closed/cancelled ones.
//  3. Inserts a pilot_consents row with full audit trail (IP, user agent,
//     snapshot of the exact text, version).
//  4. Creates the auth user with a random temp password.
//  5. Inserts a pilot_participants row linked to the new user.
//  6. Either sends the credentials by email (normal mode) OR returns them
//     in the response body (test_mode = true).

export const maxDuration = 30;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  // Light slug validation: alphanumeric + hyphens, 3..80 chars
  if (!/^[a-z0-9-]{3,80}$/i.test(slug)) {
    return NextResponse.json({ error: "Slug inválido" }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const parsed = parseBody(pilotEnrollSchema, raw);
  if (!parsed.ok) return parsed.response;
  const data = parsed.data;

  const admin = createAdminClient();

  // ── 1. Look up the pilot ─────────────────────────────────────────────
  const { data: pilot, error: pilotErr } = await admin
    .from("pilots")
    .select(
      "id, name, institution, status, ended_at, consent_text, consent_version, test_mode, establishment_id",
    )
    .eq("enrollment_slug", slug)
    .maybeSingle();

  if (pilotErr) {
    return NextResponse.json(
      { error: "Error al buscar el piloto" },
      { status: 500 },
    );
  }
  if (!pilot) {
    return NextResponse.json({ error: "Piloto no encontrado" }, { status: 404 });
  }
  if (pilot.status === "cancelado") {
    return NextResponse.json(
      { error: "Este piloto fue desactivado" },
      { status: 410 },
    );
  }
  if (pilot.status === "finalizado") {
    return NextResponse.json(
      { error: "Este piloto ya finalizó" },
      { status: 410 },
    );
  }
  if (pilot.ended_at && new Date(pilot.ended_at) < new Date()) {
    return NextResponse.json(
      { error: "El período de inscripción ya cerró" },
      { status: 410 },
    );
  }

  // ── 2. Validate signed_name matches full_name ────────────────────────
  if (
    data.signed_name.trim().toLowerCase() !==
    data.full_name.trim().toLowerCase()
  ) {
    return NextResponse.json(
      { error: "La firma no coincide con el nombre ingresado" },
      { status: 400 },
    );
  }

  // ── 3. Check the consent version sent matches the current pilot ──────
  if (data.consent_version !== pilot.consent_version) {
    return NextResponse.json(
      {
        error:
          "El consentimiento fue actualizado mientras llenabas el formulario. Recarga la página para ver la versión actual.",
      },
      { status: 409 },
    );
  }

  // ── 4. Check if this email already signed for this pilot ─────────────
  const { data: existing } = await admin
    .from("pilot_consents")
    .select("id, user_id")
    .eq("pilot_id", pilot.id)
    .eq("email", data.email)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      {
        error:
          "Este correo ya firmó el consentimiento para este piloto. Si perdiste tus credenciales, escríbenos a soporte@glor-ia.com.",
      },
      { status: 409 },
    );
  }

  // ── 5. Create the auth user with a random temp password ─────────────
  const tempPassword = generateTempPassword();

  const { data: newAuthUser, error: createErr } =
    await admin.auth.admin.createUser({
      email: data.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: data.full_name,
        role: data.role === "estudiante" ? "student" : "instructor",
        pilot_id: pilot.id,
        establishment_id: pilot.establishment_id || null,
      },
    });

  if (createErr || !newAuthUser?.user?.id) {
    return NextResponse.json(
      {
        error:
          createErr?.message ||
          "No se pudo crear tu cuenta. Probablemente este correo ya existe en GlorIA.",
      },
      { status: 500 },
    );
  }

  const userId = newAuthUser.user.id;

  // Belt-and-braces: the handle_new_user trigger SHOULD copy
  // establishment_id from raw_user_meta_data, but we explicitly update
  // here too in case the trigger fails silently. We also force role to
  // student / instructor regardless of the trigger's hardcoded default.
  await admin
    .from("profiles")
    .update({
      full_name: data.full_name,
      establishment_id: pilot.establishment_id || null,
      role: data.role === "estudiante" ? "student" : "instructor",
    })
    .eq("id", userId);

  // ── 6. Find or create the pilot_participants row ─────────────────────
  // The participant may have been pre-loaded from CSV; in that case we
  // just update it. Otherwise we insert a fresh row (self-enrollment).
  const { data: existingParticipant } = await admin
    .from("pilot_participants")
    .select("id")
    .eq("pilot_id", pilot.id)
    .eq("email", data.email)
    .maybeSingle();

  let participantId: string;
  if (existingParticipant) {
    await admin
      .from("pilot_participants")
      .update({
        full_name: data.full_name,
        role: data.role === "estudiante" ? "student" : "instructor",
        user_id: userId,
        status: "activo",
        invite_sent_at: new Date().toISOString(),
      })
      .eq("id", existingParticipant.id);
    participantId = existingParticipant.id;
  } else {
    const { data: newPart, error: partErr } = await admin
      .from("pilot_participants")
      .insert({
        pilot_id: pilot.id,
        email: data.email,
        full_name: data.full_name,
        role: data.role === "estudiante" ? "student" : "instructor",
        user_id: userId,
        status: "activo",
        invite_sent_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (partErr || !newPart) {
      // Rollback the auth user we just created
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: "Error al registrar al participante" },
        { status: 500 },
      );
    }
    participantId = newPart.id;
  }

  // ── 7. Insert the consent row with audit trail ───────────────────────
  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent") || null;

  const { error: consentErr } = await admin.from("pilot_consents").insert({
    pilot_id: pilot.id,
    pilot_participant_id: participantId,
    full_name: data.full_name,
    email: data.email,
    age: data.age,
    gender: data.gender,
    role: data.role,
    university: data.university,
    signed_name: data.signed_name,
    signed_ip: ip,
    signed_user_agent: userAgent,
    consent_version: data.consent_version,
    consent_text_snapshot: pilot.consent_text || "(empty consent text)",
    user_id: userId,
  });

  if (consentErr) {
    // Best-effort rollback: delete the auth user. We deliberately do NOT
    // delete the participant row here because Tomás may want to reset and
    // try again from the admin UI without losing the participant CSV row.
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json(
      { error: "Error al registrar el consentimiento: " + consentErr.message },
      { status: 500 },
    );
  }

  // ── 8. Send credentials by email (or skip if test_mode) ──────────────
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.glor-ia.com";

  if (pilot.test_mode) {
    return NextResponse.json({
      success: true,
      email: data.email,
      testMode: true,
      tempPassword,
      loginUrl: `${appUrl}/login`,
    });
  }

  // Normal mode: send the credentials email via Resend
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    // Email is best-effort. The user is created either way, so we still
    // return success but mark emailSent: false so the page can guide them
    // to contact support.
    return NextResponse.json({
      success: true,
      email: data.email,
      emailSent: false,
      tempPassword: undefined,
    });
  }

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "GlorIA <noreply@glor-ia.com>",
        to: data.email,
        subject: `Te damos la bienvenida a GlorIA — Piloto ${pilot.name}`,
        html: buildCredentialsEmail({
          fullName: data.full_name,
          email: data.email,
          tempPassword,
          pilotName: pilot.name,
          institution: pilot.institution,
          appUrl,
        }),
      }),
    });
  } catch {
    // Email failed but the user exists — let them know.
    return NextResponse.json({
      success: true,
      email: data.email,
      emailSent: false,
    });
  }

  return NextResponse.json({
    success: true,
    email: data.email,
    emailSent: true,
  });
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function generateTempPassword(): string {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let p = "Gloria_";
  for (let i = 0; i < 6; i++) {
    p += chars[Math.floor(Math.random() * chars.length)];
  }
  return p;
}

function getClientIp(request: Request): string | null {
  // Vercel forwards the original IP in x-forwarded-for; cf-connecting-ip
  // is the Cloudflare equivalent if the user runs behind CF.
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf;
  return null;
}

function buildCredentialsEmail(opts: {
  fullName: string;
  email: string;
  tempPassword: string;
  pilotName: string;
  institution: string;
  appUrl: string;
}) {
  // Public URL of the GlorIA logo. The image is served from the live app
  // (always reachable from email clients), not from a Supabase storage
  // bucket which previously was unreachable / 404'd.
  const logoUrl = `${opts.appUrl}/branding/gloria-logo.png`;
  const loginUrl = `${opts.appUrl}/login`;
  return `
    <div style="font-family: Calibri, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1A1A1A;">
      <div style="background: #4A55A2; padding: 24px 32px; border-radius: 12px 12px 0 0;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div>
            <h1 style="color: white; margin: 0; font-size: 22px;">Te damos la bienvenida a GlorIA</h1>
            <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 13px;">
              Plataforma de Entrenamiento Cl&iacute;nico con IA
            </p>
          </div>
          <img src="${logoUrl}" alt="GlorIA" width="120" height="40" style="height: 40px; width: auto; display: block;" />
        </div>
      </div>

      <div style="background: #FAFAFA; padding: 32px; border: 1px solid #E5E5E5; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="font-size: 15px; color: #333;">Hola <strong>${escapeHtml(opts.fullName)}</strong>,</p>

        <p style="font-size: 14px; color: #555; line-height: 1.6;">
          Acabas de firmar tu consentimiento informado para participar en el piloto
          <strong>${escapeHtml(opts.pilotName)}</strong> de
          <strong>${escapeHtml(opts.institution)}</strong>. ¡Gracias por ser parte!
        </p>

        <p style="font-size: 14px; color: #555; line-height: 1.6;">
          A continuaci&oacute;n est&aacute;n tus credenciales de acceso a la plataforma:
        </p>

        <div style="background: white; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <p style="margin: 0 0 12px; font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px;">
            Credenciales de acceso
          </p>
          <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666; width: 120px;">Plataforma:</td>
              <td style="padding: 8px 0;">
                <a href="${loginUrl}" style="color: #4A55A2; text-decoration: none; font-weight: 600;">Ingresar a GlorIA</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Email:</td>
              <td style="padding: 8px 0; font-weight: bold;">${escapeHtml(opts.email)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Contrase&ntilde;a:</td>
              <td style="padding: 8px 0; font-weight: bold; font-family: monospace; font-size: 16px; letter-spacing: 1px; color: #4A55A2;">
                ${escapeHtml(opts.tempPassword)}
              </td>
            </tr>
          </table>
        </div>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${loginUrl}" style="display: inline-block; background: #4A55A2; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
            Ir al login
          </a>
        </div>

        <div style="margin-top: 28px; border-top: 1px solid #eee; padding-top: 20px;">
          <p style="font-size: 14px; color: #555; margin: 0;">Con entusiasmo,</p>
          <p style="font-size: 14px; color: #333; margin: 4px 0 0; font-weight: 700;">Equipo GlorIA</p>
          <p style="font-size: 12px; color: #999; margin: 4px 0 0;">
            Si tienes problemas para acceder, escr&iacute;benos a soporte@glor-ia.com
          </p>
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
