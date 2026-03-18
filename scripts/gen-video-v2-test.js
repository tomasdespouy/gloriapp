/**
 * Test new video prompt with 2 patients
 * Applies Luma credit optimization rules:
 * - 10 min polling timeout
 * - Save gen_ids to file for rescue
 * - No blind retries
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
const GEN_IDS_FILE = path.resolve(__dirname, "../.luma-gen-ids.json");

const PROMPT_V2 = "Photorealistic portrait with subtle natural motion. The person breathes gently with slight shoulder movement, blinks naturally, and makes minimal micro-expressions. The expression remains calm and neutral with occasional subtle shifts — a slight tightening of the lips, a brief softening of the eyes, a micro-frown. NO smiling, NO laughing. The person looks thoughtful and present, like sitting in a waiting room. High skin detail, 4k, cinematic lighting, static camera.";

const TEST_SLUGS = ["fernanda-contreras", "roberto-salas"];

function curl(args) {
  return execSync(`cd "${DIR}" && curl -s ${args}`, { encoding: "utf8", shell: BASH, maxBuffer: 50 * 1024 * 1024 });
}
function curlBin(args) {
  execSync(`cd "${DIR}" && curl -s ${args}`, { shell: BASH });
}

// Load or create gen_ids tracking file
function loadGenIds() {
  try { return JSON.parse(fs.readFileSync(GEN_IDS_FILE, "utf8")); } catch { return {}; }
}
function saveGenId(slug, genId) {
  const ids = loadGenIds();
  ids[slug] = { genId, createdAt: new Date().toISOString(), prompt: "v2" };
  fs.writeFileSync(GEN_IDS_FILE, JSON.stringify(ids, null, 2));
}

function generateVideo(slug) {
  const imageUrl = `${SUPABASE_URL}/storage/v1/object/public/patients/${slug}.png`;
  console.log(`\n${slug}`);
  console.log(`  Image: ${imageUrl}`);

  // Check if there's already a pending generation
  const existing = loadGenIds()[slug];
  if (existing && existing.prompt === "v2") {
    console.log(`  Found existing gen_id: ${existing.genId} — checking status first...`);
    try {
      const status = JSON.parse(curl(
        `-X GET 'https://api.lumalabs.ai/dream-machine/v1/generations/${existing.genId}' ` +
        `-H 'Authorization: Bearer ${LUMA_KEY}' --max-time 30`
      ));
      if (status.state === "completed" && status.assets?.video) {
        console.log("  Already completed! Downloading...");
        downloadAndUpload(slug, status.assets.video);
        return;
      }
      if (status.state === "dreaming" || status.state === "processing") {
        console.log(`  Still ${status.state} — polling...`);
        return pollAndDownload(slug, existing.genId);
      }
    } catch { /* proceed to new generation */ }
  }

  // Start new generation
  fs.writeFileSync(path.resolve(__dirname, "../.tmp_body.json"), JSON.stringify({
    model: "ray-2",
    prompt: PROMPT_V2,
    keyframes: { frame0: { type: "image", url: imageUrl } },
  }));

  const gen = JSON.parse(curl(
    `-X POST 'https://api.lumalabs.ai/dream-machine/v1/generations' ` +
    `-H 'Authorization: Bearer ${LUMA_KEY}' -H 'Content-Type: application/json' ` +
    `-d @.tmp_body.json --max-time 60`
  ));

  if (!gen.id) throw new Error("No gen ID: " + JSON.stringify(gen).substring(0, 100));

  // Save gen_id immediately
  saveGenId(slug, gen.id);
  console.log(`  Gen ID: ${gen.id} (saved to .luma-gen-ids.json)`);

  pollAndDownload(slug, gen.id);
}

function pollAndDownload(slug, genId) {
  process.stdout.write("  Polling (10 min max) ");
  // 120 polls * 5s = 10 minutes
  for (let i = 0; i < 120; i++) {
    execSync("sleep 5", { shell: BASH });
    const status = JSON.parse(curl(
      `-X GET 'https://api.lumalabs.ai/dream-machine/v1/generations/${genId}' ` +
      `-H 'Authorization: Bearer ${LUMA_KEY}' --max-time 30`
    ));
    if (status.state === "completed") {
      if (!status.assets?.video) throw new Error("Completed but no video URL");
      console.log("");
      downloadAndUpload(slug, status.assets.video);
      return;
    }
    if (status.state === "failed") throw new Error("Luma failed: " + (status.failure_reason || "unknown"));
    process.stdout.write(".");
  }
  throw new Error("Timed out after 10 minutes — check .luma-gen-ids.json to rescue later");
}

function downloadAndUpload(slug, videoUrl) {
  console.log("  Downloading...");
  fs.writeFileSync(path.resolve(__dirname, "../.tmp_url"), videoUrl);
  curlBin(`-o .tmp_video -L "$(cat .tmp_url)" --max-time 300`);

  console.log("  Uploading to Supabase...");
  curl(
    `-X PUT '${SUPABASE_URL}/storage/v1/object/patients/${slug}.mp4' ` +
    `-H 'apikey: ${SERVICE_KEY}' -H 'Authorization: Bearer ${SERVICE_KEY}' ` +
    `-H 'Content-Type: video/mp4' -H 'x-upsert: true' ` +
    `--upload-file .tmp_video --max-time 300`
  );

  const sz = fs.statSync(path.resolve(__dirname, "../.tmp_video")).size;
  console.log(`  OK (${Math.round(sz / 1024)} KB)`);
  try { fs.unlinkSync(path.resolve(__dirname, "../.tmp_video")); } catch {}
}

// Main
console.log("=== Testing video prompt V2 with 2 patients ===");
console.log(`Prompt: ${PROMPT_V2.substring(0, 80)}...\n`);

let ok = 0, fail = 0;
for (const slug of TEST_SLUGS) {
  try {
    generateVideo(slug);
    ok++;
  } catch (e) {
    console.log(`\n  FAILED: ${e.message.substring(0, 120)}`);
    fail++;
  }
}

try { fs.unlinkSync(path.resolve(__dirname, "../.tmp_body.json")); } catch {}
try { fs.unlinkSync(path.resolve(__dirname, "../.tmp_url")); } catch {}

console.log(`\n${"═".repeat(50)}`);
console.log(`RESULT: ${ok} OK, ${fail} failed`);
console.log(`COST ESTIMATE: ${ok + fail} credits used = ~$${((ok + fail) * 0.4).toFixed(2)} USD`);
console.log(`(Luma pricing: ~$0.40/credit for ray-2 5s video)`);
console.log(`${"═".repeat(50)}`);
