/**
 * Generate videos for ALL 34 patients using Luma AI ray-2
 * Processes in batches of 5 with pauses between batches
 * Usage: node scripts/gen-all-videos.js
 */
require("dotenv").config({ path: ".env.local" });
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const LUMA_KEY = process.env.LUMA_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASH = "C:\\Program Files\\Git\\usr\\bin\\bash.exe";
const DIR = path.resolve(__dirname, "..").replace(/\\/g, "/");

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const PROMPT = "Photorealistic portrait with dynamic natural motion. The person exhibits organic movement: shifting their weight slightly, natural shoulder movement from breathing, and frequent eye blinking. The facial expression transitions fluidly and randomly between a neutral gaze, a genuine warm laugh, and a look of cold indifference. High skin detail, 4k, cinematic lighting, static camera.";

// Skip already done (generated with new prompt on 2026-03-17)
const DONE = [
  "alejandro-vega", "altagracia-marte", "andres-castillo", "camila-bertoni",
  "carmen-torres", "catalina-rios", "daniela-moreno", "diego-fuentes",
  "fernanda-contreras", "carlos-quispe", "edwin-quispe", "gabriel-navarro",
  "gustavo-peralta", "hernan-mejia", "ignacio-poblete", "jimena-ramirez",
  "lorena-gutierrez", "lucia-mendoza", "macarena-sepulveda", "marcos-herrera",
  "mariana-sanchez", "mateo-gimenez", "milagros-flores", "patricia-hernandez",
  "rafael-santos", "renata-ayala", "roberto-salas", "rosa-huaman",
  "samuel-batista", "sofia-pellegrini", "valentina-ospina", "yamilet-perez",
];

function curl(args) {
  return execSync(`cd "${DIR}" && curl -s ${args}`, { encoding: "utf8", shell: BASH, maxBuffer: 50 * 1024 * 1024 });
}
function curlBin(args) {
  execSync(`cd "${DIR}" && curl -s ${args}`, { shell: BASH });
}
function slugify(n) {
  return n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");
}

function generateVideo(slug) {
  const imageUrl = `${SUPABASE_URL}/storage/v1/object/public/patients/${slug}.png`;

  fs.writeFileSync(path.resolve(__dirname, "../.tmp_body.json"), JSON.stringify({
    model: "ray-2",
    prompt: PROMPT,
    keyframes: { frame0: { type: "image", url: imageUrl } },
  }));

  const gen = JSON.parse(curl(
    `-X POST 'https://api.lumalabs.ai/dream-machine/v1/generations' ` +
    `-H 'Authorization: Bearer ${LUMA_KEY}' -H 'Content-Type: application/json' ` +
    `-d @.tmp_body.json --max-time 60`
  ));

  if (!gen.id) throw new Error("No gen ID: " + JSON.stringify(gen).substring(0, 100));

  process.stdout.write(`  Gen ${gen.id} `);

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
      curlBin(`-o .tmp_video -L "$(cat .tmp_url)" --max-time 300`);

      curl(
        `-X PUT '${SUPABASE_URL}/storage/v1/object/patients/${slug}.mp4' ` +
        `-H 'apikey: ${SERVICE_KEY}' -H 'Authorization: Bearer ${SERVICE_KEY}' ` +
        `-H 'Content-Type: video/mp4' -H 'x-upsert: true' ` +
        `--upload-file .tmp_video --max-time 300`
      );

      const size = fs.statSync(path.resolve(__dirname, "../.tmp_video")).size;
      try { fs.unlinkSync(path.resolve(__dirname, "../.tmp_video")); } catch {}
      return Math.round(size / 1024);
    }

    if (status.state === "failed") throw new Error("Luma failed: " + (status.failure_reason || "unknown"));
    process.stdout.write(".");
  }
  throw new Error("Timed out");
}

async function main() {
  const { data: patients } = await sb.from("ai_patients").select("name").order("name");
  const all = patients.map(p => ({ name: p.name, slug: slugify(p.name) }));
  const remaining = all.filter(p => !DONE.includes(p.slug));

  console.log(`=== Generating videos for ${remaining.length} patients ===`);
  console.log(`Prompt: ${PROMPT.substring(0, 60)}...`);
  console.log(`Batch size: 5, pause between batches: 10s\n`);

  let totalOk = 0, totalFail = 0;

  for (let batch = 0; batch < remaining.length; batch += 5) {
    const chunk = remaining.slice(batch, batch + 5);
    const batchNum = Math.floor(batch / 5) + 1;
    const totalBatches = Math.ceil(remaining.length / 5);

    console.log(`\n── Batch ${batchNum}/${totalBatches} ──────────────────────────`);

    for (const p of chunk) {
      console.log(`\n[${totalOk + totalFail + 1}/${remaining.length}] ${p.name} (${p.slug})`);
      try {
        const sizeKB = generateVideo(p.slug);
        console.log(`\n  OK (${sizeKB} KB)`);
        totalOk++;
      } catch (e) {
        console.log(`\n  FAILED: ${e.message.substring(0, 100)}`);
        totalFail++;
      }
    }

    console.log(`\n── Batch ${batchNum} done: ${totalOk} OK, ${totalFail} failed total ──`);

    // Pause between batches (except after last)
    if (batch + 5 < remaining.length) {
      console.log("Pausing 10s before next batch...");
      execSync("sleep 10", { shell: BASH });
    }
  }

  // Cleanup
  try { fs.unlinkSync(path.resolve(__dirname, "../.tmp_body.json")); } catch {}
  try { fs.unlinkSync(path.resolve(__dirname, "../.tmp_url")); } catch {}
  try { fs.unlinkSync(path.resolve(__dirname, "../.tmp_video")); } catch {}

  console.log(`\n${"═".repeat(50)}`);
  console.log(`COMPLETE: ${totalOk} videos OK, ${totalFail} failed`);
  console.log(`${"═".repeat(50)}`);
}

main().catch(console.error);
