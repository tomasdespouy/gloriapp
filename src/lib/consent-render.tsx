/**
 * Lightweight consent-text renderer.
 *
 * Supports a small, safe subset of markdown so admins can add visual
 * hierarchy to the consent text without us shipping a full markdown lib:
 *
 *   **bold text**          → <strong>bold text</strong>
 *   # Heading              → <h3 class="font-bold">
 *   ## Subheading          → <h4 class="font-semibold">
 *   - list item            → <ul><li>
 *   ¿Preguntas así?        → auto-bold (heading) when line is short
 *   blank line             → paragraph break
 *
 * Anything that looks risky goes through DOMPurify before landing on
 * the page via dangerouslySetInnerHTML. If rendering fails for any
 * reason we fall back to the plain whitespace-pre-wrap version.
 */

import DOMPurify from "dompurify";

const MAX_HEADING_LEN = 80;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderInline(line: string): string {
  // Escape HTML first, then introduce our safe tags via known tokens.
  const esc = escapeHtml(line);
  return esc.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
}

function isAutoHeading(line: string): boolean {
  // Short, title-ish lines that end with a question mark count as
  // headings without any markdown — this covers the existing template
  // ("¿Qué es GlorIA?", "¿Qué se te pide?"…) without forcing the admin
  // to rewrite everything.
  const trimmed = line.trim();
  return (
    trimmed.length > 0 &&
    trimmed.length <= MAX_HEADING_LEN &&
    trimmed.endsWith("?")
  );
}

/** Converts the raw consent text to sanitized HTML. */
export function consentToHtml(text: string): string {
  if (!text) return "";
  try {
    const lines = text.split(/\r?\n/);
    const parts: string[] = [];
    let paragraphBuf: string[] = [];
    let listBuf: string[] = [];

    const flushParagraph = () => {
      if (paragraphBuf.length === 0) return;
      const joined = paragraphBuf.map(renderInline).join("<br/>");
      parts.push(`<p class="mb-3 text-gray-800 leading-relaxed">${joined}</p>`);
      paragraphBuf = [];
    };

    const flushList = () => {
      if (listBuf.length === 0) return;
      const items = listBuf
        .map((l) => `<li>${renderInline(l.replace(/^\s*-\s+/, ""))}</li>`)
        .join("");
      parts.push(
        `<ul class="list-disc pl-5 mb-3 space-y-1 text-gray-800">${items}</ul>`,
      );
      listBuf = [];
    };

    for (const raw of lines) {
      const line = raw.replace(/\s+$/, "");

      // Blank line = paragraph break
      if (line.trim() === "") {
        flushParagraph();
        flushList();
        continue;
      }

      // Markdown explicit heading
      if (/^##\s+/.test(line)) {
        flushParagraph();
        flushList();
        parts.push(
          `<h4 class="font-semibold text-gray-900 mt-4 mb-1">${renderInline(line.replace(/^##\s+/, ""))}</h4>`,
        );
        continue;
      }
      if (/^#\s+/.test(line)) {
        flushParagraph();
        flushList();
        parts.push(
          `<h3 class="font-bold text-gray-900 text-base mt-5 mb-1">${renderInline(line.replace(/^#\s+/, ""))}</h3>`,
        );
        continue;
      }

      // List item
      if (/^\s*-\s+/.test(line)) {
        flushParagraph();
        listBuf.push(line);
        continue;
      }

      // Auto heading for question-style lines
      if (listBuf.length === 0 && paragraphBuf.length === 0 && isAutoHeading(line)) {
        flushParagraph();
        flushList();
        parts.push(
          `<h4 class="font-semibold text-gray-900 mt-4 mb-1">${renderInline(line)}</h4>`,
        );
        continue;
      }

      // Default paragraph accumulation
      flushList();
      paragraphBuf.push(line);
    }

    flushParagraph();
    flushList();

    const html = parts.join("\n");
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ["p", "h3", "h4", "strong", "em", "ul", "li", "br"],
      ALLOWED_ATTR: ["class"],
    });
  } catch {
    // Fall back to plain escaped text if anything goes wrong
    return `<p class="whitespace-pre-wrap text-gray-800">${escapeHtml(text)}</p>`;
  }
}

/** Drop-in component: renders the sanitized HTML. */
export function ConsentRenderer({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const html = consentToHtml(text);
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
