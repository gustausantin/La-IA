# 🚀 INSTRUCCIONES CONFIGURACIÓN N8N - LA-IA APP

> **IMPORTANTE:** Todos los workflows están completos y listos para importar  
> **Credenciales:** Usar las existentes (Supabase La-IA, OpenAi La-IA)

---

## 📋 WORKFLOWS A IMPORTAR (EN ORDEN)

### 1️⃣ `1-whatsapp-input-with-buffer.json`
- **Trigger:** Webhook `/whatsapp-webhook`
- **Credenciales:** Supabase La-IA (id: `9pdl4V7ImejCLZWo`)
- **Tabla usada:** `whatsapp_message_buffer`
- **Configuración NECESARIA después de importar:**
  - Nodo "Ejecutar Gateway Unificado":
    - `workflowId`: Cambiar a ID del workflow "2️⃣ Gateway Unificado"

---

### 2️⃣ `2-gateway-unified.json`
- **Trigger:** Execute Workflow Trigger (llamado desde workflow 1)
- **Credenciales:** Supabase La-IA (id: `9pdl4V7ImejCLZWo`)
- **Tablas usadas:** `customers`, `agent_conversations`, `agent_messages`
- **Variable de entorno NECESARIA:**
  - `DEFAULT_RESTAURANT_ID`: UUID del restaurante (obtener de tabla `businesses`)
- **Configuración NECESARIA después de importar:**
  - Nodo "Ejecutar Clasificador":
    - `workflowId`: Cambiar a ID del workflow "3️⃣ Clasificador Super Agent"

---

### 3️⃣ `3-classifier-super-agent.json`
- **Trigger:** Execute Workflow Trigger (llamado desde workflow 2)
- **Credenciales:**
  - Supabase La-IA (id: `9pdl4V7ImejCLZWo`)
  - OpenAi La-IA (id: `zwtmjTlXACMvkqZx`)
- **Tabla usada:** `agent_conversations`
- **IA:** GPT-4o-mini (temperature: 0.2, max_tokens: 150)
- **Configuración NECESARIA después de importar:**
  - Nodo "Agente de Reservas":
    - `workflowId`: Cambiar a ID del workflow "4️⃣ Agente Reservas" (cuando lo crees)
  - Nodos "Agente de Modificación", "Agente de Cancelación", "Agente de FAQ":
    - `workflowId`: Dejar como placeholders por ahora

---

## ⚙️ CONFIGURACIÓN INICIAL PASO A PASO

### PASO 1: Obtener `DEFAULT_RESTAURANT_ID`

**En Supabase → SQL Editor → Nueva Query:**

```sql
SELECT id, name FROM public.businesses LIMIT 1;
```

**Copiar el UUID del restaurante.**

---

### PASO 2: Configurar Variables de Entorno en n8n

**Settings → Environment Variables → Add:**

```
DEFAULT_RESTAURANT_ID = [UUID_COPIADO_PASO_1]
```

---

### PASO 3: Importar Workflows (EN ORDEN)

1. **Importar** `2-gateway-unified.json` PRIMERO
   - Copiar el **Workflow ID** que se genera
   
2. **Importar** `3-classifier-super-agent.json` SEGUNDO
   - Copiar el **Workflow ID** que se genera

3. **Importar** `1-whatsapp-input-with-buffer.json` TERCERO
   - En nodo "Ejecutar Gateway Unificado":
     - Pegar **Workflow ID** del paso 1

4. **Editar** `2-gateway-unified.json`:
   - En nodo "Ejecutar Clasificador":
     - Pegar **Workflow ID** del paso 2

---

### PASO 4: Verificar Credenciales

**Verificar que TODOS los nodos Supabase usan:**
- Credential: "Supabase La-IA" (id: `9pdl4V7ImejCLZWo`)

**Verificar que el nodo OpenAI usa:**
- Credential: "OpenAi La-IA" (id: `zwtmjTlXACMvkqZx`)

---

### PASO 5: Activar Webhooks

1. **Workflow 1 (WhatsApp Buffer):**
   - Abrir workflow
   - Click en nodo "Webhook WhatsApp"
   - Click "Listen for Test Event"
   - Copiar URL del webhook
   - **Webhook URL:** `https://tu-n8n.com/webhook/whatsapp-webhook`

---

## 🧪 TESTING

