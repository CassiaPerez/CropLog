/*
  # Add lote to invoice_items and sort_order to load_map_invoices

  ## Changes

  ### 1. invoice_items
  - Add `lote` column (text, nullable) - batch/lot number from the ERP order (nro_pedido field)

  ### 2. load_map_invoices
  - Add `sort_order` column (integer, default 0) - controls display order of invoices within a load map

  ## Notes
  - Both columns are additive (no data loss)
  - sort_order defaults to 0 so existing rows are unaffected
  - lote is nullable since not all items have a batch number
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoice_items' AND column_name = 'lote'
  ) THEN
    ALTER TABLE invoice_items ADD COLUMN lote text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'load_map_invoices' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE load_map_invoices ADD COLUMN sort_order integer DEFAULT 0;
  END IF;
END $$;
