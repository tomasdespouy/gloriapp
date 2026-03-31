import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { uploadLimiter, checkRateLimit } from "@/lib/rate-limit";

const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50 MB

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

  // Rate limit: 10 uploads/hour per user
  const rateLimited = await checkRateLimit(uploadLimiter, user.id);
  if (rateLimited) return rateLimited;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const slug = formData.get("slug") as string | null;

  if (!file || !slug) {
    return NextResponse.json({ error: "file y slug requeridos" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    if (buffer.length > MAX_VIDEO_SIZE) {
      return NextResponse.json({ error: "Archivo excede el límite de 50 MB" }, { status: 413 });
    }

    const admin = createAdminClient();

    const { error } = await admin.storage
      .from("patients")
      .upload(`${slug}.mp4`, buffer, { contentType: "video/mp4", upsert: true });

    if (error) throw error;

    const { data: urlData } = admin.storage.from("patients").getPublicUrl(`${slug}.mp4`);

    return NextResponse.json({ success: true, publicUrl: urlData.publicUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error subiendo video";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
