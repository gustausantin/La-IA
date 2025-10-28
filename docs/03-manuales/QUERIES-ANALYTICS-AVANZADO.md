# 📊 QUERIES DE ANALYTICS AVANZADO - LA-IA APP

**Fecha:** 14 de octubre de 2025  
**Versión:** 1.0  
**Propósito:** Aprovechar al máximo los datos estructurados del Agente IA

---

## 🎯 **ÍNDICE**

1. [Dashboard de Operaciones Diarias](#1-dashboard-de-operaciones-diarias)
2. [Análisis de Sentimiento](#2-análisis-de-sentimiento)
3. [Rendimiento del Agente IA](#3-rendimiento-del-agente-ia)
4. [Conversión: Consultas → Reservas](#4-conversión-consultas--reservas)
5. [Horarios de Mayor Demanda](#5-horarios-de-mayor-demanda)
6. [Clientes VIP](#6-clientes-vip)
7. [Tiempo de Respuesta](#7-tiempo-de-respuesta)
8. [Análisis de Entidades](#8-análisis-de-entidades)
9. [Detección de Problemas](#9-detección-de-problemas)
10. [ROI del Agente IA](#10-roi-del-agente-ia)
11. [Tendencias Semanales](#11-tendencias-semanales)
12. [Análisis Multi-Tenant](#12-análisis-multi-tenant)

---

## 1️⃣ **DASHBOARD DE OPERACIONES DIARIAS**

### **Objetivo:** Ver resumen del día en tiempo real

```sql
-- Resumen de hoy: reservas, consultas, quejas
SELECT 
  interaction_type,
  COUNT(*) as total,
  ROUND(AVG((metadata->'classification'->>'confidence')::numeric * 100), 1) as avg_confidence_pct,
  COUNT(CASE WHEN metadata->'classification'->>'sentiment' = 'positive' THEN 1 END) as positivos,
  COUNT(CASE WHEN metadata->'classification'->>'sentiment' = 'negative' THEN 1 END) as negativos
FROM agent_conversations
WHERE restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
  AND DATE(created_at) = CURRENT_DATE
GROUP BY interaction_type
ORDER BY total DESC;
```

**Resultado esperado:**
```
interaction_type | total | avg_confidence_pct | positivos | negativos
-----------------+-------+--------------------+-----------+----------
reservation      |   45  |        94.5        |    38     |     2
inquiry          |   23  |        87.2        |    19     |     1
modification     |    8  |        92.0        |     7     |     1
complaint        |    3  |        91.0        |     0     |     3
```

**Uso:** Dashboard principal para el gerente.

---

## 2️⃣ **ANÁLISIS DE SENTIMIENTO**

### **Objetivo:** Detectar clientes insatisfechos AHORA

```sql
-- Clientes con sentimiento negativo HOY (requieren atención urgente)
SELECT 
  ac.customer_name,
  ac.customer_phone,
  ac.interaction_type,
  ac.metadata->'classification'->>'sentiment' as sentiment,
  ac.metadata->'classification'->>'intent' as intent,
  ac.metadata->'classification'->>'reasoning' as reasoning,
  ac.created_at,
  c.total_visits,
  c.segment_auto_v2
FROM agent_conversations ac
LEFT JOIN customers c ON c.id = ac.customer_id
WHERE ac.restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
  AND ac.metadata->'classification'->>'sentiment' = 'negative'
  AND DATE(ac.created_at) = CURRENT_DATE
ORDER BY ac.created_at DESC;
```

**Acción:** Llamar a estos clientes inmediatamente.

---

## 3️⃣ **RENDIMIENTO DEL AGENTE IA**

### **Objetivo:** Medir la calidad de la IA

```sql
-- Rendimiento del agente en los últimos 7 días
SELECT 
  DATE(created_at) as dia,
  COUNT(*) as total_conversaciones,
  ROUND(AVG((metadata->'classification'->>'confidence')::numeric * 100), 1) as confianza_promedio,
  COUNT(CASE WHEN (metadata->'classification'->>'confidence')::numeric < 0.7 THEN 1 END) as clasificaciones_dudosas,
  COUNT(CASE WHEN (metadata->'classification'->>'confidence')::numeric >= 0.9 THEN 1 END) as clasificaciones_excelentes,
  ROUND(
    COUNT(CASE WHEN (metadata->'classification'->>'confidence')::numeric >= 0.9 THEN 1 END)::numeric / 
    COUNT(*)::numeric * 100, 
    1
  ) as pct_excelentes
FROM agent_conversations
WHERE restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY dia DESC;
```

**Uso:** Si `pct_excelentes < 80%`, revisar prompt del agente.

---

## 4️⃣ **CONVERSIÓN: CONSULTAS → RESERVAS**

### **Objetivo:** Medir efectividad del agente para convertir

```sql
-- Tasa de conversión de consultas a reservas
WITH consultas AS (
  SELECT 
    customer_id, 
    MIN(created_at) as primera_consulta,
    COUNT(*) as num_consultas
  FROM agent_conversations
  WHERE interaction_type = 'inquiry'
    AND restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
    AND created_at > NOW() - INTERVAL '30 days'
  GROUP BY customer_id
),
reservas AS (
  SELECT 
    customer_id, 
    MIN(created_at) as primera_reserva,
    COUNT(*) as num_reservas
  FROM agent_conversations
  WHERE interaction_type = 'reservation'
    AND restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
    AND created_at > NOW() - INTERVAL '30 days'
  GROUP BY customer_id
)
SELECT 
  COUNT(DISTINCT c.customer_id) as total_clientes_consultaron,
  COUNT(DISTINCT r.customer_id) as clientes_que_reservaron,
  ROUND(
    COUNT(DISTINCT r.customer_id)::numeric / 
    NULLIF(COUNT(DISTINCT c.customer_id), 0)::numeric * 100, 
    1
  ) as tasa_conversion_pct,
  ROUND(AVG(c.num_consultas), 1) as promedio_consultas_antes_reservar,
  ROUND(AVG(r.num_reservas), 1) as promedio_reservas_por_cliente
FROM consultas c
LEFT JOIN reservas r ON c.customer_id = r.customer_id AND r.primera_reserva > c.primera_consulta;
```

**Benchmark:** Tasa de conversión > 50% es excelente.

---

## 5️⃣ **HORARIOS DE MAYOR DEMANDA**

### **Objetivo:** Optimizar staffing y promociones

```sql
-- Distribución de conversaciones por hora del día
SELECT 
  EXTRACT(HOUR FROM created_at) as hora,
  COUNT(*) as total_mensajes,
  COUNT(CASE WHEN interaction_type = 'reservation' THEN 1 END) as reservas,
  COUNT(CASE WHEN interaction_type = 'inquiry' THEN 1 END) as consultas,
  ROUND(
    COUNT(CASE WHEN interaction_type = 'reservation' THEN 1 END)::numeric / 
    NULLIF(COUNT(*), 0)::numeric * 100, 
    1
  ) as pct_conversion_hora
FROM agent_conversations
WHERE restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY hora
ORDER BY total_mensajes DESC;
```

**Acción:** 
- Horarios pico → Más personal / Promos "reserva ahora"
- Horarios valle → Promos descuento para rellenar

---

## 6️⃣ **CLIENTES VIP**

### **Objetivo:** Identificar clientes frecuentes para trato especial

```sql
-- Top 20 clientes más activos (VIP)
SELECT 
  c.name,
  c.phone,
  c.email,
  c.segment_auto_v2,
  COUNT(ac.id) as total_conversaciones,
  COUNT(CASE WHEN ac.interaction_type = 'reservation' THEN 1 END) as reservas,
  COUNT(CASE WHEN ac.interaction_type = 'complaint' THEN 1 END) as quejas,
  MAX(ac.created_at) as ultima_interaccion,
  EXTRACT(DAY FROM NOW() - MAX(ac.created_at)) as dias_desde_ultima_interaccion,
  c.total_spent as total_gastado,
  ROUND(c.total_spent / NULLIF(c.visits_count, 0), 2) as ticket_promedio
FROM customers c
JOIN agent_conversations ac ON ac.customer_id = c.id
WHERE ac.restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
  AND ac.created_at > NOW() - INTERVAL '90 days'
GROUP BY c.id, c.name, c.phone, c.email, c.segment_auto_v2, c.total_spent, c.visits_count
HAVING COUNT(ac.id) >= 5
ORDER BY total_conversaciones DESC
LIMIT 20;
```

**Acción:** Programa VIP, descuentos exclusivos, invitaciones especiales.

---

## 7️⃣ **TIEMPO DE RESPUESTA**

### **Objetivo:** Medir velocidad del sistema completo

```sql
-- Tiempo promedio de respuesta del agente (incluye buffer 30s)
SELECT 
  DATE(created_at) as dia,
  COUNT(*) as conversaciones,
  ROUND(AVG(EXTRACT(EPOCH FROM (
    (metadata->>'last_response_at')::timestamptz - created_at
  ))), 1) as tiempo_respuesta_segundos,
  ROUND(MIN(EXTRACT(EPOCH FROM (
    (metadata->>'last_response_at')::timestamptz - created_at
  ))), 1) as tiempo_minimo,
  ROUND(MAX(EXTRACT(EPOCH FROM (
    (metadata->>'last_response_at')::timestamptz - created_at
  ))), 1) as tiempo_maximo,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (
    (metadata->>'last_response_at')::timestamptz - created_at
  ))), 1) as mediana_segundos
FROM agent_conversations
WHERE restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
  AND metadata->>'last_response_at' IS NOT NULL
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY dia DESC;
```

**Benchmark:** < 40s es excelente (incluye 30s de buffer).

---

## 8️⃣ **ANÁLISIS DE ENTIDADES**

### **Objetivo:** Entender patrones de reservas

```sql
-- Análisis de horarios más solicitados en reservas
SELECT 
  metadata->'classification'->'entities'->>'hora' as hora_solicitada,
  COUNT(*) as veces_solicitada,
  ROUND(AVG((metadata->'classification'->'entities'->>'numero_personas')::int), 1) as promedio_personas,
  COUNT(CASE WHEN metadata->'classification'->>'sentiment' = 'positive' THEN 1 END) as reservas_positivas
FROM agent_conversations
WHERE restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
  AND interaction_type = 'reservation'
  AND metadata->'classification'->'entities'->>'hora' IS NOT NULL
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY hora_solicitada
ORDER BY veces_solicitada DESC
LIMIT 10;
```

**Acción:** Optimizar disponibilidad en horarios más demandados.

---

## 9️⃣ **DETECCIÓN DE PROBLEMAS**

### **Objetivo:** Alertas automáticas

```sql
-- Alertas: Detectar picos de quejas o sentimiento negativo
WITH stats_hoy AS (
  SELECT 
    COUNT(CASE WHEN interaction_type = 'complaint' THEN 1 END) as quejas_hoy,
    COUNT(CASE WHEN metadata->'classification'->>'sentiment' = 'negative' THEN 1 END) as negativos_hoy,
    COUNT(*) as total_hoy
  FROM agent_conversations
  WHERE restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
    AND DATE(created_at) = CURRENT_DATE
),
stats_promedio AS (
  SELECT 
    AVG(quejas_dia) as promedio_quejas,
    AVG(negativos_dia) as promedio_negativos
  FROM (
    SELECT 
      DATE(created_at) as dia,
      COUNT(CASE WHEN interaction_type = 'complaint' THEN 1 END) as quejas_dia,
      COUNT(CASE WHEN metadata->'classification'->>'sentiment' = 'negative' THEN 1 END) as negativos_dia
    FROM agent_conversations
    WHERE restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
      AND created_at > NOW() - INTERVAL '30 days'
      AND created_at < CURRENT_DATE
    GROUP BY dia
  ) sub
)
SELECT 
  h.quejas_hoy,
  ROUND(p.promedio_quejas, 1) as promedio_historico_quejas,
  h.negativos_hoy,
  ROUND(p.promedio_negativos, 1) as promedio_historico_negativos,
  CASE 
    WHEN h.quejas_hoy > p.promedio_quejas * 2 THEN '🚨 ALERTA: Quejas anormalmente altas'
    WHEN h.negativos_hoy > p.promedio_negativos * 2 THEN '⚠️ ALERTA: Sentimiento negativo alto'
    ELSE '✅ Normal'
  END as status_alerta
FROM stats_hoy h, stats_promedio p;
```

**Acción:** Si hay alerta, revisar qué está pasando HOY.

---

## 🔟 **ROI DEL AGENTE IA**

### **Objetivo:** Demostrar valor económico del agente

```sql
-- ROI: Comparar reservas antes/después del agente
WITH reservas_agente AS (
  SELECT 
    COUNT(*) as reservas_via_agente,
    COUNT(DISTINCT customer_id) as clientes_unicos
  FROM agent_conversations
  WHERE restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
    AND interaction_type = 'reservation'
    AND created_at > NOW() - INTERVAL '30 days'
),
valor_estimado AS (
  SELECT 
    AVG(total_spent / NULLIF(visits_count, 0)) as ticket_promedio
  FROM customers
  WHERE restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
    AND visits_count > 0
)
SELECT 
  ra.reservas_via_agente,
  ra.clientes_unicos,
  ROUND(ve.ticket_promedio, 2) as ticket_promedio_eur,
  ROUND(ra.reservas_via_agente * ve.ticket_promedio, 2) as ingresos_generados_estimados_eur,
  ROUND((ra.reservas_via_agente * ve.ticket_promedio) / 30, 2) as ingresos_diarios_promedio_eur
FROM reservas_agente ra, valor_estimado ve;
```

**Uso:** Justificar inversión en IA ante dirección.

---

## 1️⃣1️⃣ **TENDENCIAS SEMANALES**

### **Objetivo:** Identificar patrones por día de la semana

```sql
-- Patrones por día de la semana
SELECT 
  TO_CHAR(created_at, 'Day') as dia_semana,
  EXTRACT(ISODOW FROM created_at) as num_dia,
  COUNT(*) as total_conversaciones,
  COUNT(CASE WHEN interaction_type = 'reservation' THEN 1 END) as reservas,
  ROUND(
    COUNT(CASE WHEN interaction_type = 'reservation' THEN 1 END)::numeric / 
    NULLIF(COUNT(*), 0)::numeric * 100, 
    1
  ) as pct_conversion
FROM agent_conversations
WHERE restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
  AND created_at > NOW() - INTERVAL '60 days'
GROUP BY dia_semana, num_dia
ORDER BY num_dia;
```

**Acción:** Campañas específicas para días con baja conversión.

---

## 1️⃣2️⃣ **ANÁLISIS MULTI-TENANT**

### **Objetivo:** Comparar rendimiento entre restaurantes

```sql
-- Comparación de performance entre restaurantes
SELECT 
  r.name as restaurante,
  r.id as restaurant_id,
  COUNT(ac.id) as total_conversaciones,
  COUNT(CASE WHEN ac.interaction_type = 'reservation' THEN 1 END) as reservas,
  ROUND(
    COUNT(CASE WHEN ac.interaction_type = 'reservation' THEN 1 END)::numeric / 
    NULLIF(COUNT(ac.id), 0)::numeric * 100, 
    1
  ) as pct_conversion,
  ROUND(AVG((ac.metadata->'classification'->>'confidence')::numeric * 100), 1) as avg_confidence,
  COUNT(CASE WHEN ac.metadata->'classification'->>'sentiment' = 'negative' THEN 1 END) as negativos
FROM businesses r
LEFT JOIN agent_conversations ac ON ac.restaurant_id = r.id
  AND ac.created_at > NOW() - INTERVAL '30 days'
GROUP BY r.id, r.name
HAVING COUNT(ac.id) > 0
ORDER BY total_conversaciones DESC;
```

**Uso:** Benchmarking entre locales, detectar mejores prácticas.

---

## 📊 **DASHBOARDS RECOMENDADOS**

### **Dashboard 1: Operaciones Diarias (Gerente)**
- Query #1: Resumen del día
- Query #2: Alertas de sentimiento negativo
- Query #7: Tiempo de respuesta

### **Dashboard 2: Analytics Semanal (Dirección)**
- Query #4: Tasa de conversión
- Query #10: ROI del agente
- Query #11: Tendencias semanales

### **Dashboard 3: CRM & Marketing**
- Query #6: Clientes VIP
- Query #8: Análisis de horarios demandados
- Query #5: Horarios de mayor tráfico

### **Dashboard 4: Calidad & Mejora Continua**
- Query #3: Rendimiento del agente
- Query #9: Detección de problemas
- Query #12: Comparación multi-tenant

---

## 🔔 **ALERTAS AUTOMÁTICAS (SUPABASE CRON)**

### **Ejemplo: Alerta de quejas diarias**

```sql
-- Crear función para enviar alertas
CREATE OR REPLACE FUNCTION check_daily_complaints()
RETURNS void AS $$
DECLARE
  complaints_today INT;
  avg_complaints FLOAT;
BEGIN
  -- Contar quejas de hoy
  SELECT COUNT(*) INTO complaints_today
  FROM agent_conversations
  WHERE interaction_type = 'complaint'
    AND DATE(created_at) = CURRENT_DATE;
  
  -- Promedio histórico
  SELECT AVG(daily_count) INTO avg_complaints
  FROM (
    SELECT DATE(created_at) as dia, COUNT(*) as daily_count
    FROM agent_conversations
    WHERE interaction_type = 'complaint'
      AND created_at > NOW() - INTERVAL '30 days'
    GROUP BY dia
  ) sub;
  
  -- Si hay más del doble de quejas que el promedio
  IF complaints_today > avg_complaints * 2 THEN
    -- Aquí podrías llamar a un webhook, enviar email, etc.
    RAISE NOTICE 'ALERTA: % quejas hoy (promedio: %)', complaints_today, avg_complaints;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Programar ejecución diaria a las 20:00
SELECT cron.schedule(
  'daily-complaints-check',
  '0 20 * * *',
  $$SELECT check_daily_complaints();$$
);
```

---

## 📈 **INTEGRACIONES RECOMENDADAS**

### **1. Metabase / Superset**
- Conectar directamente a Supabase
- Dashboards interactivos con estas queries

### **2. Google Sheets (via Supabase API)**
- Reporte diario automático por email

### **3. Slack / Discord Webhooks**
- Alertas en tiempo real cuando hay problemas

### **4. Power BI / Tableau**
- Analytics avanzado para dirección

---

## 🎯 **MÉTRICAS CLAVE (KPIs)**

### **KPIs Operacionales:**
- Conversaciones totales/día
- Tiempo promedio de respuesta
- % de sentimiento negativo

### **KPIs de Negocio:**
- Tasa de conversión (consultas → reservas)
- ROI del agente (€ generados)
- % clientes VIP activos

### **KPIs de Calidad:**
- Confianza promedio del agente (> 85%)
- % clasificaciones excelentes (> 80%)
- Quejas/día (tendencia)

---

## ✅ **CHECKLIST DE IMPLEMENTACIÓN**

- [ ] Ejecutar queries en Supabase SQL Editor (verificar que funcionan)
- [ ] Crear vistas materializadas para queries más pesadas
- [ ] Configurar índices en columnas más usadas
- [ ] Implementar al menos 3 dashboards básicos
- [ ] Configurar 2-3 alertas automáticas con CRON
- [ ] Integrar con herramienta de visualización (Metabase recomendado)
- [ ] Documentar KPIs objetivo por restaurante
- [ ] Entrenar al equipo en lectura de dashboards

---

## 🚀 **PRÓXIMOS PASOS**

1. **Corto plazo (esta semana):**
   - Dashboard operacional diario
   - Alerta de quejas

2. **Medio plazo (este mes):**
   - Dashboard semanal completo
   - Integración con Metabase

3. **Largo plazo (3 meses):**
   - Machine Learning sobre estos datos
   - Predicción de demanda
   - Recomendaciones personalizadas por cliente

---

**ESTADO:** ✅ **LISTO PARA IMPLEMENTAR**

**Valor añadido:** Estos analytics convierten tu app de "herramienta operativa" a **"sistema de inteligencia de negocio"**.

