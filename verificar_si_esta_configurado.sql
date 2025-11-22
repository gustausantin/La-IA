-- =====================================================
-- VERIFICAR SI GOOGLE CALENDAR YA ESTÁ CONFIGURADO
-- =====================================================

-- 1. Ver si hay watch channels configurados
SELECT 
    id,
    business_id,
    -- Ver watch_channels
    config->'watch_channels' as watch_channels,
    -- Ver cuándo se configuraron
    config->>'watch_setup_at' as watch_setup_at,
    -- Ver última sincronización
    last_sync_at,
    updated_at
FROM integrations
WHERE provider = 'google_calendar'
  AND is_active = true
  AND id = '50b41bbf-274c-4c74-a225-a232406b9699';

-- 2. Ver detalles de cada watch channel
SELECT 
    channel->>'channel_id' as channel_id,
    channel->>'calendar_id' as calendar_id,
    channel->>'resource_id' as resource_id,
    channel->>'expiration' as expiration_timestamp,
    to_timestamp((channel->>'expiration')::bigint / 1000) as expiration_date,
    CASE 
        WHEN (channel->>'expiration')::bigint < EXTRACT(EPOCH FROM NOW()) * 1000 
        THEN 'EXPIRADO ❌' 
        ELSE 'ACTIVO ✅' 
    END as status
FROM integrations,
     jsonb_array_elements(COALESCE(config->'watch_channels', '[]'::jsonb)) AS channel
WHERE provider = 'google_calendar'
  AND is_active = true
  AND id = '50b41bbf-274c-4c74-a225-a232406b9699';

