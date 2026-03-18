-- LLM-013: Email embeddings for semantic search via Jess

-- Enable pgvector if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS email_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  embedding vector(1024) NOT NULL,
  content_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(email_id)
);

-- HNSW index for fast similarity search
CREATE INDEX idx_email_embeddings_hnsw ON email_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_email_embeddings_email_id ON email_embeddings(email_id);

ALTER TABLE email_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read email embeddings"
  ON email_embeddings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage email embeddings"
  ON email_embeddings FOR ALL TO service_role USING (true);

-- RPC for semantic email search
-- Uses actual documents columns: email_von_name, email_von_email, email_empfangen_am, email_body_text, email_kategorie
CREATE OR REPLACE FUNCTION search_emails_semantic(
  p_query_embedding vector(1024),
  p_absender TEXT DEFAULT NULL,
  p_kategorie TEXT DEFAULT NULL,
  p_datum_von DATE DEFAULT NULL,
  p_datum_bis DATE DEFAULT NULL,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  email_betreff TEXT,
  email_von_name TEXT,
  email_von_email TEXT,
  email_empfangen_am TIMESTAMPTZ,
  email_kategorie TEXT,
  body_preview TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.email_betreff,
    d.email_von_name,
    d.email_von_email,
    d.email_empfangen_am,
    d.email_kategorie,
    LEFT(d.email_body_text, 200) AS body_preview,
    1 - (ee.embedding <=> p_query_embedding) AS similarity
  FROM email_embeddings ee
  JOIN documents d ON d.id = ee.email_id
  WHERE
    (p_absender IS NULL OR d.email_von_name ILIKE '%' || p_absender || '%' OR d.email_von_email ILIKE '%' || p_absender || '%')
    AND (p_kategorie IS NULL OR d.email_kategorie = p_kategorie)
    AND (p_datum_von IS NULL OR d.email_empfangen_am >= p_datum_von)
    AND (p_datum_bis IS NULL OR d.email_empfangen_am <= p_datum_bis + INTERVAL '1 day')
  ORDER BY ee.embedding <=> p_query_embedding
  LIMIT LEAST(p_limit, 50);
END;
$$;
