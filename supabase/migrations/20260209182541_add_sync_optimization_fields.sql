/*
  # Otimização de Sincronização - Campos para Detecção de Mudanças
  
  1. Mudanças
    - Adiciona campo `erp_data_hash` para detectar mudanças nos dados
    - Adiciona campo `last_synced_at` para rastrear última sincronização
    - Adiciona índice na coluna `number` para buscas rápidas
    
  2. Performance
    - Índice composto para otimizar queries de sincronização
    - Permite comparação rápida de mudanças sem processar todos os dados
*/

-- Adicionar campo para hash dos dados do ERP
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS erp_data_hash text,
ADD COLUMN IF NOT EXISTS last_synced_at timestamptz DEFAULT now();

-- Criar índice para buscas rápidas por número
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(number);

-- Criar índice para sincronização
CREATE INDEX IF NOT EXISTS idx_invoices_sync ON invoices(last_synced_at, number);
