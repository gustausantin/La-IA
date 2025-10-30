-- =====================================================
-- MIGRACIÓN: Sistema de Inventario de Números Telefónicos
-- Fecha: 2025-10-29
-- Descripción: Pool de números de Vonage para asignar a negocios
-- =====================================================

-- 1. Crear tabla de inventario de teléfonos
CREATE TABLE IF NOT EXISTS inventario_telefonos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_telefono TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('disponible', 'asignado', 'en_cuarentena')),
  id_negocio_asignado UUID REFERENCES businesses(id) ON DELETE SET NULL,
  fecha_asignacion TIMESTAMPTZ,
  fecha_liberacion TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_inventario_status ON inventario_telefonos(status);
CREATE INDEX IF NOT EXISTS idx_inventario_negocio ON inventario_telefonos(id_negocio_asignado);
CREATE INDEX IF NOT EXISTS idx_inventario_liberacion ON inventario_telefonos(fecha_liberacion) WHERE status = 'en_cuarentena';

-- 3. Agregar campo assigned_phone a la tabla businesses
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS assigned_phone TEXT;

-- 4. Crear índice en assigned_phone
CREATE INDEX IF NOT EXISTS idx_businesses_assigned_phone ON businesses(assigned_phone);

-- 5. Insertar el primer número telefónico
INSERT INTO inventario_telefonos (numero_telefono, status)
VALUES ('+34931204462', 'disponible')
ON CONFLICT (numero_telefono) DO NOTHING;

-- 6. Crear función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_inventario_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Crear trigger para updated_at
DROP TRIGGER IF EXISTS trigger_update_inventario_updated_at ON inventario_telefonos;
CREATE TRIGGER trigger_update_inventario_updated_at
  BEFORE UPDATE ON inventario_telefonos
  FOR EACH ROW
  EXECUTE FUNCTION update_inventario_updated_at();

-- 8. Comentarios para documentación
COMMENT ON TABLE inventario_telefonos IS 'Pool de números telefónicos de Vonage para asignar a negocios';
COMMENT ON COLUMN inventario_telefonos.numero_telefono IS 'Número en formato internacional +34...';
COMMENT ON COLUMN inventario_telefonos.status IS 'disponible: listo para asignar | asignado: en uso | en_cuarentena: liberado hace menos de 48h';
COMMENT ON COLUMN inventario_telefonos.fecha_liberacion IS 'Fecha en que se liberó el número (inicio de cuarentena)';

-- =====================================================
-- FUNCIÓN SQL: Reciclaje automático (Cron Job)
-- Se ejecuta cada hora para liberar números después de 48h
-- =====================================================
CREATE OR REPLACE FUNCTION reciclar_numeros_cuarentena()
RETURNS TABLE(numeros_reciclados INTEGER) AS $$
DECLARE
  affected_rows INTEGER;
BEGIN
  UPDATE inventario_telefonos
  SET 
    status = 'disponible',
    id_negocio_asignado = NULL,
    fecha_asignacion = NULL,
    fecha_liberacion = NULL
  WHERE 
    status = 'en_cuarentena'
    AND fecha_liberacion <= NOW() - INTERVAL '48 hours';
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  
  RETURN QUERY SELECT affected_rows;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION reciclar_numeros_cuarentena IS 'Libera números que llevan más de 48h en cuarentena';

-- =====================================================
-- RLS (Row Level Security) - Políticas de seguridad
-- =====================================================

-- Habilitar RLS en la tabla
ALTER TABLE inventario_telefonos ENABLE ROW LEVEL SECURITY;

-- Política: Solo admins pueden ver el inventario
CREATE POLICY "Admins pueden ver inventario" ON inventario_telefonos
  FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'role' = 'service_role');

-- Política: Solo service_role puede modificar (Edge Functions)
CREATE POLICY "Service role puede modificar inventario" ON inventario_telefonos
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================


