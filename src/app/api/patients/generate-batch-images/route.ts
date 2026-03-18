import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GoogleGenAI, PersonGeneration } from "@google/genai";
import { buildImagePrompt, defaultVisualIdentity } from "@/lib/patient-image-prompt";
import type { VisualIdentity } from "@/lib/patient-image-prompt";

let _gemini: GoogleGenAI | null = null;
function getGemini() {
  if (!_gemini) _gemini = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });
  return _gemini;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { name, age, gender, country, occupation, visual_identity } = await request.json();

  const admin = createAdminClient();

  // Use provided visual_identity, or fetch from DB, or use defaults
  let identity: VisualIdentity;
  if (visual_identity) {
    identity = visual_identity;
  } else {
    // Try to read from DB
    const { data: patient } = await admin
      .from("ai_patients")
      .select("visual_identity")
      .eq("name", name)
      .single();

    identity = (patient?.visual_identity as VisualIdentity) || defaultVisualIdentity();
  }

  const prompt = buildImagePrompt(
    { name, age, occupation, country },
    identity
  );

  try {
    const gemini = getGemini();
    const response = await gemini.models.generateImages({
      model: "imagen-4.0-generate-001",
      prompt,
      config: {
        numberOfImages: 1,
        aspectRatio: "1:1",
        personGeneration: PersonGeneration.ALLOW_ADULT,
        outputMimeType: "image/png",
      },
    });

    const image = response.generatedImages?.[0];
    if (!image?.image?.imageBytes) {
      return NextResponse.json({ error: "No se generó imagen" }, { status: 500 });
    }

    // Upload to Supabase Storage
    const imageBuffer = Buffer.from(image.image.imageBytes, "base64");
    const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");
    const fileName = `${slug}.png`;

    await admin.storage.from("patients").upload(fileName, imageBuffer, {
      contentType: "image/png",
      upsert: true,
    });

    const { data: publicUrl } = admin.storage.from("patients").getPublicUrl(fileName);

    return NextResponse.json({ imageUrl: publicUrl.publicUrl, fileName, prompt });
  } catch (err) {
    return NextResponse.json({
      error: "Error generando imagen: " + (err instanceof Error ? err.message : "unknown"),
    }, { status: 500 });
  }
}
