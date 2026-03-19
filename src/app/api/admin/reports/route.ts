import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado", status: 401 };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "superadmin"].includes(profile.role)) return { error: "No autorizado", status: 403 };
  return { user, role: profile.role };
}

// GET — list all reports
export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("technical_reports")
    .select("id, title, summary, file_url, file_name, file_size, notes, category, uploaded_by, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST — upload new report (multipart form)
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.role !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const title = formData.get("title") as string || "";
  const summary = formData.get("summary") as string || "";
  const category = formData.get("category") as string || "general";

  if (!file) return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });

  const admin = createAdminClient();

  // Upload to storage
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `${timestamp}_${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from("reports")
    .upload(filePath, buffer, { contentType: file.type, upsert: false });

  if (uploadError) return NextResponse.json({ error: "Error subiendo archivo: " + uploadError.message }, { status: 500 });

  const { data: urlData } = admin.storage.from("reports").getPublicUrl(filePath);

  // Save metadata
  const { data, error } = await admin.from("technical_reports").insert({
    title: title || file.name.replace(/\.[^.]+$/, ""),
    summary,
    file_url: urlData.publicUrl,
    file_name: file.name,
    file_size: file.size,
    category,
    uploaded_by: auth.user.id,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
