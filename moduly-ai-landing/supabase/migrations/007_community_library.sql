-- Phase 7: Community Library
-- 1. Add public-read RLS policy so any authenticated user can browse ready documents
-- 2. Create removal_requests table for LIB-03

-- Allow any authenticated user to read documents with status = 'ready'
CREATE POLICY "Authenticated users can view ready documents"
  ON documents FOR SELECT
  USING (auth.role() = 'authenticated' AND status = 'ready');

-- Removal requests table
CREATE TABLE removal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE removal_requests ENABLE ROW LEVEL SECURITY;

-- Users can insert their own removal requests
CREATE POLICY "Users can insert own removal requests"
  ON removal_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own removal requests
CREATE POLICY "Users can view own removal requests"
  ON removal_requests FOR SELECT
  USING (auth.uid() = user_id);
