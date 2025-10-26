-- ═══════════════════════════════════════════════════════════════════════════
-- 📊 QUERIES CRM - SISTEMA DE FEEDBACK Y SATISFACCIÓN
-- ═══════════════════════════════════════════════════════════════════════════
-- Fecha: 14 de Octubre 2025
-- Propósito: Queries para dashboard CRM, análisis de feedback y NPS
-- Uso: Copiar en Supabase o integrar en dashboard frontend
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- 1️⃣ DISTRIBUCIÓN DE SENTIMENT (General)
-- ═══════════════════════════════════════════════════════════════════════════
-- Descripción: Porcentaje de feedback positivo/neutral/negativo
-- Uso: Gráfico de barras o pie chart en dashboard

SELECT 
  sentiment,
  COUNT(*) as total,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as porcentaje
FROM agent_conversations
WHERE interaction_type = 'feedback'
  AND restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'  -- Cambiar por tu restaurant_id
GROUP BY sentiment
ORDER BY sentiment;

-- Resultado esperado:
-- sentiment  | total | porcentaje
-- -----------+-------+-----------
-- positive   |   10  |   100.0
-- neutral    |    2  |    20.0
-- negative   |    1  |    10.0


-- ═══════════════════════════════════════════════════════════════════════════
-- 2️⃣ NPS SCORE (Net Promoter Score)
-- ═══════════════════════════════════════════════════════════════════════════
-- Descripción: Calcula el NPS de los últimos 7 días
-- Fórmula: ((Promotores - Detractores) / Total) * 100
-- Escala: -100 (muy malo) a +100 (excelente)

WITH feedback_semanal AS (
  SELECT 
    COUNT(*) FILTER (WHERE sentiment = 'positive') as promotores,
    COUNT(*) FILTER (WHERE sentiment = 'negative') as detractores,
    COUNT(*) as total
  FROM agent_conversations
  WHERE interaction_type = 'feedback'
    AND restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
    AND created_at >= CURRENT_DATE - INTERVAL '7 days'
)
SELECT 
  promotores,
  detractores,
  total,
  ROUND(((promotores::numeric - detractores::numeric) / NULLIF(total, 0)) * 100, 1) as nps_score,
  CASE 
    WHEN ROUND(((promotores::numeric - detractores::numeric) / NULLIF(total, 0)) * 100, 1) >= 70 THEN '🌟 Excelente'
    WHEN ROUND(((promotores::numeric - detractores::numeric) / NULLIF(total, 0)) * 100, 1) >= 50 THEN '✅ Bueno'
    WHEN ROUND(((promotores::numeric - detractores::numeric) / NULLIF(total, 0)) * 100, 1) >= 0 THEN '⚠️ Mejorable'
    ELSE '❌ Crítico'
  END as evaluacion
FROM feedback_semanal;

-- Resultado esperado:
-- promotores | detractores | total | nps_score | evaluacion
-- -----------+-------------+-------+-----------+---------------
--     10     |      0      |   10  |   100.0   | 🌟 Excelente


-- ═══════════════════════════════════════════════════════════════════════════
-- 3️⃣ ÚLTIMOS FEEDBACKS CON DETALLES
-- ═══════════════════════════════════════════════════════════════════════════
-- Descripción: Lista de últimos feedbacks con toda la info relevante
-- Uso: Tabla en dashboard CRM

SELECT 
  id,
  customer_name,
  customer_phone,
  sentiment,
  metadata->'classification'->>'confidence' as confidence,
  metadata->'classification'->'entities'->>'valoracion' as valoracion,
  metadata->'classification'->'entities'->>'aspectos_positivos' as aspectos_positivos,
  metadata->'classification'->'entities'->>'aspectos_negativos' as aspectos_negativos,
  metadata->>'agent_response' as respuesta_agente,
  created_at,
  DATE_PART('day', NOW() - created_at) as dias_desde_feedback
FROM agent_conversations
WHERE interaction_type = 'feedback'
  AND restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
ORDER BY created_at DESC
LIMIT 20;


-- ═══════════════════════════════════════════════════════════════════════════
-- 4️⃣ TENDENCIA DE NPS (Comparativa Semanal)
-- ═══════════════════════════════════════════════════════════════════════════
-- Descripción: Compara NPS de esta semana vs semana pasada
-- Uso: KPI card con flecha de tendencia ↑↓

