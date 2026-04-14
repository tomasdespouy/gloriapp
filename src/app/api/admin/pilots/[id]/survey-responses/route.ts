import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import ExcelJS from "exceljs";

// Export survey responses for a pilot. Four formats supported:
//
//   GET .../survey-responses?format=csv-named
//   GET .../survey-responses?format=csv-anonymous
//   GET .../survey-responses?format=xlsx-named
//   GET .../survey-responses?format=xlsx-anonymous
//   GET .../survey-responses?format=json       (Dashboard in-app view)
//
// Nominal exports include full_name and email (from pilot_consents or
// fallback pilot_participants). Anonymous exports replace name/email
// with a sequential id (P-001, P-002...).
//
// Scope: we look at `survey_responses` for every user that belongs to
// this pilot via `pilot_participants` — this is robust whether the
// survey is pilot-scoped, global, or the UGM form. Previously the
// endpoint filtered by survey title, which broke for global surveys.

const USAB_KEYS = ["navegacion", "performance", "claridad", "feedback"] as const;
const FORM_KEYS = ["aplicacion", "habilidades", "incorporacion", "verosimilitud", "atencion"] as const;

const VALID_FORMATS = new Set([
  "csv-named",
  "csv-anonymous",
  "xlsx-named",
  "xlsx-anonymous",
  "json",
]);

type ConsentRow = {
  user_id: string | null;
  full_name: string;
  email: string;
};

