/**
 * Fix Altagracia (60 not 80) + Carlos (differentiate from Edwin)
 * Then generate videos for the 7 approved patients
 */
require("dotenv").config({ path: ".env.local" });
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const LUMA_KEY = process.env.LUMA_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASH = "C:\\Program Files\\Git\\usr\\bin\\bash.exe";
const DIR = path.resolve(__dirname, "..").replace(/\\/g, "/");

function curl(args) {
  return execSync(`cd "${DIR}" && curl -s ${args}`, { encoding: "utf8", shell: BASH, maxBuffer: 50*1024*1024 });
}
function curlBin(args) {
  execSync(`cd "${DIR}" && curl -s ${args}`, { shell: BASH });
}

const SUFFIX = "Shot on Canon EOS R5 with 85mm f/1.4 lens. Shallow depth of field. Real skin texture with pores and imperfections. RAW photograph, absolutely NO digital art, NO painting, NO illustration, NO 3D render, NO cartoon.";

// Step 1: Regenerate images for Altagracia + Carlos
const REGEN_IMAGES = [
  {
    slug: "altagracia-marte",
    prompt: `Close-up portrait photograph showing full head and shoulders of a 60 year old Dominican woman, seamstress. Dark Afro-Caribbean black skin, short natural gray hair (not fully white, mix of gray and black). She looks her age - 60, NOT elderly. Some wrinkles around eyes and mouth but skin still has elasticity. Round, full face. Wears a colorful floral blouse and a thin gold chain with small cross. Expression is dignified but tired, with warmth in her eyes. Plain gray studio backdrop. Full head visible, not cropped. ${SUFFIX}`
  },
  {
    slug: "carlos-quispe",
    prompt: `Close-up portrait photograph of a 42 year old Peruvian man, taxi driver in Lima. Mestizo features (mixed indigenous and Spanish), medium brown skin, rounder softer face than typical highland indigenous. Short black hair with a slight wave, clean shaven, brown eyes. Wears a collared polo shirt. Slightly chubby cheeks. Looks like an urban Lima working-class man, friendly but tired. Plain gray studio backdrop. ${SUFFIX}`
  },
];

// Step 2: Generate videos for the 7 approved + 2 fixed above = 9 total
const VIDEO_SLUGS = [
  "rosa-huaman",
  "jimena-ramirez",
  "edwin-quispe",
  "alejandro-vega",
  "sofia-pellegrini",
  "mateo-gimenez",
  "macarena-sepulveda",
  "altagracia-marte",
  "carlos-quispe",
];

function generateImage(slug, prompt) {
  console.log(`  Generating image...`);
  fs.writeFileSync(path.resolve(__dirname, "../.tmp_body.json"), JSON.stringify({
    model: "dall-e-3", prompt, n: 1, size: "1024x1024", quality: "hd",
  }));
  const result = JSON.parse(curl(
    `-X POST 'https://api.openai.com/v1/images/generations' ` +
    `-H 'Authorization: Bearer ${OPENAI_KEY}' ` +
    `-H 'Content-Type: application/json' ` +
    `-d @.tmp_body.json --max-time 120`
  ));
  if (result.error) throw new Error(result.error.message);
  const imgUrl = result.data?.[0]?.url;
  if (!imgUrl) throw new Error("No image URL");

  fs.writeFileSync(path.resolve(__dirname, "../.tmp_url"), imgUrl);
  curlBin(`-o .tmp_asset -L "$(cat .tmp_url)" --max-time 180`);
  curl(
    `-X PUT '${SUPABASE_URL}/storage/v1/object/patients/${slug}.png' ` +
    `-H 'apikey: ${SERVICE_KEY}' -H 'Authorization: Bearer ${SERVICE_KEY}' ` +
    `-H 'Content-Type: image/png' -H 'x-upsert: true' ` +
    `--upload-file .tmp_asset --max-time 180`
  );
  console.log(`  Image OK`);
}

function generateVideo(slug) {
  const imageUrl = `${SUPABASE_URL}/storage/v1/object/public/patients/${slug}.png`;
  console.log(`  Generating video...`);
  fs.writeFileSync(path.resolve(__dirname, "../.tmp_body.json"), JSON.stringify({
    model: "ray-2",
    prompt: "Subtle natural movement: gentle breathing, slight eye blinks, micro facial expressions. The person stays still, looking forward with a calm, neutral presence. Photorealistic, no camera movement.",
    keyframes: { frame0: { type: "image", url: imageUrl } },
  }));

  const gen = JSON.parse(curl(
    `-X POST 'https://api.lumalabs.ai/dream-machine/v1/generations' ` +
    `-H 'Authorization: Bearer ${LUMA_KEY}' -H 'Content-Type: application/json' ` +
    `-d @.tmp_body.json --max-time 60`
  ));
  if (!gen.id) throw new Error("No gen ID: " + JSON.stringify(gen));
  console.log(`  Gen ID: ${gen.id}`);

  for (let i = 0; i < 60; i++) {
    execSync("sleep 5", { shell: BASH });
    const status = JSON.parse(curl(
      `-X GET 'https://api.lumalabs.ai/dream-machine/v1/generations/${gen.id}' ` +
      `-H 'Authorization: Bearer ${LUMA_KEY}' --max-time 30`
    ));
    if (status.state === "completed") {
      const videoUrl = status.assets?.video;
      if (!videoUrl) throw new Error("No video URL");
      fs.writeFileSync(path.resolve(__dirname, "../.tmp_url"), videoUrl);
      curlBin(`-o .tmp_asset -L "$(cat .tmp_url)" --max-time 300`);
      curl(
        `-X PUT '${SUPABASE_URL}/storage/v1/object/patients/${slug}.mp4' ` +
        `-H 'apikey: ${SERVICE_KEY}' -H 'Authorization: Bearer ${SERVICE_KEY}' ` +
        `-H 'Content-Type: video/mp4' -H 'x-upsert: true' ` +
        `--upload-file .tmp_asset --max-time 300`
      );
      console.log(`\n  Video OK`);
      return;
    }
    if (status.state === "failed") throw new Error("Luma failed");
    process.stdout.write(".");
  }
  throw new Error("Timed out");
}

async function main() {
  // Step 1: Fix Altagracia + Carlos images
  console.log("=== STEP 1: Fixing images ===\n");
  for (const p of REGEN_IMAGES) {
    console.log(`${p.slug}:`);
    try {
      generateImage(p.slug, p.prompt);
    } catch (err) {
      console.error(`  IMAGE FAILED: ${err.message.substring(0, 100)}`);
    }
  }

  // Step 2: Generate videos for all 9
  console.log("\n=== STEP 2: Generating videos (9 patients) ===\n");
  let success = 0, failed = 0;
  for (const slug of VIDEO_SLUGS) {
    console.log(`[${success+failed+1}/${VIDEO_SLUGS.length}] ${slug}`);
    try {
      generateVideo(slug);
      success++;
    } catch (err) {
      console.error(`\n  VIDEO FAILED: ${err.message.substring(0, 100)}`);
      failed++;
    }
  }

  try { fs.unlinkSync(path.resolve(__dirname, "../.tmp_asset")); } catch {}
  try { fs.unlinkSync(path.resolve(__dirname, "../.tmp_body.json")); } catch {}
  try { fs.unlinkSync(path.resolve(__dirname, "../.tmp_url")); } catch {}

  console.log(`\nDone! Videos: ${success} OK, ${failed} failed`);
}

main().catch(console.error);
