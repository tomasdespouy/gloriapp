/**
 * VECTOR RAG — Semantic search over clinical knowledge base
 *
 * Uses OpenAI embeddings + Supabase pgvector for similarity search.
 * Replaces the keyword-based RAG with understanding of MEANING.
 *
 * Example:
 *   "no puedo dormir desde que ella no está"
 *   → finds: "insomnio en duelo", "somatización del duelo", "duelo normal"
 *   (even though the query doesn't contain those exact words)
 */

import OpenAI from "openai";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  return _openai;
}

export type RAGResult = {
  topic: string;
  category: string;
  content: string;
  source: string | null;
  similarity: number;
};

/**
 * Generate embedding for a text query.
 * Cost: ~0.00002 USD per query (negligible).
 */
async function getEmbedding(text: string): Promise<number[]> {
  const openai = getOpenAI();
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text.slice(0, 8000), // Max input
  });
  return response.data[0].embedding;
}

/**
 * Search clinical knowledge base using semantic similarity.
 *
 * @param query - The conversation context to search for
 * @param maxResults - Maximum number of results (default 3)
 * @param threshold - Minimum similarity score 0-1 (default 0.65)
 */
export async function searchVectorRAG(
  query: string,
  maxResults = 3,
  threshold = 0.40
): Promise<RAGResult[]> {
  try {
    const start = Date.now();

    // 1. Generate embedding for the query
    const embedding = await getEmbedding(query);

    // 2. Search Supabase with pgvector
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("search_clinical_knowledge", {
      query_embedding: JSON.stringify(embedding),
      match_threshold: threshold,
      match_count: maxResults,
    });

    if (error) {
      logger.error("vector_rag_search_error", { error: error.message });
      return [];
    }

    const results: RAGResult[] = (data || []).map((r: Record<string, unknown>) => ({
      topic: String(r.topic),
      category: String(r.category),
      content: String(r.content),
      source: r.source ? String(r.source) : null,
      similarity: Number(r.similarity),
    }));

    logger.metric("vector_rag_search", {
      query_length: query.length,
      results_count: results.length,
      top_similarity: results[0]?.similarity || 0,
      duration_ms: Date.now() - start,
    });

    return results;
  } catch (e) {
    logger.error("vector_rag_error", { error: e instanceof Error ? e.message : "unknown" });
    return [];
  }
}

/**
 * Build a RAG context block from vector search results.
 */
export function buildVectorRAGContext(results: RAGResult[]): string {
  if (results.length === 0) return "";

  const context = results
    .map((r) => `[${r.topic}] (${r.source || "sin fuente"}, relevancia: ${(r.similarity * 100).toFixed(0)}%)\n${r.content}`)
    .join("\n\n");

  return `\n[CONOCIMIENTO CLÍNICO — Información recuperada semánticamente. Usa para dar respuestas clínicamente coherentes. NO la cites textualmente ni actúes como profesional.]
${context}
[FIN CONOCIMIENTO CLÍNICO]\n`;
}
