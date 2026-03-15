import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import OpenAI from "openai";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { name, age, gender, country, occupation } = await request.json();

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  const admin = createAdminClient();

  const genderDesc = gender === "Femenino" ? "woman" : "man";
  const ageDesc = age < 25 ? "young" : age < 40 ? "adult" : age < 55 ? "middle-aged" : "older";

  const prompt = `A professional headshot portrait of a ${ageDesc} ${genderDesc} from ${country}, age ${age}, who works as a ${occupation}. Natural lighting, neutral expression, looking slightly to the side. Realistic photography style, clean background. The person should look like a typical ${country} resident with appropriate ethnic features for the region. Professional but approachable appearance. No text.`;

  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    });

    const imageUrl = response.data?.[0]?.url;
    if (!imageUrl) return NextResponse.json({ error: "No se generó imagen" }, { status: 500 });

    // Download and upload to Supabase
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");
    const fileName = `${slug}.png`;

    await admin.storage.from("patients").upload(fileName, Buffer.from(imageBuffer), {
      contentType: "image/png",
      upsert: true,
    });

    const { data: publicUrl } = admin.storage.from("patients").getPublicUrl(fileName);

    return NextResponse.json({ imageUrl: publicUrl.publicUrl, fileName });
  } catch (err) {
    return NextResponse.json({
      error: "Error generando imagen: " + (err instanceof Error ? err.message : "unknown"),
    }, { status: 500 });
  }
}
