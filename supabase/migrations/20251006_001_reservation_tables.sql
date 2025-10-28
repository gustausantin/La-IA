-- =====================================================
-- RESERVATION TABLES - SOPORTE MULTI-MESA
-- Fecha: 6 Octubre 2025
-- Descripción: Permite asignar múltiples mesas a una reserva
-- =====================================================

-- 1. CREAR TABLA reservation_tables
CREATE TABLE IF NOT EXISTS reservation_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraint: Una mesa no puede estar asignada dos veces a la misma reserva
  UNIQUE(reservation_id, table_id)
);

-- 2. CREAR ÍNDICES
CREATE INDEX IF NOT EXISTS idx_reservation_tables_reservation 
  ON reservation_tables(reservation_id);

CREATE INDEX IF NOT EXISTS idx_reservation_tables_table 
  ON reservation_tables(table_id);

-- 3. HABILITAR RLS (Row Level Security)
ALTER TABLE reservation_tables ENABLE ROW LEVEL SECURITY;

-- 4. CREAR POLÍTICA RLS
CREATE POLICY "Users can manage reservation_tables from their restaurant"
  ON reservation_tables
  FOR ALL
  USING (
    reservation_id IN (
      SELECT r.id 
      FROM reservations r
      INNER JOIN businesses rest ON rest.id = r.restaurant_id
      WHERE rest.owner_id = auth.uid()
    )
  );

-- 5. MIGRAR DATOS EXISTENTES
-- Para cada reserva con table_id, crear una fila en reservation_tables
INSERT INTO reservation_tables (reservation_id, table_id, created_at)
SELECT 
  id as reservation_id,
  table_id,
  created_at
FROM reservations
WHERE table_id IS NOT NULL
ON CONFLICT (reservation_id, table_id) DO NOTHING;

-- 6. COMENTARIOS
COMMENT ON TABLE reservation_tables IS 'Tabla intermedia para soportar múltiples mesas por reserva (grupos grandes)';
COMMENT ON COLUMN reservation_tables.reservation_id IS 'FK a reservations';
COMMENT ON COLUMN reservation_tables.table_id IS 'FK a tables';

-- =====================================================
-- MIGRACIÓN COMPLETADA ✅
-- =====================================================
