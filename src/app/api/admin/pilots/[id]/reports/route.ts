/**
 * GET /api/admin/pilots/[id]/reports
 *
 * Lists persisted DOCX reports for a pilot, most recent first. Each row
 * carries a resolved public_url so the client can offer a direct download.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
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
  if (profile?.role !== "superadmin" && profile?.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id: pilotId } = await params;
  const admin = createAdminClient();

  const { data: rows, error } = await admin
    .from("pilot_reports")
    .select("id, pilot_id, variant, file_path, file_size_bytes, metadata, created_at, created_by")
    .eq("pilot_id", pilotId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const withUrls = (rows || []).map((r) => {
    const { data: pub } = admin.storage.from("reports").getPublicUrl(r.file_path);
    return { ...r, public_url: pub.publicUrl };
  });

  return NextResponse.json(withUrls);
}

export async function DELETE(
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

  const url = new URL(request.url);
  const reportId = url.searchParams.get("reportId");
  if (!reportId) {
    return NextResponse.json({ error: "reportId requerido" }, { status: 400 });
  }

  const { id: pilotId } = await params;
  const admin = createAdminClient();

  const { data: row } = await admin
    .from("pilot_reports")
    .select("file_path, pilot_id")
    .eq("id", reportId)
    .single();

  if (!row || row.pilot_id !== pilotId) {
    return NextResponse.json({ error: "Informe no encontrado" }, { status: 404 });
  }

  await admin.storage.from("reports").remove([row.file_path]).catch(() => {});
  const { error } = await admin.from("pilot_reports").delete().eq("id", reportId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
