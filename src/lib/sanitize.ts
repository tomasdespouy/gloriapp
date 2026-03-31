import DOMPurify from "dompurify";

/**
 * Sanitize HTML to prevent XSS, allowing only safe formatting tags.
 */
export function sanitizeHTML(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ["strong", "em", "span", "br", "a"],
    ALLOWED_ATTR: ["class", "href", "target", "rel"],
  });
}
