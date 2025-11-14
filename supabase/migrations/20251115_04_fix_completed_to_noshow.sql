-- =====================================================
-- MIGRACIÓN: CORREGIR RESERVAS COMPLETED QUE DEBERÍAN SER NO_SHOW
-- Fecha: 2025-11-15
-- Objetivo: Cambiar TODAS las reservas "completed" de días anteriores a "no_show"
--           porque las reservas NO CONFIRMADAS deben ser "no_show", no "completed"
-- =====================================================

-- IMPORTANTE: Las reservas que NO fueron confirmadas (pending) deben ser "no_show"
-- NO "completed". Solo las reservas CONFIRMADAS pueden ser "completed".

-- Cambiar TODAS las reservas "completed" de días anteriores a "no_show"
-- (Asumimos que si están como "completed" y son de días anteriores,
-- probablemente fueron "pending" y no se confirmaron)
UPDATE appointments
SET 
    status = 'no_show',
    updated_at = NOW()
WHERE 
    status = 'completed'
    AND appointment_date < CURRENT_DATE;
    
-- También cambiar las reservas "completed" de HOY que ya pasaron su hora
-- (si fueron actualizadas recientemente, probablemente fueron pending)
UPDATE appointments
SET 
    status = 'no_show',
    updated_at = NOW()
WHERE 
    status = 'completed'
    AND appointment_date = CURRENT_DATE
    AND (
        appointment_time::TIME + COALESCE(duration_minutes, 60) * INTERVAL '1 minute'
    ) < CURRENT_TIME
    AND updated_at >= CURRENT_DATE - INTERVAL '2 hours';

-- Mostrar cuántas reservas se actualizaron
SELECT 
    COUNT(*) as reservas_corregidas,
    'Reservas completed revertidas a no_show' as mensaje
FROM appointments
WHERE 
    status = 'no_show'
    AND updated_at >= NOW() - INTERVAL '1 minute'
    AND appointment_date < CURRENT_DATE;

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================

SELECT 'Migración 20251115_04_fix_completed_to_noshow completada' AS status;

