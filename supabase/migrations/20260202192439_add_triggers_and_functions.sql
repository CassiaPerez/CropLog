/*
  # Adicionar Triggers e Funções Auxiliares

  1. Funções
    - `update_updated_at_column()` - Atualiza automaticamente o campo updated_at

  2. Triggers
    - Trigger para atualizar updated_at em `invoices`
    - Trigger para atualizar updated_at em `load_maps`

  3. Notas
    - Triggers são executados automaticamente antes de cada UPDATE
    - O campo updated_at será sempre atualizado com o timestamp atual
*/

-- Criar função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Criar trigger para invoices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_invoices_updated_at'
  ) THEN
    CREATE TRIGGER update_invoices_updated_at
      BEFORE UPDATE ON invoices
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Criar trigger para load_maps
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_load_maps_updated_at'
  ) THEN
    CREATE TRIGGER update_load_maps_updated_at
      BEFORE UPDATE ON load_maps
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;