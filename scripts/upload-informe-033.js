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
    "auditoria",
    "INF-2026-033_cumplimiento-protocolo-seguridad-ugm.pdf"
  );
  const fileName = "INF-2026-033_cumplimiento-protocolo-seguridad-ugm.pdf";
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
    title:
      "INF-2026-033 — Cumplimiento del Protocolo de Seguridad UGM",
    summary:
      "Auditoría de GlorIA contra el protocolo SECURITY.md de la Universidad Gabriela Mistral (Plantilla UGM Next.js 15). Hallazgo inicial: 7 de 10 controles cumplían, 3 brechas parciales (xlsx instalado, validación Zod no uniforme, sin SAST). Remediación: migración xlsx→exceljs en parse-sgs.ts, módulo central de schemas Zod aplicado a 5 rutas admin (incluye fix colateral de inyección PostgREST .or() en /admin/usuarios), Semgrep + eslint-plugin-security en CI con 5 reglas adaptadas al stack Supabase. Resultado final: 10/10 controles cumplidos, 0 findings Semgrep. Stack auditado: Next.js 16 + Supabase + Vercel.",
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
