/*
  # Add Sync Tracking Columns to Invoices Table
  
  1. New Columns
    - `source_updated_at` (timestamptz) - Timestamp from the ERP API indicating when the invoice was last updated at source
    - `source_hash` (text) - SHA-256 hash of invoice data from source for change detection
    - `cancelled_at` (timestamptz) - Timestamp when the invoice was marked as cancelled
  
  2. Changes
    - Add columns if they don't exist to support incremental sync and change detection
    - These columns help track the state of invoices from the ERP source
  
  3. Notes
    - `source_hash` uses SHA-256 for reliable change detection
    - `source_updated_at` allows filtering by last modified date from API
    - `cancelled_at` tracks when an invoice was marked as cancelled (soft delete)
*/

-- Add source tracking columns if they don't exist
DO $$
BEGIN
  -- Add source_updated_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'source_updated_at'
  ) THEN
    ALTER TABLE invoices ADD COLUMN source_updated_at timestamptz;
  END IF;

  -- Add source_hash column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'source_hash'
  ) THEN
    ALTER TABLE invoices ADD COLUMN source_hash text;
  END IF;

  -- Add cancelled_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'cancelled_at'
  ) THEN
    ALTER TABLE invoices ADD COLUMN cancelled_at timestamptz;
  END IF;
END $$;

-- Create index on source_hash for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoices_source_hash ON invoices(source_hash);

-- Create index on source_updated_at for incremental sync queries
CREATE INDEX IF NOT EXISTS idx_invoices_source_updated_at ON invoices(source_updated_at);
