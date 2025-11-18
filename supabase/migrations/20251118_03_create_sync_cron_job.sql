-- =====================================================
-- MIGRACIÓN: CREAR CRON JOB PARA SINCRONIZACIÓN CONTINUA DE GOOGLE CALENDAR
-- Fecha: 2025-11-18
-- Objetivo: Ejecutar sync-google-calendar-continuous cada 15 minutos
-- =====================================================

-- 1. Habilitar extensión pg_cron (si no está habilitada)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Habilitar extensión pg_net (para hacer HTTP requests)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 3. Eliminar job existente si existe (para evitar duplicados)
DO $$
BEGIN
    PERFORM cron.unschedule('sync-google-calendar-continuous');
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

-- 4. Crear función que llama a la Edge Function
CREATE OR REPLACE FUNCTION call_sync_google_calendar_continuous()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_url text;
    v_service_role_key text;
BEGIN
    -- URL de la Edge Function
    v_url := 'https://zrcsujgurtglyqoqiynr.supabase.co/functions/v1/sync-google-calendar-continuous';
    
    -- Obtener service role key desde secrets (configurar en Supabase Dashboard)
    -- O usar directamente si está en variables de entorno
    v_service_role_key := current_setting('app.supabase_service_role_key', true);
    
    -- Si no está configurada, usar la que está en las variables de entorno de la función
    -- Por ahora, la función Edge Function usa SERVICE_ROLE_KEY directamente, así que no necesitamos pasarla aquí
    
    -- Llamar a la Edge Function usando pg_net
    PERFORM net.http_post(
        url := v_url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json'
            -- No necesitamos Authorization porque la función está configurada como pública (JWT OFF)
        ),
        body := '{}'::jsonb
    );
    
    RAISE NOTICE 'Sincronización Google Calendar iniciada';
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error ejecutando sincronización Google Calendar: %', SQLERRM;
END;
$$;

-- 5. Programar cron job para ejecutar cada 15 minutos
SELECT cron.schedule(
    'sync-google-calendar-continuous',
    '*/15 * * * *', -- Cada 15 minutos
    $$SELECT call_sync_google_calendar_continuous()$$
);

-- 6. Comentarios
COMMENT ON FUNCTION call_sync_google_calendar_continuous() IS 
'Sincronización continua de Google Calendar ejecutada por pg_cron cada 15 minutos. 
Llama a la Edge Function sync-google-calendar-continuous para detectar cambios en Google Calendar y actualizar appointments bloqueados.';

-- Verificar que se creó correctamente
DO $$
DECLARE
    v_job_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_job_count
    FROM cron.job
    WHERE jobname = 'sync-google-calendar-continuous';
    
    IF v_job_count > 0 THEN
        RAISE NOTICE '✅ Cron job sync-google-calendar-continuous creado correctamente';
    ELSE
        RAISE WARNING '⚠️ No se pudo crear el cron job. Verifica que pg_cron esté habilitado.';
    END IF;
END $$;

SELECT 'Migración 20251118_03_create_sync_cron_job completada. Cron job configurado para ejecutarse cada 15 minutos.' AS status;

