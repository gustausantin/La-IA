-- =====================================================
-- AUTO-LIBERACIÓN 2H ANTES VÍA PG_CRON + N8N WEBHOOK
-- =====================================================
-- Fecha: 21 Octubre 2025
-- Objetivo: Reducir ejecuciones N8N de 4,320/mes a ~200-400/mes
-- =====================================================

-- 1. FUNCIÓN: Buscar reservas sin confirmar <2h y llamar N8N
CREATE OR REPLACE FUNCTION trigger_auto_liberacion_2h()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reservations jsonb;
  v_webhook_url text := 'https://gustausantin.app.n8n.cloud/webhook/AUTO-LIBERACION-2H'; -- ⚠️ CAMBIAR POR TU WEBHOOK
  v_response text;
BEGIN
  -- Buscar reservas sin confirmar en las próximas 2 horas
  SELECT jsonb_agg(row_to_json(t))
  INTO v_reservations
  FROM (
    SELECT 
      r.id as reservation_id,
      r.restaurant_id,
      r.customer_id,
      r.customer_name,
      r.reservation_date,
      r.reservation_time,
      r.party_size,
      r.status,
      EXTRACT(EPOCH FROM ((r.reservation_date::TIMESTAMP + r.reservation_time) - NOW())) / 3600 as hours_until
    FROM reservations r
    WHERE r.status IN ('pending', 'confirmed', 'pendiente', 'confirmada')
      AND EXTRACT(EPOCH FROM ((r.reservation_date::TIMESTAMP + r.reservation_time) - NOW())) BETWEEN 0 AND 7200
      AND NOT EXISTS (
        SELECT 1 FROM customer_confirmations cc
        WHERE cc.reservation_id = r.id
        AND cc.confirmed = TRUE
      )
    ORDER BY hours_until ASC
    LIMIT 50 -- Máximo 50 reservas por ejecución
  ) t;

  -- Si hay reservas, llamar a N8N
  IF v_reservations IS NOT NULL AND jsonb_array_length(v_reservations) > 0 THEN
    
    RAISE NOTICE '🔍 Encontradas % reservas sin confirmar <2h - Llamando N8N...', jsonb_array_length(v_reservations);
    
    -- Llamar webhook de N8N con HTTP POST
    SELECT content INTO v_response
    FROM http((
      'POST',
      v_webhook_url,
      ARRAY[http_header('Content-Type', 'application/json')],
      'application/json',
      jsonb_build_object('reservations', v_reservations)::text
    )::http_request);
    
    RAISE NOTICE '✅ N8N webhook llamado correctamente';
    
  ELSE
    RAISE NOTICE 'ℹ️ No hay reservas sin confirmar <2h';
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '❌ Error en trigger_auto_liberacion_2h: %', SQLERRM;
END;
$$;

-- 2. CONFIGURAR PG_CRON: Ejecutar cada 10 minutos
-- ⚠️ EJECUTAR MANUALMENTE EN SUPABASE SQL EDITOR (pg_cron no funciona en migraciones):

/*
SELECT cron.schedule(
  'auto-liberacion-2h',           -- Nombre del job
  '*/10 * * * *',                  -- Cada 10 minutos
  $$SELECT trigger_auto_liberacion_2h()$$
);
*/

-- 3. VERIFICAR JOB CREADO:
-- SELECT * FROM cron.job WHERE jobname = 'auto-liberacion-2h';

-- 4. DESACTIVAR JOB (si es necesario):
-- SELECT cron.unschedule('auto-liberacion-2h');

-- =====================================================
-- NOTAS:
-- =====================================================
-- 1. Requiere extensión http: CREATE EXTENSION IF NOT EXISTS http;
-- 2. Requiere extensión pg_cron: CREATE EXTENSION IF NOT EXISTS pg_cron;
-- 3. El webhook URL debe estar correcto en v_webhook_url
-- 4. N8N debe tener un webhook configurado para recibir el JSON
-- 5. Coste: ~144 ejecuciones SQL/día (gratis), ~200-400 llamadas N8N/mes (solo si hay reservas)
-- =====================================================

