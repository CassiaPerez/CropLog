/*
  # Fix load_maps status constraint and default value

  1. Changes
    - Drop existing `load_maps_status_check` constraint that was missing 'Coletado'
    - Recreate constraint with all valid Portuguese status values including 'Coletado'
    - Update column default from 'PLANNING' to 'Planejamento' to match constraint

  2. Status values allowed after migration
    - Planejamento
    - Aguardando Separação
    - Em Separação
    - Separado
    - Separado com Divergência
    - Pronto
    - Coletado
    - Em Trânsito
    - Entregue
    - Cancelado

  3. Data cleanup
    - Convert any English status values that may have been saved to their Portuguese equivalents
*/

UPDATE load_maps SET status = 'Planejamento' WHERE status IN ('planning', 'PLANNING');
UPDATE load_maps SET status = 'Aguardando Separação' WHERE status IN ('ready_for_separation', 'Aguardando separacao');
UPDATE load_maps SET status = 'Em Separação' WHERE status IN ('in_separation', 'separation', 'Em separacao');
UPDATE load_maps SET status = 'Separado' WHERE status = 'separated';
UPDATE load_maps SET status = 'Separado com Divergência' WHERE status = 'separated_with_divergence';
UPDATE load_maps SET status = 'Pronto' WHERE status = 'ready';
UPDATE load_maps SET status = 'Coletado' WHERE status = 'collected';
UPDATE load_maps SET status = 'Em Trânsito' WHERE status = 'in_transit';
UPDATE load_maps SET status = 'Entregue' WHERE status = 'delivered';
UPDATE load_maps SET status = 'Cancelado' WHERE status = 'cancelled';

ALTER TABLE load_maps DROP CONSTRAINT IF EXISTS load_maps_status_check;

ALTER TABLE load_maps ADD CONSTRAINT load_maps_status_check CHECK (
  status = ANY (ARRAY[
    'Planejamento',
    'Aguardando Separação',
    'Em Separação',
    'Separado',
    'Separado com Divergência',
    'Pronto',
    'Coletado',
    'Em Trânsito',
    'Entregue',
    'Cancelado'
  ])
);

ALTER TABLE load_maps ALTER COLUMN status SET DEFAULT 'Planejamento';
