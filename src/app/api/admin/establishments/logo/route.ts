import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { uploadLimiter, checkRateLimit } from "@/lib/rate-limit";
import { logAdminAction } from "@/lib/audit";

/**
 * Sube el logo de una institución desde el computador del superadmin.
 *
 * El archivo queda en el bucket público `universities` con un nombre único
 * (slug + marca de tiempo): así la CDN nunca sirve el logo anterior cuando se
 * reemplaza. Devuelve la URL pública, que el formulario guarda en
 * `establishments.logo_url` al enviar.
 *
 * Sólo superadmin, igual que el resto de la edición de instituciones.
 */

const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2 MB
const BUCKET = "universities";

const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

export async function POST(request: NextRequest) {
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

  const rateLimited = await checkRateLimit(uploadLimiter, user.id);
  if (rateLimited) return rateLimited;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const slugRaw = (formData.get("slug") as string | null) || "";

  if (!file) return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });

  const ext = EXT_BY_TYPE[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Formato no admitido. Usa PNG, JPG, WEBP o SVG." },
      { status: 415 },
    );
  }
  if (file.size > MAX_LOGO_SIZE) {
    return NextResponse.json(
      { error: "El archivo supera los 2 MB. Comprime el logo antes de subirlo." },
      { status: 413 },
    );
  }

  const slug =
    slugRaw
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "institucion";

  const filePath = `${slug}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(filePath, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json(
      { error: "No se pudo subir el archivo: " + uploadError.message },
      { status: 500 },
    );
  }

  const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(filePath);

  await logAdminAction({
    adminId: user.id,
    action: "upload_establishment_logo",
    entityType: "establishment",
    details: { path: filePath, size: file.size, type: file.type },
  });

  return NextResponse.json({ url: urlData.publicUrl, path: filePath });
}
