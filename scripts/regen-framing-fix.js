/**
 * Regenerate 13 patient images with consistent 40% face framing
 * Fixes: too small (6), too large (6), wrong gender (Rafael)
 */
require("dotenv").config({ path: ".env.local" });
const { GoogleGenAI } = require("@google/genai");
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const { execSync } = require("child_process");

const gemini = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const BASE = "Photorealistic head and shoulders portrait, square format, edge-to-edge with ZERO white borders. Face occupies approximately 40% of the frame — medium close-up showing head, neck and top of shoulders. A real person with authentic features, looking directly at the camera. Soft, natural lighting. Natural skin texture with pores, imperfections, and asymmetry. NOT idealized, NOT plastic, NOT a model. No text, no watermarks.";

const TO_FIX = [
  // Too small
  "Mateo Giménez", "Daniela Moreno", "Yamilet Pérez",
  "Diego Fuentes", "Sofía Pellegrini", "Alejandro Vega",
  // Too large
  "Valentina Ospina", "Macarena Sepúlveda", "Altagracia Marte",
  "Patricia Hernández", "Marcos Herrera", "Yesenia De Los Santos",
  // Wrong gender
  "Rafael Santos",
];

function slugify(n) { return n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-"); }

async function main() {
  console.log(`=== Regenerating ${TO_FIX.length} images with 40% face framing ===\n`);

  const { data: patients } = await sb.from("ai_patients").select("name, age, country, visual_identity").in("name", TO_FIX);
  if (!patients) { console.error("No patients found"); return; }

  let ok = 0, fail = 0;
  for (const p of TO_FIX) {
    const patient = patients.find(x => x.name === p);
    if (!patient) { console.log(`${p}: NOT FOUND`); fail++; continue; }

    const slug = slugify(p);
    const vi = patient.visual_identity;
    const gender = vi.gender || "person";

    const prompt = [
      BASE,
      `${patient.age} year old ${gender} from ${patient.country}.`,
      `${vi.etnia}.`,
      `${vi.gesto}.`,
      `${vi.pelo_estilo}, ${vi.pelo_color} hair.`,
      `${vi.tez} skin.`,
      `Wearing ${vi.ropa_tipo} in ${vi.ropa_color}.`,
      vi.accesorios !== "Sin accesorios" ? `${vi.accesorios}.` : "",
      `${vi.fondo} background.`,
    ].filter(Boolean).join(" ");

    console.log(`[${ok + fail + 1}/${TO_FIX.length}] ${p} (${gender})`);
    try {
      const res = await gemini.models.generateImages({
        model: "imagen-4.0-generate-001",
        prompt,
        config: { numberOfImages: 1, aspectRatio: "1:1", personGeneration: "ALLOW_ADULT", outputMimeType: "image/png" },
      });
      const img = res.generatedImages?.[0];
      if (!img?.image?.imageBytes) throw new Error("No image");

      fs.writeFileSync("_tmp_raw.png", Buffer.from(img.image.imageBytes, "base64"));
      execSync("python scripts/resize512.py _tmp_raw.png _tmp_out.png");
      const compressed = fs.readFileSync("_tmp_out.png");

      const { error } = await sb.storage.from("patients").upload(`${slug}.png`, compressed, { contentType: "image/png", upsert: true });
      if (error) throw new Error("Upload: " + error.message);

      console.log(`  OK (${Math.round(compressed.length / 1024)} KB)`);
      ok++;
    } catch (e) {
      console.error(`  FAILED: ${e.message?.substring(0, 120)}`);
      fail++;
    }

    if (ok + fail < TO_FIX.length) await new Promise(r => setTimeout(r, 2000));
  }

  try { fs.unlinkSync("_tmp_raw.png"); } catch {}
  try { fs.unlinkSync("_tmp_out.png"); } catch {}

  console.log(`\n=== Done! ${ok} OK, ${fail} failed ===`);
}

main().catch(console.error);
