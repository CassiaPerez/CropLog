/*
  # Create Sync History and Configuration Tables

  1. New Tables
    - `sync_history`
      - `id` (uuid, primary key) - Unique identifier for each sync record
      - `sync_type` (text) - Type of sync: 'full' or 'incremental'
      - `started_at` (timestamptz) - When the sync started
      - `completed_at` (timestamptz) - When the sync completed
      - `status` (text) - Status: 'running', 'completed', 'failed', 'cancelled'
      - `total_pages` (integer) - Total number of pages processed
      - `total_invoices` (integer) - Total number of invoices synchronized
      - `error_message` (text) - Error message if sync failed
      - `created_at` (timestamptz) - Record creation timestamp

    - `sync_config`
      - `id` (uuid, primary key) - Configuration identifier
      - `last_sync_date` (timestamptz) - Last successful sync date
      - `page_size` (integer) - Number of records per page
      - `delay_between_pages_ms` (integer) - Delay between page requests in milliseconds
      - `max_concurrent_pages` (integer) - Maximum concurrent page requests
      - `request_timeout_ms` (integer) - Timeout for each request in milliseconds
      - `updated_at` (timestamptz) - Last configuration update
      - `created_at` (timestamptz) - Configuration creation timestamp

  2. Security
    - Enable RLS on both tables
    - Add policies for anonymous access (MVP requirement)

  3. Default Configuration
    - Insert default sync configuration values
*/

-- Create sync_history table
CREATE TABLE IF NOT EXISTS sync_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type text NOT NULL CHECK (sync_type IN ('full', 'incremental')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  total_pages integer DEFAULT 0,
  total_invoices integer DEFAULT 0,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Create sync_config table
CREATE TABLE IF NOT EXISTS sync_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  last_sync_date timestamptz,
  page_size integer DEFAULT 100 CHECK (page_size > 0 AND page_size <= 1000),
  delay_between_pages_ms integer DEFAULT 500 CHECK (delay_between_pages_ms >= 0),
  max_concurrent_pages integer DEFAULT 3 CHECK (max_concurrent_pages > 0 AND max_concurrent_pages <= 10),
  request_timeout_ms integer DEFAULT 30000 CHECK (request_timeout_ms > 0),
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE sync_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_config ENABLE ROW LEVEL SECURITY;

-- Policies for sync_history (allow read/write for anonymous users - MVP)
CREATE POLICY "Anyone can view sync history"
  ON sync_history FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can insert sync history"
  ON sync_history FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can update sync history"
  ON sync_history FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Policies for sync_config (allow read/write for anonymous users - MVP)
CREATE POLICY "Anyone can view sync config"
  ON sync_config FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can update sync config"
  ON sync_config FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can insert sync config"
  ON sync_config FOR INSERT
  TO anon
  WITH CHECK (true);

-- Insert default configuration
INSERT INTO sync_config (
  page_size,
  delay_between_pages_ms,
  max_concurrent_pages,
  request_timeout_ms
) VALUES (
  100,   -- page_size: 100 records per page
  500,   -- delay: 500ms between pages to avoid overwhelming the API
  3,     -- max_concurrent: 3 pages at a time
  30000  -- timeout: 30 seconds per request
)
ON CONFLICT DO NOTHING;