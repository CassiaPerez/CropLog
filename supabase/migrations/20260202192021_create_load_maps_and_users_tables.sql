/*
  # Criar tabelas de Usuários e Mapas de Carga

  1. Novas Tabelas
    - `app_users`
      - `id` (uuid, primary key)
      - `name` (text) - Nome do usuário
      - `role` (text) - Tipo de permissão (ADMIN, LOGISTICA_PLANEJAMENTO, SEPARACAO, STATUS_OPERACAO)
      - `created_at` (timestamp)
    
    - `load_maps`
      - `id` (uuid, primary key)
      - `code` (text, unique) - Código único do mapa
      - `carrier_name` (text) - Nome da transportadora
      - `vehicle_plate` (text) - Placa do veículo
      - `source_city` (text) - Cidade de origem
      - `route` (text) - Rota
      - `status` (text) - Status atual (PLANNING, SEPARATION, IN_TRANSIT, DELIVERED)
      - `current_city` (text, nullable) - Cidade atual
      - `logistics_notes` (text, nullable) - Observações logísticas
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `load_map_invoices`
      - `id` (uuid, primary key)
      - `load_map_id` (uuid, foreign key) - Referência ao mapa de carga
      - `invoice_id` (uuid, foreign key) - Referência à nota fiscal
      - `created_at` (timestamp)
    
    - `load_map_timeline`
      - `id` (uuid, primary key)
      - `load_map_id` (uuid, foreign key) - Referência ao mapa de carga
      - `timestamp` (timestamp) - Data/hora do evento
      - `status` (text) - Status nesse evento
      - `description` (text) - Descrição do evento
      - `user_id` (uuid, nullable) - ID do usuário que criou o evento
      - `user_name` (text, nullable) - Nome do usuário
      - `created_at` (timestamp)

  2. Segurança
    - Habilitar RLS em todas as tabelas
    - Adicionar políticas para usuários autenticados
    - Políticas restritivas por padrão

  3. Índices
    - Adicionar índices para melhorar performance em consultas frequentes
*/

-- Criar tabela de usuários
CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('ADMIN', 'LOGISTICA_PLANEJAMENTO', 'SEPARACAO', 'STATUS_OPERACAO')),
  created_at timestamptz DEFAULT now()
);

-- Criar tabela de mapas de carga
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
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar tabela de relacionamento entre mapas e notas fiscais
CREATE TABLE IF NOT EXISTS load_map_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  load_map_id uuid NOT NULL REFERENCES load_maps(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(load_map_id, invoice_id)
);

-- Criar tabela de timeline dos mapas
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

-- Habilitar RLS
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE load_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE load_map_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE load_map_timeline ENABLE ROW LEVEL SECURITY;

-- Políticas para app_users
CREATE POLICY "Usuários autenticados podem ler usuários"
  ON app_users FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Apenas admins podem criar usuários"
  ON app_users FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE id = auth.uid()
      AND role = 'ADMIN'
    )
  );

CREATE POLICY "Apenas admins podem atualizar usuários"
  ON app_users FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE id = auth.uid()
      AND role = 'ADMIN'
    )
  );

CREATE POLICY "Apenas admins podem deletar usuários"
  ON app_users FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE id = auth.uid()
      AND role = 'ADMIN'
    )
  );

-- Políticas para load_maps
CREATE POLICY "Usuários autenticados podem ler mapas"
  ON load_maps FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem criar mapas"
  ON load_maps FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar mapas"
  ON load_maps FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Apenas admins podem deletar mapas"
  ON load_maps FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE id = auth.uid()
      AND role = 'ADMIN'
    )
  );

-- Políticas para load_map_invoices
CREATE POLICY "Usuários autenticados podem ler relações"
  ON load_map_invoices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem criar relações"
  ON load_map_invoices FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Apenas admins podem deletar relações"
  ON load_map_invoices FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE id = auth.uid()
      AND role = 'ADMIN'
    )
  );

-- Políticas para load_map_timeline
CREATE POLICY "Usuários autenticados podem ler timeline"
  ON load_map_timeline FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem criar eventos na timeline"
  ON load_map_timeline FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Criar índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_load_maps_status ON load_maps(status);
CREATE INDEX IF NOT EXISTS idx_load_maps_created_at ON load_maps(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_load_map_invoices_load_map_id ON load_map_invoices(load_map_id);
CREATE INDEX IF NOT EXISTS idx_load_map_invoices_invoice_id ON load_map_invoices(invoice_id);
CREATE INDEX IF NOT EXISTS idx_load_map_timeline_load_map_id ON load_map_timeline(load_map_id);
CREATE INDEX IF NOT EXISTS idx_load_map_timeline_timestamp ON load_map_timeline(timestamp DESC);