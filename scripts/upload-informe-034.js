const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const filePath = path.join(
    __dirname,
    "..",
    "informes",
    "desarrollo",
    "INF-2026-034_ajustes-pre-piloto-auto-enrollment-encuesta-ugm.pdf"
  );
  const fileName = "INF-2026-034_ajustes-pre-piloto-auto-enrollment-encuesta-ugm.pdf";
  const fileBuffer = fs.readFileSync(filePath);
  const fileSize = fs.statSync(filePath).size;
  const storageName = `${Date.now()}_${fileName}`;

  const { data: existing } = await supabase
    .from("technical_reports")
    .select("id")
    .eq("file_name", fileName)
    .maybeSingle();

  if (existing) {
    console.log("SKIP: already exists");
    return;
  }

  const { error: uploadErr } = await supabase.storage
    .from("reports")
    .upload(storageName, fileBuffer, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadErr) {
    console.error("Upload error:", uploadErr.message);
    return;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("reports").getPublicUrl(storageName);

  const { error: insertErr } = await supabase.from("technical_reports").insert({
    title: "INF-2026-034 — Ajustes Pre-Piloto: Auto-enrollment, Consentimiento, Logo, Encuesta UGM",
    summary:
      "9 commits aplicados en una jornada para dejar GlorIA lista para los pilotos UBO (15 estudiantes) y U. Católica de Arequipa (90). Self-enrollment público con consentimiento digital trazable + audit trail (IP, user agent, snapshot del texto), logo personalizable por piloto en sidebar/consent/email con cascada pilot→establishment→UGM, encuesta de experiencia UGM replicada 1:1 (10 preguntas, 4 demográficas auto-inyectadas desde pilot_consents), export CSV nominal y anónimo, tour del chat expandido a 3 steps cubriendo 10 botones, auto-creación de la encuesta al crear el piloto, y 17 hallazgos del feedback de testeo cerrados (Lucía zodíaco/silencio, mi progreso, tutor skipped, avatar overlap, profile institución, etc.). 3 migraciones nuevas, 3 endpoints API nuevos, 2 componentes React nuevos. Stack: Next.js 16 + Supabase + Vercel.",
    file_url: publicUrl,
    file_name: fileName,
    file_size: fileSize,
    category: "técnico",
    uploaded_by: "4aa3c729-8549-4170-8c9d-62d1c0aff204",
  });

  if (insertErr) {
    console.error("Insert error:", insertErr.message);
    return;
  }
  console.log(`UPLOADED: ${fileName} (${(fileSize / 1024).toFixed(0)} KB)`);
}

main().catch(console.error);
