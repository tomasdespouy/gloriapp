/**
 * Regenerate images + videos for specific patients with better prompts
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

const PATIENTS = [
  {
    slug: "renata-ayala",
    prompt: "Professional portrait photograph taken with a DSLR camera of a 29 year old Argentine woman who is a professional ballet dancer. She has light brown hair pulled back, fair skin with slight freckles, defined cheekbones. She wears a simple dark top. Neutral but slightly guarded expression. Clean studio background, soft natural lighting. Photorealistic, NOT illustration, NOT cartoon, NOT anime. Real human photograph."
  },
  {
    slug: "sofia-pellegrini",
    prompt: "Professional portrait photograph taken with a DSLR camera of a 24 year old Argentine university student woman. She has wavy dark blonde hair, light olive skin, green-hazel eyes. She wears a casual sweater. Slightly introverted expression, looking slightly to the side. Clean studio background, warm natural lighting. Photorealistic, NOT illustration, NOT cartoon, NOT anime. Real human photograph."
  },
];

async function processPatient({ slug, prompt }) {
  console.log(`\n${slug}: Generating new image...`);

  fs.writeFileSync(path.resolve(__dirname, "../.tmp_body.json"), JSON.stringify({
    model: "dall-e-3", prompt, n: 1, size: "1024x1024", quality: "hd",
  }));

  const imgResult = JSON.parse(curl(
    `-X POST 'https://api.openai.com/v1/images/generations' ` +
    `-H 'Authorization: Bearer ${OPENAI_KEY}' ` +
    `-H 'Content-Type: application/json' ` +
    `-d @.tmp_body.json --max-time 120`
  ));

  if (imgResult.error) throw new Error(imgResult.error.message);
  const imgUrl = imgResult.data?.[0]?.url;
  if (!imgUrl) throw new Error("No image URL");

  // Upload image
  fs.writeFileSync(path.resolve(__dirname, "../.tmp_url"), imgUrl);
  curlBin(`-o .tmp_asset -L "$(cat .tmp_url)" --max-time 180`);
  curl(
    `-X PUT '${SUPABASE_URL}/storage/v1/object/patients/${slug}.png' ` +
    `-H 'apikey: ${SERVICE_KEY}' -H 'Authorization: Bearer ${SERVICE_KEY}' ` +
    `-H 'Content-Type: image/png' -H 'x-upsert: true' ` +
    `--upload-file .tmp_asset --max-time 180`
  );
  console.log(`  Image OK`);

  // Generate video
  console.log(`  Generating video...`);
  const imageUrl = `${SUPABASE_URL}/storage/v1/object/public/patients/${slug}.png`;
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
  for (const p of PATIENTS) {
    try {
      await processPatient(p);
    } catch (err) {
      console.error(`\n  FAILED: ${err.message}`);
    }
  }
  try { fs.unlinkSync(path.resolve(__dirname, "../.tmp_asset")); } catch {}
  try { fs.unlinkSync(path.resolve(__dirname, "../.tmp_body.json")); } catch {}
  try { fs.unlinkSync(path.resolve(__dirname, "../.tmp_url")); } catch {}
  console.log("\nDone!");
}

main().catch(console.error);
