/*
  # Tabelas de Notas Fiscais e Itens

  ## Novas Tabelas
    
  ### `invoices`
  Armazena as notas fiscais sincronizadas da API ERP
    - `id` (uuid, primary key) - Identificador único
    - `number` (text, unique) - Número da nota fiscal
    - `customer_name` (text) - Nome do cliente
    - `customer_city` (text) - Cidade do cliente
    - `issue_date` (text) - Data de emissão
    - `total_value` (numeric) - Valor total da nota
    - `total_weight` (numeric) - Peso total em kg
    - `is_assigned` (boolean) - Se está atribuída a um mapa
    - `created_at` (timestamptz) - Data de criação no sistema
    - `updated_at` (timestamptz) - Data da última atualização
  
  ### `invoice_items`
  Armazena os itens/produtos de cada nota fiscal
    - `id` (uuid, primary key) - Identificador único
    - `invoice_id` (uuid, foreign key) - Referência à nota fiscal
    - `sku` (text) - Código SKU do produto
    - `description` (text) - Descrição do produto
    - `quantity` (numeric) - Quantidade
    - `unit` (text) - Unidade de medida
    - `weight_kg` (numeric) - Peso em kg
    - `quantity_picked` (numeric, nullable) - Quantidade separada
    - `created_at` (timestamptz) - Data de criação

  ## Segurança
    - Habilita RLS em ambas as tabelas
    - Políticas para usuários autenticados poderem ler e gerenciar dados
*/

-- Criar tabela de notas fiscais
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text UNIQUE NOT NULL,
  customer_name text NOT NULL,
  customer_city text NOT NULL,
  issue_date text NOT NULL,
  total_value numeric NOT NULL DEFAULT 0,
  total_weight numeric NOT NULL DEFAULT 0,
  is_assigned boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar tabela de itens das notas fiscais
CREATE TABLE IF NOT EXISTS invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  sku text NOT NULL,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  unit text NOT NULL,
  weight_kg numeric NOT NULL DEFAULT 0,
  quantity_picked numeric,
  created_at timestamptz DEFAULT now()
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(number);
CREATE INDEX IF NOT EXISTS idx_invoices_is_assigned ON invoices(is_assigned);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);

-- Habilitar RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

-- Políticas para invoices
CREATE POLICY "Usuários autenticados podem ler notas"
  ON invoices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem inserir notas"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar notas"
  ON invoices FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem deletar notas"
  ON invoices FOR DELETE
  TO authenticated
  USING (true);

-- Políticas para invoice_items
CREATE POLICY "Usuários autenticados podem ler itens"
  ON invoice_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem inserir itens"
  ON invoice_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar itens"
  ON invoice_items FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem deletar itens"
  ON invoice_items FOR DELETE
  TO authenticated
  USING (true);