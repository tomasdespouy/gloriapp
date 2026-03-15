/**
 * Generate 11 learning competency images using DALL-E 3
 * with miniature diorama style
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env.local") });
const OpenAI = require("openai");
const fs = require("fs");
const path = require("path");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const BASE_STYLE = "beautiful stylized 3D render in miniature diorama style, soft rounded geometry, cozy modern design aesthetic, pastel color palette, warm morning sunlight entering from a window, soft cinematic lighting, smooth materials (light wood, matte surfaces, soft fabric), minimalistic yet detailed scene, architectural model feeling, depth of field, 35mm photography, clean composition, ultra high quality render, cozy atmosphere, Pixar-like design language";

const IMAGES = [
  { key: "setting_terapeutico", prompt: "A tiny cozy therapy office with two miniature armchairs facing each other, a small coffee table with a tissue box, a clock on the wall, warm lamp light, a door slightly open symbolizing welcome" },
  { key: "motivo_consulta", prompt: "A miniature scene of a person sitting on a chair with thought bubbles above their head containing small symbolic objects (a heart, a question mark, a tangled thread), representing inner exploration" },
  { key: "datos_contextuales", prompt: "A tiny diorama showing interconnected miniature scenes: a small house, a workplace desk, a park bench with friends, and a hospital bed — all connected by soft glowing threads" },
  { key: "objetivos", prompt: "A miniature scene of two tiny people standing together looking at a map or compass on a table, with a path leading to a glowing destination in the distance, collaborative goal setting" },
  { key: "escucha_activa", prompt: "A miniature scene of two tiny figures sitting close, one leaning forward attentively, with visible sound waves between them rendered as soft glowing particles, deep listening" },
  { key: "actitud_no_valorativa", prompt: "A tiny diorama of open hands gently holding a fragile glass heart, with soft warm light, no judgment, unconditional acceptance, safe space feeling" },
  { key: "optimismo", prompt: "A miniature scene of a tiny plant sprouting from cracked ground with a small watering can beside it, morning sunlight rays coming through, hope and growth metaphor" },
  { key: "presencia", prompt: "A miniature zen-like scene with two tiny figures sitting in stillness, a candle burning softly between them, sand garden, absolute calm and mindful presence" },
  { key: "conducta_no_verbal", prompt: "A miniature scene of two tiny figures where one has visible body language cues: crossed arms, looking away, with subtle magnifying glass effect highlighting these gestures" },
  { key: "contencion_afectos", prompt: "A tiny diorama of gentle hands forming a protective cup around a small glowing orb of light (representing emotions), warm safe embrace, emotional containment" },
];

async function generateImage(item) {
  const fullPrompt = `${item.prompt}. ${BASE_STYLE}`;
  console.log(`  Generating: ${item.key}...`);

  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt: fullPrompt,
    n: 1,
    size: "1024x1024",
    quality: "standard",
  });

  const url = response.data?.[0]?.url;
  if (!url) throw new Error("No image URL returned");

  // Download and save
  const imgRes = await fetch(url);
  const buffer = Buffer.from(await imgRes.arrayBuffer());
  const outPath = path.join(__dirname, "../public/learning", `${item.key}.png`);
  fs.writeFileSync(outPath, buffer);
  console.log(`  ✓ ${item.key}.png (${Math.round(buffer.length / 1024)} KB)`);

  // Rate limit: wait 12s between calls
  await new Promise(r => setTimeout(r, 12000));
}

async function main() {
  console.log("Generating learning images with DALL-E 3...\n");

  // Ensure directory exists
  const dir = path.join(__dirname, "../public/learning");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  for (const item of IMAGES) {
    try {
      await generateImage(item);
    } catch (e) {
      console.error(`  ✗ ${item.key}: ${e.message}`);
    }
  }

  console.log("\nDone!");
}

main();
