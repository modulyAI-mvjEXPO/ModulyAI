-- Migration: Add columns for admin promotion request & approval
-- Description: Adds is_admin_pending and admin_requested_by columns to profiles table.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin_pending BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS admin_requested_by TEXT DEFAULT NULL;
