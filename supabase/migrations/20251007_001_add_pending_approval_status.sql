-- ========================================
-- AÑADIR STATUS 'pending_approval' A RESERVATIONS
-- Para grupos grandes (≥10 personas) que requieren aprobación
-- ========================================

-- 1. Verificar el constraint actual
DO $$ 
BEGIN
    -- Eliminar el constraint existente si existe
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'reservations_status_check'
    ) THEN
        ALTER TABLE reservations DROP CONSTRAINT reservations_status_check;
        RAISE NOTICE 'Constraint antiguo eliminado';
    END IF;
END $$;

-- 2. Añadir el nuevo constraint con 'pending_approval'
ALTER TABLE reservations 
ADD CONSTRAINT reservations_status_check 
CHECK (status IN (
    'pending',           -- Pendiente de confirmación (normal)
    'pending_approval',  -- Pendiente de aprobación (grupos ≥10 personas)
    'confirmed',         -- Confirmada
    'seated',            -- Cliente sentado
    'completed',         -- Completada
    'cancelled',         -- Cancelada
    'no_show'            -- No se presentó
));

-- 3. Comentario para documentación
COMMENT ON COLUMN reservations.status IS 'Estado de la reserva. pending_approval se usa para grupos ≥10 personas que requieren aprobación del restaurante';

-- ========================================
-- MIGRACIÓN COMPLETADA ✅
-- ========================================

