-- ============================================================
-- VECTOR RAG: Clinical knowledge base with semantic search
-- Uses pgvector for embedding-based similarity search
-- ============================================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Clinical knowledge entries with embeddings
CREATE TABLE public.clinical_knowledge (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic       TEXT NOT NULL,
  category    TEXT NOT NULL,
  content     TEXT NOT NULL,
  source      TEXT,
  embedding   vector(1536),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast similarity search
CREATE INDEX idx_clinical_knowledge_embedding
  ON public.clinical_knowledge
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 20);

CREATE INDEX idx_clinical_knowledge_category
  ON public.clinical_knowledge(category);

ALTER TABLE public.clinical_knowledge ENABLE ROW LEVEL SECURITY;

-- Everyone can read clinical knowledge
CREATE POLICY "Authenticated read clinical knowledge"
  ON public.clinical_knowledge FOR SELECT TO authenticated
  USING (true);

-- Only superadmin can modify
CREATE POLICY "Superadmin manage clinical knowledge"
  ON public.clinical_knowledge FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- Function for semantic search
CREATE OR REPLACE FUNCTION search_clinical_knowledge(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  topic TEXT,
  category TEXT,
  content TEXT,
  source TEXT,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ck.id,
    ck.topic,
    ck.category,
    ck.content,
    ck.source,
    1 - (ck.embedding <=> query_embedding) AS similarity
  FROM public.clinical_knowledge ck
  WHERE 1 - (ck.embedding <=> query_embedding) > match_threshold
  ORDER BY ck.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
