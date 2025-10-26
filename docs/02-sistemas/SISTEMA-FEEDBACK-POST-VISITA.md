# 🎯 SISTEMA DE FEEDBACK POST-VISITA

**Fecha:** 14 de octubre de 2025  
**Estado:** ✅ Diseñado y documentado (Pendiente implementación CRM)  
**Propósito:** Capturar satisfacción del cliente automáticamente después de cada visita

---

## 📋 **ÍNDICE**

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Flujo Completo](#flujo-completo)
3. [Estructura de Datos](#estructura-de-datos)
4. [Clasificación de Feedback](#clasificación-de-feedback)
5. [Queries de NPS](#queries-de-nps)
6. [Implementación en CRM](#implementación-en-crm)
7. [Dashboards Recomendados](#dashboards-recomendados)
8. [Alertas Automáticas](#alertas-automáticas)

---

## 🎯 **RESUMEN EJECUTIVO**

### **Objetivo:**
Medir automáticamente la satisfacción del cliente después de cada visita para:
- 📊 Calcular NPS (Net Promoter Score)
- 🔔 Detectar clientes insatisfechos ANTES de que hablen mal del restaurante
- 💎 Identificar promotores para campañas de referidos
- 📈 Mejorar continuamente la experiencia

### **Cómo funciona:**
1. Cliente completa una reserva y visita el restaurante
2. Al día siguiente, el CRM envía automáticamente: *"Hola María, espero que disfrutaras tu visita ayer. ¿Cómo estuvo todo?"*
3. Cliente responde por WhatsApp
4. El Agente IA clasifica la respuesta como `feedback` + detecta sentiment
5. Se generan métricas automáticas de NPS y alertas de insatisfacción

---

## 🔄 **FLUJO COMPLETO**

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. CLIENTE VISITA RESTAURANTE                                   │
│    Reserva confirmada → status: 'completed' en reservations     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. CRM DETECTA VISITA COMPLETADA (CRON diario a las 10:00)     │
│    Query: Reservas de ayer con status 'completed'               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. CRM ENVÍA MENSAJE DE FEEDBACK (vía WhatsApp)                │
│    Mensaje: "Hola {nombre}, espero que disfrutaras tu visita    │
│             ayer. ¿Cómo estuvo todo?"                            │
│    Se guarda en agent_conversations:                             │
│    - interaction_type: 'feedback'                                │
│    - status: 'awaiting_response'                                 │
│    - metadata.campaign_id: 'feedback_post_visit_day1'           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. CLIENTE RESPONDE (vía WhatsApp)                              │
│    Ejemplos:                                                     │
│    - "Genial, todo perfecto 😊"                                 │
│    - "Bien, aunque tardasteis un poco"                          │
│    - "Fatal, la comida estaba fría"                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. AGENTE IA CLASIFICA LA RESPUESTA                             │
│    - Detecta que es respuesta a feedback (contexto)             │
│    - Analiza sentiment: positive / neutral / negative           │
│    - Guarda clasificación en metadata                            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. ACCIONES AUTOMÁTICAS                                         │
│    SI sentiment = 'negative':                                    │
│      → 🚨 ALERTA inmediata al gerente                           │
│      → 📞 Llamar al cliente HOY para resolver                   │
│                                                                  │
│    SI sentiment = 'positive':                                    │
│      → 💎 Marcar como PROMOTOR en CRM                           │
│      → 🎁 Enviar código descuento para próxima visita           │
│                                                                  │
│    SIEMPRE:                                                      │
│      → 📊 Actualizar métricas de NPS                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 **ESTRUCTURA DE DATOS**

### **Tabla: `agent_conversations`**

```sql
{
  "id": "uuid",
  "restaurant_id": "uuid",
  "customer_id": "uuid",
  "customer_name": "María García",
  "customer_phone": "+34600123456",
  
  "interaction_type": "feedback",  ← TIPO ESPECÍFICO
  
  "status": "active",
  
  "metadata": {
    "classification": {
      "intent": "feedback",
      "sentiment": "positive",     ← AQUÍ: positive / neutral / negative
      "confidence": 0.92,
      "reasoning": "Cliente expresa satisfacción con emojis positivos"
    },
    
    "is_solicited_feedback": true,  ← Indica que fue solicitado por CRM
    "campaign_id": "feedback_post_visit_day1",
    "related_reservation_id": "uuid-de-la-reserva",
    
    "last_response_at": "2025-10-15T10:30:00Z",
    "agent_response": "¡Muchas gracias María! Nos alegra mucho que...",
    "response_timestamp": "2025-10-15T10:30:05Z"
  },
  
  "created_at": "2025-10-15T10:25:00Z"
}
```

---

## 🎯 **CLASIFICACIÓN DE FEEDBACK**

### **Tipos de Sentiment:**

| Sentiment | Descripción | Ejemplos | Acción |
|-----------|-------------|----------|--------|
| **positive** | Cliente muy satisfecho | "Genial", "Excelente", "10/10", "Perfecto", emojis 😊👍 | Marcar como PROMOTOR |
| **neutral** | Cliente satisfecho pero sin entusiasmo | "Bien", "Normal", "OK", "Correcto" | Seguimiento opcional |
| **negative** | Cliente insatisfecho | "Mal", "Fatal", "Tardasteis", "Fría", emojis 😞😡 | ALERTA + Llamar HOY |

---

### **Detección Automática en el Agente IA:**

#### **Prompt del Clasificador (añadir esto):**

```
CLASIFICACIÓN DE FEEDBACK:

Si el mensaje es una RESPUESTA a una solicitud previa de opinión/valoración:

1. Clasifica como intent: "feedback"

2. Analiza el sentiment:
   - POSITIVE: Cliente expresa satisfacción, usa palabras positivas 
     (genial, excelente, perfecto, increíble, buenísimo, encantado)
     o emojis positivos (😊, 👍, ❤️, 🤩, 🙌)
   
   - NEGATIVE: Cliente expresa insatisfacción, usa palabras negativas
     (mal, fatal, horrible, decepcionante, frío, lento, sucio)
     o emojis negativos (😞, 😡, 👎, 😠)
   
   - NEUTRAL: Respuestas cortas sin emoción
     (bien, normal, ok, correcto, regular)

3. Extrae entities relevantes:
   - Aspectos mencionados: comida, servicio, ambiente, precio, etc.
   - Nivel de satisfacción: del 1 al 10 si lo mencionan

Ejemplo:
Mensaje: "Todo estuvo genial, pero el servicio fue un poco lento"
Clasificación:
- intent: feedback
- sentiment: neutral (positivo pero con pero)
- entities: { aspectos: ["comida:positivo", "servicio:negativo"] }
```

---

## 📈 **QUERIES DE NPS**

### **1. NPS Score (Métrica de Oro)**

```sql
-- NPS = (% Promotores - % Detractores)
-- Promotores: sentiment = positive
-- Detractores: sentiment = negative
-- Neutrales: sentiment = neutral

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
  ROUND((promotores::float / NULLIF(total_responses, 0)) * 100, 1) as pct_promotores,
  ROUND((detractores::float / NULLIF(total_responses, 0)) * 100, 1) as pct_detractores,
  ROUND(
    ((promotores::float - detractores::float) / NULLIF(total_responses, 0)) * 100, 
    1
  ) as nps_score
FROM feedback_stats;
```

**Benchmark NPS:**
- < 0: 🔴 Crisis (más detractores que promotores)
- 0-30: 🟡 Mejorable
- 30-50: 🟢 Bueno
- 50-70: 💚 Excelente
- \> 70: 💎 Clase mundial

---

### **2. Evolución del NPS en el Tiempo**

```sql
-- NPS diario/semanal
SELECT 
  DATE(created_at) as dia,
  COUNT(*) as total_feedbacks,
  COUNT(CASE WHEN metadata->'classification'->>'sentiment' = 'positive' THEN 1 END) as promotores,
  COUNT(CASE WHEN metadata->'classification'->>'sentiment' = 'negative' THEN 1 END) as detractores,
  ROUND(
    ((COUNT(CASE WHEN metadata->'classification'->>'sentiment' = 'positive' THEN 1 END)::float - 
      COUNT(CASE WHEN metadata->'classification'->>'sentiment' = 'negative' THEN 1 END)::float) / 
     NULLIF(COUNT(*), 0)) * 100, 
    1
  ) as nps_score_dia
FROM agent_conversations
WHERE restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
  AND interaction_type = 'feedback'
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY dia DESC;
```

---

### **3. Tasa de Respuesta a Feedback**

```sql
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
    (rr.clientes_respondieron::float / NULLIF(cs.clientes_contactados, 0)) * 100, 
    1
  ) as tasa_respuesta_pct
FROM campaigns_sent cs, responses_received rr;
```

**Benchmark:** Tasa de respuesta > 40% es excelente.

---

### **4. Feedback Negativo Urgente**

```sql
-- Clientes insatisfechos HOY → Llamar AHORA
SELECT 
  c.name,
  c.phone,
  c.email,
  ac.metadata->>'agent_response' as que_dijo_cliente,
  ac.metadata->'classification'->>'reasoning' as razon_negativo,
  ac.created_at,
  c.total_visits,
  c.total_spent
FROM agent_conversations ac
JOIN customers c ON c.id = ac.customer_id
WHERE ac.restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
  AND ac.interaction_type = 'feedback'
  AND ac.metadata->'classification'->>'sentiment' = 'negative'
  AND DATE(ac.created_at) = CURRENT_DATE
ORDER BY ac.created_at DESC;
```

---

### **5. Segmentación de Clientes por NPS**

```sql
-- Clasificar clientes como Promotores / Detractores / Neutrales
SELECT 
  c.id,
  c.name,
  c.phone,
  c.segment_auto_v2,
  COUNT(ac.id) as feedbacks_dados,
  COUNT(CASE WHEN ac.metadata->'classification'->>'sentiment' = 'positive' THEN 1 END) as positivos,
  COUNT(CASE WHEN ac.metadata->'classification'->>'sentiment' = 'negative' THEN 1 END) as negativos,
  CASE 
    WHEN COUNT(CASE WHEN ac.metadata->'classification'->>'sentiment' = 'positive' THEN 1 END) >= 2
         AND COUNT(CASE WHEN ac.metadata->'classification'->>'sentiment' = 'negative' THEN 1 END) = 0
    THEN '💎 PROMOTOR'
    
    WHEN COUNT(CASE WHEN ac.metadata->'classification'->>'sentiment' = 'negative' THEN 1 END) >= 1
    THEN '🔴 DETRACTOR'
    
    ELSE '🟡 NEUTRAL'
  END as categoria_nps,
  MAX(ac.created_at) as ultimo_feedback
FROM customers c
JOIN agent_conversations ac ON ac.customer_id = c.id
WHERE ac.restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
  AND ac.interaction_type = 'feedback'
  AND ac.created_at > NOW() - INTERVAL '90 days'
GROUP BY c.id, c.name, c.phone, c.segment_auto_v2
HAVING COUNT(ac.id) >= 2
ORDER BY positivos DESC, feedbacks_dados DESC;
```

---

## 🔧 **IMPLEMENTACIÓN EN CRM**

### **PASO 1: Detectar Visitas Completadas**

**CRON Job:** Ejecutar diariamente a las 10:00 AM

```sql
-- Función para detectar reservas completadas ayer
CREATE OR REPLACE FUNCTION detect_completed_visits_for_feedback()
RETURNS TABLE (
  reservation_id UUID,
  customer_id UUID,
  customer_name VARCHAR,
  customer_phone VARCHAR,
  restaurant_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id as reservation_id,
    r.customer_id,
    c.name as customer_name,
    c.phone as customer_phone,
    r.restaurant_id
  FROM reservations r
  JOIN customers c ON c.id = r.customer_id
  WHERE r.status = 'completed'
    AND DATE(r.reservation_date) = CURRENT_DATE - INTERVAL '1 day'
    AND NOT EXISTS (
      -- No enviar si ya se le pidió feedback por esta reserva
      SELECT 1 FROM agent_conversations ac
      WHERE ac.customer_id = r.customer_id
        AND ac.interaction_type = 'feedback'
        AND ac.metadata->>'related_reservation_id' = r.id::text
    );
END;
$$ LANGUAGE plpgsql;
```

---

### **PASO 2: Enviar Mensajes de Feedback**

**Workflow N8N:** `4-crm-feedback-post-visita.json`

```json
{
  "nodes": [
    {
      "name": "⏰ CRON Diario 10:00",
      "type": "scheduleTrigger",
      "parameters": {
        "rule": {
          "interval": [{ "field": "hour", "hourInterval": 24, "triggerAtHour": 10 }]
        }
      }
    },
    {
      "name": "🔍 Get Completed Visits",
      "type": "supabase",
      "parameters": {
        "operation": "executeQuery",
        "query": "SELECT * FROM detect_completed_visits_for_feedback();"
      }
    },
    {
      "name": "📝 Preparar Mensajes",
      "type": "code",
      "parameters": {
        "jsCode": `
          const visits = $input.all();
          return visits.map(visit => ({
            customer_id: visit.json.customer_id,
            customer_name: visit.json.customer_name,
            customer_phone: visit.json.customer_phone,
            restaurant_id: visit.json.restaurant_id,
            reservation_id: visit.json.reservation_id,
            message: \`Hola \${visit.json.customer_name}, espero que disfrutaras tu visita ayer en nuestro restaurante. ¿Cómo estuvo todo? Tu opinión nos ayuda a mejorar 😊\`
          }));
        `
      }
    },
    {
      "name": "💾 Guardar Conversación Feedback",
      "type": "supabase",
      "parameters": {
        "operation": "create",
        "tableId": "agent_conversations",
        "fieldsUi": {
          "fieldValues": [
            { "fieldId": "restaurant_id", "fieldValue": "={{ $json.restaurant_id }}" },
            { "fieldId": "customer_id", "fieldValue": "={{ $json.customer_id }}" },
            { "fieldId": "customer_phone", "fieldValue": "={{ $json.customer_phone }}" },
            { "fieldId": "customer_name", "fieldValue": "={{ $json.customer_name }}" },
            { "fieldId": "source_channel", "fieldValue": "whatsapp" },
            { "fieldId": "interaction_type", "fieldValue": "feedback" },
            { "fieldId": "status", "fieldValue": "awaiting_response" },
            { 
              "fieldId": "metadata", 
              "fieldValue": "={{ JSON.stringify({ is_solicited_feedback: true, campaign_id: 'feedback_post_visit_day1', related_reservation_id: $json.reservation_id }) }}" 
            }
          ]
        }
      }
    },
    {
      "name": "📤 Enviar WhatsApp (Twilio)",
      "type": "twilio",
      "parameters": {
        "resource": "message",
        "operation": "send",
        "from": "whatsapp:+14155238886",
        "to": "={{ 'whatsapp:' + $json.customer_phone }}",
        "message": "={{ $json.message }}"
      }
    }
  ]
}
```

---

### **PASO 3: Clasificación Automática (Ya está implementado)**

El **Workflow 3 (Super Agent)** ya hace la clasificación. Solo necesitas actualizar el prompt:

**Añadir al prompt del clasificador:**
```
DETECCIÓN DE FEEDBACK:

Si el mensaje:
1. Es una respuesta corta de valoración (bien, mal, genial, etc.)
2. Y existe una conversación previa tipo 'feedback' en status 'awaiting_response'
3. Y fue enviada en las últimas 48h

Entonces clasifica como:
- intent: "feedback"
- sentiment: analiza el tono (positive/neutral/negative)
```

---

## 📊 **DASHBOARDS RECOMENDADOS**

### **Dashboard 1: NPS en Tiempo Real (Gerente)**

**Widgets:**
1. **NPS Score del Mes** (número grande)
2. **Distribución:** Promotores / Neutrales / Detractores (gráfico de pastel)
3. **Evolución NPS últimos 30 días** (gráfico de línea)
4. **Tasa de respuesta** a feedback (%)
5. **Alertas:** Feedbacks negativos de hoy (tabla)

---

### **Dashboard 2: Análisis de Satisfacción (Dirección)**

**Widgets:**
1. **NPS por semana** (últimos 3 meses)
2. **Comparación con mes anterior**
3. **Top 10 promotores** (clientes más satisfechos)
4. **Top 10 detractores** (clientes insatisfechos)
5. **Aspectos más mencionados** (comida, servicio, ambiente)

---

## 🔔 **ALERTAS AUTOMÁTICAS**

### **Alerta 1: Feedback Negativo Inmediato**

```sql
-- Función para alertas
CREATE OR REPLACE FUNCTION alert_negative_feedback()
RETURNS void AS $$
DECLARE
  negative_count INT;
  customer_details TEXT;
BEGIN
  -- Contar negativos de hoy
  SELECT COUNT(*) INTO negative_count
  FROM agent_conversations
  WHERE interaction_type = 'feedback'
    AND metadata->'classification'->>'sentiment' = 'negative'
    AND DATE(created_at) = CURRENT_DATE;
  
  IF negative_count > 0 THEN
    -- Obtener detalles
    SELECT STRING_AGG(
      customer_name || ' (' || customer_phone || ')', 
      ', '
    ) INTO customer_details
    FROM agent_conversations
    WHERE interaction_type = 'feedback'
      AND metadata->'classification'->>'sentiment' = 'negative'
      AND DATE(created_at) = CURRENT_DATE;
    
    -- Aquí: Enviar notificación (Slack, Email, SMS)
    RAISE NOTICE '🚨 ALERTA: % clientes insatisfechos HOY: %', negative_count, customer_details;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Ejecutar cada hora
SELECT cron.schedule(
  'check-negative-feedback-hourly',
  '0 * * * *',  -- Cada hora
  $$SELECT alert_negative_feedback();$$
);
```

---

### **Alerta 2: NPS Caída Significativa**

```sql
-- Alerta si NPS baja >10 puntos vs semana pasada
CREATE OR REPLACE FUNCTION alert_nps_drop()
RETURNS void AS $$
DECLARE
  nps_this_week FLOAT;
  nps_last_week FLOAT;
BEGIN
  -- NPS esta semana
  SELECT 
    ((COUNT(CASE WHEN metadata->'classification'->>'sentiment' = 'positive' THEN 1 END)::float - 
      COUNT(CASE WHEN metadata->'classification'->>'sentiment' = 'negative' THEN 1 END)::float) / 
     NULLIF(COUNT(*), 0)) * 100
  INTO nps_this_week
  FROM agent_conversations
  WHERE interaction_type = 'feedback'
    AND created_at > NOW() - INTERVAL '7 days';
  
  -- NPS semana pasada
  SELECT 
    ((COUNT(CASE WHEN metadata->'classification'->>'sentiment' = 'positive' THEN 1 END)::float - 
      COUNT(CASE WHEN metadata->'classification'->>'sentiment' = 'negative' THEN 1 END)::float) / 
     NULLIF(COUNT(*), 0)) * 100
  INTO nps_last_week
  FROM agent_conversations
  WHERE interaction_type = 'feedback'
    AND created_at BETWEEN NOW() - INTERVAL '14 days' AND NOW() - INTERVAL '7 days';
  
  IF (nps_this_week - nps_last_week) < -10 THEN
    RAISE NOTICE '⚠️ ALERTA NPS: Caída de %.1f puntos (antes: %.1f, ahora: %.1f)', 
      (nps_last_week - nps_this_week), nps_last_week, nps_this_week;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Ejecutar lunes a las 9:00
SELECT cron.schedule(
  'check-nps-weekly-drop',
  '0 9 * * 1',  -- Lunes 9:00
  $$SELECT alert_nps_drop();$$
);
```

---

## ✅ **CHECKLIST DE IMPLEMENTACIÓN**

### **Fase 1: Base de Datos (HOY)**
- [x] Ejecutar migración `20251014_002_add_feedback_interaction_type.sql`
- [x] Verificar que constraint acepta 'feedback'
- [x] Crear índices para optimización

### **Fase 2: Agente IA (ESTA SEMANA)**
- [ ] Actualizar prompt del clasificador con detección de feedback
- [ ] Añadir mapeo `'feedback': 'feedback'` en nodo de preparación
- [ ] Probar clasificación manual con mensajes de prueba

### **Fase 3: CRM Workflow (PRÓXIMA SEMANA)**
- [ ] Crear función `detect_completed_visits_for_feedback()`
- [ ] Crear workflow N8N `4-crm-feedback-post-visita.json`
- [ ] Configurar CRON diario 10:00 AM
- [ ] Probar con reserva de prueba

### **Fase 4: Dashboards & Alertas (MES 1)**
- [ ] Implementar Dashboard NPS en Metabase
- [ ] Configurar alertas de feedback negativo (CRON hourly)
- [ ] Configurar alerta de caída de NPS (CRON weekly)
- [ ] Entrenar equipo en uso de dashboards

### **Fase 5: Automatizaciones Avanzadas (MES 2)**
- [ ] Auto-envío de descuento a promotores
- [ ] Auto-llamada a detractores
- [ ] Análisis de aspectos más mencionados (IA)
- [ ] Predicción de detractores antes de que respondan

---

## 🎯 **KPIs OBJETIVO**

| Métrica | Objetivo Año 1 | Benchmark Industria |
|---------|----------------|---------------------|
| **NPS Score** | > 40 | 30-50 (restaurantes) |
| **Tasa de respuesta** | > 40% | 30-50% |
| **Feedbacks negativos resueltos** | > 80% | 60-70% |
| **Tiempo resolución detractores** | < 24h | 48-72h |

---

## 🚀 **PRÓXIMOS PASOS**

1. **Hoy:** Ejecutar migración SQL
2. **Esta semana:** Actualizar clasificador del agente
3. **Próxima semana:** Implementar workflow CRM
4. **Mes 1:** Dashboards y alertas
5. **Mes 2:** Automatizaciones avanzadas

---

**ESTADO:** ✅ **DOCUMENTADO Y LISTO PARA IMPLEMENTACIÓN CRM**

**Valor añadido:** Sistema profesional de medición de satisfacción que convierte feedback en acción inmediata.

