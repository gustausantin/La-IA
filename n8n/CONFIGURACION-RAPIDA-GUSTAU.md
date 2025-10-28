# 🚀 CONFIGURACIÓN RÁPIDA - Gustau

**Para:** Gustau Santín  
**N8N Cloud:** gustausantin.app.n8n.cloud  
**Fecha:** 03 Octubre 2025

---

## ⚡ PASO 1: OBTENER TU RESTAURANT_ID

```sql
-- Ejecutar en Supabase SQL Editor:
SELECT id, name FROM businesses LIMIT 1;
```

**Copia el UUID completo** (ejemplo: `a1b2c3d4-e5f6-...`)

---

## ⚡ PASO 2: CONFIGURAR WORKFLOW 1

1. Abre el Workflow **"1️⃣ WhatsApp Input → Buffer"**
2. Click en el nodo **"Config"** (segundo nodo después del Webhook)
3. En el campo `restaurant_id`, **reemplaza** `'REEMPLAZAR_CON_TU_RESTAURANT_ID'` con tu UUID:

```javascript
// ANTES:
value: "={{ $json.restaurant_id || 'REEMPLAZAR_CON_TU_RESTAURANT_ID' }}"

// DESPUÉS (ejemplo):
value: "={{ $json.restaurant_id || 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }}"
```

4. **Guardar** (Save)

---

## ⚡ PASO 3: TEST CON TWILIO

### **Tu mensaje recibido:**
```json
{
  "From": "whatsapp:+34671126148",
  "ProfileName": "Gustau",
  "Body": "Hola"
}
```

### **Test desde N8N:**

1. Click en el nodo **"Webhook WhatsApp"**
2. Click en **"Listen for Test Event"**
3. Envía un WhatsApp desde tu móvil (+34671126148) al número de Twilio
4. N8N capturará el mensaje
5. Click en **"Execute Node"** para procesar

### **Resultado esperado:**

El nodo **"Normalizar Datos"** debe producir:

```json
{
  "buffer_key": "+34671126148_1696329000000",
  "customer_phone": "+34671126148",
  "customer_name": "Gustau",
  "message_text": "Hola",
  "restaurant_id": "tu-restaurant-id-aqui",
  "timestamp": "2025-10-03T...",
  "raw_data": { ... }
}
```

---

## ⚡ PASO 4: VERIFICAR EN SUPABASE

Después de enviar el mensaje y esperar 10 segundos:

```sql
-- 1. Verificar que el buffer se vació (debe estar vacío)
SELECT * FROM whatsapp_message_buffer 
WHERE customer_phone = '+34671126148';

-- 2. Verificar cliente creado/actualizado
SELECT * FROM customers 
WHERE phone = '+34671126148';

-- 3. Verificar conversación creada
SELECT * FROM agent_conversations 
WHERE customer_phone = '+34671126148'
ORDER BY created_at DESC LIMIT 1;

-- 4. Verificar mensaje guardado
SELECT am.* 
FROM agent_messages am
JOIN agent_conversations ac ON am.conversation_id = ac.id
WHERE ac.customer_phone = '+34671126148'
ORDER BY am.timestamp DESC LIMIT 1;
```

---

## ⚠️ PROBLEMAS COMUNES

### **Error: "access to env vars denied"**
✅ **SOLUCIONADO** - Ahora usa nodo "Config" en lugar de `$env`

### **Error: "Cannot read property 'ProfileName' of undefined"**
**Causa:** El webhook de Twilio envía datos en `body`

**Solución:** Ya está solucionado en el código actualizado:
```javascript
const body = data.body || data;
const customerName = body.ProfileName || body.profile?.name || 'Cliente';
```

### **Error: "restaurant_id" is null**
**Causa:** No configuraste el UUID en el nodo Config

**Solución:** Ve al **PASO 2** arriba

---

## 📊 DEBUGGING

### **Ver logs en N8N:**

1. Click en cualquier nodo ejecutado
2. Ve a la pestaña **"Input/Output"**
3. Revisa los datos que entran y salen

### **Ver console.log en Code nodes:**

Los `console.log()` en los nodos Code aparecen en:
- N8N Cloud: Pestaña **"Executions"** → Click en la ejecución → **"View execution"**
- En la pestaña de debugging del navegador

---

## 🎯 SIGUIENTE PASO

Una vez que funcione el Workflow 1 y veas datos en Supabase:

1. Workflow 2 (Gateway) se ejecutará automáticamente
2. Workflow 3 (Clasificador) clasificará tu mensaje "Hola" como `saludo_inicial`
3. Verás en `agent_conversations.interaction_type` el resultado

---

## 📞 CONTACTO RÁPIDO

Si algo falla, revisa:

1. ✅ Tabla `whatsapp_message_buffer` existe en Supabase
2. ✅ Credenciales "Supabase La-IA" configuradas
3. ✅ `restaurant_id` configurado en nodo Config
4. ✅ Workflow está **Active** (toggle arriba)
5. ✅ Webhook URL de Twilio apunta a tu n8n cloud

---

*Última actualización: 03 Octubre 2025*  
*N8N Cloud: gustausantin.app.n8n.cloud*

