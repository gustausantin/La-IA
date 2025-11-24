-- =====================================================
-- VERIFICAR ESTADO DETALLADO DE WATCH CHANNELS
-- =====================================================

-- 1. Verificar si los watch channels están activos o expirados
SELECT 
    id as integration_id,
    business_id,
    channel->>'channel_id' as channel_id,
    channel->>'calendar_id' as calendar_id,
    channel->>'expiration' as expiration_timestamp,
    to_timestamp((channel->>'expiration')::bigint / 1000) as expiration_date,
    CASE 
        WHEN (channel->>'expiration')::bigint < EXTRACT(EPOCH FROM NOW()) * 1000 
        THEN 'EXPIRADO ❌' 
        ELSE 'ACTIVO ✅' 
    END as status,
    ROUND(EXTRACT(EPOCH FROM (to_timestamp((channel->>'expiration')::bigint / 1000) - NOW())) / 86400, 1) as days_until_expiration,
    NOW() as current_time
FROM integrations,
     jsonb_array_elements(COALESCE(config->'watch_channels', '[]'::jsonb)) AS channel
WHERE provider = 'google_calendar'
  AND is_active = true
  AND id = '50b41bbf-274c-4c74-a225-a232406b9699';

-- 2. Verificar última sincronización
SELECT 
    id,
    business_id,
    last_sync_at,
    updated_at,
    created_at
FROM integrations
WHERE id = '50b41bbf-274c-4c74-a225-a232406b9699';


