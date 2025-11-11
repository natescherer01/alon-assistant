-- Migration to add project column to tasks table
-- Adds project field for task organization

-- Add project column
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS project VARCHAR;
