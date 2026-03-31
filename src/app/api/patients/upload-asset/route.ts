import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

const MAX_ASSET_SIZE = 50 * 1024 * 1024; // 50 MB

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // Role check: only admin/superadmin can upload patient assets
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "superadmin"].includes(profile.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { url, slug, type } = await request.json();
  if (!url || !slug || !type) {
    return NextResponse.json({ error: "url, slug y type requeridos" }, { status: 400 });
  }

  const ext = type === "video" ? "mp4" : "png";
  const filePath = `${slug}.${ext}`;
  const contentType = type === "video" ? "video/mp4" : "image/png";

  try {
    // Download the file from the external URL
    const response = await fetch(url);
    if (!response.ok) throw new Error("Error descargando archivo");

    const buffer = Buffer.from(await response.arrayBuffer());

    if (buffer.length > MAX_ASSET_SIZE) {
      return NextResponse.json({ error: "Archivo excede el límite de 50 MB" }, { status: 413 });
    }

    const admin = createAdminClient();

    // Upload to Supabase Storage (upsert to overwrite if exists)
    const { error } = await admin.storage
      .from("patients")
      .upload(filePath, buffer, {
        contentType,
        upsert: true,
      });

    if (error) throw error;

    // Get public URL
    const { data: urlData } = admin.storage.from("patients").getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      publicUrl: urlData.publicUrl,
      path: filePath,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error subiendo archivo";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
