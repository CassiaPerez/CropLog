-- ========================================
-- SCRIPT COMPLETO PARA CRIAÇÃO DO BANCO DE DADOS
-- Sistema de Gestão Logística - GCF Logística
-- ========================================
-- Este script já foi aplicado no seu banco Supabase
-- Use apenas para referência ou para recriar em outro banco
-- ========================================

-- ========================================
-- 1. TABELAS DE NOTAS FISCAIS
-- ========================================

-- Tabela principal de notas fiscais
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text UNIQUE NOT NULL,
  customer_name text NOT NULL,
  customer_city text NOT NULL,
  issue_date text NOT NULL,
  document_date text,
  total_value numeric NOT NULL DEFAULT 0,
  total_weight numeric NOT NULL DEFAULT 0,
  is_assigned boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de itens das notas fiscais
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

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(number);
CREATE INDEX IF NOT EXISTS idx_invoices_is_assigned ON invoices(is_assigned);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);

-- ========================================
-- 2. TABELAS DE USUÁRIOS
-- ========================================

CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('ADMIN', 'LOGISTICA_PLANEJAMENTO', 'SEPARACAO', 'STATUS_OPERACAO')),
  created_at timestamptz DEFAULT now()
);

-- ========================================
-- 3. TABELAS DE MAPAS DE CARGA
-- ========================================

-- Tabela principal de mapas de carga
CREATE TABLE IF NOT EXISTS load_maps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  carrier_name text NOT NULL,
  vehicle_plate text NOT NULL,
  source_city text NOT NULL,
  route text NOT NULL,
  status text NOT NULL DEFAULT 'PLANNING' CHECK (status IN ('PLANNING', 'SEPARATION', 'IN_TRANSIT', 'DELIVERED')),
  current_city text,
  logistics_notes text,
  google_maps_link text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de relacionamento entre mapas e notas fiscais
CREATE TABLE IF NOT EXISTS load_map_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  load_map_id uuid NOT NULL REFERENCES load_maps(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(load_map_id, invoice_id)
);

-- Tabela de timeline dos mapas
CREATE TABLE IF NOT EXISTS load_map_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  load_map_id uuid NOT NULL REFERENCES load_maps(id) ON DELETE CASCADE,
  timestamp timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL,
  description text NOT NULL,
  user_id uuid,
  user_name text,
  created_at timestamptz DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_load_maps_status ON load_maps(status);
CREATE INDEX IF NOT EXISTS idx_load_maps_created_at ON load_maps(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_load_map_invoices_load_map_id ON load_map_invoices(load_map_id);
CREATE INDEX IF NOT EXISTS idx_load_map_invoices_invoice_id ON load_map_invoices(invoice_id);
CREATE INDEX IF NOT EXISTS idx_load_map_timeline_load_map_id ON load_map_timeline(load_map_id);
CREATE INDEX IF NOT EXISTS idx_load_map_timeline_timestamp ON load_map_timeline(timestamp DESC);

-- ========================================
-- 4. FUNÇÕES E TRIGGERS
-- ========================================

-- Função para atualizar automaticamente o campo updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para invoices
DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para load_maps
DROP TRIGGER IF EXISTS update_load_maps_updated_at ON load_maps;
CREATE TRIGGER update_load_maps_updated_at
  BEFORE UPDATE ON load_maps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 5. SEGURANÇA - ROW LEVEL SECURITY (RLS)
-- ========================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE load_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE load_map_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE load_map_timeline ENABLE ROW LEVEL SECURITY;

-- ========================================
-- POLÍTICAS RLS - INVOICES
-- ========================================

DROP POLICY IF EXISTS "Permitir leitura de notas" ON invoices;
CREATE POLICY "Permitir leitura de notas"
  ON invoices FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Permitir inserção de notas" ON invoices;
CREATE POLICY "Permitir inserção de notas"
  ON invoices FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualização de notas" ON invoices;
CREATE POLICY "Permitir atualização de notas"
  ON invoices FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir exclusão de notas" ON invoices;
CREATE POLICY "Permitir exclusão de notas"
  ON invoices FOR DELETE
  TO anon, authenticated
  USING (true);

-- ========================================
-- POLÍTICAS RLS - INVOICE_ITEMS
-- ========================================

DROP POLICY IF EXISTS "Permitir leitura de itens" ON invoice_items;
CREATE POLICY "Permitir leitura de itens"
  ON invoice_items FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Permitir inserção de itens" ON invoice_items;
CREATE POLICY "Permitir inserção de itens"
  ON invoice_items FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualização de itens" ON invoice_items;
CREATE POLICY "Permitir atualização de itens"
  ON invoice_items FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir exclusão de itens" ON invoice_items;
CREATE POLICY "Permitir exclusão de itens"
  ON invoice_items FOR DELETE
  TO anon, authenticated
  USING (true);

-- ========================================
-- POLÍTICAS RLS - APP_USERS
-- ========================================

DROP POLICY IF EXISTS "Permitir leitura de usuários" ON app_users;
CREATE POLICY "Permitir leitura de usuários"
  ON app_users FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Permitir criação de usuários" ON app_users;
CREATE POLICY "Permitir criação de usuários"
  ON app_users FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualização de usuários" ON app_users;
CREATE POLICY "Permitir atualização de usuários"
  ON app_users FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir exclusão de usuários" ON app_users;
CREATE POLICY "Permitir exclusão de usuários"
  ON app_users FOR DELETE
  TO anon, authenticated
  USING (true);

-- ========================================
-- POLÍTICAS RLS - LOAD_MAPS
-- ========================================

DROP POLICY IF EXISTS "Permitir leitura de mapas" ON load_maps;
CREATE POLICY "Permitir leitura de mapas"
  ON load_maps FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Permitir criação de mapas" ON load_maps;
CREATE POLICY "Permitir criação de mapas"
  ON load_maps FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualização de mapas" ON load_maps;
CREATE POLICY "Permitir atualização de mapas"
  ON load_maps FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir exclusão de mapas" ON load_maps;
CREATE POLICY "Permitir exclusão de mapas"
  ON load_maps FOR DELETE
  TO anon, authenticated
  USING (true);

-- ========================================
-- POLÍTICAS RLS - LOAD_MAP_INVOICES
-- ========================================

DROP POLICY IF EXISTS "Permitir leitura de relações" ON load_map_invoices;
CREATE POLICY "Permitir leitura de relações"
  ON load_map_invoices FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Permitir criação de relações" ON load_map_invoices;
CREATE POLICY "Permitir criação de relações"
  ON load_map_invoices FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir exclusão de relações" ON load_map_invoices;
CREATE POLICY "Permitir exclusão de relações"
  ON load_map_invoices FOR DELETE
  TO anon, authenticated
  USING (true);

-- ========================================
-- POLÍTICAS RLS - LOAD_MAP_TIMELINE
-- ========================================

DROP POLICY IF EXISTS "Permitir leitura de timeline" ON load_map_timeline;
CREATE POLICY "Permitir leitura de timeline"
  ON load_map_timeline FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Permitir criação de eventos na timeline" ON load_map_timeline;
CREATE POLICY "Permitir criação de eventos na timeline"
  ON load_map_timeline FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- ========================================
-- FIM DO SCRIPT
-- ========================================
-- Todas as tabelas, índices, funções e políticas foram criadas
-- O banco de dados está pronto para uso
-- ========================================
