/**
 * Batch generate images (DALL-E 3) and videos (Luma AI) for new patients
 * Uses curl for HTTP calls (Node.js 24 has DNS issues on Windows)
 * Usage: node scripts/generate-patient-assets.js
 */

require("dotenv").config({ path: ".env.local" });
const { execSync } = require("child_process");

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const LUMA_KEY = process.env.LUMA_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function slugify(name) {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");
}

function curlJson(method, url, headers, body) {
  const fs = require("fs");
  const path = require("path");
  const hFlags = Object.entries(headers).map(([k, v]) => `-H '${k}: ${v}'`).join(" ");
  const projectDir = path.resolve(__dirname, "..").replace(/\\/g, "/");

  if (body) {
    fs.writeFileSync(path.resolve(__dirname, "../.tmp_body.json"), JSON.stringify(body));
    const cmd = `cd "${projectDir}" && curl -s -X ${method} '${url}' ${hFlags} -d @.tmp_body.json --max-time 120`;
    const out = execSync(cmd, { encoding: "utf8", maxBuffer: 50 * 1024 * 1024, shell: "C:\\Program Files\\Git\\usr\\bin\\bash.exe" });
    try { fs.unlinkSync(path.resolve(__dirname, "../.tmp_body.json")); } catch {}
    return JSON.parse(out);
  }
  const cmd = `curl -s -X ${method} '${url}' ${hFlags} --max-time 120`;
  const out = execSync(cmd, { encoding: "utf8", maxBuffer: 50 * 1024 * 1024, shell: "C:\\Program Files\\Git\\usr\\bin\\bash.exe" });
  return JSON.parse(out);
}

function curlDownloadUpload(sourceUrl, destPath, contentType) {
  const fs = require("fs");
  const path = require("path");
  const projectDir = path.resolve(__dirname, "..").replace(/\\/g, "/");
  const tmpAsset = `${projectDir}/.tmp_asset`;
  const tmpUrl = `${projectDir}/.tmp_url`;

  // Write URL to file (avoids shell escaping of signed URLs)
  fs.writeFileSync(path.resolve(__dirname, "../.tmp_url"), sourceUrl);
  execSync(`cd "${projectDir}" && curl -s -o .tmp_asset -L "$(cat .tmp_url)" --max-time 180`, { shell: "C:\\Program Files\\Git\\usr\\bin\\bash.exe" });

  const assetPath = path.resolve(__dirname, "../.tmp_asset");
  const stat = fs.statSync(assetPath);
  if (stat.size === 0) throw new Error("Downloaded file is empty");

  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/patients/${destPath}`;
  const result = execSync(
    `cd "${projectDir}" && curl -s -w '\\n%{http_code}' -X PUT '${uploadUrl}' ` +
    `-H 'apikey: ${SERVICE_KEY}' ` +
    `-H 'Authorization: Bearer ${SERVICE_KEY}' ` +
    `-H 'Content-Type: ${contentType}' ` +
    `-H 'x-upsert: true' ` +
    `--upload-file .tmp_asset --max-time 180`,
    { encoding: "utf8", shell: "C:\\Program Files\\Git\\usr\\bin\\bash.exe" }
  );

  try { fs.unlinkSync(assetPath); } catch {}
  try { fs.unlinkSync(path.resolve(__dirname, "../.tmp_url")); } catch {}

  const lines = result.trim().split("\n");
  const httpCode = lines[lines.length - 1];
  if (!httpCode.startsWith("2")) {
    throw new Error(`Upload HTTP ${httpCode}`);
  }

  return `${SUPABASE_URL}/storage/v1/object/public/patients/${destPath}`;
}

const FEMALE_NAMES = [
  "Fernanda","Macarena","Milagros","Catalina","Lorena","Daniela","Jimena",
  "Patricia","Camila","Renata","Yesenia","Altagracia",
];

const PATIENTS = [
  { name: "Alejandro Vega", age: 39, occupation: "Empresario", country: "México" },
  { name: "Altagracia Marte", age: 60, occupation: "Costurera", country: "República Dominicana" },
  { name: "Camila Bertoni", age: 22, occupation: "Estudiante de psicologia", country: "Argentina" },
  { name: "Daniela Moreno", age: 35, occupation: "Enfermera", country: "Colombia" },
  { name: "Edwin Quispe", age: 47, occupation: "Minero", country: "Perú" },
  { name: "Fernanda Contreras", age: 23, occupation: "Estudiante de enfermeria", country: "Chile" },
  { name: "Gustavo Peralta", age: 52, occupation: "Taxista", country: "Argentina" },
  { name: "Hernan Mejia", age: 55, occupation: "Pastor evangelico", country: "Colombia" },
  { name: "Ignacio Poblete", age: 41, occupation: "Contador", country: "Chile" },
  { name: "Jimena Ramirez", age: 20, occupation: "Estudiante de comunicacion", country: "México" },
  { name: "Lorena Gutierrez", age: 26, occupation: "Mesera", country: "Colombia" },
  { name: "Macarena Sepulveda", age: 33, occupation: "Psicóloga clinica", country: "Chile" },
  { name: "Milagros Flores", age: 30, occupation: "Vendedora de mercado", country: "Perú" },
  { name: "Patricia Hernandez", age: 48, occupation: "Ama de casa", country: "México" },
  { name: "Renata Ayala", age: 29, occupation: "Bailarina profesional", country: "Argentina" },
  { name: "Samuel Batista", age: 44, occupation: "Mecanico", country: "República Dominicana" },
  { name: "Yesenia De Los Santos", age: 25, occupation: "Maestra de primaria", country: "República Dominicana" },
];

function generateImage(patient) {
  const isFemale = FEMALE_NAMES.some(f => patient.name.includes(f));
  const gender = isFemale ? "woman" : "man";
  const ageDesc = patient.age < 25 ? "young" : patient.age < 40 ? "adult" : patient.age < 55 ? "middle-aged" : "older";

  const prompt = `A professional headshot portrait of a ${ageDesc} Latin American ${gender} from ${patient.country}, age ${patient.age}, who works as a ${patient.occupation}. Natural lighting, neutral expression, looking slightly to the side. Realistic photography style, clean background. The person should look like a typical ${patient.country} resident with appropriate ethnic features for the region. Professional but approachable appearance. No text, no watermarks.`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`  Generating image (attempt ${attempt})...`);
      const result = curlJson("POST", "https://api.openai.com/v1/images/generations", {
        "Authorization": `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      }, {
        model: "dall-e-3", prompt, n: 1, size: "1024x1024", quality: "standard",
      });

      if (result.error) throw new Error(result.error.message);
      return result.data?.[0]?.url;
    } catch (err) {
      if (attempt === 3) throw err;
      console.log(`  Retry in 10s... (${err.message})`);
      execSync("sleep 10 || timeout /t 10 > nul 2>&1", { stdio: "ignore" });
    }
  }
}

