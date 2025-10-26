-- =====================================================
-- AUTO-ANALIZAR CONVERSACIONES INACTIVAS
-- =====================================================
-- Fecha: 21 Octubre 2025
-- Objetivo: Analizar conversaciones activas sin actividad >10 min
-- Coste: ~144 ejecuciones SQL/día (gratis), ~300-600 llamadas N8N/mes
-- =====================================================

-- 1. FUNCIÓN: Buscar conversaciones inactivas y llamar N8N
CREATE OR REPLACE FUNCTION trigger_analyze_inactive_conversations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conversations jsonb;
  v_webhook_url text := 'https://gustausantin.app.n8n.cloud/webhook/dd42211c-06eb-4c88-a1e0-7c9d06701566';
  v_response text;
  v_count integer;
BEGIN
  -- Buscar conversaciones activas sin actividad en los últimos 10 minutos
  SELECT jsonb_agg(row_to_json(t)), COUNT(*)
  INTO v_conversations, v_count
  FROM (
    SELECT 
      c.id as conversation_id,
      c.restaurant_id,
      c.customer_name,
      c.customer_phone,
      c.status,
      EXTRACT(EPOCH FROM (NOW() - m.last_message_time)) / 60 as minutes_inactive
    FROM agent_conversations c
    INNER JOIN (
      SELECT 
        conversation_id,
        MAX(timestamp) as last_message_time
      FROM agent_messages
      GROUP BY conversation_id
    ) m ON m.conversation_id = c.id
    WHERE c.status = 'active'
      AND EXTRACT(EPOCH FROM (NOW() - m.last_message_time)) > 600  -- 10 minutos
      AND (c.sentiment IS NULL OR c.outcome IS NULL)  -- No analizada
    ORDER BY m.last_message_time ASC
    LIMIT 50  -- Máximo 50 conversaciones por ejecución
  ) t;

  -- Si hay conversaciones, llamar a N8N
  IF v_conversations IS NOT NULL AND v_count > 0 THEN
    
    RAISE NOTICE '🔍 Encontradas % conversaciones inactivas >10min - Llamando N8N...', v_count;
    
    -- Llamar webhook de N8N con HTTP POST (una conversación a la vez)
    FOR i IN 0..(v_count - 1) LOOP
      DECLARE
        v_conv jsonb := v_conversations->i;
      BEGIN
        SELECT content INTO v_response
        FROM http((
          'POST',
          v_webhook_url,
          ARRAY[http_header('Content-Type', 'application/json')],
          'application/json',
          jsonb_build_object(
            'conversation_id', v_conv->>'conversation_id',
            'restaurant_id', v_conv->>'restaurant_id',
            'source', 'cron_inactive'
          )::text
        )::http_request);
        
        RAISE NOTICE '✅ Análisis iniciado para conversación: %', v_conv->>'conversation_id';
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING '❌ Error analizando conversación %: %', v_conv->>'conversation_id', SQLERRM;
      END;
    END LOOP;
    
    RAISE NOTICE '✅ Enviadas % conversaciones a N8N para análisis', v_count;
    
  ELSE
    RAISE NOTICE 'ℹ️ No hay conversaciones inactivas >10min para analizar';
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '❌ Error en trigger_analyze_inactive_conversations: %', SQLERRM;
END;
$$;

-- 2. CONFIGURAR PG_CRON: Ejecutar cada 10 minutos
-- ⚠️ EJECUTAR MANUALMENTE EN SUPABASE SQL EDITOR:

/*
SELECT cron.schedule(
  'auto-analyze-conversations',
  '*/10 * * * *',                    -- Cada 10 minutos
  $$SELECT trigger_analyze_inactive_conversations()$$
);
*/

-- 3. VERIFICAR JOB CREADO:
-- SELECT * FROM cron.job WHERE jobname = 'auto-analyze-conversations';

-- 4. DESACTIVAR JOB (si es necesario):
-- SELECT cron.unschedule('auto-analyze-conversations');

-- =====================================================
-- NOTAS:
-- =====================================================
-- 1. Requiere extensión http (ya instalada)
-- 2. Requiere extensión pg_cron (ya instalada)
-- 3. El webhook URL es el mismo que Workflow 04
-- 4. Solo analiza conversaciones 'active' sin sentiment/outcome
-- 5. Coste: ~144 ejecuciones SQL/día (gratis), ~300-600 llamadas N8N/mes
-- 6. Backup de seguridad si el LLM del Super Agent falla
-- =====================================================
