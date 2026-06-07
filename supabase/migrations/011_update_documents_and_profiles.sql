-- Migration: Update profiles and documents for admin management
-- Description: Adds is_admin column to profiles and updates documents status check constraint to include pending_approval.

-- 1. Add is_admin column to profiles table if it doesn't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- 2. Update status constraint on documents table
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_status_check;
ALTER TABLE documents ADD CONSTRAINT documents_status_check CHECK (status IN ('pending_approval', 'processing', 'ready', 'failed', 'no_text'));