function generateAndPollVideo(imageUrl) {
  console.log(`  Generating video (1-2 min)...`);

  // Start generation
  const gen = curlJson("POST", "https://api.lumalabs.ai/dream-machine/v1/generations", {
    "Authorization": `Bearer ${LUMA_KEY}`,
    "Content-Type": "application/json",
  }, {
    model: "ray-2",
    prompt: "Subtle natural movement: gentle breathing, slight eye blinks, micro facial expressions. The person stays still, looking forward with a calm, neutral presence. Photorealistic, no camera movement.",
    keyframes: { frame0: { type: "image", url: imageUrl } },
  });

  if (gen.error) throw new Error(gen.error);
  const genId = gen.id;

  // Poll
  for (let i = 0; i < 60; i++) {
    execSync("sleep 5 || timeout /t 5 > nul 2>&1", { stdio: "ignore" });
    const status = curlJson("GET", `https://api.lumalabs.ai/dream-machine/v1/generations/${genId}`, {
      "Authorization": `Bearer ${LUMA_KEY}`,
    });

    if (status.state === "completed") {
      return status.assets?.video || null;
    }
    if (status.state === "failed") throw new Error("Luma generation failed");
    process.stdout.write(".");
  }
  throw new Error("Video timed out");
}

async function main() {
  console.log(`\nGenerating assets for ${PATIENTS.length} patients:\n`);
  PATIENTS.forEach(p => console.log(`  - ${p.name}`));

  let success = 0, failed = 0;

  for (const patient of PATIENTS) {
    const slug = slugify(patient.name);
    console.log(`\n[${success + failed + 1}/${PATIENTS.length}] ${patient.name} (${slug})`);

    try {
      // Image
      const imageUrl = generateImage(patient);
      if (!imageUrl) throw new Error("No image URL");

      const pubImage = curlDownloadUpload(imageUrl, `${slug}.png`, "image/png");
      console.log(`  Image OK: ${slug}.png`);

      // Video
      try {
        const videoUrl = generateAndPollVideo(pubImage);
        if (videoUrl) {
          curlDownloadUpload(videoUrl, `${slug}.mp4`, "video/mp4");
          console.log(`\n  Video OK: ${slug}.mp4`);
        }
      } catch (ve) {
        console.log(`\n  Video FAILED (image OK): ${ve.message}`);
      }

      success++;
    } catch (err) {
      console.error(`  FAILED: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n\nDone! Success: ${success}, Failed: ${failed}`);
}

main().catch(console.error);
