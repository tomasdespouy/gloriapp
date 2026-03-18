/**
 * Regenerate images for patients that look like comics or have issues
 * Using ultra-specific anti-illustration prompts
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

// Anti-comic suffix for all prompts
const SUFFIX = "Shot on Canon EOS R5 with 85mm f/1.4 lens. Shallow depth of field. Real skin texture with pores and imperfections. RAW photograph, absolutely NO digital art, NO painting, NO illustration, NO 3D render, NO cartoon, NO anime, NO stylized.";

const PATIENTS = [
  {
    slug: "carlos-quispe",
    prompt: `Close-up portrait photograph of a 42 year old Peruvian man from the Andes, works as a taxi driver. Strong indigenous Quechua facial features, dark copper-brown skin with sun damage, prominent cheekbones, slightly crooked nose. Short straight black hair. Deep wrinkles around eyes from squinting in the sun. Wears a faded polo shirt. Neutral tired expression, looking at camera. Plain gray studio backdrop. ${SUFFIX}`
  },
  {
    slug: "rosa-huaman",
    prompt: `Close-up portrait photograph of a 35 year old Peruvian woman, elementary school teacher from the highlands. Indigenous Andean features, warm brown skin, round face, dark brown eyes. Long dark hair in a single thick braid draped over her right shoulder. Small mole near her lip. Wears a simple blouse with subtle traditional pattern. Gentle, warm expression. Plain gray studio backdrop. ${SUFFIX}`
  },
  {
    slug: "jimena-ramirez",
    prompt: `Close-up portrait photograph of a 20 year old Mexican woman, college student. Light brown mestiza skin, dark eyes with slight dark circles. Short choppy bob haircut with one streak of blue-teal dyed hair. Large silver hoop earrings. Subtle eyeliner. Wears a plain black crew-neck t-shirt. Guarded, slightly defiant expression with a hint of vulnerability. Faded long sleeves visible. Plain gray studio backdrop. ${SUFFIX}`
  },
  {
    slug: "altagracia-marte",
    prompt: `Close-up portrait photograph showing full head and shoulders of a 60 year old Dominican woman, seamstress. Very dark Afro-Caribbean black skin, short tightly curled gray-white natural hair. Deep wrinkles, crow's feet, and smile lines showing decades of hard work. Wears a simple floral cotton blouse and a thin gold chain with a small cross. Dignified but exhausted expression. Slightly watery eyes. Plain gray studio backdrop. MUST show complete head with forehead and hair visible, not cropped. ${SUFFIX}`
  },
  {
    slug: "edwin-quispe",
    prompt: `Close-up portrait photograph of a 47 year old Peruvian man, miner from Cerro de Pasco. Indigenous Quechua features, very dark and weathered skin roughened by years of sun and high altitude. Short black hair with some gray. Deep furrows on forehead, chapped lips. A faint old scar on his left cheekbone. Wears a worn plaid flannel shirt. Blank, emotionally flat expression - thousand-yard stare. Plain gray studio backdrop. ${SUFFIX}`
  },
  {
    slug: "alejandro-vega",
    prompt: `Close-up portrait photograph of a 39 year old Mexican man, wealthy tech entrepreneur. Olive skin, clean shaven, dark hair slicked back with product. Expensive fitted white dress shirt with top two buttons undone, no tie. Prominent dark circles and slightly bloodshot eyes despite groomed appearance. Angular jaw, sharp features. Cynical, hollow half-smile. Plain gray studio backdrop. ${SUFFIX}`
  },
  {
    slug: "sofia-pellegrini",
    prompt: `Close-up portrait photograph of a 24 year old Argentine woman of Italian descent, university student. Fair white skin with natural freckles across nose and cheeks. Wavy honey-blonde / dark blonde hair past shoulders, slightly messy. Hazel-green eyes. No makeup or very minimal. Wears a loose cream-colored knit sweater. Introverted, melancholic expression, looking slightly off camera. Plain gray studio backdrop. ${SUFFIX}`
  },
  {
    slug: "mateo-gimenez",
    prompt: `Close-up portrait photograph of a 38 year old Argentine man of Italian descent, works as a chef. Light brown messy hair that needs a cut, 3-day stubble, blue-gray eyes, fair skin with slight redness on cheeks. Slightly overweight face, double chin starting. Wears a wrinkled casual button-down shirt. Looks like a regular tired working guy, NOT a model. Weary but warm expression. Plain gray studio backdrop. ${SUFFIX}`
  },
  {
    slug: "macarena-sepulveda",
    prompt: `Close-up portrait photograph showing full head and shoulders of a 33 year old Chilean woman, clinical psychologist. Light olive skin, dark brown wavy hair to shoulders, subtle dark circles under brown eyes. Wears a simple dark blazer over a plain top. Intelligent but stressed expression, slight forced smile. Plain gray studio backdrop. MUST show complete head with forehead and full hair visible, not cropped at top. ${SUFFIX}`
  },
];

async function main() {
  console.log(`Regenerating ${PATIENTS.length} patient images (anti-comic, HD)...\n`);
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

      fs.writeFileSync(path.resolve(__dirname, "../.tmp_url"), imgUrl);
      curlBin(`-o .tmp_asset -L "$(cat .tmp_url)" --max-time 180`);
      curl(
        `-X PUT '${SUPABASE_URL}/storage/v1/object/patients/${p.slug}.png' ` +
        `-H 'apikey: ${SERVICE_KEY}' -H 'Authorization: Bearer ${SERVICE_KEY}' ` +
        `-H 'Content-Type: image/png' -H 'x-upsert: true' ` +
        `--upload-file .tmp_asset --max-time 180`
      );
      console.log(`  OK`);
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
