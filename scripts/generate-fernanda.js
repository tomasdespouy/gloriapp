/**
 * Generate missing image + video for Fernanda Contreras
 * Uses Gemini Imagen 4 for image + Luma AI for video
 *
 * Usage: node scripts/generate-fernanda.js
 */
require("dotenv").config({ path: ".env.local" });
const { GoogleGenAI } = require("@google/genai");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const GOOGLE_KEY = process.env.GOOGLE_API_KEY;
const LUMA_KEY = process.env.LUMA_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASH = "C:\\Program Files\\Git\\usr\\bin\\bash.exe";
const DIR = path.resolve(__dirname, "..").replace(/\\/g, "/");

function curl(args) {
  return execSync(`cd "${DIR}" && curl -s ${args}`, { encoding: "utf8", shell: BASH, maxBuffer: 50 * 1024 * 1024 });
}
function curlBin(args) {
  execSync(`cd "${DIR}" && curl -s ${args}`, { shell: BASH });
}

const SLUG = "fernanda-contreras";
const PROMPT = `Close-up portrait photograph showing full head and shoulders of a 23 year old Chilean woman, nursing student. Light to medium brown skin, dark brown eyes, long dark brown hair (straight or slightly wavy). Youthful face with soft features. Wears a simple casual top. Expression is warm but slightly anxious, like someone who is caring but overwhelmed. She looks like a typical young Chilean university student. Plain gray studio backdrop. Full head visible, not cropped. Shot on Canon EOS R5 with 85mm f/1.4 lens. Shallow depth of field. Real skin texture. RAW photograph.`;

async function generateImage() {
  console.log("Generating image with Gemini Imagen 4...");
  const gemini = new GoogleGenAI({ apiKey: GOOGLE_KEY });

  const response = await gemini.models.generateImages({
    model: "imagen-4.0-generate-001",
    prompt: PROMPT,
    config: {
      numberOfImages: 1,
      aspectRatio: "1:1",
      personGeneration: "allow_adult",
      outputMimeType: "image/png",
    },
  });

  const image = response.generatedImages?.[0];
  if (!image?.image?.imageBytes) {
    throw new Error("No se generó imagen");
  }

  // Save locally as temp file
  const buffer = Buffer.from(image.image.imageBytes, "base64");
  const tmpPath = path.resolve(__dirname, "../.tmp_asset");
  fs.writeFileSync(tmpPath, buffer);
  console.log(`Image generated (${Math.round(buffer.length / 1024)} KB)`);

  // Upload to Supabase Storage
  console.log("Uploading to Supabase Storage...");
  curl(
    `-X PUT '${SUPABASE_URL}/storage/v1/object/patients/${SLUG}.png' ` +
    `-H 'apikey: ${SERVICE_KEY}' -H 'Authorization: Bearer ${SERVICE_KEY}' ` +
    `-H 'Content-Type: image/png' -H 'x-upsert: true' ` +
    `--upload-file .tmp_asset --max-time 180`
  );
  console.log("Image uploaded OK");
}

function generateVideo() {
  const imageUrl = `${SUPABASE_URL}/storage/v1/object/public/patients/${SLUG}.png`;
  console.log("\nGenerating video with Luma AI...");
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
  console.log(`Gen ID: ${gen.id} — polling...`);

  for (let i = 0; i < 60; i++) {
    execSync("sleep 5", { shell: BASH });
    const status = JSON.parse(curl(
      `-X GET 'https://api.lumalabs.ai/dream-machine/v1/generations/${gen.id}' ` +
      `-H 'Authorization: Bearer ${LUMA_KEY}' --max-time 30`
    ));
    if (status.state === "completed") {
      const videoUrl = status.assets?.video;
      if (!videoUrl) throw new Error("No video URL");
      console.log("Downloading video...");
      fs.writeFileSync(path.resolve(__dirname, "../.tmp_url"), videoUrl);
      curlBin(`-o .tmp_asset -L "$(cat .tmp_url)" --max-time 300`);
      console.log("Uploading video to Supabase...");
      curl(
        `-X PUT '${SUPABASE_URL}/storage/v1/object/patients/${SLUG}.mp4' ` +
        `-H 'apikey: ${SERVICE_KEY}' -H 'Authorization: Bearer ${SERVICE_KEY}' ` +
        `-H 'Content-Type: video/mp4' -H 'x-upsert: true' ` +
        `--upload-file .tmp_asset --max-time 300`
      );
      console.log("Video uploaded OK");
      return;
    }
    if (status.state === "failed") throw new Error("Luma generation failed");
    process.stdout.write(".");
  }
  throw new Error("Video generation timed out");
}

async function main() {
  console.log(`=== Generating assets for ${SLUG} ===\n`);

  try {
    await generateImage();
  } catch (err) {
    console.error(`IMAGE FAILED: ${err.message}`);
    process.exit(1);
  }

  if (LUMA_KEY) {
    try {
      generateVideo();
    } catch (err) {
      console.error(`VIDEO FAILED: ${err.message}`);
    }
  } else {
    console.log("\nLUMA_API_KEY not set, skipping video generation.");
  }

  // Cleanup
  try { fs.unlinkSync(path.resolve(__dirname, "../.tmp_asset")); } catch {}
  try { fs.unlinkSync(path.resolve(__dirname, "../.tmp_body.json")); } catch {}
  try { fs.unlinkSync(path.resolve(__dirname, "../.tmp_url")); } catch {}

  console.log(`\nDone! Check: ${SUPABASE_URL}/storage/v1/object/public/patients/${SLUG}.png`);
}

main().catch(console.error);
