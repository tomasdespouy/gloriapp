import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { url, slug, type } = await request.json();
  if (!url || !slug || !type) {
    return NextResponse.json({ error: "url, slug y type requeridos" }, { status: 400 });
  }

  // Validate slug to prevent path traversal
  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
    return NextResponse.json({ error: "Slug inválido: solo letras, números, guiones y guiones bajos" }, { status: 400 });
  }

  if (!["image", "video"].includes(type)) {
    return NextResponse.json({ error: "type debe ser 'image' o 'video'" }, { status: 400 });
  }

  const ext = type === "video" ? "mp4" : "png";
  const filePath = `${slug}.${ext}`;
  const contentType = type === "video" ? "video/mp4" : "image/png";

  try {
    // Download the file from the external URL
    const response = await fetch(url);
    if (!response.ok) throw new Error("Error descargando archivo");

    const buffer = Buffer.from(await response.arrayBuffer());
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
