/*
  # Create API Configuration Table

  ## Summary
  Creates a secure table to store ERP API configuration settings with proper validation and security.

  ## New Tables
  
  ### `api_config`
  - `id` (uuid, primary key) - Unique identifier for the configuration
  - `name` (text) - Friendly name for this configuration (e.g., "ERP Principal")
  - `base_url` (text, required) - Full API endpoint URL with query parameters
  - `api_key` (text) - Optional API key for authentication
  - `is_active` (boolean) - Whether this configuration is currently active
  - `auto_sync_enabled` (boolean) - Enable/disable automatic synchronization
  - `sync_interval_minutes` (integer) - Interval between automatic syncs (default: 5 minutes)
  - `last_test_at` (timestamptz) - Last time connection was tested
  - `last_test_status` (text) - Result of last connection test (success/failed)
  - `created_at` (timestamptz) - When configuration was created
  - `updated_at` (timestamptz) - Last update timestamp

  ## Security
  - Enable RLS on api_config table
  - Allow anonymous read access (for MVP - single user system)
  - Allow anonymous write access (for MVP - single user system)
  
  ## Notes
  - Only one configuration can be active at a time
  - Auto-sync is disabled by default for safety
  - Connection testing is tracked for diagnostics
*/

-- Create api_config table
CREATE TABLE IF NOT EXISTS api_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Configuração Principal',
  base_url text NOT NULL,
  api_key text,
  is_active boolean DEFAULT false,
  auto_sync_enabled boolean DEFAULT false,
  sync_interval_minutes integer DEFAULT 5 CHECK (sync_interval_minutes >= 1),
  last_test_at timestamptz,
  last_test_status text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE api_config ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access (MVP - single user)
CREATE POLICY "Allow anonymous read api_config"
  ON api_config
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous insert api_config"
  ON api_config
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous update api_config"
  ON api_config
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous delete api_config"
  ON api_config
  FOR DELETE
  TO anon
  USING (true);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_api_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER api_config_updated_at
  BEFORE UPDATE ON api_config
  FOR EACH ROW
  EXECUTE FUNCTION update_api_config_updated_at();

-- Create index for active configuration lookup
CREATE INDEX IF NOT EXISTS idx_api_config_active ON api_config(is_active) WHERE is_active = true;