/**
 * Regenerate images ONLY (no videos) for 13 patients with diverse appearances
 * Usage: node scripts/regen-diverse-faces.js
 */
require("dotenv").config({ path: ".env.local" });
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const OPENAI_KEY = process.env.OPENAI_API_KEY;
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
    slug: "gabriel-navarro",
    prompt: "Professional DSLR portrait photograph of a 49 year old Chilean-Venezuelan man, social worker. Short salt-and-pepper gray hair, 3-day stubble beard, thick-rimmed glasses. Tired but warm eyes. Wears a worn button-down shirt. Olive skin. Clean studio background, soft lighting. Photorealistic, real human, NOT illustration."
  },
  {
    slug: "carlos-quispe",
    prompt: "Professional DSLR portrait photograph of a 42 year old Peruvian man, taxi driver from the highlands. Strong Quechua indigenous features, copper-brown skin, high cheekbones, short black hair. Weathered face from sun exposure. Wears a simple polo shirt. Neutral expression. Clean studio background. Photorealistic, real human, NOT illustration."
  },
  {
    slug: "rosa-huaman",
    prompt: "Professional DSLR portrait photograph of a 35 year old Peruvian woman, elementary school teacher. Andean indigenous features, warm brown skin, dark hair in a long braid over one shoulder. Round face, gentle expression. Wears a modest colorful blouse. Clean studio background, warm lighting. Photorealistic, real human, NOT illustration."
  },
  {
    slug: "marcos-herrera",
    prompt: "Professional DSLR portrait photograph of a 34 year old Chilean man, high school teacher. Buzz cut / very short hair, light stubble beard, fair skin with slight tan. Strong jaw, tired eyes with slight dark circles. Wears a casual collared shirt. Skeptical but not hostile expression. Clean studio background. Photorealistic, real human, NOT illustration."
  },
  {
    slug: "mateo-gimenez",
    prompt: "Professional DSLR portrait photograph of a 38 year old Argentine man, chef. Light brown / dirty blonde hair slightly messy, blue-green eyes, fair white skin, European features (Italian-Argentine descent). Wears a simple dark henley shirt. Thoughtful expression. Clean studio background, warm lighting. Photorealistic, real human, NOT illustration."
  },
  {
    slug: "camila-bertoni",
    prompt: "Professional DSLR portrait photograph of a 22 year old Argentine woman, psychology university student in Buenos Aires. Straight dark hair with dyed purple/violet tips, small nose piercing (tiny stud), fair skin. Wears an oversized vintage sweater. Slightly anxious but intelligent expression. Clean studio background. Photorealistic, real human, NOT illustration."
  },
  {
    slug: "jimena-ramirez",
    prompt: "Professional DSLR portrait photograph of a 20 year old Mexican woman, communications student. Short bob haircut with one streak of teal/blue color, large hoop earrings, light brown skin. Wears a black t-shirt. Defiant but vulnerable expression, slight eyeliner. Clean studio background. Photorealistic, real human, NOT illustration."
  },
  {
    slug: "altagracia-marte",
    prompt: "Professional DSLR portrait photograph of a 60 year old Dominican woman, seamstress. Dark black skin, short gray/white natural hair, deep wrinkles around eyes and mouth showing a life of hard work. Wears a simple floral blouse and small gold cross necklace. Dignified but weary expression. Clean studio background, warm lighting. Photorealistic, real human, NOT illustration."
  },
  {
    slug: "yamilet-perez",
    prompt: "Professional DSLR portrait photograph of a 29 year old Dominican woman, nurse. Medium-dark brown skin, natural curly afro hair (shoulder length), small gold hoop earrings. Wears light blue medical scrubs. Warm but slightly guarded expression. Clean studio background. Photorealistic, real human, NOT illustration."
  },
  {
    slug: "rafael-santos",
    prompt: "Professional DSLR portrait photograph of a 45 year old Dominican man, musician. Brown skin, short afro hair with some gray, thin beard. Wears a linen shirt partially unbuttoned, simple leather necklace with a pendant. Soulful, reflective expression. Clean studio background, warm lighting. Photorealistic, real human, NOT illustration."
  },
  {
    slug: "edwin-quispe",
    prompt: "Professional DSLR portrait photograph of a 47 year old Peruvian man, miner from Cerro de Pasco. Dark weathered skin tanned and roughened by sun and altitude, indigenous Quechua features, short black hair, a small scar on his left cheek. Deep-set tired eyes. Wears a worn flannel shirt. Stoic expression. Clean studio background. Photorealistic, real human, NOT illustration."
  },
  {
    slug: "alejandro-vega",
    prompt: "Professional DSLR portrait photograph of a 39 year old Mexican man, successful entrepreneur. Slicked back dark hair with gel, clean shaven, olive skin. Wears an expensive dress shirt with no tie, top button undone. Noticeable dark circles under his eyes despite polished appearance. Cynical half-smile. Clean studio background. Photorealistic, real human, NOT illustration."
  },
  {
    slug: "sofia-pellegrini",
    prompt: "Professional DSLR portrait photograph of a 24 year old Argentine woman, university student. Wavy dark blonde / light brown hair, green-hazel eyes, fair white skin with light freckles, Italian-Argentine features. Wears a simple knit sweater. Introverted, slightly melancholic expression. Clean studio background, soft warm lighting. Photorealistic, real human, NOT illustration."
  },
];

async function main() {
  console.log(`Generating ${PATIENTS.length} new diverse face images (NO videos)...\n`);
  let success = 0, failed = 0;

  for (const p of PATIENTS) {
    console.log(`[${success+failed+1}/${PATIENTS.length}] ${p.slug}`);
    try {
      fs.writeFileSync(path.resolve(__dirname, "../.tmp_body.json"), JSON.stringify({
        model: "dall-e-3", prompt: p.prompt, n: 1, size: "1024x1024", quality: "hd",
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

      // Download and upload
      fs.writeFileSync(path.resolve(__dirname, "../.tmp_url"), imgUrl);
      curlBin(`-o .tmp_asset -L "$(cat .tmp_url)" --max-time 180`);
      curl(
        `-X PUT '${SUPABASE_URL}/storage/v1/object/patients/${p.slug}.png' ` +
        `-H 'apikey: ${SERVICE_KEY}' -H 'Authorization: Bearer ${SERVICE_KEY}' ` +
        `-H 'Content-Type: image/png' -H 'x-upsert: true' ` +
        `--upload-file .tmp_asset --max-time 180`
      );
      console.log(`  OK: ${p.slug}.png`);
      success++;
    } catch (err) {
      console.error(`  FAILED: ${err.message.substring(0, 100)}`);
      failed++;
    }
  }

  try { fs.unlinkSync(path.resolve(__dirname, "../.tmp_asset")); } catch {}
  try { fs.unlinkSync(path.resolve(__dirname, "../.tmp_body.json")); } catch {}
  try { fs.unlinkSync(path.resolve(__dirname, "../.tmp_url")); } catch {}

  console.log(`\nDone! Success: ${success}, Failed: ${failed}`);
}

main().catch(console.error);