type ParticipantRow = {
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

  if (!VALID_FORMATS.has(format)) {
    return NextResponse.json(
      { error: `format inválido — usa uno de: ${Array.from(VALID_FORMATS).join(", ")}` },
      { status: 400 },
    );
  }
  const anonymized = format.endsWith("-anonymous");

  const admin = createAdminClient();

  // 1. Pilot metadata (institution + name go into the export rows).
  const { data: pilot } = await admin
    .from("pilots")
    .select("id, name, institution")
    .eq("id", pilotId)
    .single();

  if (!pilot) {
    return NextResponse.json({ error: "Piloto no encontrado" }, { status: 404 });
  }

  // 2. All participants of this pilot (including those without user_id
  // so we can show emails even if they never responded).
  const { data: participants } = await admin
    .from("pilot_participants")
    .select("user_id, full_name, email")
    .eq("pilot_id", pilotId);

  const participantList = (participants || []) as ParticipantRow[];
  const userIds = participantList.map((p) => p.user_id).filter((v): v is string => !!v);

  if (userIds.length === 0) {
    return NextResponse.json(
      { error: "No hay participantes con sesión todavía" },
      { status: 404 },
    );
  }

  // 3. All responses for any survey, filtered by participant user_id.
  // Covers UGM global survey, pilot-scoped surveys, etc.
  const { data: responses } = await admin
    .from("survey_responses")
    .select("id, user_id, created_at, answers")
    .in("user_id", userIds)
    .order("created_at", { ascending: true });

  const respList: ResponseRow[] = (responses || []) as ResponseRow[];

  if (respList.length === 0 && format !== "json") {
    return NextResponse.json(
      { error: "No hay respuestas todavía para este piloto" },
      { status: 404 },
    );
  }

  // 4. Name/email lookup — prefer pilot_consents (signed at enrollment)
  // then fallback to pilot_participants.
  const nameMap = new Map<string, { full_name: string; email: string }>();
  if (!anonymized && format !== "json") {
    const { data: consents } = await admin
      .from("pilot_consents")
      .select("user_id, full_name, email")
      .eq("pilot_id", pilotId)
      .in("user_id", userIds);

    for (const c of (consents || []) as ConsentRow[]) {
      if (c.user_id) nameMap.set(c.user_id, { full_name: c.full_name, email: c.email });
    }
  }
  // Also populate from participants so everyone has a fallback.
  for (const p of participantList) {
    if (p.user_id && !nameMap.has(p.user_id)) {
      nameMap.set(p.user_id, { full_name: p.full_name, email: p.email });
    }
  }

  // ── JSON branch (used by the Dashboard to render cards/tabla) ─────
  if (format === "json") {
    const rows = respList.map((resp) => {
      const id = resp.user_id;
      const who = nameMap.get(id) || { full_name: "(sin nombre)", email: "" };
      return {
        response_id: resp.id,
        user_id: id,
        full_name: who.full_name,
        email: who.email,
        created_at: resp.created_at,
        answers: resp.answers || {},
      };
    });
    return NextResponse.json({ pilot, total: rows.length, rows });
  }

  // ── Tabular export (CSV or XLSX) ──────────────────────────────────
  const headers: string[] = ["institucion", "fecha"];
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
    ...USAB_KEYS.map((k) => `q5_usabilidad_${k}`),
    ...FORM_KEYS.map((k) => `q6_formacion_${k}`),
    "q7_mas_gusto",
    "q8_mejoras",
    "q9_integracion",
    "q10_comentarios",
  );

  const dataRows: (string | number | null)[][] = respList.map((resp, idx) => {
    const a = (resp.answers || {}) as Record<string, unknown>;
    const usabilidad = (a.q5_usabilidad || {}) as Record<string, unknown>;
    const formacion = (a.q6_formacion || {}) as Record<string, unknown>;

    const row: (string | number | null)[] = [pilot.institution, formatDate(resp.created_at)];

    if (anonymized) {
      row.push(`P-${String(idx + 1).padStart(3, "0")}`);
    } else {
      const who = nameMap.get(resp.user_id);
      row.push(who?.full_name || "(sin consentimiento)");
      row.push(who?.email || "");
    }

    row.push(
      str(a.q1_carrera),
      str(a.q2_genero),
      numOrStr(a.q3_edad),
      str(a.q4_rol),
      ...USAB_KEYS.map((k) => numOrStr(usabilidad[k])),
      ...FORM_KEYS.map((k) => numOrStr(formacion[k])),
      str(a.q7_mas_gusto),
      str(a.q8_mejoras),
      str(a.q9_integracion),
      str(a.q10_comentarios),
    );
    return row;
  });

  const dateStr = new Date().toISOString().slice(0, 10);
  const slug = slugify(`${pilot.institution}-${pilot.name}`);
  const baseName = `encuesta-${slug}-${dateStr}-${anonymized ? "anonima" : "nominal"}`;

  if (format.startsWith("xlsx")) {
    const buffer = await buildXlsx(headers, dataRows, pilot.name);
    const body = new Uint8Array(buffer);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${baseName}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // CSV
  const csvRows = [headers, ...dataRows.map((r) => r.map((v) => (v == null ? "" : String(v))))];
  const csvBody = csvRows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
  const csv = "\uFEFF" + csvBody;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${baseName}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

// ─────────────────────────────────────────────────────────────────────
// XLSX builder
// ─────────────────────────────────────────────────────────────────────

async function buildXlsx(
  headers: string[],
  rows: (string | number | null)[][],
  sheetName: string,
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "GlorIA";
  wb.created = new Date();
  const safeSheetName = sheetName.replace(/[\\/*?:[\]]/g, "").slice(0, 28) || "Respuestas";
  const ws = wb.addWorksheet(safeSheetName);
  ws.addRow(headers);
  for (const r of rows) ws.addRow(r);

  // Style header + autofit columns
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE5E7EB" },
  };
  ws.columns.forEach((col, idx) => {
    const header = headers[idx] || "";
    let max = header.length;
    for (const row of rows) {
      const v = row[idx];
      if (v != null) {
        const len = String(v).length;
        if (len > max) max = len;
      }
    }
    col.width = Math.min(Math.max(max + 2, 10), 60);
  });
  ws.views = [{ state: "frozen", ySplit: 1 }];

  const buf = await wb.xlsx.writeBuffer();
  return buf as ArrayBuffer;
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function str(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function numOrStr(v: unknown): string | number {
  if (v == null) return "";
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : String(v);
}

function csvEscape(v: string): string {
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
