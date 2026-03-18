/**
 * Generate 5 test patient images using visual_identity from DB
 * Reads visual_identity from ai_patients table, builds prompt, generates with Imagen 4
 *
 * Usage: node scripts/regen-5-test.js
 */
require("dotenv").config({ path: ".env.local" });
const { GoogleGenAI } = require("@google/genai");
const { createClient } = require("@supabase/supabase-js");

const gemini = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Same base prompt as src/lib/patient-image-prompt.ts
const BASE = "Photorealistic close-up portrait, square format, fully framed within the image. A real person with authentic features, looking directly at the camera. Soft, natural lighting. Natural skin texture with pores, imperfections, and asymmetry. NOT idealized, NOT plastic, NOT a model. No text, no watermarks.";

const FEMALE_NAMES = [
  "Lucía", "Lucia", "Carmen", "Fernanda", "Macarena", "Milagros", "Catalina",
  "Lorena", "Daniela", "Jimena", "Patricia", "Camila", "Renata", "Altagracia",
  "Yesenia", "Rosa", "Sofía", "Sofia", "Valentina", "Yamilet", "Mariana",
];

function buildPrompt(patient, identity) {
  const first = patient.name.split(" ")[0];
  const gender = FEMALE_NAMES.some(f => first.startsWith(f)) ? "woman" : "man";

  return [
    BASE,
    `${patient.age} year old ${gender} from ${patient.country}.`,
    `${identity.etnia}.`,
    `${identity.gesto}.`,
    `${identity.pelo_estilo}, ${identity.pelo_color} hair.`,
    `${identity.tez} skin.`,
    `Wearing ${identity.ropa_tipo} in ${identity.ropa_color}.`,
    identity.accesorios !== "Sin accesorios" ? identity.accesorios + "." : "",
    `${identity.fondo} background.`,
  ].filter(Boolean).join(" ");
}

function slugify(name) {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");
}

// 5 test patients — diverse selection
const TEST_NAMES = [
  "Jorge Ramírez",        // 58M, obrero, México, zapoteco
  "Daniela Moreno",       // 35F, enfermera, Colombia, afrocolombiana
  "Rafael Santos",        // 45M, músico, Rep. Dom., mulato
  "Gabriel Navarro",      // 49M, trabajador social, Chile/Venezuela
  "Fernanda Contreras",   // 23F, enfermería, Chile
];

async function generateAndUpload(patient) {
  const slug = slugify(patient.name);
  const identity = patient.visual_identity;

  if (!identity) {
    console.log(`  SKIP: No visual_identity found`);
    return null;
  }

  const prompt = buildPrompt(patient, identity);

  console.log(`\n[${patient.name}] (${slug})`);
  console.log(`  ${prompt.substring(0, 150)}...`);
  console.log(`  Generating...`);

  const response = await gemini.models.generateImages({
    model: "imagen-4.0-generate-001",
    prompt,
    config: {
      numberOfImages: 1,
      aspectRatio: "1:1",
      personGeneration: "ALLOW_ADULT",
      outputMimeType: "image/png",
    },
  });

  const image = response.generatedImages?.[0];
  if (!image?.image?.imageBytes) throw new Error("No image generated");

  const buffer = Buffer.from(image.image.imageBytes, "base64");
  console.log(`  Image OK (${Math.round(buffer.length / 1024)} KB)`);

  const fileName = `${slug}.png`;
  const { error } = await supabase.storage.from("patients").upload(fileName, buffer, {
    contentType: "image/png",
    upsert: true,
  });
  if (error) throw new Error(`Upload: ${error.message}`);

  const { data } = supabase.storage.from("patients").getPublicUrl(fileName);
  console.log(`  Uploaded: ${data.publicUrl}`);
  return data.publicUrl;
}

async function main() {
  console.log("=== Generating 5 test images from DB visual_identity ===\n");

  // Fetch patients from DB
  const { data: patients, error } = await supabase
    .from("ai_patients")
    .select("name, age, occupation, country, visual_identity")
    .in("name", TEST_NAMES);

  if (error) { console.error("DB error:", error.message); return; }
  if (!patients?.length) { console.error("No patients found"); return; }

  console.log(`Found ${patients.length} patients in DB`);

  let success = 0, failed = 0;
  for (const patient of patients) {
    try {
      await generateAndUpload(patient);
      success++;
    } catch (err) {
      console.error(`  FAILED: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n=== Done! ${success} OK, ${failed} failed ===`);
}

main().catch(console.error);
