import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { pilotEnrollAnonSchema, parseBody } from "@/lib/validation/schemas";

// Public endpoint for anonymous pilot enrollment.
// Only works when pilots.is_anonymous = true.
//
// What it does:
//  1. Validates body against pilotEnrollAnonSchema (only "accepted" is required).
//  2. Looks up the pilot and rejects if it is not marked as anonymous.
//  3. Soft rate-limit: max 5 anonymous sign-ups per IP per pilot per hour
//     (using pilot_consents.signed_ip as the counter — no extra infra).
//  4. Generates a synthetic email (anon-{nanoid}@piloto.glor-ia.com) and
//     a 16-char password (mixed case + digits, matches auth hardening).
//  5. Creates the auth user, profile update, pilot_participants row and
//     pilot_consents row with audit trail.
//  6. Returns the credentials directly in the response — there is no
//     real inbox to email.

export const maxDuration = 30;

const ANON_EMAIL_DOMAIN = "piloto.glor-ia.com";
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  if (!/^[a-z0-9-]{3,80}$/i.test(slug)) {
    return NextResponse.json({ error: "Slug inválido" }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const parsed = parseBody(pilotEnrollAnonSchema, raw);
  if (!parsed.ok) return parsed.response;
  const data = parsed.data;

  const admin = createAdminClient();

  // ── 1. Look up the pilot ─────────────────────────────────────────────
  const { data: pilot, error: pilotErr } = await admin
    .from("pilots")
    .select(
      "id, name, institution, status, ended_at, consent_text, consent_version, establishment_id, is_anonymous",
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
  if (!pilot.is_anonymous) {
    return NextResponse.json(
      { error: "Este piloto no está configurado para inscripción anónima" },
      { status: 400 },
    );
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

  // ── 2. Consent version check ─────────────────────────────────────────
  if (data.consent_version !== pilot.consent_version) {
    return NextResponse.json(
      {
        error:
          "El consentimiento fue actualizado mientras llenabas el formulario. Recarga la página para ver la versión actual.",
      },
      { status: 409 },
    );
  }

  // ── 3. Soft rate-limit per IP / pilot / hour ─────────────────────────
  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent") || null;

  if (ip) {
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    const { count } = await admin
      .from("pilot_consents")
      .select("id", { count: "exact", head: true })
      .eq("pilot_id", pilot.id)
      .eq("signed_ip", ip)
      .eq("anonymous_consent", true)
      .gte("signed_at", since);

    if (count !== null && count >= RATE_LIMIT_MAX) {
      return NextResponse.json(
        {
          error:
            "Has alcanzado el máximo de registros por hora desde esta conexión. Intenta de nuevo más tarde.",
        },
        { status: 429 },
      );
    }
  }

  // ── 4. Generate synthetic credentials ────────────────────────────────
  const anonEmail = generateAnonEmail();
  const anonPassword = generateAnonPassword();

  // ── 5. Create the auth user ──────────────────────────────────────────
  const { data: newAuthUser, error: createErr } =
    await admin.auth.admin.createUser({
      email: anonEmail,
      password: anonPassword,
      email_confirm: true,
      user_metadata: {
        full_name: "anónimo",
        role: "student",
        pilot_id: pilot.id,
        establishment_id: pilot.establishment_id || null,
        pilot_declared_role: data.role || "estudiante",
        is_anonymous: true,
      },
    });

  if (createErr || !newAuthUser?.user?.id) {
    return NextResponse.json(
      {
        error:
          createErr?.message ||
          "No se pudo crear tu cuenta. Intenta de nuevo.",
      },
      { status: 500 },
    );
  }

  const userId = newAuthUser.user.id;

  // Defensive profile update. The handle_new_user trigger copies
  // metadata, but we set role/establishment explicitly to guarantee
  // the expected RLS scope for the anonymous student.
  await admin
    .from("profiles")
    .update({
      full_name: "anónimo",
      establishment_id: pilot.establishment_id || null,
      role: "student",
    })
    .eq("id", userId);

  // ── 6. Create pilot_participants row ─────────────────────────────────
  const { data: newPart, error: partErr } = await admin
    .from("pilot_participants")
    .insert({
      pilot_id: pilot.id,
      email: anonEmail,
      full_name: "anónimo",
      role: "student",
      user_id: userId,
      status: "activo",
      invite_sent_at: new Date().toISOString(),
      is_anonymous: true,
    })
    .select("id")
    .single();

  if (partErr || !newPart) {
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json(
      { error: "Error al registrar al participante" },
      { status: 500 },
    );
  }

  // ── 7. Insert consent row with audit trail ───────────────────────────
  const { error: consentErr } = await admin.from("pilot_consents").insert({
    pilot_id: pilot.id,
    pilot_participant_id: newPart.id,
    full_name: "anónimo",
    email: anonEmail,
    age: data.age ?? null,
    gender: "prefiere_no_decir",
    role: data.role || "estudiante",
    university: pilot.institution || "—",
    signed_name: "acepto",
    signed_ip: ip,
    signed_user_agent: userAgent,
    consent_version: data.consent_version,
    consent_text_snapshot: pilot.consent_text || "(empty consent text)",
    user_id: userId,
    anonymous_consent: true,
  });

  if (consentErr) {
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json(
      {
        error: "Error al registrar el consentimiento: " + consentErr.message,
      },
      { status: 500 },
    );
  }

  // ── 8. Return credentials inline (there is no real inbox) ────────────
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.glor-ia.com";
  return NextResponse.json({
    success: true,
    anonymous: true,
    email: anonEmail,
    tempPassword: anonPassword,
    loginUrl: `${appUrl}/login`,
  });
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

// Unambiguous lowercase alphabet (no 0, 1, i, l, o).
const NANO_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function generateAnonEmail(): string {
  let nano = "";
  for (let i = 0; i < 12; i++) {
    nano += NANO_ALPHABET[randomInt(NANO_ALPHABET.length)];
  }
  return `anon-${nano}@${ANON_EMAIL_DOMAIN}`;
}

// 16 chars, guarantees ≥1 upper, ≥1 lower, ≥1 digit (hardening requires
// lower_upper_letters_digits with min length 10 — we exceed both).
function generateAnonPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digit = "23456789";
  const all = upper + lower + digit;

  const chars: string[] = [
    upper[randomInt(upper.length)],
    lower[randomInt(lower.length)],
    digit[randomInt(digit.length)],
  ];
  while (chars.length < 16) {
    chars.push(all[randomInt(all.length)]);
  }
  // Fisher-Yates shuffle so the first three positions aren't predictable.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

function getClientIp(request: Request): string | null {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf;
  return null;
}
