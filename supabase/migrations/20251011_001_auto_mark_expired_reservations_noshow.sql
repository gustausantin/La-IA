-- ========================================
-- AUTO-MARCAR RESERVAS EXPIRADAS COMO NO-SHOW
-- Fecha: 11 Octubre 2025
-- Descripción: Función que cambia automáticamente pending → noshow
--              cuando han pasado 2 horas desde la hora de la reserva
-- ========================================

-- 1. FUNCIÓN: Marcar reservas expiradas como no-show
CREATE OR REPLACE FUNCTION mark_expired_reservations_as_noshow()
RETURNS TABLE(
    updated_count INT,
    reservation_ids UUID[]
) AS $$
DECLARE
    v_cutoff_time TIMESTAMPTZ;
    v_updated_ids UUID[];
    v_count INT;
BEGIN
    -- Calcular el tiempo límite (hace 2 horas)
    v_cutoff_time := NOW() - INTERVAL '2 hours';
    
    -- Actualizar reservas que cumplan las condiciones:
    -- 1. Estado = 'pending' o 'pending_approval'
    -- 2. La fecha + hora de reserva + 2 horas < NOW()
    -- 3. No están canceladas ni completadas
    WITH updated_reservations AS (
        UPDATE reservations
        SET 
            status = 'no_show',
            updated_at = NOW()
        WHERE 
            status IN ('pending', 'pending_approval')
            AND (reservation_date::TIMESTAMP + reservation_time) < v_cutoff_time
            AND status NOT IN ('cancelled', 'completed', 'confirmed', 'seated')
        RETURNING id
    )
    SELECT 
        COUNT(*)::INT,
        ARRAY_AGG(id)
    INTO v_count, v_updated_ids
    FROM updated_reservations;
    
    -- Log de la operación
    RAISE NOTICE 'Auto-marcadas % reservas como no-show', v_count;
    
    -- Retornar resultados
    RETURN QUERY
    SELECT 
        COALESCE(v_count, 0) as updated_count,
        COALESCE(v_updated_ids, ARRAY[]::UUID[]) as reservation_ids;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. FUNCIÓN WRAPPER para ejecutar desde aplicación/N8n (sin parámetros)
CREATE OR REPLACE FUNCTION auto_mark_expired_noshows()
RETURNS JSONB AS $$
DECLARE
    v_result RECORD;
BEGIN
    SELECT * INTO v_result FROM mark_expired_reservations_as_noshow();
    
    RETURN jsonb_build_object(
        'success', true,
        'updated_count', v_result.updated_count,
        'reservation_ids', v_result.reservation_ids,
        'executed_at', NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. COMENTARIOS
COMMENT ON FUNCTION mark_expired_reservations_as_noshow IS 
    'Marca automáticamente como no_show (con guion bajo) las reservas pendientes que han pasado +2h de su hora';
    
COMMENT ON FUNCTION auto_mark_expired_noshows IS 
    'Wrapper simple para ejecutar desde aplicación o N8n. Cambia status de pending/pending_approval a no_show';

-- ========================================
-- INSTRUCCIONES DE USO
-- ========================================

-- OPCIÓN A: Ejecutar manualmente desde SQL Editor de Supabase:
--   SELECT * FROM mark_expired_reservations_as_noshow();

-- OPCIÓN B: Ejecutar desde aplicación React/N8n:
--   const { data } = await supabase.rpc('auto_mark_expired_noshows');

-- OPCIÓN C: Crear Cron Job en N8n (recomendado):
--   Trigger: Cron cada 30 minutos
--   Acción: Supabase Execute RPC 'auto_mark_expired_noshows'

-- ========================================
-- TESTING
-- ========================================

-- Test 1: Ver cuántas reservas se actualizarían SIN ejecutar
-- SELECT 
--     id,
--     customer_name,
--     reservation_date,
--     reservation_time,
--     status,
--     (reservation_date + reservation_time::TIME) as reservation_datetime,
--     NOW() - (reservation_date + reservation_time::TIME) as time_passed
-- FROM reservations
-- WHERE 
--     status IN ('pending', 'pending_approval')
--     AND (reservation_date + reservation_time::TIME) < (NOW() - INTERVAL '2 hours')
--     AND status NOT IN ('cancelled', 'completed', 'confirmed', 'seated')
-- ORDER BY reservation_date DESC, reservation_time DESC;

-- Test 2: Ejecutar la función
-- SELECT * FROM mark_expired_reservations_as_noshow();

-- Test 3: Verificar que se actualizaron
-- SELECT 
--     id,
--     customer_name,
--     reservation_date,
--     reservation_time,
--     status,
--     updated_at
-- FROM reservations
-- WHERE status = 'no_show'
-- ORDER BY updated_at DESC
-- LIMIT 10;

-- ========================================
-- FIN DE MIGRACIÓN
-- ========================================

