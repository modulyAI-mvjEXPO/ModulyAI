-- Fix embedding dimension mismatch
-- The Groq nomic-embed-text-v1.5 model produces 2048 dimensions
-- This migration updates the document_chunks table to accept 2048 dims

-- Drop existing index (HNSW index with old dimensions)
DROP INDEX IF EXISTS document_chunks_embedding_hnsw_idx;

-- Alter the embedding column to accept 2048 dimensions
ALTER TABLE document_chunks 
ALTER COLUMN embedding TYPE vector(2048);

-- Recreate the HNSW index with new dimensions
CREATE INDEX document_chunks_embedding_hnsw_idx ON document_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Also fix the match_documents_filtered function
CREATE OR REPLACE FUNCTION match_documents_filtered(
  query_embedding vector(2048),
  filter_document_ids uuid[] DEFAULT NULL,
  filter_subject_id uuid DEFAULT NULL,
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  INNER JOIN documents d ON d.id = dc.document_id
  WHERE 1 - (dc.embedding <=> query_embedding) > match_threshold
    AND (filter_document_ids IS NULL OR dc.document_id = ANY(filter_document_ids))
    AND (filter_subject_id IS NULL OR d.subject_id = filter_subject_id)
    AND d.status = 'ready'
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;