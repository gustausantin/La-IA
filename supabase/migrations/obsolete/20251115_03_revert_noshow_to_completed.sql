-- =====================================================
-- MIGRACIÓN: REVERTIR RESERVAS NO_SHOW A COMPLETED
-- Fecha: 2025-11-15
-- ⚠️ NO EJECUTAR - Esta migración ya no es necesaria
-- =====================================================

-- NOTA: Esta migración NO debe ejecutarse.
-- La lógica correcta es: pending pasadas → no_show (correcto)
-- Las reservas "no_show" ahora se muestran en el calendario con estilo especial (opacidad/tachadas)
-- Solo se ocultan las reservas "cancelled"

-- Si necesitas revertir manualmente algunas reservas no_show a completed,
-- puedes hacerlo directamente desde la interfaz o con una consulta SQL específica.

UPDATE appointments
SET 
    status = 'completed',
    updated_at = NOW()
WHERE 
    status = 'no_show'
    AND (
        -- Reservas de días anteriores
        appointment_date < CURRENT_DATE
        OR
        -- Reservas de hoy que ya pasaron su hora de fin
        (
            appointment_date = CURRENT_DATE
            AND (
                (appointment_time::TIME + COALESCE(duration_minutes, 60) * INTERVAL '1 minute') < CURRENT_TIME
            )
        )
    );

-- Mostrar cuántas reservas se actualizaron
SELECT 
    COUNT(*) as reservas_revertidas,
    'Reservas no_show revertidas a completed' as mensaje
FROM appointments
WHERE 
    status = 'completed'
    AND updated_at >= NOW() - INTERVAL '1 minute';

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================

SELECT 'Migración 20251115_03_revert_noshow_to_completed completada' AS status;

