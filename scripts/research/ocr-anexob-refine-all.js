// High-quality re-OCR for all 3 pages, structured output preserving section titles + items
require("dotenv").config({ path: "C:/Users/tomas/documents/gloriapp/.env.local" });

const fs = require("fs");
const path = require("path");
const OpenAI = require("openai").default;

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const PAGES_DIR = "C:/tmp/pdfwork/anexob";

const PROMPT = `Eres un OCR experto. Esta es una página del ANEXO B — una rúbrica de evaluación de competencias clínicas para estudiantes de psicología (Valdés & Gómez, 2023).

CONTEXTO de la rúbrica:
- Cada página puede tener uno o más BLOQUES/SECCIONES.
- Cada SECCIÓN tiene un TÍTULO en mayúsculas (ej: "ESTRUCTURA TERAPÉUTICA", "ACTITUD DE LA TERAPEUTA").
- Cada SECCIÓN tiene una matriz con 5 columnas de calificación (0 No aplica, 1 Ausente, 2 Insuficiente, 3 Buena, 4 Excelente).
- Cada SECCIÓN tiene FILAS de ítems conductuales (texto descriptivo a evaluar).

INSTRUCCIONES:
1. Identifica TODAS las secciones visibles en la página (incluso si solo aparece el título sin matriz, o solo la matriz sin título).
2. Si una matriz aparece sin título, indica "[SECCIÓN CONTINÚA DE PÁGINA ANTERIOR]" o "[TÍTULO NO VISIBLE EN ESTA PÁGINA]".
3. Para cada sección, lista TODOS los ítems conductuales con prefijo "- ", texto completo, sin la matriz de círculos.
4. Si hay numeración o sub-bullets con "+", consérvalos.
5. Conserva acentos del español (á, é, í, ó, ú, ñ).
6. Si hay texto descriptivo arriba/abajo de la tabla (instrucciones, leyendas, escalas), inclúyelo claramente.
7. Si hay números de página, inclúyelos.

FORMATO de salida:
[Texto introductorio si lo hay]

SECCIÓN: <TÍTULO EXACTO>
- ítem 1
- ítem 2
...

SECCIÓN: <SIGUIENTE TÍTULO>
...

[Notas al pie / instrucciones / número de página]
[Total secciones: N | Total ítems: M]`;

async function ocrPage(pngPath, pageNum) {
  const buf = fs.readFileSync(pngPath);
  const dataUrl = `data:image/png;base64,${buf.toString("base64")}`;
  console.log(`  [page ${pageNum}] sending (${(buf.length / 1024).toFixed(0)} KB)...`);
  const t0 = Date.now();
  const resp = await client.chat.completions.create({
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
  const text = resp.choices[0]?.message?.content || "";
  console.log(`  [page ${pageNum}] OK (${dt}s, ${text.length} chars)`);
  return text;
}

(async () => {
  const files = fs.readdirSync(PAGES_DIR).filter((f) => /^anexob-p\d+\.png$/i.test(f)).sort();
  const results = [];
  for (let i = 0; i < files.length; i++) {
    const text = await ocrPage(path.join(PAGES_DIR, files[i]), i + 1);
    results.push(`\n========== PÁGINA ${i + 1} (${files[i]}) ==========\n\n${text}`);
  }

  const header = `# ANEXO B - Valdés & Gómez (2023)
# Libro: "Supervisión clínica para estudiantes de Psicología"
# Editorial: Ediciones Universidad Santo Tomás
# Extracción: OCR vía OpenAI gpt-4o (vision, detail=high) — segunda pasada estructurada
# Páginas: ${files.length}
# Fecha extracción: ${new Date().toISOString()}
# Fuente PDF: C:/Users/tomas/OneDrive - Universidad Gabriela Mistral (1)/GlorIA/Valdés & Gómez/Anexo B - Valdéz & Gómez.pdf
`;

  const full = header + results.join("\n");
  const outPath = "C:/tmp/valdes-anexo-b-ocr.txt";
  fs.writeFileSync(outPath, full, { encoding: "utf8" });
  console.log(`\nOK -> ${outPath} (${full.length} chars)`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
