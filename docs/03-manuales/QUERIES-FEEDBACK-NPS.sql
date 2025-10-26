-- =====================================
-- QUERIES DE FEEDBACK Y NPS
-- =====================================
-- Fecha: 2025-10-14
-- Propósito: Queries específicas para análisis de satisfacción del cliente
-- Usar en: Dashboards, reportes, alertas automáticas

-- =====================================
-- 1. NPS SCORE (MÉTRICA PRINCIPAL)
-- =====================================

-- NPS del último mes
WITH feedback_stats AS (
  SELECT 
    COUNT(*) as total_responses,
    COUNT(CASE WHEN metadata->'classification'->>'sentiment' = 'positive' THEN 1 END) as promotores,
    COUNT(CASE WHEN metadata->'classification'->>'sentiment' = 'negative' THEN 1 END) as detractores,
    COUNT(CASE WHEN metadata->'classification'->>'sentiment' = 'neutral' THEN 1 END) as neutrales
  FROM agent_conversations
  WHERE restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
    AND interaction_type = 'feedback'
    AND created_at > NOW() - INTERVAL '30 days'
)
SELECT 
  total_responses,
  promotores,
  detractores,
  neutrales,
  ROUND((promotores::numeric / NULLIF(total_responses, 0)) * 100, 1) as pct_promotores,
  ROUND((detractores::numeric / NULLIF(total_responses, 0)) * 100, 1) as pct_detractores,
  ROUND(
    ((promotores::numeric - detractores::numeric) / NULLIF(total_responses, 0)) * 100, 
    1
  ) as nps_score
FROM feedback_stats;

-- =====================================
-- 2. EVOLUCIÓN NPS EN EL TIEMPO
-- =====================================

-- NPS diario (últimos 30 días)
SELECT 
  DATE(created_at) as dia,
  COUNT(*) as total_feedbacks,
  COUNT(CASE WHEN metadata->'classification'->>'sentiment' = 'positive' THEN 1 END) as promotores,
  COUNT(CASE WHEN metadata->'classification'->>'sentiment' = 'negative' THEN 1 END) as detractores,
  COUNT(CASE WHEN metadata->'classification'->>'sentiment' = 'neutral' THEN 1 END) as neutrales,
  ROUND(
    ((COUNT(CASE WHEN metadata->'classification'->>'sentiment' = 'positive' THEN 1 END)::numeric - 
      COUNT(CASE WHEN metadata->'classification'->>'sentiment' = 'negative' THEN 1 END)::numeric) / 
     NULLIF(COUNT(*), 0)) * 100, 
    1
  ) as nps_score_dia
FROM agent_conversations
WHERE restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
  AND interaction_type = 'feedback'
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY dia DESC;

-- =====================================
-- 3. FEEDBACK NEGATIVO URGENTE
-- =====================================

-- Clientes insatisfechos HOY → Llamar AHORA
SELECT 
  c.name as cliente,
  c.phone as telefono,
  c.email,
  ac.metadata->'classification'->>'reasoning' as razon_insatisfaccion,
  ac.created_at as cuando_respondio,
  c.total_visits as visitas_totales,
  c.total_spent as gastado_total,
  CASE 
    WHEN c.total_visits >= 5 THEN '🔴 CLIENTE VIP - URGENTE'
    WHEN c.total_visits >= 2 THEN '⚠️ CLIENTE RECURRENTE'
    ELSE 'ℹ️ CLIENTE NUEVO'
  END as prioridad
FROM agent_conversations ac
JOIN customers c ON c.id = ac.customer_id
WHERE ac.restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
  AND ac.interaction_type = 'feedback'
  AND ac.metadata->'classification'->>'sentiment' = 'negative'
  AND DATE(ac.created_at) = CURRENT_DATE
ORDER BY c.total_visits DESC, ac.created_at DESC;

-- =====================================
-- 4. TASA DE RESPUESTA A FEEDBACK
-- =====================================

-- ¿Cuántos clientes responden cuando pedimos feedback?
WITH campaigns_sent AS (
  SELECT COUNT(DISTINCT customer_id) as clientes_contactados
  FROM crm_interactions
  WHERE interaction_type = 'feedback'
    AND restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
    AND created_at > NOW() - INTERVAL '7 days'
),
responses_received AS (
  SELECT COUNT(DISTINCT customer_id) as clientes_respondieron
  FROM agent_conversations
  WHERE interaction_type = 'feedback'
    AND restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
    AND created_at > NOW() - INTERVAL '7 days'
)
SELECT 
  cs.clientes_contactados,
  rr.clientes_respondieron,
  ROUND(
    (rr.clientes_respondieron::numeric / NULLIF(cs.clientes_contactados, 0)) * 100, 
    1
  ) as tasa_respuesta_pct,
  CASE 
    WHEN ROUND((rr.clientes_respondieron::numeric / NULLIF(cs.clientes_contactados, 0)) * 100, 1) >= 50 THEN '💚 Excelente'
    WHEN ROUND((rr.clientes_respondieron::numeric / NULLIF(cs.clientes_contactados, 0)) * 100, 1) >= 30 THEN '🟢 Bueno'
    ELSE '🟡 Mejorable'
  END as evaluacion
