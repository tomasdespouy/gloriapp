require("dotenv").config({ path: ".env.local" });
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const LUMA_KEY = process.env.LUMA_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASH = "C:\\Program Files\\Git\\usr\\bin\\bash.exe";
const DIR = path.resolve(__dirname, "..").replace(/\\/g, "/");
function curl(a) { return execSync(`cd "${DIR}" && curl -s ${a}`, {encoding:"utf8",shell:BASH,maxBuffer:50*1024*1024}); }
function curlBin(a) { execSync(`cd "${DIR}" && curl -s ${a}`, {shell:BASH}); }

const IDS = [
  { gen: "536d56e8-69bb-4de9-a539-f08fbca72a84", slug: "jorge-ramirez" },
  { gen: "2c89ee9a-b98b-4933-995d-3168a74ad45b", slug: "yesenia-de-los-santos" },
];

for (const { gen, slug } of IDS) {
  try {
    const s = JSON.parse(curl(
      `-X GET 'https://api.lumalabs.ai/dream-machine/v1/generations/${gen}' ` +
      `-H 'Authorization: Bearer ${LUMA_KEY}' --max-time 30`
    ));
    console.log(`${slug}: state=${s.state}`);
    if (s.state === "completed" && s.assets?.video) {
      console.log("  Downloading...");
      fs.writeFileSync(path.resolve(__dirname, "../.tmp_url"), s.assets.video);
      curlBin(`-o .tmp_video -L "$(cat .tmp_url)" --max-time 300`);
      curl(
        `-X PUT '${SUPABASE_URL}/storage/v1/object/patients/${slug}.mp4' ` +
        `-H 'apikey: ${SERVICE_KEY}' -H 'Authorization: Bearer ${SERVICE_KEY}' ` +
        `-H 'Content-Type: video/mp4' -H 'x-upsert: true' ` +
        `--upload-file .tmp_video --max-time 300`
      );
      const sz = fs.statSync(path.resolve(__dirname, "../.tmp_video")).size;
      console.log(`  Uploaded (${Math.round(sz/1024)} KB)`);
      try { fs.unlinkSync(path.resolve(__dirname, "../.tmp_video")); } catch {}
    }
  } catch (e) {
    console.error(`${slug}: ${e.message.substring(0, 80)}`);
  }
}
try { fs.unlinkSync(path.resolve(__dirname, "../.tmp_url")); } catch {}
console.log("Done");
