// OCR Anexo B (Valdés & Gómez 2023) via OpenAI Vision (gpt-4o)
// Loads PNGs from C:/tmp/pdfwork/anexob/, sends each page to vision, concatenates results
require("dotenv").config({ path: "C:/Users/tomas/documents/gloriapp/.env.local" });

const fs = require("fs");
const path = require("path");
const OpenAI = require("openai").default;

const PAGES_DIR = "C:/tmp/pdfwork/anexob";
const OUTPUT_TXT = "C:/tmp/valdes-anexo-b-ocr.txt";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const PROMPT = `Eres un OCR experto en documentos académicos en español.

Esta es una página del ANEXO B del libro "Supervisión clínica para estudiantes de Psicología" (Valdés & Gómez, 2023). Contiene una RÚBRICA DE EVALUACIÓN de competencias clínicas para estudiantes de psicología.

INSTRUCCIONES CRÍTICAS:
1. Transcribe LITERALMENTE todo el texto visible, sin parafrasear ni resumir.
2. Mantén la estructura visual de tablas con texto plano: usa líneas separadoras "---" y pipes "|" para columnas si hay tabla.
3. Conserva todos los acentos, tildes y ñ del español correctamente.
4. Si hay encabezados de columnas (ej: "Nivel 1", "Nivel 2", "Nivel 3", "Nivel 4", "NA", "No observado"), inclúyelos.
5. Si hay nombres de competencias (ej: "Setting terapéutico", "Escucha activa"), inclúyelos.
6. Si hay descriptores conductuales (texto detallado dentro de celdas), transcríbelos completos.
7. Si hay numeración o letras (1, 2, 3, a, b, c), inclúyelas.
8. Si hay notas al pie, instrucciones metodológicas, o leyendas, inclúyelas al final del bloque.
9. NO añadas comentarios tuyos, solo el texto transcrito.
10. NO uses bloques de código markdown — texto plano.

Devuelve únicamente la transcripción.`;

async function ocrPage(pngPath, pageNum) {
  const imageBuffer = fs.readFileSync(pngPath);
  const imageBase64 = imageBuffer.toString("base64");
  const dataUrl = `data:image/png;base64,${imageBase64}`;

  console.log(`  [page ${pageNum}] sending to gpt-4o (${(imageBuffer.length / 1024).toFixed(0)} KB)...`);
  const t0 = Date.now();
  const response = await client.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 4096,
    temperature: 0,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: PROMPT },
          { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
        ],
      },
    ],
  });
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  const text = response.choices[0]?.message?.content || "";
  console.log(`  [page ${pageNum}] OK (${dt}s, ${text.length} chars)`);
  return text;
}

(async () => {
  if (!process.env.OPENAI_API_KEY) {
    console.error("ERROR: OPENAI_API_KEY no encontrada en .env.local");
    process.exit(1);
  }

  const files = fs
    .readdirSync(PAGES_DIR)
    .filter((f) => /^anexob-p\d+\.png$/i.test(f))
    .sort();

  console.log(`OCR de ${files.length} páginas usando gpt-4o vision...`);

  const transcriptions = [];
  for (let i = 0; i < files.length; i++) {
    const pageNum = i + 1;
    const pngPath = path.join(PAGES_DIR, files[i]);
    try {
      const text = await ocrPage(pngPath, pageNum);
      transcriptions.push(`\n========== PÁGINA ${pageNum} (${files[i]}) ==========\n\n${text}`);
    } catch (e) {
      console.error(`  [page ${pageNum}] ERROR:`, e.message);
      transcriptions.push(`\n========== PÁGINA ${pageNum} ERROR ==========\n${e.message}`);
    }
  }

  const header = `# ANEXO B - Valdés & Gómez (2023)
# Libro: "Supervisión clínica para estudiantes de Psicología"
# Editorial: Ediciones Universidad Santo Tomás
# Extracción: OCR vía OpenAI gpt-4o (vision, detail=high)
# Páginas: ${files.length}
# Fecha extracción: ${new Date().toISOString()}
# Fuente PDF: C:/Users/tomas/OneDrive - Universidad Gabriela Mistral (1)/GlorIA/Valdés & Gómez/Anexo B - Valdéz & Gómez.pdf
`;

  const fullText = header + transcriptions.join("\n");
  fs.writeFileSync(OUTPUT_TXT, fullText, { encoding: "utf8" });

  console.log(`\nOK -> ${OUTPUT_TXT} (${fullText.length} chars total)`);
})().catch((e) => {
  console.error("FATAL:", e.message);
  console.error(e.stack);
  process.exit(1);
});
