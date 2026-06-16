// Sube INF-2026-060 a la plataforma (bucket reports + tabla technical_reports) en PROD.
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
const cfg = require("dotenv").parse(fs.readFileSync(".env.production"));
const supabase = createClient(cfg.NEXT_PUBLIC_SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function main() {
  const fileName = "INF-2026-060_enriquecimiento-clinico-pacientes-piloto-conductual.docx";
  const filePath = path.join(__dirname, "..", "informes", "investigacion", fileName);
  const fileBuffer = fs.readFileSync(filePath);
  const fileSize = fs.statSync(filePath).size;
  const storageName = `${Date.now()}_${fileName}`;

  const { data: existing } = await supabase.from("technical_reports").select("id").eq("file_name", fileName).maybeSingle();
  if (existing) { console.log("SKIP: ya existe en technical_reports"); return; }

  const { error: upErr } = await supabase.storage.from("reports").upload(storageName, fileBuffer, {
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", upsert: false,
  });
  if (upErr) { console.error("Upload error:", upErr.message); return; }

  const { data: { publicUrl } } = supabase.storage.from("reports").getPublicUrl(storageName);

  const { error: insErr } = await supabase.from("technical_reports").insert({
    title: "INF-2026-060 — Enriquecimiento clínico de pacientes IA: piloto, validación conductual A/B y despliegue a producción",
    summary:
      "Se eliminaron las 'dos generaciones' de pacientes IA (ricos vs planos). Rúbrica de riqueza clínica de 8 ejes (baseline 67/100, 11 bajo umbral). Se enriquecieron los 11 bajo umbral: 4 con reescritura completa del system_prompt (Carlos, Andrés, Sofía, Gabriel, los planos genuinos) y 7 solo de ficha sin tocar el prompt que ya funcionaba. Se generó el distinctive_factor para los 23 restantes — los 34 quedan con ese campo poblado (antes vacío en todos). La validación antes/después combinó la etiqueta de calor emocional por turno con un índice de diferenciación conductual por gatillo. Hallazgo central: la riqueza documental de un prompt NO predice su comportamiento en sesión; varios pacientes de ficha pobre ya reaccionaban bien y reescribirlos no aportaba. Ninguna métrica automática única basta para evaluar un paciente simulado: la lectura clínica humana sigue siendo el juez final. Aplicado a staging y producción con dry-run, backup y confirmación explícita. Documentos hermanos: INF-049, 050, 051. Commit 9146569.",
    file_url: publicUrl,
    file_name: fileName,
    file_size: fileSize,
    category: "técnico",
    uploaded_by: "4aa3c729-8549-4170-8c9d-62d1c0aff204",
  });
  if (insErr) { console.error("Insert error:", insErr.message); return; }
  console.log(`SUBIDO a plataforma (PROD): ${fileName} (${(fileSize / 1024).toFixed(0)} KB)\n  ${publicUrl}`);
}
main().catch(console.error);