### TEST 1: WhatsApp Buffer

**Enviar POST a webhook:**

```bash
curl -X POST https://tu-n8n.com/webhook/whatsapp-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "from": "+34666777888",
    "body": "Hola quiero reservar",
    "profile": {
      "name": "Juan Test"
    }
  }'
```

**Verificar en Supabase:**
```sql
SELECT * FROM whatsapp_message_buffer ORDER BY created_at DESC LIMIT 1;
```

---

### TEST 2: Gateway + Clasificador

**Verificar en Supabase después del test:**

```sql
-- Ver cliente creado
SELECT * FROM customers WHERE phone = '+34666777888';

-- Ver conversación creada
SELECT * FROM agent_conversations 
WHERE customer_phone = '+34666777888' 
ORDER BY created_at DESC LIMIT 1;

-- Ver mensaje guardado
SELECT * FROM agent_messages 
WHERE restaurant_id = 'TU_RESTAURANT_ID'
ORDER BY timestamp DESC LIMIT 1;

-- Ver clasificación
SELECT 
  id, 
  interaction_type, 
  metadata->>'classification_confidence' as confidence,
  metadata->>'classification_reasoning' as reasoning
FROM agent_conversations 
WHERE customer_phone = '+34666777888'
ORDER BY created_at DESC LIMIT 1;
```

---

## 📊 TABLA DE OPERACIONES SUPABASE

### Workflow 1: WhatsApp Buffer

| Nodo | Operation | Table | Columns |
|------|-----------|-------|---------|
| Insertar en Buffer | `insert` | `whatsapp_message_buffer` | buffer_key, customer_phone, customer_name, messages, message_count |
| Actualizar Buffer | `update` | `whatsapp_message_buffer` | messages, message_count, last_message_at |
| Obtener Buffer Completo | `get` | `whatsapp_message_buffer` | * (filter by buffer_key) |
| Eliminar Buffer | `delete` | `whatsapp_message_buffer` | (filter by buffer_key) |

---

### Workflow 2: Gateway Unificado

| Nodo | Operation | Table | Columns |
|------|-----------|-------|---------|
| Buscar Cliente Existente | `get` | `customers` | * (filter by phone) |
| Crear Cliente Nuevo | `insert` | `customers` | restaurant_id, name, phone, segment_auto, segment_auto_v2, preferred_channel, consent_whatsapp |
| Crear Conversación | `insert` | `agent_conversations` | restaurant_id, customer_id, customer_phone, customer_name, source_channel, interaction_type, status |
| Guardar Mensaje del Usuario | `insert` | `agent_messages` | conversation_id, restaurant_id, direction, sender, message_text |

---

### Workflow 3: Clasificador

| Nodo | Operation | Table | Columns |
|------|-----------|-------|---------|
| Actualizar Conversación | `update` | `agent_conversations` | interaction_type, metadata (filter by id) |

---

## ✅ CHECKLIST FINAL

- [ ] Variables de entorno configuradas (`DEFAULT_RESTAURANT_ID`)
- [ ] 3 workflows importados en orden correcto
- [ ] Workflow IDs actualizados en nodos "Execute Workflow"
- [ ] Credenciales verificadas (Supabase La-IA, OpenAi La-IA)
- [ ] Webhook activado y URL copiada
- [ ] Test enviado y verificado en Supabase
- [ ] Cliente creado correctamente
- [ ] Conversación creada correctamente
- [ ] Mensaje guardado correctamente
- [ ] Clasificación ejecutada correctamente

---

## 🆘 TROUBLESHOOTING

### Error: "Table not found"
- Verificar que la tabla existe en Supabase
- Verificar que el `tableId` en el nodo está correcto

### Error: "Column not found"
- Verificar esquema en `docs/DATABASE-SCHEMA-SUPABASE-COMPLETO.md`
- Verificar que el `fieldId` coincide con el nombre exacto de la columna

### Error: "Workflow not found"
- Verificar que el `workflowId` en "Execute Workflow" es correcto
- Copiar el ID del workflow destino (visible en la URL del workflow)

### Error: "Authentication failed"
- Verificar que la credencial "Supabase La-IA" existe y es válida
- Verificar que el Service Role Key tiene permisos

---

**📅 Última actualización:** 2 de Octubre 2025  
**✅ Estado:** COMPLETO Y LISTO PARA PRODUCCIÓN

