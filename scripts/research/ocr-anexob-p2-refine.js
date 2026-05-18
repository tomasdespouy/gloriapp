// Refine page 2 OCR — explicit instructions to keep all rows in their proper sections
require("dotenv").config({ path: "C:/Users/tomas/documents/gloriapp/.env.local" });

const fs = require("fs");
const OpenAI = require("openai").default;

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const PROMPT = `Eres un OCR experto. Esta página contiene secciones de una rúbrica de competencias clínicas.

INSTRUCCIONES:
1. Transcribe LITERALMENTE todo el texto visible.
2. Cada sección tiene un TÍTULO (en mayúsculas), un encabezado de columnas (0 No aplica, 1 Ausente, 2 Insuficiente, 3 Buena, 4 Excelente), y FILAS con ítems conductuales.
3. NO inventes filas vacías ni omitas filas. NO uses placeholders genéricos como "○ ○ ○ ○ ○" sin texto.
4. Para cada fila, transcribe el TEXTO COMPLETO del ítem conductual visible en la columna izquierda.
5. Mantén los acentos del español (á, é, í, ó, ú, ñ).
6. Si alguna fila es continuación de una sección anterior (sin nuevo título), agrúpala bajo la última sección titulada.
7. Cuenta cuántos ítems hay en cada sección y verifica que coincida con lo que ves.
8. Formato de salida: para cada sección, escribe el título, luego una línea por ítem con prefijo "- ", sin la matriz de círculos (solo nombre del ítem).
9. Al final agrega "[Total ítems en página: N]".

Devuelve solo la transcripción estructurada.`;

(async () => {
  const png = fs.readFileSync("C:/tmp/pdfwork/anexob/anexob-p02.png");
  const dataUrl = `data:image/png;base64,${png.toString("base64")}`;

  console.log("Re-OCR page 2 with section-aware prompt...");
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
  console.log(`OK (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  const text = resp.choices[0]?.message?.content || "";
  fs.writeFileSync("C:/tmp/valdes-anexo-b-p2-refined.txt", text, { encoding: "utf8" });
  console.log(text);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
