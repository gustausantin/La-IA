# 🎙️ INSTRUCCIONES: CONFIGURAR BAPI PARA LA-IA APP

**Fecha:** 25 de Octubre 2025  
**Versión:** 1.0  
**Estado:** ✅ LISTO PARA IMPLEMENTAR

---

## 📋 ÍNDICE

1. [Resumen](#resumen)
2. [Prerequisitos](#prerequisitos)
3. [Paso 1: Importar Workflow en n8n](#paso-1-importar-workflow-en-n8n)
4. [Paso 2: Configurar BAPI](#paso-2-configurar-bapi)
5. [Paso 3: Configurar Tools en BAPI](#paso-3-configurar-tools-en-bapi)
6. [Paso 4: Testing](#paso-4-testing)
7. [Troubleshooting](#troubleshooting)

---

## 🎯 RESUMEN

Este documento explica cómo integrar **BAPI** (Bland AI) como el cerebro de voz para La-IA App.

**Arquitectura:**
```
Cliente llama → BAPI (cerebro) → n8n (contexto dinámico) → BAPI usa Tools
```

**Lo que hace n8n:**
- ✅ Proporciona contexto dinámico del restaurante
- ✅ Proporciona contexto del cliente
- ✅ Expone tools (check_availability, create_reservation, etc.)

**Lo que hace BAPI:**
- ✅ STT (speech-to-text)
- ✅ LLM (GPT-4o como cerebro conversacional)
- ✅ TTS (text-to-speech)
- ✅ Gestión de la llamada

---

## ⚙️ PREREQUISITOS

### **1. n8n Accesible Públicamente**
```
https://tu-dominio-n8n.com
```

### **2. Cuenta BAPI (Bland AI)**
```
https://app.bland.ai
```

### **3. Supabase Configurado**
- Tabla `restaurants` con columna `channels` JSONB
- Estructura: `channels.voice.phone_number`

### **4. Twilio Voice Number**
- Número comprado en Twilio
- Configurado en `restaurants.channels.voice.phone_number`

---

## 📥 PASO 1: IMPORTAR WORKFLOW EN N8N

### **1.1. Importar el Workflow**

1. Ve a n8n
2. Click en **"Import from File"**
3. Selecciona: `n8n/workflows/BAPI-Voice-Gateway-FINAL.json`
4. Click **"Import"**

### **1.2. Verificar Credenciales**

El workflow usa estas credenciales:
- ✅ **Supabase API** (ya configuradas)

Si no están, añádelas:
1. Settings → Credentials
2. Add Credential → Supabase
3. Completa:
   - **Host:** `ktsqwvhqamedpmzkzjaz.supabase.co`
   - **Service Role Key:** `[Tu Service Key]`

### **1.3. Activar el Workflow**

1. Abre el workflow importado
2. Click en **"Active: OFF"** (esquina superior derecha)
3. Cambia a **"Active: ON"**
4. ✅ El workflow está activo

### **1.4. Copiar la URL del Webhook**

1. Click en el nodo **"📞 Webhook BAPI"**
2. En el panel derecho, verás:
   ```
   Production URL: https://tu-n8n.com/webhook/bapi-voice-gateway
   ```
3. **Copia esta URL** (la necesitarás para BAPI)

---

## 🎙️ PASO 2: CONFIGURAR BAPI

### **2.1. Crear un Nuevo Agente en BAPI**

1. Ve a https://app.bland.ai
2. Click en **"Create New Agent"** o **"Pathways" → "Create Pathway"**
3. Nombre: `La-IA Voice Agent`

### **2.2. Configurar el Prompt**

1. En la sección **"System Prompt"** o **"Agent Instructions"**, pega el contenido de:
   ```
   n8n/prompts/PROMPT-BAPI-VOICE-AGENT-v1.txt
   ```

2. **IMPORTANTE:** BAPI usará variables dinámicas. El prompt ya está preparado con:
   ```
   {{ restaurant_name }}
   {{ agent_name }}
   {{ customer_name }}
   {{ horarios }}
   {{ zones_summary }}
   {{ customer_active_reservations_summary }}
   ```

### **2.3. Configurar el Webhook de Contexto (CRÍTICO)**

⚠️ **IMPORTANTE:** Configura que BAPI llame al webhook **ANTES del primer saludo**.

En BAPI, busca la sección **"Dynamic Data"** o **"Server URL"** o **"Knowledge Base"**:

1. **Server URL:** Pega la URL de n8n:
   ```
   https://tu-n8n.com/webhook/bapi-voice-gateway
   ```

2. **Method:** `POST`

3. **When to call:** `on_call_start` o `before_first_message`
   - ✅ Esto asegura que BAPI obtiene el contexto ANTES de saludar

4. **Headers:** (si es necesario)
   ```json
   {
     "Content-Type": "application/json"
   }
   ```

5. **Request Body Template:**
   ```json
   {
     "call": {
       "from": "{{call.from}}",
       "to": "{{call.to}}",
       "forwardedFrom": "{{call.forwardedFrom}}",
       "callSid": "{{call.callSid}}",
       "direction": "{{call.direction}}"
     },
     "timestamp": "{{timestamp}}"
   }
   ```

6. **Response Mapping:**
   - Asegúrate de que BAPI mapea las variables de la respuesta
   - `restaurant_name` → `{{ restaurant_name }}`
   - `agent_name` → `{{ agent_name }}`
   - `horarios` → `{{ horarios }}`
   - etc.

**Flujo correcto:**
```
1. Cliente llama
2. BAPI llama al webhook (obtiene contexto)
3. BAPI saluda: "¡Hola! Soy {{ agent_name }} del restaurante {{ restaurant_name }}"
```

### **2.4. Configurar la Voz**

1. **Provider:** OpenAI (recomendado) o ElevenLabs
2. **Voice:**
   - **Mujer:** `nova` (OpenAI) o `Rachel` (ElevenLabs)
   - **Hombre:** `onyx` (OpenAI) o `Adam` (ElevenLabs)
3. **Speed:** 1.0 (normal)
4. **Stability:** 0.75 (recomendado)

### **2.5. Configurar el Número de Teléfono**

1. En BAPI, ve a **"Phone Numbers"**
2. Click en **"Add Number"** o **"Import from Twilio"**
3. Selecciona tu número de Twilio (ej. `+34931234567`)
4. Asigna este número al agente que acabas de crear

---

## 🛠️ PASO 3: CONFIGURAR TOOLS EN BAPI

BAPI necesita saber qué tools (herramientas) puede usar. Estas tools son webhooks adicionales que debes crear en n8n.

### **3.1. Tools Necesarias**

Debes crear 5 workflows adicionales en n8n (o usar los existentes):

| **Tool** | **Workflow Existente** | **Endpoint** |
|----------|------------------------|--------------|
| `check_availability` | `01-check-availability-OPTIMIZADO.json` | `/webhook/check-availability` |
| `create_reservation` | `TOOL-create-reservation-FINAL-COMPLETO.json` | `/webhook/create-reservation` |
| `cancel_reservation` | `TOOL-cancel-reservation.json` | `/webhook/cancel-reservation` |
| `consultar_informacion_restaurante` | `TOOL-consultar-info.json` (crear) | `/webhook/consultar-info` |
| `escalate_to_human` | `TOOL-escalate.json` (existente) | `/webhook/escalate-to-human` |

### **3.2. Configurar Tools en BAPI**

En BAPI, ve a la sección **"Tools"** o **"Functions"**:

#### **Tool 1: check_availability**

```json
{
  "name": "check_availability",
  "description": "Verifica la disponibilidad de mesas para una fecha, hora y número de personas específicos. SIEMPRE úsala antes de crear una reserva.",
  "parameters": {
    "type": "object",
    "properties": {
      "date": {
        "type": "string",
        "description": "Fecha en formato YYYY-MM-DD (ej. 2025-10-26)"
      },
      "time": {
        "type": "string",
        "description": "Hora en formato HH:MM (24h, ej. 20:00)"
      },
      "party_size": {
        "type": "integer",
        "description": "Número de personas"
      },
      "preferred_zone": {
        "type": "string",
        "description": "Zona preferida: 'interior', 'terraza', 'barra', 'privado', o 'any'"
      },
      "restaurant_id": {
        "type": "string",
        "description": "ID del restaurante (usar variable {{ restaurant_id }})"
      }
    },
    "required": ["date", "time", "party_size", "restaurant_id"]
  },
  "url": "https://tu-n8n.com/webhook/check-availability",
  "method": "POST"
}
```

#### **Tool 2: create_reservation**

```json
{
  "name": "create_reservation",
  "description": "Crea una nueva reserva. SOLO úsala después de verificar disponibilidad y confirmación del cliente.",
  "parameters": {
    "type": "object",
    "properties": {
      "restaurant_id": {
        "type": "string",
        "description": "ID del restaurante (usar {{ restaurant_id }})"
      },
      "customer_id": {
        "type": "string",
        "description": "ID del cliente (usar {{ customer_id }})"
      },
      "customer_phone": {
        "type": "string",
        "description": "Teléfono del cliente (usar {{ customer_phone }})"
      },
      "customer_name": {
        "type": "string",
        "description": "Nombre del cliente (usar {{ customer_name }})"
      },
      "reservation_date": {
        "type": "string",
        "description": "Fecha YYYY-MM-DD"
      },
      "reservation_time": {
        "type": "string",
        "description": "Hora HH:MM"
      },
      "party_size": {
        "type": "integer",
        "description": "Número de personas"
      },
      "preferred_zone": {
        "type": "string",
        "description": "Zona: 'interior', 'terraza', 'barra', 'privado'"
      },
      "special_requests": {
        "type": "string",
        "description": "Peticiones especiales (opcional)"
      },
      "source": {
        "type": "string",
        "description": "Siempre usar 'agent_voice'"
      }
    },
    "required": ["restaurant_id", "customer_id", "customer_phone", "customer_name", "reservation_date", "reservation_time", "party_size", "source"]
  },
  "url": "https://tu-n8n.com/webhook/create-reservation",
  "method": "POST"
}
```

#### **Tool 3: cancel_reservation**

```json
{
  "name": "cancel_reservation",
  "description": "Cancela una reserva existente. Usa el ID de la reserva activa del cliente.",
  "parameters": {
    "type": "object",
    "properties": {
      "reservation_id": {
        "type": "string",
        "description": "ID de la reserva a cancelar (usar de reservas_activas)"
      },
      "cancellation_reason": {
        "type": "string",
        "description": "Motivo de cancelación"
      },
      "restaurant_id": {
        "type": "string",
        "description": "ID del restaurante (usar {{ restaurant_id }})"
      }
    },
    "required": ["reservation_id", "restaurant_id"]
  },
  "url": "https://tu-n8n.com/webhook/cancel-reservation",
  "method": "POST"
}
```

#### **Tool 4: consultar_informacion_restaurante**

```json
{
  "name": "consultar_informacion_restaurante",
  "description": "Busca información del restaurante (menú, servicios, precios, políticas). Úsala cuando el cliente pregunte por información que no tienes en el contexto.",
  "parameters": {
    "type": "object",
    "properties": {
      "restaurant_id": {
        "type": "string",
        "description": "ID del restaurante (usar {{ restaurant_id }})"
      },
      "query": {
        "type": "string",
        "description": "Pregunta en lenguaje natural (ej. '¿Qué vinos tenéis?')"
      }
    },
    "required": ["restaurant_id", "query"]
  },
  "url": "https://tu-n8n.com/webhook/consultar-info",
  "method": "POST"
}
```

#### **Tool 5: escalate_to_human**

```json
{
  "name": "escalate_to_human",
  "description": "Escala la conversación a un humano. Úsala si el cliente lo pide explícitamente o si hay una queja grave.",
  "parameters": {
    "type": "object",
    "properties": {
      "restaurant_id": {
        "type": "string",
        "description": "ID del restaurante (usar {{ restaurant_id }})"
      },
      "customer_phone": {
        "type": "string",
        "description": "Teléfono del cliente (usar {{ customer_phone }})"
      },
      "customer_name": {
        "type": "string",
        "description": "Nombre del cliente (usar {{ customer_name }})"
      },
      "reason": {
        "type": "string",
        "description": "Motivo del escalado"
      },
      "urgency": {
        "type": "string",
        "description": "'high', 'medium', o 'low'"
      },
      "customer_message": {
        "type": "string",
        "description": "Último mensaje del cliente"
      }
    },
    "required": ["restaurant_id", "customer_phone", "reason"]
  },
  "url": "https://tu-n8n.com/webhook/escalate-to-human",
  "method": "POST"
}
```

---

## ✅ PASO 4: TESTING

### **4.1. Test del Webhook de Contexto**

Puedes probar el webhook directamente con Postman o curl:

```bash
curl -X POST https://tu-n8n.com/webhook/bapi-voice-gateway \
  -H "Content-Type: application/json" \
  -d '{
    "call": {
      "from": "+34671126148",
      "to": "+34931234567",
      "callSid": "CA123",
      "direction": "inbound"
    },
    "messages": [],
    "timestamp": "2025-10-25T10:00:00Z"
  }'
```

**Respuesta esperada:**
```json
{
  "restaurant_id": "uuid",
  "restaurant_name": "Nombre Restaurante",
  "agent_name": "María",
  "agent_gender": "female",
  "horarios": "Lun: 18:00-23:00, Mar: CERRADO...",
  "zonas_disponibles": [...],
  "politicas": {...},
  "customer_id": "uuid",
  "customer_name": "Gustau",
  "customer_phone": "+34671126148",
  "reservas_activas": [...]
}
```

### **4.2. Test de Llamada Real**

1. Llama al número de Twilio configurado en BAPI
2. Verifica que BAPI responde con el saludo
3. Intenta hacer una reserva de prueba:
   - "Quiero reservar para 4 personas mañana a las 20:00"
4. Verifica que:
   - ✅ BAPI llama a `check_availability`
   - ✅ BAPI confirma disponibilidad
   - ✅ BAPI llama a `create_reservation`
   - ✅ La reserva se crea en Supabase

### **4.3. Verificar en Supabase**

1. Ve a Supabase → Table Editor → `reservations`
2. Verifica que la reserva se creó con:
   - `source` = `agent_voice`
   - `customer_phone` = tu número
   - `status` = `pending`

---

## 🚨 TROUBLESHOOTING

### **Problema 1: "Restaurante no encontrado"**

**Causa:** El teléfono de `call.to` no coincide con `channels.voice.phone_number` en Supabase.

**Solución:**
1. Ve a Supabase → `restaurants`
2. Verifica que `channels` tiene esta estructura:
   ```json
   {
     "voice": {
       "phone_number": "+34931234567",
       "enabled": true
     }
   }
   ```
3. El teléfono **DEBE incluir** el `+` y el código de país

---

### **Problema 2: "Cliente no se crea"**

**Causa:** Error en la tabla `customers` (constraint UNIQUE).

**Solución:**
1. Verifica que `customers` tiene índice UNIQUE en `(phone, restaurant_id)`
2. Si el cliente ya existe, debería encontrarlo (no crear duplicado)

---

### **Problema 3: "check_availability no responde"**

**Causa:** El webhook de la tool no está activo o la URL es incorrecta.

**Solución:**
1. Ve a n8n → Workflow `01-check-availability-OPTIMIZADO`
2. Verifica que está **Active: ON**
3. Copia la Production URL y actualízala en BAPI

---

### **Problema 4: "BAPI no llama a las tools"**

**Causa:** Las tools no están configuradas correctamente en BAPI.

**Solución:**
1. Verifica que cada tool tiene:
   - ✅ `name` correcto
   - ✅ `description` clara
   - ✅ `parameters` bien definidos
   - ✅ `url` correcta
   - ✅ `method` = `POST`
2. Asegúrate de que el prompt usa los nombres exactos de las tools

---

### **Problema 5: "Variables no se reemplazan"**

**Causa:** BAPI no está recibiendo el contexto correctamente.

**Solución:**
1. Verifica que el webhook de contexto devuelve todas las variables
2. En BAPI, asegúrate de que las variables están en el formato correcto:
   - ✅ `{{ restaurant_name }}`
   - ❌ `$json.restaurant_name`

---

## 📊 CHECKLIST FINAL

Antes de lanzar a producción:

- [ ] Workflow `BAPI-Voice-Gateway-FINAL` importado y activo
- [ ] Credenciales de Supabase configuradas
- [ ] Webhook URL copiada y configurada en BAPI
- [ ] Prompt de BAPI configurado
- [ ] Voz seleccionada en BAPI
- [ ] Número de Twilio asignado al agente
- [ ] 5 Tools configuradas en BAPI
- [ ] Test de webhook exitoso
- [ ] Test de llamada real exitoso
- [ ] Reserva de prueba creada en Supabase
- [ ] `channels.voice.phone_number` configurado en TODOS los restaurantes

---

## 🎯 PRÓXIMOS PASOS

Una vez configurado:

1. **Monitoreo:** Revisa logs de n8n para ver las llamadas
2. **Optimización:** Ajusta el prompt según feedback real
3. **Escalado:** Añade más restaurantes configurando `channels.voice.phone_number`

---

**Fecha:** 25 Octubre 2025  
**Autor:** La-IA App Team  
**Estado:** ✅ LISTO PARA PRODUCCIÓN

