// Generate the landing hero banner by outpainting login-bg.jpg with Nano Banana
// (Gemini 2.5 Flash Image). Produces:
//   public/branding/home-hero.jpg         (16:9 desktop, ~2400x1350)
//   public/branding/home-hero-mobile.jpg  (4:5 mobile,   ~1080x1350)
//
// Usage:
//   node scripts/gen-home-hero.js                # both variants
//   node scripts/gen-home-hero.js desktop        # desktop only
//   node scripts/gen-home-hero.js mobile         # mobile only

import { GoogleGenAI } from "@google/genai";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import { config as dotenvConfig } from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");
dotenvConfig({ path: resolve(ROOT, ".env.local") });

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
const MODEL = "gemini-2.5-flash-image";

const SOURCE = resolve(ROOT, "public/branding/login-bg.jpg");

const VARIANTS = {
  desktop: {
    out: "public/branding/home-hero.jpg",
    width: 2400,
    height: 1350, // 16:9
    targetKB: 180,
    prompt: `Outpaint and recompose this therapy session photo into a 16:9 cinematic banner (2400x1350).
CRITICAL COMPOSITION RULE: The smiling woman's HEAD must be ENTIRELY visible with GENEROUS HEADROOM above. Her hair/crown must NOT touch the top edge — leave at least 25% of the frame height as empty indigo space ABOVE the top of her hair. Her chin should be roughly at the vertical center of the frame, with her shoulders and torso in the lower half. Think "rule of thirds with eyes on the upper third line".
Position her in the RIGHT THIRD of the frame horizontally. Keep her face, hairstyle, smile, earring and beige sleeveless top 100% identical to the source — same person, same expression, same lighting on her skin.
Extend the scene UPWARD to add ceiling/dark indigo wall space above her head. Extend the scene to the LEFT continuing the same warm consulting room: soft window light from the right, blurred indoor plant, out-of-focus silhouette of the therapist's shoulder/back in the foreground, tasteful muted shadows.
Color palette: deep indigo and dusty blue tones (#2D3561, #3A4280, #4A55A2 family) with warm beige skin tones — NOT navy, NOT teal. Cinematic shallow depth of field, intimate calm mood, photorealistic, fine film grain.
The LEFT HALF of the image should be noticeably darker and less detailed (soft indigo shadow gradient) so overlaid white text remains perfectly legible. The RIGHT side stays brighter where Gloria sits.
No text, no logos, no borders, no watermarks, no UI elements. Edge-to-edge photographic composition.`,
  },
  mobile: {
    out: "public/branding/home-hero-mobile.jpg",
    width: 1080,
    height: 1350, // 4:5
    targetKB: 100,
    prompt: `Recompose this therapy session photo into a 4:5 vertical banner (1080x1350) for a mobile hero section.
Keep the smiling woman in the beige sleeveless top centered horizontally, in the LOWER HALF of the frame. Preserve her face, hairstyle, smile and clothing 100% identical to the source.
Extend the scene UPWARD continuing the same warm consulting room: soft indirect window light, blurred plant, indigo shadows above her. The UPPER THIRD of the image must be noticeably darker (deep indigo gradient) so overlaid white headline text is legible.
Color palette: deep indigo and dusty blue (#2D3561, #3A4280, #4A55A2 family) with warm beige skin tones. Cinematic shallow depth of field, intimate calm mood, photorealistic, fine film grain.
No text, no logos, no borders, no watermarks. Edge-to-edge photographic composition.`,
  },
};

async function generate(variant) {
  const cfg = VARIANTS[variant];
  const outAbs = resolve(ROOT, cfg.out);
  console.log(`\n[${variant}] target: ${cfg.width}x${cfg.height}, <${cfg.targetKB} KB`);

  // Read source as base64
  const sourceBytes = readFileSync(SOURCE);
  console.log(`[${variant}] source: ${SOURCE} (${(sourceBytes.length / 1024).toFixed(1)} KB)`);

  console.log(`[${variant}] calling ${MODEL}...`);
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: sourceBytes.toString("base64"),
            },
          },
          { text: cfg.prompt },
        ],
      },
    ],
    config: {
      responseModalities: ["image", "text"],
    },
  });

  // Find image part
  let raw = null;
  for (const cand of response.candidates || []) {
    for (const part of cand.content?.parts || []) {
      if (part.inlineData?.data) {
        raw = Buffer.from(part.inlineData.data, "base64");
        break;
      }
      if (part.text) console.log(`[${variant}] model text: ${part.text.slice(0, 200)}`);
    }
    if (raw) break;
  }
  if (!raw) {
    throw new Error(`[${variant}] no image returned`);
  }
  console.log(`[${variant}] received ${(raw.length / 1024).toFixed(1)} KB raw`);

  // Resize to exact target ratio + optimize
  mkdirSync(dirname(outAbs), { recursive: true });

  // Try descending qualities until we hit target weight
  const qualities = [82, 78, 74, 70, 66, 62, 58];
  let finalBuf = null;
  for (const q of qualities) {
    const buf = await sharp(raw)
      .resize(cfg.width, cfg.height, { fit: "cover", position: "centre" })
      .jpeg({ quality: q, progressive: true, mozjpeg: true })
      .toBuffer();
    console.log(`[${variant}]   q=${q} -> ${(buf.length / 1024).toFixed(1)} KB`);
    finalBuf = buf;
    if (buf.length / 1024 <= cfg.targetKB) break;
  }

  writeFileSync(outAbs, finalBuf);
  console.log(`[${variant}] saved: ${cfg.out} (${(finalBuf.length / 1024).toFixed(1)} KB)`);
}

async function main() {
  const arg = process.argv[2];
  const todo = arg ? [arg] : ["desktop", "mobile"];
  for (const v of todo) {
    if (!VARIANTS[v]) {
      console.error(`Unknown variant: ${v}. Use 'desktop' or 'mobile'.`);
      process.exit(1);
    }
    try {
      await generate(v);
    } catch (e) {
      console.error(`[${v}] FAILED:`, e.message || e);
      process.exit(1);
    }
  }
}

main();
