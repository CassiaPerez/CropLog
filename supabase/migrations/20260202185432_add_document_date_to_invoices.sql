/*
  # Adicionar campo document_date à tabela invoices

  1. Alterações
    - Adiciona coluna `document_date` (text) à tabela `invoices`
    - Campo para armazenar a data do documento da nota fiscal
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'document_date'
  ) THEN
    ALTER TABLE invoices ADD COLUMN document_date text;
  END IF;
END $$;
