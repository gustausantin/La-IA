-- =====================================================
-- AÑADIR SOFT DELETE A CUSTOMERS
-- Fecha: 18 de octubre de 2025
-- Objetivo: Permitir desactivar clientes sin eliminarlos físicamente
-- =====================================================

-- PASO 1: Añadir columna is_active si no existe
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- PASO 2: Actualizar clientes existentes (todos activos por defecto)
UPDATE customers 
SET is_active = TRUE 
WHERE is_active IS NULL;

-- PASO 3: Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_customers_is_active 
ON customers(is_active) 
WHERE is_active = TRUE;

-- PASO 4: Índice compuesto para búsquedas por restaurante + activos
CREATE INDEX IF NOT EXISTS idx_customers_restaurant_active 
ON customers(restaurant_id, is_active) 
WHERE is_active = TRUE;

-- COMENTARIO
COMMENT ON COLUMN customers.is_active IS 
'Indica si el cliente está activo. FALSE = desactivado (soft delete). Protege integridad de reservas y mantiene histórico.';

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================



