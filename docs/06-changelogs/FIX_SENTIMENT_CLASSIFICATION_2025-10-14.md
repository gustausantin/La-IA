# 🔧 FIX: Clasificación de Sentiment y Sincronización

> **Fecha:** 14 de Octubre 2025  
> **Problema:** El LLM clasificaba feedback positivo como "neutral" y el campo `sentiment` en `agent_conversations` quedaba en NULL  
> **Estado:** ✅ SOLUCIONADO

---

## 🐛 **PROBLEMA DETECTADO**

### **Caso real:**
```
Mensaje: "Todo estuvo excelente, la comida increíble y el servicio de 10. Volveremos seguro!"

❌ Clasificación incorrecta:
{
  "intent": "feedback",           // ✅ Correcto
  "sentiment": "neutral",         // ❌ INCORRECTO (debería ser "positive")
  "confidence": 0.5               // ❌ Muy baja
}

❌ En base de datos:
agent_conversations.sentiment = NULL  // ❌ No se sincronizó
```

---

## ✅ **SOLUCIONES IMPLEMENTADAS**

### **1. Prompt Mejorado para Clasificación (`n8n/prompts/CLASIFICADOR-CON-SENTIMENT-MEJORADO.txt`)**

#### **Mejoras:**
- ✅ Instrucciones MUY CLARAS sobre sentiment (positive/neutral/negative)
- ✅ Lista de palabras clave para cada sentiment
- ✅ Ejemplos específicos de feedback positivo y quejas
- ✅ Reglas de confidence más estrictas

#### **Ejemplo de output esperado:**
```json
{
  "intent": "feedback",
  "entities": {
    "valoracion": "excelente",
    "comida": "increíble",
    "servicio": "10"
  },
  "sentiment": "positive",        // ✅ Ahora detecta correctamente
  "confidence": 0.98,             // ✅ Alta confianza
  "reasoning": "Feedback muy positivo tras una visita"
}
```

---

### **2. Sincronización Automática de Sentiment (`supabase/migrations/20251014_004_sync_sentiment_from_metadata.sql`)**

#### **Problema:**
El sentiment se guardaba en `metadata->classification->sentiment` pero NO se copiaba al campo `sentiment` de la tabla.

#### **Solución:**
- ✅ Trigger que auto-copia `metadata.classification.sentiment` → `sentiment` (campo directo)
- ✅ Actualización de registros existentes
- ✅ Funciona en INSERT y UPDATE

#### **Ventajas:**
- 📊 Las queries de NPS pueden usar `WHERE sentiment = 'positive'` directamente
- 🚀 Índices sobre el campo `sentiment` funcionan correctamente
- 🔍 Más fácil filtrar y analizar

---

## 📋 **PASOS PARA APLICAR**

### **Paso 1: Actualizar Prompt en N8N**

1. Abre **Workflow 3 (Super Agent Híbrido)**
2. Ve al nodo **"🧠 Clasificar Intención"** (LangChain Agent)
3. Reemplaza el prompt con el contenido de:
   ```
   n8n/prompts/CLASIFICADOR-CON-SENTIMENT-MEJORADO.txt
   ```
4. Guarda el workflow

---

### **Paso 2: Ejecutar Migración en Supabase**

1. Abre **Supabase SQL Editor**
2. Copia y ejecuta:
   ```
   supabase/migrations/20251014_004_sync_sentiment_from_metadata.sql
   ```
3. Verifica que el trigger se creó:
   ```sql
   SELECT trigger_name, event_manipulation, event_object_table
   FROM information_schema.triggers
   WHERE trigger_name = 'trigger_sync_sentiment';
   ```

---

### **Paso 3: Probar con Mensajes Reales**

Envía estos mensajes de prueba vía WhatsApp:

#### **Test 1: Feedback Positivo**
```
"Increíble experiencia, todo perfecto. Volveremos pronto!"
```
**Esperado:**
- `intent`: "feedback"
- `sentiment`: "positive"
- `confidence`: >= 0.9

#### **Test 2: Queja**
```
"Muy decepcionado con el servicio, esperamos más de 40 minutos"
```
**Esperado:**
- `intent`: "queja"
- `sentiment`: "negative"
- `confidence`: >= 0.9

#### **Test 3: Consulta Neutra**
```
"Hola, ¿a qué hora cierran hoy?"
```
**Esperado:**
- `intent`: "consultar"
- `sentiment`: "neutral"
- `confidence`: >= 0.9

---

### **Paso 4: Verificar en Base de Datos**

```sql
-- Ver últimas conversaciones con sentiment sincronizado
SELECT 
  id,
  interaction_type,
  sentiment,                                        -- ✅ Debería estar lleno
  metadata->'classification'->>'sentiment' as sentiment_metadata,
  metadata->'classification'->>'confidence' as confidence,
  customer_name,
  created_at
FROM agent_conversations
WHERE restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

---

## 📊 **IMPACTO EN ANALYTICS**

Ahora las queries de NPS funcionarán correctamente:

```sql
-- NPS basado en sentiment (ahora funcionará)
SELECT 
  COUNT(*) FILTER (WHERE sentiment = 'positive') as promotores,
  COUNT(*) FILTER (WHERE sentiment = 'negative') as detractores,
  COUNT(*) as total
FROM agent_conversations
WHERE interaction_type = 'feedback'
  AND created_at >= CURRENT_DATE - INTERVAL '7 days';
```

---

## ✅ **RESULTADO ESPERADO**

### **Antes:**
```json
{
  "sentiment": null,              // ❌
  "confidence": 0.5,              // ❌
  "metadata": {
    "classification": {
      "sentiment": "neutral"      // ❌ Mal clasificado
    }
  }
}
```

### **Después:**
```json
{
  "sentiment": "positive",        // ✅ Sincronizado desde metadata
  "confidence": 0.95,             // ✅ Alta confianza
  "metadata": {
    "classification": {
      "sentiment": "positive"     // ✅ Bien clasificado
    }
  }
}
```

---

## 🎯 **CHECKLIST FINAL**

- [ ] Prompt actualizado en Workflow 3
- [ ] Migración ejecutada en Supabase
- [ ] Trigger verificado (`trigger_sync_sentiment` existe)
- [ ] Test de feedback positivo → `sentiment = 'positive'`
- [ ] Test de queja → `sentiment = 'negative'`
- [ ] Test de consulta → `sentiment = 'neutral'`
- [ ] Query de NPS devuelve datos correctos

---

**Una vez completado, el sistema de feedback estará 100% funcional.** 🚀

