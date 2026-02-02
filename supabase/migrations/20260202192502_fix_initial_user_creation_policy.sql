/*
  # Corrigir Políticas de Criação de Usuários Iniciais

  1. Mudanças
    - Remove política restritiva de INSERT em app_users que impedia criar o primeiro usuário
    - Adiciona nova política que permite:
      a) Criação se não houver nenhum usuário ainda (primeiro usuário)
      b) Criação por admins existentes
    
  2. Segurança
    - Mantém RLS habilitado
    - Permite bootstrap do sistema com primeiro usuário
    - Mantém restrição para usuários subsequentes
*/

-- Remover política antiga de INSERT
DROP POLICY IF EXISTS "Apenas admins podem criar usuários" ON app_users;

-- Criar nova política que permite primeiro usuário ou admin
CREATE POLICY "Permitir criação de usuários"
  ON app_users FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Permite se não há usuários ainda (primeiro usuário)
    NOT EXISTS (SELECT 1 FROM app_users)
    OR
    -- Permite se o usuário atual é admin
    EXISTS (
      SELECT 1 FROM app_users
      WHERE id = auth.uid()
      AND role = 'ADMIN'
    )
  );