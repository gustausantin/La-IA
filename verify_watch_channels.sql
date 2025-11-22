-- =====================================================
-- VERIFICAR ESTADO DE WATCH CHANNELS
-- =====================================================

SELECT 
    id,
    business_id,
    -- Número de watch channels
    jsonb_array_length(COALESCE(config->'watch_channels', '[]'::jsonb)) as num_watch_channels,
    -- Ver cada watch channel con su estado
    jsonb_pretty(
        jsonb_build_array(
            jsonb_build_object(
                'channel_id', channel->>'channel_id',
                'calendar_id', channel->>'calendar_id',
                'expiration_timestamp', channel->>'expiration',
                'expiration_date', to_timestamp((channel->>'expiration')::bigint / 1000)::text,
                'status', CASE 
                    WHEN (channel->>'expiration')::bigint < EXTRACT(EPOCH FROM NOW()) * 1000 
                    THEN 'EXPIRADO ❌' 
                    ELSE 'ACTIVO ✅' 
                END,
                'days_until_expiration', ROUND(EXTRACT(EPOCH FROM (to_timestamp((channel->>'expiration')::bigint / 1000) - NOW())) / 86400, 1)
            )
        )
    ) as watch_channels_status
FROM integrations,
     jsonb_array_elements(COALESCE(config->'watch_channels', '[]'::jsonb)) AS channel
WHERE provider = 'google_calendar'
  AND is_active = true
  AND id = '50b41bbf-274c-4c74-a225-a232406b9699';

-- =====================================================
-- VERIFICAR SI HAY APPOINTMENTS RECIENTES DE GOOGLE CALENDAR
-- =====================================================
SELECT 
    COUNT(*) as total_appointments_from_gcal,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as created_last_hour,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as created_last_24h,
    MAX(created_at) as last_appointment_created
FROM appointments
WHERE business_id = '3bbe9ac3-3e61-471e-822e-e159f6ad8ae2'
  AND source = 'google_calendar';

