/*
  # Adicionar campo google_maps_link à tabela load_maps

  1. Alterações
    - Adicionar coluna `google_maps_link` (text, nullable) à tabela `load_maps`
    - Campo opcional para armazenar o link do Google Maps da rota

  2. Notas
    - Campo nullable pois nem todos os mapas terão um link definido
    - Não há necessidade de popular dados existentes
*/

-- Adicionar coluna google_maps_link se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'load_maps' AND column_name = 'google_maps_link'
  ) THEN
    ALTER TABLE load_maps ADD COLUMN google_maps_link text;
  END IF;
END $$;
