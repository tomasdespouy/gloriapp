/**
 * POST /api/admin/pilots/[id]/report/generate
 *
 * Builds a DOCX snapshot of the pilot report, uploads it to the 'reports'
 * Storage bucket, and inserts a pilot_reports row linking to the file.
 *
 * Body: { variant: 'named' | 'anonymous' }
 *
 * Returns the new pilot_reports row with public_url resolved.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchPilotReportData } from "@/lib/pilot-report-data";
import { generatePilotDocx } from "@/lib/generate-pilot-docx";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export async function POST(
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

  // Body is accepted for forward compat (variant selector) but the
  // generator always produces anonymised output now — per product call
  // 2026-04-20. Keep the stored variant label so the metadata row is
  // still honest about what's inside the file.
  await request.json().catch(() => ({}));
  const variant: "anonymous" = "anonymous";

  const { id: pilotId } = await params;
  const admin = createAdminClient();

  // 1. Fetch data
  let data;
  try {
    data = await fetchPilotReportData(admin, pilotId);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al recolectar datos" },
      { status: 500 },
    );
  }

  // 2. Generate DOCX
  const buffer = await generatePilotDocx(data);

  // 3. Upload to Storage (bucket: 'reports')
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${timestamp}-${slugify(data.pilot.name)}-${variant}.docx`;
  const filePath = `pilots/${pilotId}/${filename}`;

  const { error: uploadErr } = await admin.storage
    .from("reports")
    .upload(filePath, buffer, {
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: false,
    });

  if (uploadErr) {
    return NextResponse.json(
      { error: `Error al subir archivo: ${uploadErr.message}` },
      { status: 500 },
    );
  }

  // 4. Insert metadata row
  const metadata = {
    total_students: data.kpis.total_students,
    total_connected: data.kpis.total_connected,
    completed_sessions: data.kpis.completed_sessions,
    avg_seconds_per_session: Math.round(data.kpis.avg_seconds_per_session),
    pilot_overall_avg: Number(data.kpis.pilot_overall_avg.toFixed(2)),
    survey_responses_count: data.survey.n,
  };

  const { data: inserted, error: insertErr } = await admin
    .from("pilot_reports")
    .insert({
      pilot_id: pilotId,
      variant,
      file_path: filePath,
      file_size_bytes: buffer.length,
      metadata,
      created_by: user.id,
    })
    .select("*")
    .single();

  if (insertErr) {
    // Best-effort cleanup of the uploaded file if metadata insert fails.
    await admin.storage.from("reports").remove([filePath]).catch(() => {});
    return NextResponse.json(
      { error: `Error al guardar metadatos: ${insertErr.message}` },
      { status: 500 },
    );
  }

  // 5. Resolve public URL (bucket 'reports' is public; no signing needed)
  const { data: publicUrl } = admin.storage.from("reports").getPublicUrl(filePath);

  return NextResponse.json(
    {
      ...inserted,
      public_url: publicUrl.publicUrl,
    },
    { status: 201 },
  );
}
