/*
  # Adicionar campos de sincronização à tabela invoices

  1. Alterações
    - Adiciona campo `erp_data_hash` (text, nullable) para armazenar o hash dos dados do ERP
      - Usado para detectar mudanças nos dados e otimizar a sincronização
    - Adiciona campo `last_synced_at` (timestamptz, nullable) para rastrear a última sincronização
      - Permite monitorar quando cada nota foi sincronizada pela última vez

  2. Observações
    - Ambos os campos são opcionais (nullable) para não quebrar dados existentes
    - O campo `erp_data_hash` usa um algoritmo de hash base64 para comparação eficiente
    - O campo `last_synced_at` é atualizado automaticamente durante cada sincronização
*/

-- Adicionar campo para armazenar hash dos dados do ERP
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS erp_data_hash text;

-- Adicionar campo para rastrear última sincronização
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

-- Criar índice no campo erp_data_hash para otimizar consultas
CREATE INDEX IF NOT EXISTS idx_invoices_erp_data_hash ON invoices(erp_data_hash);

-- Criar índice no campo last_synced_at para consultas de monitoramento
CREATE INDEX IF NOT EXISTS idx_invoices_last_synced_at ON invoices(last_synced_at);
