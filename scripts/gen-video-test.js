/**
 * Generate video for 1 patient using Luma AI ray-2
 * Usage: node scripts/gen-video-test.js
 */
require("dotenv").config({ path: ".env.local" });
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

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
const IMAGE_URL = `${SUPABASE_URL}/storage/v1/object/public/patients/${SLUG}.png`;
const PROMPT = "Photorealistic portrait with dynamic natural motion. The person exhibits organic movement: shifting their weight slightly, natural shoulder movement from breathing, and frequent eye blinking. The facial expression transitions fluidly and randomly between a neutral gaze, a genuine warm laugh, and a look of cold indifference. High skin detail, 4k, cinematic lighting, static camera.";

async function main() {
  console.log(`=== Generating video for ${SLUG} ===`);
  console.log(`Image: ${IMAGE_URL}`);
  console.log(`Prompt: ${PROMPT.substring(0, 80)}...\n`);

  // Start generation
  fs.writeFileSync(path.resolve(__dirname, "../.tmp_body.json"), JSON.stringify({
    model: "ray-2",
    prompt: PROMPT,
    keyframes: { frame0: { type: "image", url: IMAGE_URL } },
  }));

  const gen = JSON.parse(curl(
    `-X POST 'https://api.lumalabs.ai/dream-machine/v1/generations' ` +
    `-H 'Authorization: Bearer ${LUMA_KEY}' -H 'Content-Type: application/json' ` +
    `-d @.tmp_body.json --max-time 60`
  ));

  if (!gen.id) {
    console.error("No gen ID:", JSON.stringify(gen));
    return;
  }
  console.log(`Gen ID: ${gen.id}`);
  console.log("Polling (1-3 min)...");

  // Poll
  for (let i = 0; i < 60; i++) {
    execSync("sleep 5", { shell: BASH });
    const status = JSON.parse(curl(
      `-X GET 'https://api.lumalabs.ai/dream-machine/v1/generations/${gen.id}' ` +
      `-H 'Authorization: Bearer ${LUMA_KEY}' --max-time 30`
    ));

    if (status.state === "completed") {
      const videoUrl = status.assets?.video;
      if (!videoUrl) { console.error("No video URL"); return; }

      console.log("\nVideo ready! Downloading...");
      fs.writeFileSync(path.resolve(__dirname, "../.tmp_url"), videoUrl);
      curlBin(`-o .tmp_video -L "$(cat .tmp_url)" --max-time 300`);

      console.log("Uploading to Supabase...");
      curl(
        `-X PUT '${SUPABASE_URL}/storage/v1/object/patients/${SLUG}.mp4' ` +
        `-H 'apikey: ${SERVICE_KEY}' -H 'Authorization: Bearer ${SERVICE_KEY}' ` +
        `-H 'Content-Type: video/mp4' -H 'x-upsert: true' ` +
        `--upload-file .tmp_video --max-time 300`
      );

      const size = fs.statSync(path.resolve(__dirname, "../.tmp_video")).size;
      console.log(`\nDone! Video: ${Math.round(size / 1024)} KB`);
      console.log(`URL: ${SUPABASE_URL}/storage/v1/object/public/patients/${SLUG}.mp4`);

      // Cleanup
      try { fs.unlinkSync(path.resolve(__dirname, "../.tmp_video")); } catch {}
      try { fs.unlinkSync(path.resolve(__dirname, "../.tmp_body.json")); } catch {}
      try { fs.unlinkSync(path.resolve(__dirname, "../.tmp_url")); } catch {}
      return;
    }

    if (status.state === "failed") {
      console.error("\nGeneration failed:", JSON.stringify(status).substring(0, 200));
      return;
    }

    process.stdout.write(".");
  }
  console.error("\nTimed out after 5 minutes");
}

main().catch(console.error);