WITH nps_esta_semana AS (
  SELECT 
    COUNT(*) FILTER (WHERE sentiment = 'positive') as promotores,
    COUNT(*) FILTER (WHERE sentiment = 'negative') as detractores,
    COUNT(*) as total
  FROM agent_conversations
  WHERE interaction_type = 'feedback'
    AND restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
    AND created_at >= CURRENT_DATE - INTERVAL '7 days'
),
nps_semana_pasada AS (
  SELECT 
    COUNT(*) FILTER (WHERE sentiment = 'positive') as promotores,
    COUNT(*) FILTER (WHERE sentiment = 'negative') as detractores,
    COUNT(*) as total
  FROM agent_conversations
  WHERE interaction_type = 'feedback'
    AND restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
    AND created_at >= CURRENT_DATE - INTERVAL '14 days'
    AND created_at < CURRENT_DATE - INTERVAL '7 days'
)
SELECT 
  ROUND(((esta.promotores::numeric - esta.detractores::numeric) / NULLIF(esta.total, 0)) * 100, 1) as nps_esta_semana,
  ROUND(((pasada.promotores::numeric - pasada.detractores::numeric) / NULLIF(pasada.total, 0)) * 100, 1) as nps_semana_pasada,
  ROUND(
    ((esta.promotores::numeric - esta.detractores::numeric) / NULLIF(esta.total, 0)) * 100 -
    ((pasada.promotores::numeric - pasada.detractores::numeric) / NULLIF(pasada.total, 0)) * 100,
  1) as diferencia,
  CASE 
    WHEN ((esta.promotores::numeric - esta.detractores::numeric) / NULLIF(esta.total, 0)) * 100 >
         ((pasada.promotores::numeric - pasada.detractores::numeric) / NULLIF(pasada.total, 0)) * 100 
    THEN '📈 Mejorando'
    WHEN ((esta.promotores::numeric - esta.detractores::numeric) / NULLIF(esta.total, 0)) * 100 <
         ((pasada.promotores::numeric - pasada.detractores::numeric) / NULLIF(pasada.total, 0)) * 100 
    THEN '📉 Empeorando'
    ELSE '➡️ Estable'
  END as tendencia
FROM nps_esta_semana esta, nps_semana_pasada pasada;


-- ═══════════════════════════════════════════════════════════════════════════
-- 5️⃣ TOP CLIENTES MÁS SATISFECHOS
-- ═══════════════════════════════════════════════════════════════════════════
-- Descripción: Clientes con más feedback positivo
-- Uso: Programa de fidelización, ofertas especiales

SELECT 
  c.name as cliente,
  c.phone,
  c.email,
  COUNT(*) FILTER (WHERE ac.sentiment = 'positive') as feedback_positivo,
  COUNT(*) as total_feedback,
  ROUND(COUNT(*) FILTER (WHERE ac.sentiment = 'positive')::numeric / COUNT(*) * 100, 1) as porcentaje_positivo,
  MAX(ac.created_at) as ultimo_feedback
FROM customers c
INNER JOIN agent_conversations ac ON c.id = ac.customer_id
WHERE ac.interaction_type = 'feedback'
  AND ac.restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
GROUP BY c.id, c.name, c.phone, c.email
HAVING COUNT(*) FILTER (WHERE ac.sentiment = 'positive') >= 2  -- Al menos 2 feedbacks positivos
ORDER BY feedback_positivo DESC, porcentaje_positivo DESC
LIMIT 10;


-- ═══════════════════════════════════════════════════════════════════════════
-- 6️⃣ ALERTAS: CLIENTES INSATISFECHOS
-- ═══════════════════════════════════════════════════════════════════════════
-- Descripción: Detecta clientes con feedback negativo reciente
-- Uso: Notificación al gerente, seguimiento proactivo

SELECT 
  ac.customer_name,
  ac.customer_phone,
  ac.sentiment,
  ac.metadata->'classification'->'entities'->>'tipo_problema' as problema,
  ac.metadata->'classification'->'entities'->>'aspecto_negativo' as aspecto_negativo,
  ac.metadata->>'agent_response' as respuesta_agente,
  ac.created_at,
  DATE_PART('hour', NOW() - ac.created_at) as horas_desde_queja,
  CASE 
    WHEN DATE_PART('hour', NOW() - ac.created_at) < 24 THEN '🔴 URGENTE - Menos de 24h'
    WHEN DATE_PART('hour', NOW() - ac.created_at) < 48 THEN '🟡 IMPORTANTE - Menos de 48h'
    ELSE '⚪ Seguimiento - Más de 48h'
  END as prioridad
FROM agent_conversations ac
WHERE ac.interaction_type IN ('feedback', 'complaint')
  AND ac.sentiment = 'negative'
  AND ac.restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
  AND ac.created_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY ac.created_at DESC;


