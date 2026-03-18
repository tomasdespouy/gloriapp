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

const PROMPT = "Photorealistic portrait with dynamic natural motion. The person exhibits organic movement: shifting their weight slightly, natural shoulder movement from breathing, and frequent eye blinking. The facial expression transitions fluidly and randomly between a neutral gaze, a genuine warm laugh, and a look of cold indifference. High skin detail, 4k, cinematic lighting, static camera.";

function genVideo(slug) {
  const imgUrl = `${SUPABASE_URL}/storage/v1/object/public/patients/${slug}.png`;
  console.log(`\n${slug}...`);

  fs.writeFileSync(path.resolve(__dirname, "../.tmp_body.json"), JSON.stringify({
    model: "ray-2",
    prompt: PROMPT,
    keyframes: { frame0: { type: "image", url: imgUrl } },
  }));

  const gen = JSON.parse(curl(
    `-X POST 'https://api.lumalabs.ai/dream-machine/v1/generations' ` +
    `-H 'Authorization: Bearer ${LUMA_KEY}' -H 'Content-Type: application/json' ` +
    `-d @.tmp_body.json --max-time 60`
  ));

  if (!gen.id) throw new Error("No gen ID: " + JSON.stringify(gen).substring(0, 100));
  process.stdout.write(`  Gen ${gen.id} `);

  for (let i = 0; i < 90; i++) {
    execSync("sleep 5", { shell: BASH });
    const status = JSON.parse(curl(
      `-X GET 'https://api.lumalabs.ai/dream-machine/v1/generations/${gen.id}' ` +
      `-H 'Authorization: Bearer ${LUMA_KEY}' --max-time 30`
    ));
    if (status.state === "completed") {
      if (!status.assets?.video) throw new Error("No video URL");
      fs.writeFileSync(path.resolve(__dirname, "../.tmp_url"), status.assets.video);
      curlBin(`-o .tmp_video -L "$(cat .tmp_url)" --max-time 300`);
      curl(
        `-X PUT '${SUPABASE_URL}/storage/v1/object/patients/${slug}.mp4' ` +
        `-H 'apikey: ${SERVICE_KEY}' -H 'Authorization: Bearer ${SERVICE_KEY}' ` +
        `-H 'Content-Type: video/mp4' -H 'x-upsert: true' ` +
        `--upload-file .tmp_video --max-time 300`
      );
      const sz = fs.statSync(path.resolve(__dirname, "../.tmp_video")).size;
      console.log(`\n  OK (${Math.round(sz / 1024)} KB)`);
      try { fs.unlinkSync(path.resolve(__dirname, "../.tmp_video")); } catch {}
      return;
    }
    if (status.state === "failed") throw new Error("Luma failed");
    process.stdout.write(".");
  }
  throw new Error("Timed out (7.5 min)");
}

try {
  genVideo("jorge-ramirez");
} catch (e) {
  console.error("  FAILED:", e.message.substring(0, 100));
}

try {
  genVideo("yesenia-de-los-santos");
} catch (e) {
  console.error("  FAILED:", e.message.substring(0, 100));
}

try { fs.unlinkSync(path.resolve(__dirname, "../.tmp_body.json")); } catch {}
try { fs.unlinkSync(path.resolve(__dirname, "../.tmp_url")); } catch {}
console.log("\nDone!");
