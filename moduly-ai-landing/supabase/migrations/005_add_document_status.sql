-- Add processing status and metadata columns to documents table
ALTER TABLE documents
  ADD COLUMN status text NOT NULL DEFAULT 'processing',
  ADD COLUMN chunk_count integer DEFAULT 0,
  ADD COLUMN file_size bigint,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

-- Add constraint for valid status values
ALTER TABLE documents
  ADD CONSTRAINT documents_status_check
  CHECK (status IN ('processing', 'ready', 'failed', 'no_text'));

-- Add UPDATE policy so users can update own documents
CREATE POLICY "Users can update own documents"
  ON documents FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