-- ═══════════════════════════════════════════════════════════════════════════
-- 7️⃣ PALABRAS CLAVE EN FEEDBACK POSITIVO
-- ═══════════════════════════════════════════════════════════════════════════
-- Descripción: Aspectos más mencionados en feedback positivo
-- Uso: Análisis de fortalezas del restaurante

SELECT 
  jsonb_array_elements_text(metadata->'classification'->'entities'->'aspectos_positivos') as aspecto,
  COUNT(*) as menciones
FROM agent_conversations
WHERE interaction_type = 'feedback'
  AND sentiment = 'positive'
  AND restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
  AND metadata->'classification'->'entities'->'aspectos_positivos' IS NOT NULL
GROUP BY aspecto
ORDER BY menciones DESC
LIMIT 10;


-- ═══════════════════════════════════════════════════════════════════════════
-- 8️⃣ RESUMEN EJECUTIVO (Dashboard Principal)
-- ═══════════════════════════════════════════════════════════════════════════
-- Descripción: KPIs principales para vista ejecutiva
-- Uso: Cards en dashboard principal

WITH stats AS (
  SELECT 
    COUNT(*) as total_feedback,
    COUNT(*) FILTER (WHERE sentiment = 'positive') as positivos,
    COUNT(*) FILTER (WHERE sentiment = 'negative') as negativos,
    COUNT(*) FILTER (WHERE sentiment = 'neutral') as neutrales,
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as feedback_esta_semana,
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '24 hours') as feedback_hoy,
    AVG((metadata->'classification'->>'confidence')::numeric) as confidence_promedio
  FROM agent_conversations
  WHERE interaction_type = 'feedback'
    AND restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
)
SELECT 
  total_feedback,
  positivos,
  negativos,
  neutrales,
  ROUND((positivos::numeric / NULLIF(total_feedback, 0)) * 100, 1) as tasa_satisfaccion,
  ROUND(((positivos::numeric - negativos::numeric) / NULLIF(total_feedback, 0)) * 100, 1) as nps,
  feedback_esta_semana,
  feedback_hoy,
  ROUND(confidence_promedio * 100, 1) as confidence_promedio_pct
FROM stats;


-- ═══════════════════════════════════════════════════════════════════════════
-- 9️⃣ FEEDBACK POR DÍA DE LA SEMANA
-- ═══════════════════════════════════════════════════════════════════════════
-- Descripción: Identifica qué días hay más feedback (positivo/negativo)
-- Uso: Gráfico de líneas o barras por día

SELECT 
  TO_CHAR(created_at, 'Day') as dia_semana,
  EXTRACT(DOW FROM created_at) as dia_numero,  -- 0=Domingo, 6=Sábado
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE sentiment = 'positive') as positivos,
  COUNT(*) FILTER (WHERE sentiment = 'negative') as negativos,
  ROUND(COUNT(*) FILTER (WHERE sentiment = 'positive')::numeric / COUNT(*) * 100, 1) as porcentaje_satisfaccion
FROM agent_conversations
WHERE interaction_type = 'feedback'
  AND restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
  AND created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY dia_semana, dia_numero
ORDER BY dia_numero;


-- ═══════════════════════════════════════════════════════════════════════════
-- 🔟 TASA DE RESPUESTA A FEEDBACK
-- ═══════════════════════════════════════════════════════════════════════════
-- Descripción: % de feedbacks que recibieron respuesta del agente
-- Uso: KPI de calidad de atención

SELECT 
  COUNT(*) as total_feedback,
  COUNT(*) FILTER (WHERE metadata->>'agent_response' IS NOT NULL) as con_respuesta,
  COUNT(*) FILTER (WHERE metadata->>'agent_response' IS NULL) as sin_respuesta,
  ROUND(COUNT(*) FILTER (WHERE metadata->>'agent_response' IS NOT NULL)::numeric / COUNT(*) * 100, 1) as tasa_respuesta
FROM agent_conversations
WHERE interaction_type = 'feedback'
  AND restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
  AND created_at >= CURRENT_DATE - INTERVAL '30 days';


-- ═══════════════════════════════════════════════════════════════════════════
-- 📝 NOTAS DE USO
-- ═══════════════════════════════════════════════════════════════════════════
-- 
-- 1. Reemplaza 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1' con tu restaurant_id
-- 2. Ajusta los intervalos de tiempo según necesites (7 days, 30 days, etc.)
-- 3. Estas queries están optimizadas para performance (usan índices en sentiment, interaction_type, created_at)
-- 4. Para multi-restaurante, quita el filtro restaurant_id o agrupa por restaurant_id
--
-- ═══════════════════════════════════════════════════════════════════════════