FROM campaigns_sent cs, responses_received rr;

-- =====================================
-- 5. SEGMENTACIÓN NPS DE CLIENTES
-- =====================================

-- Clasificar clientes como Promotores / Detractores / Neutrales
SELECT 
  c.id,
  c.name,
  c.phone,
  c.email,
  c.segment_auto_v2 as segmento_actual,
  COUNT(ac.id) as feedbacks_dados,
  COUNT(CASE WHEN ac.metadata->'classification'->>'sentiment' = 'positive' THEN 1 END) as positivos,
  COUNT(CASE WHEN ac.metadata->'classification'->>'sentiment' = 'negative' THEN 1 END) as negativos,
  COUNT(CASE WHEN ac.metadata->'classification'->>'sentiment' = 'neutral' THEN 1 END) as neutrales,
  CASE 
    WHEN COUNT(CASE WHEN ac.metadata->'classification'->>'sentiment' = 'positive' THEN 1 END) >= 2
         AND COUNT(CASE WHEN ac.metadata->'classification'->>'sentiment' = 'negative' THEN 1 END) = 0
    THEN '💎 PROMOTOR'
    
    WHEN COUNT(CASE WHEN ac.metadata->'classification'->>'sentiment' = 'negative' THEN 1 END) >= 1
    THEN '🔴 DETRACTOR'
    
    ELSE '🟡 NEUTRAL'
  END as categoria_nps,
  ROUND(
    (COUNT(CASE WHEN ac.metadata->'classification'->>'sentiment' = 'positive' THEN 1 END)::numeric / 
     NULLIF(COUNT(ac.id), 0)) * 100,
    1
  ) as pct_satisfaccion,
  MAX(ac.created_at) as ultimo_feedback,
  c.total_visits,
  c.total_spent
FROM customers c
JOIN agent_conversations ac ON ac.customer_id = c.id
WHERE ac.restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
  AND ac.interaction_type = 'feedback'
  AND ac.created_at > NOW() - INTERVAL '90 days'
GROUP BY c.id, c.name, c.phone, c.email, c.segment_auto_v2, c.total_visits, c.total_spent
HAVING COUNT(ac.id) >= 2
ORDER BY positivos DESC, feedbacks_dados DESC;

-- =====================================
-- 6. COMPARACIÓN NPS: ESTA SEMANA VS ANTERIOR
-- =====================================

WITH nps_this_week AS (
  SELECT 
    ROUND(
      ((COUNT(CASE WHEN metadata->'classification'->>'sentiment' = 'positive' THEN 1 END)::numeric - 
        COUNT(CASE WHEN metadata->'classification'->>'sentiment' = 'negative' THEN 1 END)::numeric) / 
       NULLIF(COUNT(*), 0)) * 100, 
      1
    ) as nps
  FROM agent_conversations
  WHERE restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
    AND interaction_type = 'feedback'
    AND created_at > NOW() - INTERVAL '7 days'
),
nps_last_week AS (
  SELECT 
    ROUND(
      ((COUNT(CASE WHEN metadata->'classification'->>'sentiment' = 'positive' THEN 1 END)::numeric - 
        COUNT(CASE WHEN metadata->'classification'->>'sentiment' = 'negative' THEN 1 END)::numeric) / 
       NULLIF(COUNT(*), 0)) * 100, 
      1
    ) as nps
  FROM agent_conversations
  WHERE restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
    AND interaction_type = 'feedback'
    AND created_at BETWEEN NOW() - INTERVAL '14 days' AND NOW() - INTERVAL '7 days'
)
SELECT 
  tw.nps as nps_esta_semana,
  lw.nps as nps_semana_pasada,
  ROUND(tw.nps - lw.nps, 1) as diferencia,
  CASE 
    WHEN (tw.nps - lw.nps) > 10 THEN '📈 Mejora significativa'
    WHEN (tw.nps - lw.nps) > 0 THEN '↗️ Mejora leve'
    WHEN (tw.nps - lw.nps) = 0 THEN '➡️ Sin cambios'
    WHEN (tw.nps - lw.nps) > -10 THEN '↘️ Caída leve'
    ELSE '📉 ALERTA: Caída significativa'
  END as tendencia
FROM nps_this_week tw, nps_last_week lw;

-- =====================================
-- 7. TOP 10 PROMOTORES (PARA CAMPAÑA REFERIDOS)
-- =====================================

-- Clientes más satisfechos → Candidatos para pedir reseñas/referidos
SELECT 
  c.name,
  c.phone,
  c.email,
  COUNT(ac.id) as feedbacks_positivos,
  c.total_visits as visitas_totales,
  c.total_spent as gastado_total,
  MAX(ac.created_at) as ultimo_feedback_positivo,
  EXTRACT(DAY FROM NOW() - MAX(ac.created_at)) as dias_desde_ultimo_feedback
