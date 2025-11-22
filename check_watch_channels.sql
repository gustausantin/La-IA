-- =====================================================
-- VERIFICAR ESTADO DE WATCH CHANNELS DE GOOGLE CALENDAR
-- =====================================================
-- Ejecuta esta consulta para ver si los watch channels están configurados
-- y si están activos o expirados

SELECT 
    id,
    business_id,
    provider,
    is_active,
    -- Ver watch_channels en config
    config->'watch_channels' as watch_channels,
    -- Contar cuántos watch channels hay
    jsonb_array_length(COALESCE(config->'watch_channels', '[]'::jsonb)) as num_watch_channels,
    -- Verificar si hay canales expirados (expiration < ahora)
    (
        SELECT COUNT(*)
        FROM jsonb_array_elements(COALESCE(config->'watch_channels', '[]'::jsonb)) AS channel
        WHERE (channel->>'expiration')::bigint < EXTRACT(EPOCH FROM NOW()) * 1000
    ) as expired_channels,
    -- Ver última sincronización
    last_sync_at,
    updated_at
FROM integrations
WHERE provider = 'google_calendar'
  AND is_active = true
ORDER BY updated_at DESC;

-- =====================================================
-- VER DETALLES DE CADA WATCH CHANNEL
-- =====================================================
-- Descomenta esto para ver los detalles de cada canal:

/*
SELECT 
    id as integration_id,
    business_id,
    channel->>'channel_id' as channel_id,
    channel->>'calendar_id' as calendar_id,
    channel->>'resource_id' as resource_id,
    channel->>'expiration' as expiration_timestamp,
    to_timestamp((channel->>'expiration')::bigint / 1000) as expiration_date,
    CASE 
        WHEN (channel->>'expiration')::bigint < EXTRACT(EPOCH FROM NOW()) * 1000 
        THEN 'EXPIRADO ❌' 
        ELSE 'ACTIVO ✅' 
    END as status,
    EXTRACT(EPOCH FROM (to_timestamp((channel->>'expiration')::bigint / 1000) - NOW())) / 86400 as days_until_expiration
FROM integrations,
     jsonb_array_elements(COALESCE(config->'watch_channels', '[]'::jsonb)) AS channel
WHERE provider = 'google_calendar'
  AND is_active = true;
*/

