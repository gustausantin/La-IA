-- =====================================================
-- MIGRACIÓN: CONFIGURAR CRON JOB PARA SINCRONIZACIÓN CONTINUA DE GOOGLE CALENDAR
-- Fecha: 2025-11-18
-- Objetivo: Documentar configuración de cron job para sync-google-calendar-continuous
-- =====================================================

-- NOTA: Esta migración documenta cómo configurar el cron job.
-- La configuración real debe hacerse desde el Dashboard de Supabase o usando pg_cron.

-- =====================================================
-- OPCIÓN 1: CONFIGURAR DESDE SUPABASE DASHBOARD (RECOMENDADO)
-- =====================================================
-- 
-- 1. Ve a Supabase Dashboard → Database → Cron Jobs
-- 2. Crea un nuevo cron job con:
--    - Name: sync-google-calendar-continuous
--    - Schedule: */15 * * * * (cada 15 minutos)
--    - Command: SELECT net.http_post(
--        url := 'https://zrcsujgurtglyqoqiynr.supabase.co/functions/v1/sync-google-calendar-continuous',
--        headers := jsonb_build_object(
--            'Content-Type', 'application/json',
--            'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
--        ),
--        body := '{}'::jsonb
--      );
--
-- =====================================================
-- OPCIÓN 2: USAR Pg_CRON (si está habilitado)
-- =====================================================

-- Habilitar extensión pg_cron (si no está habilitada)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Habilitar extensión pg_net (para hacer HTTP requests)
-- CREATE EXTENSION IF NOT EXISTS pg_net;

-- Eliminar job existente si existe
DO $$
BEGIN
    PERFORM cron.unschedule('sync-google-calendar-continuous');
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

-- Programar cron job (descomentar si pg_cron está habilitado)
-- SELECT cron.schedule(
--     'sync-google-calendar-continuous',
--     '*/15 * * * *', -- Cada 15 minutos
--     $$
--     SELECT net.http_post(
--         url := 'https://zrcsujgurtglyqoqiynr.supabase.co/functions/v1/sync-google-calendar-continuous',
--         headers := jsonb_build_object(
--             'Content-Type', 'application/json',
--             'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
--         ),
--         body := '{}'::jsonb
--     );
--     $$
-- );

-- =====================================================
-- OPCIÓN 3: USAR SERVICIO EXTERNO (Vercel Cron, GitHub Actions, etc.)
-- =====================================================
--
-- Ejemplo para Vercel Cron (vercel.json):
-- {
--   "crons": [{
--     "path": "/api/sync-google-calendar",
--     "schedule": "*/15 * * * *"
--   }]
-- }
--
-- Ejemplo para GitHub Actions (.github/workflows/sync-calendar.yml):
-- name: Sync Google Calendar
-- on:
--   schedule:
--     - cron: '*/15 * * * *'
-- jobs:
--   sync:
--     runs-on: ubuntu-latest
--     steps:
--       - name: Call Edge Function
--         run: |
--           curl -X POST \
--             -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
--             https://zrcsujgurtglyqoqiynr.supabase.co/functions/v1/sync-google-calendar-continuous

-- =====================================================
-- COMENTARIOS
-- =====================================================

COMMENT ON EXTENSION pg_cron IS 
'Extensión para ejecutar tareas programadas. 
Para sincronización de Google Calendar, usar Dashboard de Supabase o servicio externo.';

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================

SELECT 'Migración 20251118_02_setup_google_calendar_sync_cron completada. 
Configura el cron job desde el Dashboard de Supabase o usando un servicio externo.' AS status;