FROM customers c
JOIN agent_conversations ac ON ac.customer_id = c.id
WHERE ac.restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
  AND ac.interaction_type = 'feedback'
  AND ac.metadata->'classification'->>'sentiment' = 'positive'
  AND ac.created_at > NOW() - INTERVAL '90 days'
GROUP BY c.id, c.name, c.phone, c.email, c.total_visits, c.total_spent
HAVING COUNT(ac.id) >= 2  -- Al menos 2 feedbacks positivos
ORDER BY COUNT(ac.id) DESC, c.total_visits DESC
LIMIT 10;

-- =====================================
-- 8. DETRACTORES RECURRENTES (PROBLEMA GRAVE)
-- =====================================

-- Clientes con múltiples feedbacks negativos → Acción urgente
SELECT 
  c.name,
  c.phone,
  c.email,
  COUNT(ac.id) as feedbacks_negativos,
  STRING_AGG(
    ac.metadata->'classification'->>'reasoning', 
    ' | ' 
    ORDER BY ac.created_at DESC
  ) as razones_insatisfaccion,
  MIN(ac.created_at) as primer_feedback_negativo,
  MAX(ac.created_at) as ultimo_feedback_negativo,
  c.total_visits,
  c.total_spent
FROM customers c
JOIN agent_conversations ac ON ac.customer_id = c.id
WHERE ac.restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
  AND ac.interaction_type = 'feedback'
  AND ac.metadata->'classification'->>'sentiment' = 'negative'
  AND ac.created_at > NOW() - INTERVAL '90 days'
GROUP BY c.id, c.name, c.phone, c.email, c.total_visits, c.total_spent
HAVING COUNT(ac.id) >= 2  -- 2 o más feedbacks negativos
ORDER BY COUNT(ac.id) DESC, c.total_spent DESC;

-- =====================================
-- 9. DISTRIBUCIÓN DE RESPUESTAS
-- =====================================

-- ¿Qué tan rápido responden los clientes al feedback?
SELECT 
  CASE 
    WHEN EXTRACT(EPOCH FROM (ac.created_at - ci.created_at)) / 3600 < 2 THEN '< 2 horas'
    WHEN EXTRACT(EPOCH FROM (ac.created_at - ci.created_at)) / 3600 < 6 THEN '2-6 horas'
    WHEN EXTRACT(EPOCH FROM (ac.created_at - ci.created_at)) / 3600 < 24 THEN '6-24 horas'
    WHEN EXTRACT(EPOCH FROM (ac.created_at - ci.created_at)) / 3600 < 48 THEN '24-48 horas'
    ELSE '> 48 horas'
  END as tiempo_respuesta,
  COUNT(*) as respuestas,
  ROUND(
    (COUNT(*)::numeric / (SELECT COUNT(*) FROM agent_conversations WHERE interaction_type = 'feedback')::numeric) * 100,
    1
  ) as porcentaje
FROM agent_conversations ac
JOIN crm_interactions ci ON ci.customer_id = ac.customer_id 
  AND ci.interaction_type = 'feedback'
  AND DATE(ci.created_at) = DATE(ac.created_at)
WHERE ac.restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
  AND ac.interaction_type = 'feedback'
  AND ac.created_at > NOW() - INTERVAL '30 days'
GROUP BY tiempo_respuesta
ORDER BY MIN(EXTRACT(EPOCH FROM (ac.created_at - ci.created_at)) / 3600);

-- =====================================
-- 10. NPS POR DÍA DE LA SEMANA
-- =====================================

-- ¿Qué días hay más/menos satisfacción?
SELECT 
  TO_CHAR(created_at, 'Day') as dia_semana,
  EXTRACT(ISODOW FROM created_at) as num_dia,
  COUNT(*) as total_feedbacks,
  COUNT(CASE WHEN metadata->'classification'->>'sentiment' = 'positive' THEN 1 END) as positivos,
  COUNT(CASE WHEN metadata->'classification'->>'sentiment' = 'negative' THEN 1 END) as negativos,
  ROUND(
    ((COUNT(CASE WHEN metadata->'classification'->>'sentiment' = 'positive' THEN 1 END)::numeric - 
      COUNT(CASE WHEN metadata->'classification'->>'sentiment' = 'negative' THEN 1 END)::numeric) / 
     NULLIF(COUNT(*), 0)) * 100, 
    1
  ) as nps_score
FROM agent_conversations
WHERE restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
  AND interaction_type = 'feedback'
  AND created_at > NOW() - INTERVAL '60 days'
GROUP BY dia_semana, num_dia
ORDER BY num_dia;

-- =====================================
-- FIN DE QUERIES
-- =====================================

-- NOTAS DE USO:
-- 1. Reemplazar 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1' por el restaurant_id correcto
-- 2. Ajustar intervalos de tiempo según necesidades
-- 3. Usar en dashboards de Metabase, Superset, o directamente en Supabase
-- 4. Combinar con alertas automáticas vía CRON

