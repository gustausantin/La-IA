-- ========================================
-- SUPABASE CRON JOB: Auto-marcar reservas caducadas como no-show
-- Se ejecuta cada 30 minutos, 24/7, en la nube
-- ========================================

-- 1. HABILITAR EXTENSIÓN pg_cron (si no está habilitada)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. ELIMINAR JOB ANTERIOR (si existe)
-- Esto previene duplicados al re-ejecutar el script
SELECT cron.unschedule('mark-expired-reservations-noshow');

-- 3. CREAR CRON JOB: Se ejecuta cada 30 minutos
SELECT cron.schedule(
    'mark-expired-reservations-noshow',  -- Nombre único del job
    '*/30 * * * *',                      -- Cron expression: cada 30 minutos
    $$
    -- Llamar a la función que marca reservas como no-show
    SELECT mark_all_expired_reservations_as_noshow();
    $$
);

-- ========================================
-- VERIFICACIÓN Y MONITOREO
-- ========================================

-- Ver que el cron job se creó correctamente
SELECT * FROM cron.job WHERE jobname = 'mark-expired-reservations-noshow';

-- Ver historial de ejecuciones (últimas 10)
-- Ejecutar esto después de 30 min para verificar que funcionó
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
    end_time
FROM cron.job_run_details 
WHERE jobid = (
    SELECT jobid 
    FROM cron.job 
    WHERE jobname = 'mark-expired-reservations-noshow'
)
ORDER BY start_time DESC 
LIMIT 10;

-- ========================================
-- COMANDOS ÚTILES PARA GESTIÓN
-- ========================================

-- Ver TODOS los cron jobs activos
-- SELECT * FROM cron.job;

-- Ver historial completo de ejecuciones
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;

-- Desactivar el cron job (si necesitas)
-- SELECT cron.unschedule('mark-expired-reservations-noshow');

-- Activar de nuevo manualmente (cambiar horario si quieres)
-- SELECT cron.schedule('mark-expired-reservations-noshow', '*/30 * * * *', 
--   $$ SELECT mark_all_expired_reservations_as_noshow(); $$);

-- ========================================
-- NOTAS IMPORTANTES
-- ========================================

/*
1. Este cron job se ejecuta AUTOMÁTICAMENTE cada 30 minutos
2. NO depende de tu ordenador - funciona 24/7 en la nube
3. Marca como 'no_show' todas las reservas 'pending' que pasaron hace +2h
4. Logs disponibles en cron.job_run_details para debugging

PRÓXIMAS EJECUCIONES (ejemplo si ejecutas a las 10:00):
- 10:30, 11:00, 11:30, 12:00, 12:30, 13:00... (cada 30 min)

CRON EXPRESSION '*/30 * * * *' significa:
- */30 = cada 30 minutos
- * = cualquier hora
- * = cualquier día del mes
- * = cualquier mes
- * = cualquier día de la semana

Si quieres cambiar la frecuencia:
- Cada 15 min: '*/15 * * * *'
- Cada hora: '0 * * * *'
- Cada 2 horas: '0 */2 * * *'
*/


