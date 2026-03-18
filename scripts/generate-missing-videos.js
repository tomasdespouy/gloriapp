/**
 * Generate only the missing videos for patients that already have images
 * Usage: node scripts/generate-missing-videos.js
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
  return execSync(`cd "${DIR}" && curl -s ${args}`, { encoding: "utf8", shell: BASH, maxBuffer: 50*1024*1024 });
}

function curlBinary(args) {
  execSync(`cd "${DIR}" && curl -s ${args}`, { shell: BASH });
}

// Patients needing videos (already have .png but not .mp4)
const NEED_VIDEO = [
  "camila-bertoni",
  "lorena-gutierrez",
  "patricia-hernandez",
  "yesenia-de-los-santos",
];

async function main() {
  console.log(`\nGenerating videos for ${NEED_VIDEO.length} patients:\n`);
  let success = 0, failed = 0;

  for (const slug of NEED_VIDEO) {
    console.log(`\n[${success+failed+1}/${NEED_VIDEO.length}] ${slug}`);
    const imageUrl = `${SUPABASE_URL}/storage/v1/object/public/patients/${slug}.png`;

    try {
      // Start Luma generation
      console.log("  Starting Luma generation...");
      fs.writeFileSync(path.resolve(__dirname, "../.tmp_body.json"), JSON.stringify({
        model: "ray-2",
        prompt: "Subtle natural movement: gentle breathing, slight eye blinks, micro facial expressions. The person stays still, looking forward with a calm, neutral presence. Photorealistic, no camera movement.",
        keyframes: { frame0: { type: "image", url: imageUrl } },
      }));

      const genResult = JSON.parse(curl(
        `-X POST 'https://api.lumalabs.ai/dream-machine/v1/generations' ` +
        `-H 'Authorization: Bearer ${LUMA_KEY}' ` +
        `-H 'Content-Type: application/json' ` +
        `-d @.tmp_body.json --max-time 60`
      ));

      if (!genResult.id) throw new Error("No generation ID: " + JSON.stringify(genResult));
      console.log(`  Generation ID: ${genResult.id}`);

      // Poll for completion
      let videoUrl = null;
      for (let i = 0; i < 60; i++) {
        execSync("sleep 5", { shell: BASH });
        const status = JSON.parse(curl(
          `-X GET 'https://api.lumalabs.ai/dream-machine/v1/generations/${genResult.id}' ` +
          `-H 'Authorization: Bearer ${LUMA_KEY}' --max-time 30`
        ));

        if (status.state === "completed") {
          videoUrl = status.assets?.video;
          break;
        }
        if (status.state === "failed") throw new Error("Luma generation failed");
        process.stdout.write(".");
      }

      if (!videoUrl) throw new Error("Video timed out");

      // Download video and upload to Supabase
      console.log("\n  Downloading & uploading video...");
      fs.writeFileSync(path.resolve(__dirname, "../.tmp_url"), videoUrl);
      curlBinary(`-o .tmp_asset -L "$(cat .tmp_url)" --max-time 300`);

      const uploadUrl = `${SUPABASE_URL}/storage/v1/object/patients/${slug}.mp4`;
      const uploadResult = curl(
        `-w '\\n%{http_code}' -X PUT '${uploadUrl}' ` +
        `-H 'apikey: ${SERVICE_KEY}' ` +
        `-H 'Authorization: Bearer ${SERVICE_KEY}' ` +
        `-H 'Content-Type: video/mp4' ` +
        `-H 'x-upsert: true' ` +
        `--upload-file .tmp_asset --max-time 180`
      );

      const httpCode = uploadResult.trim().split("\n").pop();
      if (!httpCode.startsWith("2")) throw new Error(`Upload HTTP ${httpCode}`);

      console.log(`  Video OK: ${slug}.mp4`);
      success++;
    } catch (err) {
      console.error(`\n  FAILED: ${err.message}`);
      failed++;
    }
  }

  // Cleanup
  try { fs.unlinkSync(path.resolve(__dirname, "../.tmp_asset")); } catch {}
  try { fs.unlinkSync(path.resolve(__dirname, "../.tmp_body.json")); } catch {}
  try { fs.unlinkSync(path.resolve(__dirname, "../.tmp_url")); } catch {}

  console.log(`\n\nDone! Success: ${success}, Failed: ${failed}`);
}

main().catch(console.error);
