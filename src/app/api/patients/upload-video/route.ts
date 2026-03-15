import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const slug = formData.get("slug") as string | null;

  if (!file || !slug) {
    return NextResponse.json({ error: "file y slug requeridos" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
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
