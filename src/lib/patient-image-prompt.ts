/**
 * Centralized patient image prompt builder.
 * Used by: API routes (generate-batch-images), scripts, and supradmin.
 *
 * The visual_identity JSON is stored in ai_patients.visual_identity column.
 * This ensures every patient — created via supradmin, terminal, or migration —
 * uses the same prompt structure for image generation.
 */

export interface VisualIdentity {
  etnia: string;
  gesto: string;
  pelo_estilo: string;
  pelo_color: string;
  tez: string;
  accesorios: string;
  ropa_tipo: string;
  ropa_color: string;
  fondo: string;
}

// [BASE] — Always present. Photorealism + anti-stereotyping + direct gaze
const BASE = "Photorealistic close-up portrait, square format, fully framed within the image. A real person with authentic features, looking directly at the camera. Soft, natural lighting. Natural skin texture with pores, imperfections, and asymmetry. NOT idealized, NOT plastic, NOT a model. No text, no watermarks.";

/**
 * Build the image generation prompt from patient data + visual identity.
 */
export function buildImagePrompt(
  patient: { name: string; age: number; occupation: string; country: string },
  identity: VisualIdentity
): string {
  const gender = inferGender(patient.name);

  return [
    BASE,
    // [SUBJECT]
    `${patient.age} year old ${gender} from ${patient.country}.`,
    `${identity.etnia}.`,
    `${identity.gesto}.`,
    // [HAIR & SKIN]
    `${identity.pelo_estilo}, ${identity.pelo_color} hair.`,
    `${identity.tez} skin.`,
    // [CLOTHING & ACCESSORIES]
    `Wearing ${identity.ropa_tipo} in ${identity.ropa_color}.`,
    identity.accesorios !== "Sin accesorios" ? identity.accesorios + "." : "",
    // [BACKGROUND]
    `${identity.fondo} background.`,
  ].filter(Boolean).join(" ");
}

// Female first names used in the platform
const FEMALE_NAMES = [
  "Lucía", "Lucia", "Carmen", "Fernanda", "Macarena", "Milagros", "Catalina",
  "Lorena", "Daniela", "Jimena", "Patricia", "Camila", "Renata", "Altagracia",
  "Yesenia", "Rosa", "Sofía", "Sofia", "Valentina", "Yamilet", "Mariana",
  "Esperanza", "Mei", "Aparecida", "Soledad", "Lourdes", "María",
];

function inferGender(name: string): "woman" | "man" {
  const first = name.split(" ")[0];
  return FEMALE_NAMES.some(f => first.startsWith(f)) ? "woman" : "man";
}

/**
 * Default visual identity for patients created without one.
 * Returns randomized but reasonable defaults.
 */
export function defaultVisualIdentity(): VisualIdentity {
  return {
    etnia: "Mestizo/a Latin American features",
    gesto: "Calm, natural expression",
    pelo_estilo: "Medium length, natural",
    pelo_color: "Dark brown",
    tez: "Medium brown, warm tone",
    accesorios: "Sin accesorios",
    ropa_tipo: "Simple casual top",
    ropa_color: "neutral tones",
    fondo: "Plain gray",
  };
}
