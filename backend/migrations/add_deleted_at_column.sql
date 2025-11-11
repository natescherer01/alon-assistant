-- Migration to add soft delete support
-- Adds deleted_at column and updates status constraint to include 'deleted'

-- Add deleted_at column
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITHOUT TIME ZONE;

-- Drop the old constraint
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS check_status;

-- Add new constraint that includes 'deleted' status
ALTER TABLE tasks ADD CONSTRAINT check_status
  CHECK (status IN ('not_started', 'in_progress', 'waiting_on', 'completed', 'deleted'));
