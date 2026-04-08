/**
 * Validation schemas (Zod) for API routes.
 *
 * These schemas implement the input-validation control mandated by the
 * UGM security protocol (SECURITY.md, section "Validacion de Entrada"),
 * adapted to the GlorIA stack (Supabase + Zod, instead of the
 * reference implementation's manual regex helpers).
 *
 * Usage in an API route:
 *
 *   import { parseBody } from "@/lib/validation/schemas";
 *   const parsed = parseBody(createUserSchema, await request.json());
 *   if (!parsed.ok) return parsed.response;
 *   const { email, full_name, role } = parsed.data;
 */

import { z } from "zod";
import { NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────────────────
// Reusable primitives
// ─────────────────────────────────────────────────────────────────────────

export const emailSchema = z
  .string()
  .trim()
  .min(3, "Email demasiado corto")
  .max(254, "Email demasiado largo")
  .email("Email inválido");

export const uuidSchema = z.string().uuid("ID inválido");

export const nonEmptyString = (max = 200) =>
  z.string().trim().min(1, "Campo requerido").max(max, `Máximo ${max} caracteres`);

export const optionalString = (max = 500) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .optional()
    .or(z.literal("").transform(() => undefined));

export const userRoleSchema = z.enum(["student", "instructor", "admin", "superadmin"]);
export const pilotParticipantRoleSchema = z.enum(["student", "instructor"]);

// ─────────────────────────────────────────────────────────────────────────
// /api/admin/users (GET) — query params
// ─────────────────────────────────────────────────────────────────────────

export const listUsersQuerySchema = z.object({
  role: userRoleSchema.optional(),
  establishment_id: uuidSchema.optional(),
  // Search term: limit length and reject control characters to prevent abuse
  // of PostgREST .or() filter parameters.
  search: z
    .string()
    .trim()
    .min(1)
    .max(100, "Búsqueda demasiado larga")
    .regex(/^[^\x00-\x1F\x7F]+$/, "Caracteres no permitidos")
    .optional(),
});

// ─────────────────────────────────────────────────────────────────────────
// /api/admin/users/create (POST) — body
// ─────────────────────────────────────────────────────────────────────────

export const createUserSchema = z.object({
  email: emailSchema,
  full_name: nonEmptyString(150),
  role: userRoleSchema.optional(),
  establishment_id: uuidSchema.optional(),
  course_id: uuidSchema.optional(),
  section_id: uuidSchema.optional(),
});

// ─────────────────────────────────────────────────────────────────────────
// /api/admin/pilots/[id]/send-invites (POST) — body
// ─────────────────────────────────────────────────────────────────────────

export const sendInvitesSchema = z.object({
  // Optional custom email body. Limited to 5000 characters and stripped
  // of control characters. The route uses this verbatim inside an HTML
  // template, so we let the route do its own escaping if needed; here we
  // only constrain length and shape.
  customBody: z
    .string()
    .max(5000, "Mensaje personalizado demasiado largo")
    .regex(/^[^\x00-\x08\x0B\x0C\x0E-\x1F\x7F]*$/, "Caracteres no permitidos")
    .optional(),
});

// ─────────────────────────────────────────────────────────────────────────
// /api/public/pilot-enroll/[slug] (POST) — public consent submission
// ─────────────────────────────────────────────────────────────────────────

export const pilotEnrollSchema = z.object({
  full_name: nonEmptyString(150),
  email: emailSchema,
  age: z
    .number()
    .int()
    .min(15, "Edad mínima: 15")
    .max(99, "Edad máxima: 99"),
  gender: z.enum(["femenino", "masculino", "no_binario", "prefiere_no_decir"]),
  role: z.enum(["estudiante", "docente", "coordinador"]),
  university: nonEmptyString(200),
  signed_name: nonEmptyString(150),
  accepted: z
    .boolean()
    .refine((v) => v === true, { message: "Debes aceptar el consentimiento" }),
  consent_version: nonEmptyString(40),
});

// ─────────────────────────────────────────────────────────────────────────
// /api/contact (POST) — public landing form body
// ─────────────────────────────────────────────────────────────────────────

export const contactFormSchema = z.object({
  institution: nonEmptyString(200),
  country: nonEmptyString(80),
  city: optionalString(120),
  contact_name: nonEmptyString(150),
  contact_email: emailSchema,
  contact_phone: optionalString(40),
  program_name: optionalString(200),
  // Accept either a number or a numeric string from the form.
  estimated_students: z
    .union([z.number().int().min(1).max(100000), z.string().regex(/^\d{1,6}$/)])
    .optional()
    .transform((v) => (v == null ? undefined : typeof v === "string" ? parseInt(v, 10) : v)),
  message: optionalString(2000),
});

// ─────────────────────────────────────────────────────────────────────────
// Helpers — keep API routes terse
// ─────────────────────────────────────────────────────────────────────────

type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

/**
 * Parse a JSON body against a Zod schema. On failure returns a ready-made
 * 400 NextResponse with the first validation issue, so the API route can
 * `if (!parsed.ok) return parsed.response;` and continue.
 */
export function parseBody<T extends z.ZodTypeAny>(
  schema: T,
  raw: unknown,
): ParseResult<z.infer<T>> {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first.path.length > 0 ? first.path.join(".") + ": " : "";
    return {
      ok: false,
      response: NextResponse.json(
        { error: `${path}${first.message}` },
        { status: 400 },
      ),
    };
  }
  return { ok: true, data: result.data };
}

/**
 * Parse URLSearchParams against a Zod object schema. Same return contract
 * as parseBody.
 */
export function parseSearchParams<T extends z.ZodTypeAny>(
  schema: T,
  params: URLSearchParams,
): ParseResult<z.infer<T>> {
  const obj: Record<string, string> = {};
  for (const [k, v] of params.entries()) obj[k] = v;
  return parseBody(schema, obj);
}
