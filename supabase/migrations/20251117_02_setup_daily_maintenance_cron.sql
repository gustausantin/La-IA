-- =====================================================
-- MIGRACIÓN: CONFIGURAR MANTENIMIENTO DIARIO AUTOMÁTICO
-- Fecha: 2025-11-17
-- Objetivo: Configurar pg_cron para ejecutar mantenimiento diario
-- =====================================================

-- NOTA: Esta migración requiere que la extensión pg_cron esté habilitada
-- en Supabase. Si no está disponible, el mantenimiento se puede ejecutar
-- manualmente o desde el frontend.

-- =====================================================
-- CONFIGURAR CRON JOB PARA MANTENIMIENTO DIARIO
-- =====================================================

-- Eliminar job existente si existe
DO $$
BEGIN
    -- Intentar eliminar el job si existe
    PERFORM cron.unschedule('daily-availability-maintenance');
EXCEPTION
    WHEN OTHERS THEN
        -- Si no existe, no hacer nada
        NULL;
END $$;

-- Crear nuevo job para ejecutar mantenimiento diario a las 2:00 AM
-- Esto asegura que siempre haya slots disponibles para el rango configurado
-- 
-- FUNCIONAMIENTO DE VENTANA MÓVIL:
-- Si configuras 10 días de anticipación:
--   - Cada día a las 2:00 AM, el sistema:
--     1. Elimina slots libres del pasado (días anteriores a hoy)
--     2. Genera slots para el nuevo día al final del rango (día 11, que ahora es día 10)
--   - Resultado: SIEMPRE tienes exactamente 10 días disponibles hacia el futuro
--
-- Ejemplo práctico:
--   Configuración: 10 días de anticipación
--   Hoy: 2025-11-17 → Tienes slots del 17 al 26 (10 días)
--   Mañana (18): → Elimina slots libres del 17, genera slots del 27
--                  Ahora tienes slots del 18 al 27 (10 días)
--   Y así sucesivamente...
SELECT cron.schedule(
    'daily-availability-maintenance',
    '0 2 * * *', -- 2:00 AM todos los días (hora UTC)
    $$
    SELECT daily_availability_maintenance();
    $$
);

-- =====================================================
-- COMENTARIOS
-- =====================================================

COMMENT ON FUNCTION daily_availability_maintenance IS 
'Mantenimiento diario automático ejecutado por pg_cron a las 2:00 AM UTC. 
Elimina slots del pasado y genera slots para el nuevo día al final del rango.';

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================

SELECT 'Migración 20251117_02_setup_daily_maintenance_cron completada' AS status;

