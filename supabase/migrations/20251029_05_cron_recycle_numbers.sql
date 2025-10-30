-- =====================================================
-- MIGRACIÓN: Configurar Cron Job para Reciclaje de Números
-- Fecha: 2025-10-29
-- Descripción: Ejecuta automáticamente el reciclaje cada hora
-- =====================================================

-- Nota: Esta migración requiere la extensión pg_cron
-- Para habilitarla en Supabase: Dashboard → Database → Extensions → pg_cron (enable)

-- 1. Habilitar la extensión pg_cron (si no está habilitada)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Configurar el Cron Job
-- Se ejecuta cada hora en el minuto 0 (00:00, 01:00, 02:00, etc.)
SELECT cron.schedule(
  'reciclar-numeros-cuarentena',  -- Nombre del job
  '0 * * * *',                     -- Cron expression: cada hora en el minuto 0
  $$SELECT reciclar_numeros_cuarentena()$$  -- SQL a ejecutar
);

-- 3. Verificar que el job se creó correctamente
-- Para ver los jobs configurados:
-- SELECT * FROM cron.job;

-- Para ver el historial de ejecuciones:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- =====================================================
-- INFORMACIÓN ADICIONAL
-- =====================================================

-- Cron expression '0 * * * *' significa:
-- Minuto: 0 (primer minuto de cada hora)
-- Hora: * (cualquier hora)
-- Día del mes: * (cualquier día)
-- Mes: * (cualquier mes)
-- Día de la semana: * (cualquier día)

-- Si quieres cambiar la frecuencia en el futuro:
-- - Cada 30 minutos: '*/30 * * * *'
-- - Cada 6 horas: '0 */6 * * *'
-- - Una vez al día a las 3 AM: '0 3 * * *'

-- Para desactivar el cron job:
-- SELECT cron.unschedule('reciclar-numeros-cuarentena');

COMMENT ON EXTENSION pg_cron IS 'Extensión para ejecutar tareas programadas en PostgreSQL';

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================


