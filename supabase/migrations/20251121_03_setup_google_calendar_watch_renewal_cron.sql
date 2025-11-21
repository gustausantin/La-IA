-- =====================================================
-- MIGRACIÓN: CONFIGURAR CRON JOB PARA RENOVACIÓN DE WATCH CHANNELS
-- Fecha: 2025-11-21
-- Objetivo: Renovar automáticamente los canales de watch de Google Calendar
-- =====================================================
-- 
-- Los canales de watch de Google Calendar expiran después de 7 días.
-- Este cron job renueva automáticamente los canales que están por expirar,
-- asegurando que las notificaciones push sigan funcionando.
-- =====================================================

-- 1. Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Eliminar job existente si existe
DO $$
BEGIN
    PERFORM cron.unschedule('renew-google-calendar-watch-daily');
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

-- 3. Crear función que llama a la Edge Function
CREATE OR REPLACE FUNCTION call_renew_google_calendar_watch()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_url text;
BEGIN
    -- URL de la Edge Function
    v_url := 'https://zrcsujgurtglyqoqiynr.supabase.co/functions/v1/renew-google-calendar-watch';
    
    -- Llamar a la Edge Function usando pg_net
    PERFORM net.http_post(
        url := v_url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json'
            -- La Edge Function usa SERVICE_ROLE_KEY internamente
        ),
        body := '{}'::jsonb
    );
    
    RAISE NOTICE '✅ Renovación de watch channels iniciada';
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '⚠️ Error ejecutando renovación de watch channels: %', SQLERRM;
END;
$$;

-- 4. Programar cron job para ejecutar diariamente a las 3:00 AM UTC
-- Esto renueva los canales antes de que expiren (7 días)
SELECT cron.schedule(
    'renew-google-calendar-watch-daily',
    '0 3 * * *', -- Todos los días a las 3:00 AM UTC
    $$SELECT call_renew_google_calendar_watch()$$
);

-- 5. Comentarios
COMMENT ON FUNCTION call_renew_google_calendar_watch() IS 
'Renueva automáticamente los canales de watch de Google Calendar que están por expirar. 
Se ejecuta diariamente a las 3:00 AM UTC mediante cron job. 
Los canales de Google Calendar expiran después de 7 días, por lo que esta renovación 
asegura que las notificaciones push sigan funcionando sin interrupciones.';

-- 6. Verificar que se creó correctamente
DO $$
DECLARE
    v_job_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_job_count
    FROM cron.job
    WHERE jobname = 'renew-google-calendar-watch-daily';
    
    IF v_job_count > 0 THEN
        RAISE NOTICE '✅ Cron job renew-google-calendar-watch-daily creado correctamente';
    ELSE
        RAISE WARNING '⚠️ No se pudo crear el cron job. Verifica que pg_cron esté habilitado.';
    END IF;
END $$;

SELECT 'Migración 20251121_03_setup_google_calendar_watch_renewal_cron completada. Cron job configurado para ejecutarse diariamente a las 3:00 AM UTC.' AS status;

