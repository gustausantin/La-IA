-- =====================================================
-- AÑADIR ESTADO 'deleted' AL CHECK CONSTRAINT DE RESERVATIONS
-- Fecha: 18 de octubre de 2025
-- Objetivo: Permitir soft delete de reservas
-- =====================================================

-- PASO 1: Eliminar el constraint actual (si existe)
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_status_check;

-- PASO 2: Crear nuevo constraint con 'deleted' incluido
ALTER TABLE reservations ADD CONSTRAINT reservations_status_check 
CHECK (status IN (
    'pending', 
    'pending_approval',
    'confirmed', 
    'seated', 
    'completed', 
    'cancelled', 
    'no_show',
    'deleted'  -- ✅ NUEVO
));

-- COMENTARIO
COMMENT ON CONSTRAINT reservations_status_check ON reservations IS 
'Estados válidos de reserva. "deleted" permite soft delete respetando la Regla Sagrada.';

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================

