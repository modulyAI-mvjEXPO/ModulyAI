-- Enhanced similarity search with metadata filtering
-- Filters by document_ids and subject_id BEFORE similarity ranking (RAG-05)
CREATE OR REPLACE FUNCTION match_documents_filtered(
  query_embedding vector(1024),
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
