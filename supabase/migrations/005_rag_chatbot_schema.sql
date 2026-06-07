-- Migration: RAG Chatbot Vector Storage & Chat Memory
-- Description: Sets up pgvector extension, documents table with embeddings, 
-- match_documents RPC function, and chat_history table for RAG chatbot

-- ============================================================================
-- 1. ENABLE PGVECTOR EXTENSION
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- 2. DOCUMENTS TABLE (for vector storage & RAG retrieval)
-- ============================================================================
-- Table creation (skip if already exists, just alter if needed)
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,  -- Store: { filename, source, chunk_index, etc }
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns if they don't exist
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS content TEXT,
ADD COLUMN IF NOT EXISTS embedding VECTOR(1536),  -- Dimension: 1536 (OpenAI ada-002, text-embedding-3-large)
                                                   -- Change to 384 for all-MiniLM-L6-v2, 768 for other models
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create index on embedding for vector similarity search
-- Using ivfflat for faster approximate searches (suitable for embeddings)
CREATE INDEX IF NOT EXISTS documents_embedding_idx 
  ON documents 
  USING IVFFLAT (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Create index on metadata for filtering by source/filename
CREATE INDEX IF NOT EXISTS documents_metadata_idx 
  ON documents 
  USING GIN (metadata);

-- Create index on created_at for time-based queries
CREATE INDEX IF NOT EXISTS documents_created_at_idx 
  ON documents (created_at DESC);

-- ============================================================================
-- 3. RPC FUNCTION: match_documents (Cosine Similarity Search)
-- ============================================================================
-- Drop existing function if it has a different signature
DROP FUNCTION IF EXISTS match_documents(VECTOR, FLOAT, INT);

CREATE OR REPLACE FUNCTION match_documents(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  FROM documents
  WHERE 1 - (documents.embedding <=> query_embedding) > match_threshold
  ORDER BY documents.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ============================================================================
-- 4. CHAT_HISTORY TABLE (for conversation memory)
-- ============================================================================
CREATE TABLE IF NOT EXISTS chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'ai')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Foreign key constraint (optional - only if you have a sessions table)
  -- CONSTRAINT chat_history_session_fk 
  --   FOREIGN KEY (session_id) 
  --   REFERENCES chat_sessions(id) ON DELETE CASCADE
  
  CONSTRAINT chat_history_content_not_empty CHECK (LENGTH(TRIM(content)) > 0)
);

-- Create index on session_id for quick chat retrieval
CREATE INDEX IF NOT EXISTS chat_history_session_id_idx 
  ON chat_history (session_id);

-- Create index on created_at for chronological ordering
CREATE INDEX IF NOT EXISTS chat_history_created_at_idx 
  ON chat_history (created_at DESC);

-- Create composite index for efficient session + time queries
CREATE INDEX IF NOT EXISTS chat_history_session_time_idx 
  ON chat_history (session_id, created_at DESC);

-- ============================================================================
-- 5. ENABLE ROW LEVEL SECURITY (Optional but Recommended)
-- ============================================================================
-- Uncomment if you want to add RLS policies for multi-tenant safety

-- ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;

-- Example policies (adjust to your auth scheme):
-- CREATE POLICY "Users can read documents" ON documents
--   FOR SELECT USING (true);
-- 
-- CREATE POLICY "Users can read their own chat history" ON chat_history
--   FOR SELECT USING (
--     session_id IN (
--       SELECT id FROM chat_sessions WHERE user_id = auth.uid()
--     )
--   );

-- ============================================================================
-- 6. HELPER FUNCTION: Update updated_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists, then create it
DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;

CREATE TRIGGER update_documents_updated_at
BEFORE UPDATE ON documents
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- NOTES & CONFIGURATION
-- ============================================================================
-- 
-- EMBEDDING DIMENSION:
--   - 1536: OpenAI text-embedding-3-large, text-embedding-ada-002
--   - 1024: OpenAI text-embedding-3-small
--   - 768: Sentence-BERT, all-mpnet-base-v2
--   - 384: all-MiniLM-L6-v2 (faster, smaller model)
--
-- VECTOR INDEX TYPES:
--   - IVFFLAT: Good balance of speed & accuracy (used here)
--   - HNSW: Higher accuracy, slower build time
--   - IVFFlat lists = 100 is good for ~1M rows; adjust upward for larger datasets
--
-- SIMILARITY METRICS (used in RPC function):
--   - <=> (Cosine distance) - most common for embeddings
--   - <-> (Euclidean distance)
--   - <#> (Inner product distance)
--
-- MATCH_THRESHOLD: Controls similarity cutoff (0-1)
--   - 0.7: High similarity (strict)
--   - 0.5: Medium similarity (balanced, used as default)
--   - 0.3: Low similarity (permissive)
