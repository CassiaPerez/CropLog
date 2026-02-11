/*
  # Add Invoice Modification Tracking

  1. Changes to invoices table
    - Add `is_modified` (boolean) - Flag to indicate if invoice was modified after initial sync
    - Add `last_modified_at` (timestamptz) - Timestamp of last modification detected
    - Add `is_cancelled` (boolean) - Flag to indicate if invoice was cancelled/removed
    - Add `api_hash` (text) - Hash of invoice data for change detection

  2. Purpose
    - Track modifications to invoices from the ERP system
    - Detect cancelled/removed invoices
    - Enable change detection during sync operations

  3. Notes
    - Cancelled invoices will be marked but not deleted (audit trail)
    - Modified invoices will be updated with new data and flagged
    - Hash comparison enables efficient change detection
*/

-- Add modification tracking columns to invoices table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'is_modified'
  ) THEN
    ALTER TABLE invoices ADD COLUMN is_modified boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'last_modified_at'
  ) THEN
    ALTER TABLE invoices ADD COLUMN last_modified_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'is_cancelled'
  ) THEN
    ALTER TABLE invoices ADD COLUMN is_cancelled boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'api_hash'
  ) THEN
    ALTER TABLE invoices ADD COLUMN api_hash text;
  END IF;
END $$;

-- Create index for efficient querying of modified and cancelled invoices
CREATE INDEX IF NOT EXISTS idx_invoices_is_modified ON invoices(is_modified) WHERE is_modified = true;
CREATE INDEX IF NOT EXISTS idx_invoices_is_cancelled ON invoices(is_cancelled) WHERE is_cancelled = true;
CREATE INDEX IF NOT EXISTS idx_invoices_api_hash ON invoices(api_hash);