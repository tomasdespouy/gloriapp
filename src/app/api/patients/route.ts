import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: patients, error } = await admin
    .from("ai_patients")
    .select("id, name, age, occupation, quote, difficulty_level, is_active, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(patients);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const dataStr = formData.get("data") as string;
    const videoFile = formData.get("video") as File | null;
    const patientData = JSON.parse(dataStr);

    // Save video if provided
    if (videoFile && videoFile.size > 0) {
      const slug = patientData.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "-");

      const videosDir = path.join(process.cwd(), "public", "patients");
      await mkdir(videosDir, { recursive: true });

      const buffer = Buffer.from(await videoFile.arrayBuffer());
      await writeFile(path.join(videosDir, `${slug}.mp4`), buffer);
    }

    const admin = createAdminClient();
    const { data: patient, error } = await admin
      .from("ai_patients")
      .insert({
        name: patientData.name,
        age: patientData.age,
        occupation: patientData.occupation,
        quote: patientData.quote,
        presenting_problem: patientData.presenting_problem,
        backstory: patientData.backstory,
        personality_traits: patientData.personality_traits,
        system_prompt: patientData.system_prompt,
        difficulty_level: patientData.difficulty_level,
        tags: patientData.tags,
        skills_practiced: patientData.skills_practiced,
        total_sessions: patientData.total_sessions,
        country: patientData.country || ["Chile"],
        country_origin: patientData.country_origin || (patientData.country?.[0]) || "Chile",
        country_residence: patientData.country_residence || (patientData.country?.[0]) || "Chile",
        birthday: patientData.birthday || null,
        neighborhood: patientData.neighborhood || null,
        family_members: patientData.family_members || [],
        is_active: true,
      })
      .select("id, name")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(patient, { status: 201 });
  } catch (error) {
    console.error("Error creating patient:", error);
    return NextResponse.json(
      { error: "Error al crear el paciente" },
      { status: 500 }
    );
  }
}
