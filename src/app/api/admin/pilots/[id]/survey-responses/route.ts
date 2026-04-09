import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Export survey responses for a pilot as CSV. Two formats supported:
//
//   GET /api/admin/pilots/{id}/survey-responses?format=csv-named
//     Includes full_name and email from pilot_consents.
//
//   GET /api/admin/pilots/{id}/survey-responses?format=csv-anonymous
//     Replaces the name with a sequential anonymous id (P-001, P-002...).
//     Strips email entirely.
//
// Both formats include all 10 questions of the UGM experience survey
// flattened into individual columns. The likert grids (q5/q6) become
// one column per sub-item so the CSV is friendly for Excel pivot tables.
//
// Superadmin only — survey responses contain identifying audit data
// when format=csv-named.

const COMPETENCY_USABILIDAD = ["navegacion", "performance", "claridad", "feedback"] as const;
const COMPETENCY_FORMACION = ["aplicacion", "habilidades", "incorporacion", "verosimilitud", "atencion"] as const;

type ConsentRow = {
  user_id: string | null;
  full_name: string;
  email: string;
};

type ResponseRow = {
  id: string;
  user_id: string;
  created_at: string;
  answers: Record<string, unknown> | null;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "superadmin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id: pilotId } = await params;
  const url = new URL(request.url);
  const format = url.searchParams.get("format") || "csv-named";

  if (!["csv-named", "csv-anonymous"].includes(format)) {
    return NextResponse.json(
      { error: "format inválido — usa csv-named o csv-anonymous" },
      { status: 400 },
    );
  }
  const anonymized = format === "csv-anonymous";

  const admin = createAdminClient();

  // 1. Look up the pilot to get its establishment_id and name
  const { data: pilot } = await admin
    .from("pilots")
    .select("id, name, institution, establishment_id")
    .eq("id", pilotId)
    .single();

  if (!pilot) {
    return NextResponse.json({ error: "Piloto no encontrado" }, { status: 404 });
  }

  // 2. Find the experience survey for this pilot's establishment.
  // The survey is auto-created on pilot creation with title prefix
  // "Experiencia {pilot.name} —". We match by establishment_id + title
  // to allow multiple pilots per establishment without collision.
  const { data: surveys } = await admin
    .from("surveys")
    .select("id, title")
    .eq("scope_type", "establishment")
    .eq("scope_id", pilot.establishment_id)
    .ilike("title", `%${pilot.name}%`)
    .order("created_at", { ascending: false })
    .limit(1);

  const survey = surveys?.[0];
  if (!survey) {
    return NextResponse.json(
      { error: "No hay encuesta de experiencia para este piloto" },
      { status: 404 },
    );
  }

  // 3. Fetch all responses for this survey
  const { data: responses } = await admin
    .from("survey_responses")
    .select("id, user_id, created_at, answers")
    .eq("survey_id", survey.id)
    .order("created_at", { ascending: true });

  const respList: ResponseRow[] = (responses || []) as ResponseRow[];

  if (respList.length === 0) {
    return NextResponse.json(
      { error: "No hay respuestas todavía para este piloto" },
      { status: 404 },
    );
  }

  // 4. Get pilot_consents for name/email lookup (only for named export)
  const consentsMap = new Map<string, ConsentRow>();
  if (!anonymized) {
    const userIds = respList.map((r) => r.user_id).filter(Boolean);
    if (userIds.length > 0) {
      const { data: consents } = await admin
        .from("pilot_consents")
        .select("user_id, full_name, email")
        .eq("pilot_id", pilotId)
        .in("user_id", userIds);

      for (const c of (consents || []) as ConsentRow[]) {
        if (c.user_id) consentsMap.set(c.user_id, c);
      }
    }
  }

  // 5. Build CSV
  const headers: string[] = ["fecha"];
  if (anonymized) {
    headers.push("id_anonimo");
  } else {
    headers.push("nombre", "email");
  }
  headers.push(
    "q1_carrera",
    "q2_genero",
    "q3_edad",
    "q4_rol",
    ...COMPETENCY_USABILIDAD.map((k) => `q5_usabilidad_${k}`),
    ...COMPETENCY_FORMACION.map((k) => `q6_formacion_${k}`),
    "q7_mas_gusto",
    "q8_mejoras",
    "q9_integracion",
    "q10_comentarios",
  );

  const rows: string[][] = [headers];

  respList.forEach((resp, idx) => {
    const a = (resp.answers || {}) as Record<string, unknown>;
    const usabilidad = (a.q5_usabilidad || {}) as Record<string, unknown>;
    const formacion = (a.q6_formacion || {}) as Record<string, unknown>;

    const row: string[] = [
      formatDate(resp.created_at),
    ];

    if (anonymized) {
      row.push(`P-${String(idx + 1).padStart(3, "0")}`);
    } else {
      const consent = consentsMap.get(resp.user_id);
      row.push(consent?.full_name || "(sin consentimiento)");
      row.push(consent?.email || "");
    }

    row.push(
      str(a.q1_carrera),
      str(a.q2_genero),
      str(a.q3_edad),
      str(a.q4_rol),
      ...COMPETENCY_USABILIDAD.map((k) => str(usabilidad[k])),
      ...COMPETENCY_FORMACION.map((k) => str(formacion[k])),
      str(a.q7_mas_gusto),
      str(a.q8_mejoras),
      str(a.q9_integracion),
      str(a.q10_comentarios),
    );

    rows.push(row);
  });

  // CSV serialize with UTF-8 BOM for Excel compatibility
  const csvBody = rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
  const csv = "\uFEFF" + csvBody;

  const dateStr = new Date().toISOString().slice(0, 10);
  const slug = slugify(`${pilot.institution}-${pilot.name}`);
  const filename = `encuesta-${slug}-${dateStr}-${anonymized ? "anonima" : "nominal"}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function str(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function csvEscape(v: string): string {
  // RFC 4180 — wrap in quotes if contains comma, quote, CR, or LF.
  // Inner quotes are doubled.
  if (/[",\r\n]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().replace("T", " ").slice(0, 19);
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
