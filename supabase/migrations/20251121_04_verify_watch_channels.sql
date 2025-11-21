-- =====================================================
-- VERIFICAR Y CONFIGURAR WATCH CHANNELS
-- Fecha: 2025-11-21
-- Objetivo: Verificar el estado de watch_channels y proporcionar consultas útiles
-- =====================================================

-- ✅ Consulta para ver watch_channels dentro de config
SELECT 
  id,
  business_id,
  provider,
  is_active,
  config->>'watch_channels' as watch_channels_json,
  config->>'watch_setup_at' as watch_setup_at,
  config->>'calendar_ids' as calendar_ids,
  last_sync_at,
  created_at
FROM integrations
WHERE provider = 'google_calendar' AND is_active = true;

-- ✅ Consulta para ver los canales parseados (si existen)
SELECT 
  id,
  business_id,
  jsonb_array_length(COALESCE(config->'watch_channels', '[]'::jsonb)) as channels_count,
  config->'watch_channels' as watch_channels,
  config->'calendar_ids' as calendar_ids
FROM integrations
WHERE provider = 'google_calendar' AND is_active = true;

-- ✅ Función helper para verificar si hay canales configurados
CREATE OR REPLACE FUNCTION has_google_calendar_watch_channels(business_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_channels_count INTEGER;
BEGIN
  SELECT jsonb_array_length(COALESCE(config->'watch_channels', '[]'::jsonb))
  INTO v_channels_count
  FROM integrations
  WHERE business_id = business_uuid
    AND provider = 'google_calendar'
    AND is_active = true;
  
  RETURN COALESCE(v_channels_count, 0) > 0;
END;
$$;

-- ✅ Comentario
COMMENT ON FUNCTION has_google_calendar_watch_channels(UUID) IS 
'Verifica si una integración de Google Calendar tiene watch channels configurados. 
Retorna true si hay al menos un canal configurado, false en caso contrario.';

-- ✅ Verificar estado actual
SELECT 
  'Estado de watch channels' as descripcion,
  business_id,
  has_google_calendar_watch_channels(business_id) as tiene_canales,
  jsonb_array_length(COALESCE(config->'watch_channels', '[]'::jsonb)) as cantidad_canales
FROM integrations
WHERE provider = 'google_calendar' AND is_active = true;

