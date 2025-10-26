-- ========================================
-- PROBAR MANTENIMIENTO DIARIO (MANUAL)
-- ========================================
-- Ejecutar este script después de aplicar
-- EJECUTAR_EN_SUPABASE_DAILY_MAINTENANCE.sql
-- ========================================

-- 1️⃣ VERIFICAR QUE EL JOB ESTÁ PROGRAMADO
-- ========================================
SELECT 
    jobid,
    jobname,
    schedule,
    command,
    active,
    database
FROM cron.job 
WHERE jobname = 'daily-availability-maintenance';

-- Resultado esperado:
-- ✅ 1 fila con schedule = '0 4 * * *' y active = true


-- 2️⃣ EJECUTAR MANUALMENTE (PARA PROBAR)
-- ========================================
SELECT daily_availability_maintenance();

-- Resultado esperado (ejemplo):
-- {
--   "success": true,
--   "executed_at": "2025-10-08T16:45:00Z",
--   "date_reference": "2025-10-08",
--   "restaurants_processed": 1,
--   "total_slots_deleted": 24,
--   "total_slots_created": 24,
--   "errors": [],
--   "summary": "Procesados 1 restaurantes. Eliminados 24 slots antiguos. Creados 24 slots nuevos."
-- }


-- 3️⃣ VER HISTORIAL DE EJECUCIONES
-- ========================================
-- NOTA: Esta tabla solo tendrá datos después de que el job se ejecute automáticamente
SELECT 
    jobid,
    runid,
    job_pid,
    database,
    username,
    command,
    status,
    return_message,
    start_time,
    end_time,
    end_time - start_time as duration
FROM cron.job_run_details 
WHERE command LIKE '%daily_availability_maintenance%'
ORDER BY start_time DESC 
LIMIT 10;

-- Si devuelve 0 filas: El job aún no se ha ejecutado automáticamente
-- Espera hasta mañana a las 4 AM o ejecuta manualmente (Query #2)


-- 4️⃣ VERIFICAR SLOTS GENERADOS
-- ========================================
-- Ver el rango de fechas con slots para cada restaurante
SELECT 
    r.name as restaurante,
    MIN(a.slot_date) as primer_dia,
    MAX(a.slot_date) as ultimo_dia,
    COUNT(DISTINCT a.slot_date) as dias_totales,
    COUNT(*) as slots_totales
FROM availability_slots a
JOIN restaurants r ON r.id = a.restaurant_id
GROUP BY r.name;


-- 5️⃣ VERIFICAR QUE NO HAY SLOTS ANTIGUOS LIBRES
-- ========================================
-- Esto debe devolver 0 filas
SELECT 
    restaurant_id,
    slot_date,
    COUNT(*) as slots
FROM availability_slots
WHERE slot_date < CURRENT_DATE
  AND status = 'free'
  AND is_available = TRUE
GROUP BY restaurant_id, slot_date
ORDER BY slot_date;

-- Resultado esperado: 0 filas


-- 6️⃣ VERIFICAR ADVANCE_BOOKING_DAYS
-- ========================================
-- Comparar configuración vs. días reales generados
SELECT 
    r.name as restaurante,
    (r.settings->>'advance_booking_days')::INTEGER as dias_configurados,
    MAX(a.slot_date) - CURRENT_DATE as dias_reales_generados,
    CASE 
        WHEN MAX(a.slot_date) - CURRENT_DATE = (r.settings->>'advance_booking_days')::INTEGER 
        THEN '✅ CORRECTO'
        ELSE '⚠️ REVISAR'
    END as estado
FROM restaurants r
LEFT JOIN availability_slots a ON a.restaurant_id = r.id
GROUP BY r.id, r.name, r.settings;


-- 7️⃣ DESACTIVAR JOB (SI ES NECESARIO)
-- ========================================
-- Solo ejecutar si quieres desactivar temporalmente
-- SELECT cron.unschedule('daily-availability-maintenance');


-- 8️⃣ REACTIVAR JOB (SI LO DESACTIVASTE)
-- ========================================
-- SELECT cron.schedule(
--     'daily-availability-maintenance',
--     '0 4 * * *',
--     'SELECT daily_availability_maintenance();'
-- );


