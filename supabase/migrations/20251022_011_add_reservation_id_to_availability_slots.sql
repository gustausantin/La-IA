-- =====================================================
-- AÑADIR COLUMNA reservation_id A availability_slots
-- =====================================================
-- Fecha: 22 Octubre 2025
-- Problema: La RPC create_combined_reservation necesita la columna reservation_id
--           pero no existe en availability_slots
-- Solución: Añadir la columna con índice para performance
-- =====================================================

-- Verificar si la columna ya existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'availability_slots' 
        AND column_name = 'reservation_id'
    ) THEN
        -- Añadir columna reservation_id
        ALTER TABLE availability_slots
        ADD COLUMN reservation_id UUID NULL;
        
        RAISE NOTICE '✅ Columna reservation_id añadida a availability_slots';
        
        -- Crear índice para mejorar performance
        CREATE INDEX IF NOT EXISTS idx_availability_slots_reservation_id 
        ON availability_slots(reservation_id) 
        WHERE reservation_id IS NOT NULL;
        
        RAISE NOTICE '✅ Índice creado para reservation_id';
        
        -- Comentario
        COMMENT ON COLUMN availability_slots.reservation_id IS 
        'UUID de la reserva que ocupa este slot. NULL si el slot está libre.';
        
    ELSE
        RAISE NOTICE 'ℹ️ La columna reservation_id ya existe en availability_slots';
    END IF;
END $$;

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'availability_slots' 
        AND column_name = 'reservation_id'
    ) THEN
        RAISE NOTICE '✅ VERIFICACIÓN EXITOSA: reservation_id existe en availability_slots';
    ELSE
        RAISE EXCEPTION '❌ ERROR: reservation_id NO se creó correctamente';
    END IF;
END $$;

-- =====================================================
-- ✅ FIN DE LA MIGRACIÓN
-- =====================================================

