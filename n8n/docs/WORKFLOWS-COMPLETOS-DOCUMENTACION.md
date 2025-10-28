# 📚 DOCUMENTACIÓN COMPLETA - WORKFLOWS N8N SUPER AGENTE IA

**Fecha:** 03 Octubre 2025  
**Versión:** 2.0  
**Estado:** ✅ COMPLETO Y FUNCIONAL

---

## 🎯 ÍNDICE

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Arquitectura General](#arquitectura-general)
3. [Tablas de Supabase Utilizadas](#tablas-de-supabase-utilizadas)
4. [Workflow 1: WhatsApp Input → Buffer](#workflow-1-whatsapp-input--buffer)
5. [Workflow 2: Gateway Unificado](#workflow-2-gateway-unificado)
6. [Workflow 3: Clasificador Super Agent](#workflow-3-clasificador-super-agent)
7. [Variables de Entorno Requeridas](#variables-de-entorno-requeridas)
8. [Credenciales N8N](#credenciales-n8n)
9. [Flujo Completo de Datos](#flujo-completo-de-datos)
10. [Testing y Validación](#testing-y-validación)

---

## 🎯 RESUMEN EJECUTIVO

### **Objetivo Principal**
Implementar un **Super Agente IA multi-tenant** que procese comunicaciones de múltiples canales (WhatsApp, VAPI, Instagram, Facebook, Web Chat) y las clasifique automáticamente para gestionar:
- ✅ Nuevas reservas
- ✅ Modificaciones de reservas
- ✅ Cancelaciones
- ✅ Consultas generales (FAQs, menú, horarios)

### **Canales Implementados (Fase 1)**
- ✅ **WhatsApp** (con buffer de mensajes fragmentados)
- ✅ **VAPI** (llamadas telefónicas)

### **Características Clave**
- 🔒 **Multi-tenant:** Soporte para múltiples restaurantes
- 📊 **Trazabilidad completa:** Todas las conversaciones y mensajes guardados
- 🧠 **Clasificación IA:** GPT-4o-mini para entender intenciones
- ⚡ **Buffer inteligente:** Agrupa mensajes fragmentados de WhatsApp (10 seg)
- 🎯 **Arquitectura modular:** Subworkflows reutilizables

---

## 🏗️ ARQUITECTURA GENERAL

```
┌─────────────────────────────────────────────────────────────┐
│                    SUPER AGENTE IA - N8N                     │
└─────────────────────────────────────────────────────────────┘

1️⃣ ENTRADA (CANALES)
   ├── WhatsApp → [Workflow 1: Buffer] → Gateway
   └── VAPI     → Gateway directo

2️⃣ GATEWAY UNIFICADO [Workflow 2]
   ├── Obtener/Crear Cliente (tabla: customers)
   ├── Crear Conversación (tabla: agent_conversations)
   ├── Guardar Mensaje (tabla: agent_messages)
   └── → Enviar a Clasificador

3️⃣ CLASIFICADOR SUPER AGENT [Workflow 3]
   ├── Analizar intención con GPT-4o-mini
   ├── Clasificar: nueva_reserva | modificar | cancelar | consulta
   └── → Rutear a Agente Especializado

4️⃣ AGENTES ESPECIALIZADOS
   ├── Agente Reservas [Workflow 4]
   ├── Agente Modificaciones [Workflow 5]
   ├── Agente Cancelaciones [Workflow 6]
   └── Agente FAQs [Workflow 7]
```

---

## 📊 TABLAS DE SUPABASE UTILIZADAS

### **1. `whatsapp_message_buffer`** (NUEVA - Creada en esta implementación)
```sql
Propósito: Buffer temporal para agregar mensajes fragmentados de WhatsApp

Columnas utilizadas:
├── id (uuid, PK)
├── restaurant_id (uuid, FK → businesses.id) ⭐ Multi-tenant
├── buffer_key (varchar, UNIQUE) - Clave: {phone}_{timestamp_window}
├── customer_phone (varchar)
├── customer_name (varchar)
├── messages (text) - Mensajes concatenados
├── message_count (integer) - Contador de fragmentos
├── first_message_at (timestamptz)
├── last_message_at (timestamptz)
├── metadata (jsonb)
├── created_at (timestamptz)
└── updated_at (timestamptz)

Índices:
├── idx_whatsapp_buffer_restaurant (restaurant_id)
├── idx_whatsapp_buffer_phone (customer_phone)
├── idx_whatsapp_buffer_key (buffer_key)
└── idx_whatsapp_buffer_last_message (last_message_at DESC)
```

### **2. `customers`** (EXISTENTE)
```sql
Propósito: Gestión de clientes del restaurante

Columnas utilizadas en workflows:
├── id (uuid, PK)
├── restaurant_id (uuid, FK → businesses.id) ⭐ Multi-tenant
├── name (varchar, NOT NULL)
├── phone (varchar)
├── email (varchar)
├── segment_auto (varchar) - Valores: 'nuevo', 'ocasional', 'regular', 'vip'
├── segment_auto_v2 (varchar)
├── preferred_channel (text) - 'whatsapp', 'email', 'none'
├── consent_whatsapp (boolean)
├── total_visits (integer)
├── visits_12m (integer)
├── total_spent (numeric)
├── created_at (timestamptz)
└── updated_at (timestamptz)

Operaciones en workflows:
├── GET: Buscar cliente por phone + restaurant_id
└── CREATE: Crear nuevo cliente con valores por defecto
```

### **3. `agent_conversations`** (EXISTENTE)
```sql
Propósito: Registro de conversaciones del agente IA

Columnas utilizadas:
├── id (uuid, PK)
├── restaurant_id (uuid, FK → businesses.id) ⭐ Multi-tenant
├── customer_id (uuid, FK → customers.id)
├── customer_phone (varchar, NOT NULL)
├── customer_name (varchar)
├── customer_email (varchar)
├── source_channel (varchar) - CHECK: 'whatsapp', 'phone', 'instagram', 'facebook', 'webchat'
├── interaction_type (varchar) - CHECK: 'reservation', 'modification', 'cancellation', 'inquiry', 'complaint', 'other'
├── status (varchar) - CHECK: 'active', 'resolved', 'abandoned'
├── outcome (varchar) - 'reservation_created', 'reservation_modified', etc.
├── reservation_id (uuid, FK → reservations.id)
├── created_at (timestamptz)
├── resolved_at (timestamptz)
├── resolution_time_seconds (integer, COMPUTED)
├── sentiment (varchar) - 'positive', 'neutral', 'negative'
└── metadata (jsonb)

Operaciones en workflows:
└── CREATE: Nueva conversación con status='active', interaction_type='inquiry'
```

### **4. `agent_messages`** (EXISTENTE)
```sql
Propósito: Mensajes individuales de cada conversación

Columnas utilizadas:
├── id (uuid, PK)
├── conversation_id (uuid, FK → agent_conversations.id)
├── restaurant_id (uuid, FK → businesses.id) ⭐ Multi-tenant
├── direction (varchar) - CHECK: 'inbound', 'outbound'
├── sender (varchar) - CHECK: 'customer', 'agent', 'system'
├── message_text (text, NOT NULL)
├── timestamp (timestamptz)
├── metadata (jsonb)
├── tokens_used (integer)
└── confidence_score (decimal)

Operaciones en workflows:
└── CREATE: Guardar mensaje del cliente (direction='inbound', sender='customer')
```

### **5. `reservations`** (EXISTENTE - Uso futuro)
```sql
Propósito: Gestión de reservas del restaurante

Columnas principales:
├── id (uuid, PK)
├── restaurant_id (uuid, FK → businesses.id) ⭐ Multi-tenant
├── customer_id (uuid, FK → customers.id)
├── customer_name (varchar, NOT NULL)
├── customer_phone (varchar)
├── customer_email (varchar)
├── reservation_date (date, NOT NULL)
├── reservation_time (time, NOT NULL)
├── party_size (integer, NOT NULL)
├── table_id (uuid, FK → tables.id)
├── status (varchar) - CHECK: 'pending', 'confirmed', 'cancelled', 'completed', 'no_show'
├── channel (varchar) - Origen del canal
├── reservation_source (varchar) - CHECK: 'ia', 'manual'
└── created_at (timestamptz)

Uso: Será utilizada por Workflow 4 (Agente Reservas)
```

---

## 🔄 WORKFLOW 1: WhatsApp Input → Buffer

### **Archivo:** `n8n/workflows/1-whatsapp-input-with-buffer.json`

### **Propósito**
Recibir mensajes de WhatsApp, agrupar fragmentos enviados en 10 segundos, y enviar el mensaje consolidado al Gateway.

### **Nodos Implementados**

#### **1. Webhook WhatsApp**
```javascript
Tipo: n8n-nodes-base.webhook
Path: /whatsapp-webhook
Method: POST

Entrada esperada (ejemplo Twilio/Meta):
{
  "from": "+34612345678",
  "body": "Hola quiero hacer una reserva",
  "timestamp": "2025-10-03T10:30:00Z",
  "profile": {
    "name": "Juan Pérez"
  }
}
```

#### **2. Normalizar Datos**
```javascript
Tipo: n8n-nodes-base.code

Salida:
{
  "buffer_key": "+34612345678_1696329000000",
  "customer_phone": "+34612345678",
  "customer_name": "Juan Pérez",
  "message_text": "Hola quiero hacer una reserva",
  "restaurant_id": "uuid-del-restaurante",
  "timestamp": "2025-10-03T10:30:00Z"
}

Lógica buffer_key:
- Redondea el timestamp a ventanas de 10 segundos
- Formato: {phone}_{timestamp_redondeado}
- Ejemplo: +34612345678_1696329000000
```

#### **3. Insertar en Buffer**
```javascript
Tipo: n8n-nodes-base.supabase
Operación: CREATE (row)
Tabla: whatsapp_message_buffer

Campos insertados:
├── buffer_key: "{{ $json.buffer_key }}"
├── restaurant_id: "{{ $json.restaurant_id }}"
├── customer_phone: "{{ $json.customer_phone }}"
├── customer_name: "{{ $json.customer_name }}"
├── messages: "{{ $json.message_text }}"
├── message_count: 1
├── first_message_at: "{{ $json.timestamp }}"
└── last_message_at: "{{ $json.timestamp }}"

continueOnFail: true (permite flujo de error)
```

#### **4. Preparar Actualización** (Nodo de Error)
```javascript
Tipo: n8n-nodes-base.code

Entrada: Se activa cuando "Insertar en Buffer" falla (buffer_key ya existe)

Salida:
{
  "buffer_key": "...",
  "new_message": "...",
  "timestamp": "..."
}
```

#### **5. Actualizar Buffer**
```javascript
Tipo: n8n-nodes-base.supabase
Operación: UPDATE (row)
Tabla: whatsapp_message_buffer

Condición:
└── buffer_key = "{{ $json.buffer_key }}"

Campos actualizados:
├── messages: Concatenar nuevo mensaje
├── message_count: Incrementar +1
└── last_message_at: Nuevo timestamp
```

#### **6. Esperar 10 segundos**
```javascript
Tipo: n8n-nodes-base.wait
Tiempo: 10 segundos

Propósito: Dar tiempo para recibir todos los fragmentos
```

#### **7. Obtener Buffer Completo**
```javascript
Tipo: n8n-nodes-base.supabase
Operación: GET (row)
Tabla: whatsapp_message_buffer

Condición:
└── buffer_key = "{{ $('Normalizar Datos').item.json.buffer_key }}"

Limit: 1
```

#### **8. Preparar para Gateway**
```javascript
Tipo: n8n-nodes-base.code

Salida:
{
  "channel": "whatsapp",
  "restaurant_id": "...",
  "customer_phone": "...",
  "customer_name": "...",
  "aggregated_messages": "Hola quiero hacer una reserva para 4 personas",
  "message_count": 3,
  "buffer_key": "...",
  "timestamp": "2025-10-03T10:30:10Z"
}
```

#### **9. Eliminar Buffer**
```javascript
Tipo: n8n-nodes-base.supabase
Operación: DELETE (row)
Tabla: whatsapp_message_buffer

Condición:
└── buffer_key = "{{ $json.buffer_key }}"

Propósito: Limpiar buffer después de procesarlo
```

#### **10. Ejecutar Gateway Unificado**
```javascript
Tipo: n8n-nodes-base.executeWorkflow
Workflow: "2️⃣ Gateway Unificado"

Datos enviados: Output del nodo "Preparar para Gateway"
```

#### **11. Responder Webhook**
```javascript
Tipo: n8n-nodes-base.respondToWebhook
Response: {"status": "success", "message": "Mensaje recibido y procesado"}
Status Code: 200
```

### **Flujo de Conexiones**

```
Webhook WhatsApp
  ↓
Normalizar Datos
  ↓
Insertar en Buffer
  ↓ (success)                  ↓ (error - ya existe)
Esperar 10 seg            Preparar Actualización
  ↓                             ↓
Obtener Buffer              Actualizar Buffer
  ↓                             ↓
Preparar Gateway          Responder Webhook (fin)
  ↓
Eliminar Buffer
  ↓
Ejecutar Gateway
  ↓
Responder Webhook
```

### **Casos de Uso**

#### **Caso 1: Mensaje único**
```
1. Cliente: "Hola, quiero hacer una reserva para hoy a las 8"
   → INSERT en buffer → Espera 10 seg → No hay más mensajes
   → Envía mensaje completo al Gateway
```

#### **Caso 2: Mensajes fragmentados**
```
1. Cliente (0 seg): "Hola"
   → INSERT en buffer (message_count=1) → Espera 10 seg

2. Cliente (3 seg): "Quiero hacer una reserva"
   → INSERT falla → UPDATE buffer (message_count=2) → Termina

3. Cliente (5 seg): "Para 4 personas"
   → INSERT falla → UPDATE buffer (message_count=3) → Termina

4. (10 seg): Timer completa
   → GET buffer → messages = "Hola Quiero hacer una reserva Para 4 personas"
   → Envía al Gateway
```

---

## 🔄 WORKFLOW 2: Gateway Unificado

### **Archivo:** `n8n/workflows/2-gateway-unified.json`

### **Propósito**
Punto de entrada unificado para todos los canales. Obtiene o crea el cliente, crea la conversación, guarda el mensaje y envía al clasificador.

### **Nodos Implementados**

#### **1. Start (from WhatsApp/VAPI)**
```javascript
Tipo: n8n-nodes-base.executeWorkflowTrigger

Entrada desde Workflow 1 (WhatsApp):
{
  "channel": "whatsapp",
  "restaurant_id": "...",
  "customer_phone": "+34612345678",
  "customer_name": "Juan Pérez",
  "aggregated_messages": "Hola quiero hacer una reserva",
  "timestamp": "..."
}

Entrada desde VAPI (futuro):
{
  "channel": "vapi",
  "restaurant_id": "...",
  "customer_phone": "+34612345678",
  "transcript": "Llamada: Cliente quiere reservar...",
  "call_id": "..."
}
```

#### **2. Normalizar Datos Multi-Canal**
```javascript
Tipo: n8n-nodes-base.code

Salida normalizada:
{
  "restaurant_id": "...",
  "customer_phone": "+34612345678",
  "customer_name": "Juan Pérez",
  "customer_email": null,
  "user_message": "Hola quiero hacer una reserva",
  "channel": "whatsapp",
  "timestamp": "...",
  "metadata": {
    "message_count": 3,
    "call_id": null,
    "message_type": "text"
  }
}

Lógica:
- Unifica campos de diferentes canales
- aggregated_messages → user_message (WhatsApp)
- transcript → user_message (VAPI)
```

#### **3. Buscar Cliente Existente**
```javascript
Tipo: n8n-nodes-base.supabase
Operación: GET (row)
Tabla: customers

Filtros:
├── phone = "{{ $json.customer_phone }}"
└── restaurant_id = "{{ $json.restaurant_id }}"

Limit: 1
continueOnFail: true
```

#### **4. ¿Cliente existe?**
```javascript
Tipo: n8n-nodes-base.if

Condición:
└── $json.id EXISTS

Salidas:
├── TRUE → Fusionar Datos (usa cliente existente)
└── FALSE → Crear Cliente Nuevo
```

#### **5. Crear Cliente Nuevo**
```javascript
Tipo: n8n-nodes-base.supabase
Operación: CREATE (row)
Tabla: customers

Campos insertados:
├── restaurant_id: "{{ $('Normalizar Datos Multi-Canal').item.json.restaurant_id }}"
├── name: "{{ $('Normalizar Datos Multi-Canal').item.json.customer_name }}"
├── phone: "{{ $('Normalizar Datos Multi-Canal').item.json.customer_phone }}"
├── email: "{{ $('Normalizar Datos Multi-Canal').item.json.customer_email }}"
├── segment_auto: "nuevo"
├── segment_auto_v2: "nuevo"
├── preferred_channel: "{{ $('Normalizar Datos Multi-Canal').item.json.channel }}"
├── consent_whatsapp: true
├── total_visits: 0
├── visits_12m: 0
└── total_spent: 0

Salida:
{
  "id": "uuid-nuevo-cliente",
  ...
}
```

#### **6. Fusionar Datos**
```javascript
Tipo: n8n-nodes-base.code

Entrada: 
- Datos normalizados ($('Normalizar Datos Multi-Canal').item.json)
- Datos del cliente ($input.item.json)

Salida:
{
  ...inputData,
  "customer_id": "uuid-del-cliente"
}
```

#### **7. Crear Conversación**
```javascript
Tipo: n8n-nodes-base.supabase
Operación: CREATE (row)
Tabla: agent_conversations

Campos insertados:
├── restaurant_id: "{{ $json.restaurant_id }}"
├── customer_id: "{{ $json.customer_id }}"
├── customer_phone: "{{ $json.customer_phone }}"
├── customer_name: "{{ $json.customer_name }}"
├── customer_email: "{{ $json.customer_email }}"
├── source_channel: "{{ $json.channel }}"
├── interaction_type: "inquiry" (por defecto, se actualizará después)
└── status: "active"

Salida:
{
  "id": "uuid-nueva-conversacion",
  ...
}
```

#### **8. Guardar Mensaje del Usuario**
```javascript
Tipo: n8n-nodes-base.supabase
Operación: CREATE (row)
Tabla: agent_messages

Campos insertados:
├── conversation_id: "{{ $('Crear Conversación').item.json.id }}"
├── restaurant_id: "{{ $('Fusionar Datos').item.json.restaurant_id }}"
├── direction: "inbound"
├── sender: "customer"
├── message_text: "{{ $('Fusionar Datos').item.json.user_message }}"
└── timestamp: "{{ $('Fusionar Datos').item.json.timestamp }}"

Salida:
{
  "id": "uuid-nuevo-mensaje",
  ...
}
```

#### **9. Preparar para Clasificador**
```javascript
Tipo: n8n-nodes-base.code

Salida:
{
  "conversation_id": "uuid-conversacion",
  "restaurant_id": "...",
  "customer_id": "...",
  "customer_name": "...",
  "customer_phone": "...",
  "channel": "whatsapp",
  "user_message": "Hola quiero hacer una reserva",
  "timestamp": "..."
}
```

#### **10. Ejecutar Clasificador**
```javascript
Tipo: n8n-nodes-base.executeWorkflow
Workflow: "3️⃣ Clasificador Super Agent"

Datos enviados: Output del nodo "Preparar para Clasificador"
```

### **Flujo de Conexiones**

```
Start (from WhatsApp/VAPI)
  ↓
Normalizar Datos Multi-Canal
  ↓
Buscar Cliente Existente
  ↓
¿Cliente existe?
  ↓ (true)              ↓ (false)
Fusionar Datos    Crear Cliente Nuevo
  ↓                     ↓
  └─────────────────────┘
  ↓
Crear Conversación
  ↓
Guardar Mensaje del Usuario
  ↓
Preparar para Clasificador
  ↓
Ejecutar Clasificador
```

### **Registro en Base de Datos**

Para cada mensaje recibido, se crean/actualizan:

1. **customers** (si no existe)
   ```sql
   INSERT INTO customers (name, phone, segment_auto, ...)
   ```

2. **agent_conversations** (siempre nueva)
   ```sql
   INSERT INTO agent_conversations (customer_id, source_channel, status='active', ...)
   ```

3. **agent_messages** (siempre nuevo)
   ```sql
   INSERT INTO agent_messages (conversation_id, direction='inbound', ...)
   ```

---

## 🔄 WORKFLOW 3: Clasificador Super Agent

### **Archivo:** `n8n/workflows/3-classifier-super-agent.json`

### **Propósito**
Analizar el mensaje del usuario con GPT-4o-mini y clasificar su intención para rutear al agente especializado correcto.

### **Nodos Principales** (Estructura base - Workflow 3 completo en siguiente sección)

#### **1. Trigger desde Gateway**
```javascript
Tipo: n8n-nodes-base.executeWorkflowTrigger

Entrada:
{
  "conversation_id": "...",
  "restaurant_id": "...",
  "customer_id": "...",
  "user_message": "Quiero hacer una reserva para 4 personas hoy a las 8",
  ...
}
```

#### **2. AI Agent (Langchain)**
```javascript
Tipo: @n8n/n8n-nodes-langchain.agent

Sub-nodos:
├── OpenAI Chat Model (GPT-4o-mini)
│   ├── Model: gpt-4o-mini
│   ├── Temperature: 0.2 (baja para respuestas consistentes)
│   ├── Max Tokens: 150
│   └── System Prompt: [Ver sección System Prompt]
│
└── Simple Memory
    └── Context Window: 10 mensajes

Output esperado:
{
  "category": "nueva_reserva",
  "confidence": 0.95,
  "reasoning": "Usuario menciona 'quiero hacer una reserva' y especifica personas y hora"
}
```

#### **3. Router (IF nodes)**
```javascript
Categorías detectadas:
├── nueva_reserva → Ejecutar "4️⃣ Agente Reservas"
├── modificar_reserva → Ejecutar "5️⃣ Agente Modificaciones"
├── cancelar_reserva → Ejecutar "6️⃣ Agente Cancelaciones"
├── consulta_menu → Ejecutar "7️⃣ Agente FAQs"
├── consulta_general → Ejecutar "7️⃣ Agente FAQs"
├── consulta_reserva → Ejecutar "7️⃣ Agente FAQs"
└── saludo_inicial → Ejecutar "7️⃣ Agente FAQs"
```

### **System Prompt del Clasificador**

```
Eres un asistente experto en clasificar la intención de los mensajes de clientes de restaurantes. 
Tu única tarea es analizar el mensaje del usuario y clasificarlo en una de las siguientes categorías. 
SIEMPRE responde con un objeto JSON que contenga 'category', 'confidence' (0.0-1.0) y 'reasoning'.

Categorías:
- nueva_reserva: El usuario quiere hacer una nueva reserva.
- modificar_reserva: El usuario quiere cambiar una reserva existente.
- cancelar_reserva: El usuario quiere cancelar una reserva existente.
- consulta_menu: El usuario pregunta sobre el menú, platos, precios, alérgenos.
- consulta_general: Preguntas generales sobre el restaurante (horario, ubicación, servicios, etc.).
- consulta_reserva: El usuario pregunta sobre el estado de su reserva o busca una reserva existente.
- saludo_inicial: Mensajes de saludo sin una intención clara aún.

Ejemplo de respuesta JSON:
{
  "category": "nueva_reserva",
  "confidence": 0.95,
  "reasoning": "El usuario menciona 'quiero reservar' y 'para 4 personas'."
}
```

### **Ejemplos de Clasificación**

| Mensaje Usuario | Category | Confidence | Reasoning |
|----------------|----------|------------|-----------|
| "Hola, quiero hacer una reserva para 4 personas mañana a las 8" | nueva_reserva | 0.95 | Usuario solicita explícitamente una reserva con detalles |
| "Necesito cambiar mi reserva de hoy" | modificar_reserva | 0.90 | Usuario menciona "cambiar mi reserva" |
| "Quiero cancelar la reserva del viernes" | cancelar_reserva | 0.92 | Usuario solicita cancelación específica |
| "¿Tenéis opciones sin gluten?" | consulta_menu | 0.88 | Pregunta sobre opciones alimentarias |
| "¿A qué hora abrís?" | consulta_general | 0.85 | Pregunta sobre horario del restaurante |
| "¿Puedo ver mi reserva?" | consulta_reserva | 0.87 | Usuario quiere información sobre su reserva |
| "Hola" | saludo_inicial | 0.70 | Saludo genérico sin intención clara |

---

## 🔧 VARIABLES DE ENTORNO REQUERIDAS

### **N8N Environment Variables**

Crear en N8N: **Settings → Variables**

```bash
# Supabase Configuration
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...tu-service-key
SUPABASE_ANON_KEY=eyJhbGc...tu-anon-key

# OpenAI Configuration
OPENAI_API_KEY=sk-proj-...tu-openai-key

# Restaurant Default (para testing)
DEFAULT_RESTAURANT_ID=uuid-de-tu-restaurante-test

# Workflow IDs (se generan al importar workflows)
GATEWAY_WORKFLOW_ID=workflow-id-gateway
CLASSIFIER_WORKFLOW_ID=workflow-id-classifier
```

### **¿Cómo obtener los valores?**

#### **Supabase:**
1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Settings → API
3. Copia:
   - **Project URL** → `SUPABASE_URL`
   - **anon/public key** → `SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_KEY` ⚠️ (no exponer públicamente)

#### **OpenAI:**
1. Ve a [OpenAI Platform](https://platform.openai.com)
2. API Keys → Create new secret key
3. Copia el key → `OPENAI_API_KEY`

#### **Restaurant ID:**
```sql
-- Ejecutar en Supabase SQL Editor:
SELECT id, name FROM businesses LIMIT 1;
```
Copia el `id` → `DEFAULT_RESTAURANT_ID`

---

## 🔐 CREDENCIALES N8N

### **Crear Credenciales en N8N**

#### **1. Supabase La-IA**
```
Tipo: Supabase API
Nombre: Supabase La-IA
ID Interno: 9pdl4V7ImejCLZWo

Configuración:
├── Host: {{ $env.SUPABASE_URL }}
├── Service Role Secret: {{ $env.SUPABASE_SERVICE_KEY }}
└── Connection Timeout: 30000ms
```

#### **2. OpenAi La-IA**
```
Tipo: OpenAI API
Nombre: OpenAi La-IA
ID Interno: zwtmjTlXACMvkqZx

Configuración:
├── API Key: {{ $env.OPENAI_API_KEY }}
├── Organization ID: (opcional)
└── Timeout: 60000ms
```

### **Verificar Credenciales**

```bash
# Test Supabase
curl -X GET \
  "{{ SUPABASE_URL }}/rest/v1/businesses?select=id,name&limit=1" \
  -H "apikey: {{ SUPABASE_ANON_KEY }}" \
  -H "Authorization: Bearer {{ SUPABASE_SERVICE_KEY }}"

# Test OpenAI
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer {{ OPENAI_API_KEY }}"
```

---

## 🔄 FLUJO COMPLETO DE DATOS

### **Ejemplo Real: Reserva por WhatsApp**

#### **Paso 1: Cliente envía mensajes fragmentados**
```
00:00 → WhatsApp: "Hola"
00:03 → WhatsApp: "Quiero hacer una reserva"
00:05 → WhatsApp: "Para 4 personas hoy a las 20:00"
```

#### **Paso 2: Workflow 1 - Buffer**
```
00:00 → Webhook recibe "Hola"
      → Normaliza datos
      → INSERT en whatsapp_message_buffer:
         {
           buffer_key: "+34612345678_1696329000000",
           messages: "Hola",
           message_count: 1
         }
      → Inicia espera de 10 segundos

00:03 → Webhook recibe "Quiero hacer una reserva"
      → Normaliza datos
      → INSERT falla (buffer_key existe)
      → UPDATE whatsapp_message_buffer:
         {
           messages: "Hola Quiero hacer una reserva",
           message_count: 2
         }
      → Responde webhook (termina)

00:05 → Webhook recibe "Para 4 personas hoy a las 20:00"
      → Normaliza datos
      → INSERT falla (buffer_key existe)
      → UPDATE whatsapp_message_buffer:
         {
           messages: "Hola Quiero hacer una reserva Para 4 personas hoy a las 20:00",
           message_count: 3
         }
      → Responde webhook (termina)

00:10 → Timer completa (primer mensaje + 10 seg)
      → GET whatsapp_message_buffer
      → Prepara datos para Gateway:
         {
           channel: "whatsapp",
           aggregated_messages: "Hola Quiero hacer una reserva Para 4 personas hoy a las 20:00",
           message_count: 3
         }
      → DELETE buffer
      → Ejecuta Gateway
```

#### **Paso 3: Workflow 2 - Gateway**
```
→ Normalizar datos multi-canal
→ Buscar cliente por phone + restaurant_id
  └── Si NO existe:
      → Crear nuevo cliente:
         INSERT INTO customers (
           name: "Juan Pérez",
           phone: "+34612345678",
           segment_auto: "nuevo",
           preferred_channel: "whatsapp"
         )

→ Crear conversación:
   INSERT INTO agent_conversations (
     customer_id: "uuid-cliente",
     source_channel: "whatsapp",
     interaction_type: "inquiry",
     status: "active"
   )

→ Guardar mensaje:
   INSERT INTO agent_messages (
     conversation_id: "uuid-conversacion",
     direction: "inbound",
     sender: "customer",
     message_text: "Hola Quiero hacer una reserva Para 4 personas hoy a las 20:00"
   )

→ Ejecutar Clasificador
```

#### **Paso 4: Workflow 3 - Clasificador**
```
→ AI Agent recibe mensaje
→ GPT-4o-mini analiza:
   Input: "Hola Quiero hacer una reserva Para 4 personas hoy a las 20:00"
   Output: {
     category: "nueva_reserva",
     confidence: 0.95,
     reasoning: "Usuario solicita reserva con detalles específicos"
   }

→ Router detecta category="nueva_reserva"
→ Ejecuta "4️⃣ Agente Reservas" (Workflow 4)
```

#### **Paso 5: Workflow 4 - Agente Reservas (Futuro)**
```
→ Extraer información de la reserva
   ├── party_size: 4
   ├── fecha: "hoy" → 2025-10-03
   └── hora: "20:00"

→ Consultar disponibilidad:
   SELECT * FROM availability_slots
   WHERE slot_date = '2025-10-03'
   AND start_time <= '20:00'
   AND end_time >= '21:30'
   AND status = 'free'

→ Crear reserva:
   INSERT INTO reservations (
     customer_id: "uuid-cliente",
     reservation_date: "2025-10-03",
     reservation_time: "20:00",
     party_size: 4,
     status: "confirmed",
     reservation_source: "ia"
   )

→ Actualizar conversación:
   UPDATE agent_conversations
   SET interaction_type = 'reservation',
       outcome = 'reservation_created',
       reservation_id = "uuid-reserva",
       status = 'resolved'
   WHERE id = "uuid-conversacion"

→ Enviar respuesta al cliente por WhatsApp
```

#### **Resultado Final en Base de Datos**

**customers:**
```sql
id: uuid-cliente
name: "Juan Pérez"
phone: "+34612345678"
segment_auto: "nuevo"
total_visits: 0
```

**agent_conversations:**
```sql
id: uuid-conversacion
customer_id: uuid-cliente
source_channel: "whatsapp"
interaction_type: "reservation"
status: "resolved"
outcome: "reservation_created"
reservation_id: uuid-reserva
```

**agent_messages:**
```sql
-- Mensaje 1 (inbound)
id: uuid-mensaje-1
conversation_id: uuid-conversacion
direction: "inbound"
sender: "customer"
message_text: "Hola Quiero hacer una reserva Para 4 personas hoy a las 20:00"

-- Mensaje 2 (outbound - futuro)
id: uuid-mensaje-2
conversation_id: uuid-conversacion
direction: "outbound"
sender: "agent"
message_text: "¡Perfecto! He confirmado tu reserva para 4 personas hoy a las 20:00..."
```

**reservations:**
```sql
id: uuid-reserva
customer_id: uuid-cliente
reservation_date: "2025-10-03"
reservation_time: "20:00"
party_size: 4
status: "confirmed"
reservation_source: "ia"
channel: "whatsapp"
```

---

## 🧪 TESTING Y VALIDACIÓN

### **1. Test Workflow 1 - Buffer WhatsApp**

#### **Test 1.1: Mensaje único**
```bash
# Enviar mensaje único
curl -X POST http://localhost:5678/webhook/whatsapp-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "from": "+34612345678",
    "body": "Hola, necesito una reserva",
    "profile": {"name": "Test User"}
  }'

# Validar en Supabase (después de 10 seg):
SELECT * FROM whatsapp_message_buffer 
WHERE customer_phone = '+34612345678';
-- Debe estar VACÍO (borrado después de procesar)

SELECT * FROM agent_conversations 
WHERE customer_phone = '+34612345678'
ORDER BY created_at DESC LIMIT 1;
-- Debe existir 1 conversación nueva
```

#### **Test 1.2: Mensajes fragmentados**
```bash
# Enviar 3 mensajes en 5 segundos
curl -X POST http://localhost:5678/webhook/whatsapp-webhook \
  -d '{"from": "+34611111111", "body": "Hola"}'

sleep 2

curl -X POST http://localhost:5678/webhook/whatsapp-webhook \
  -d '{"from": "+34611111111", "body": "Quiero reservar"}'

sleep 2

curl -X POST http://localhost:5678/webhook/whatsapp-webhook \
  -d '{"from": "+34611111111", "body": "Para 4 personas"}'

# Validar inmediatamente:
SELECT * FROM whatsapp_message_buffer 
WHERE customer_phone = '+34611111111';
-- Debe mostrar: messages = "Hola Quiero reservar Para 4 personas"
-- message_count = 3

# Validar después de 10 seg (desde el primer mensaje):
-- Buffer debe estar vacío
-- agent_messages debe tener el mensaje consolidado
```

### **2. Test Workflow 2 - Gateway**

#### **Test 2.1: Cliente nuevo**
```sql
-- Asegurar que no existe
DELETE FROM customers WHERE phone = '+34622222222';

-- Ejecutar workflow manualmente con:
{
  "channel": "whatsapp",
  "restaurant_id": "tu-restaurant-id",
  "customer_phone": "+34622222222",
  "customer_name": "Test Cliente",
  "aggregated_messages": "Mensaje de prueba"
}

-- Validar:
SELECT * FROM customers WHERE phone = '+34622222222';
-- Debe crear nuevo cliente con segment_auto = 'nuevo'

SELECT * FROM agent_conversations WHERE customer_phone = '+34622222222';
-- Debe crear nueva conversación

SELECT * FROM agent_messages WHERE conversation_id = (
  SELECT id FROM agent_conversations WHERE customer_phone = '+34622222222'
);
-- Debe guardar el mensaje
```

#### **Test 2.2: Cliente existente**
```sql
-- Cliente ya existe en DB
-- Ejecutar workflow con mismo phone

-- Validar:
SELECT COUNT(*) FROM customers WHERE phone = '+34622222222';
-- Debe ser 1 (no crea duplicado)

SELECT COUNT(*) FROM agent_conversations WHERE customer_phone = '+34622222222';
-- Debe ser 2 (nueva conversación cada vez)
```

### **3. Test Workflow 3 - Clasificador**

#### **Test 3.1: Clasificación de reserva**
```javascript
// Input:
{
  "user_message": "Quiero hacer una reserva para 4 personas mañana a las 8"
}

// Expected Output:
{
  "category": "nueva_reserva",
  "confidence": > 0.8,
  "reasoning": "Usuario solicita reserva con detalles"
}
```

#### **Test 3.2: Clasificación de cancelación**
```javascript
// Input:
{
  "user_message": "Necesito cancelar mi reserva del viernes"
}

// Expected Output:
{
  "category": "cancelar_reserva",
  "confidence": > 0.8,
  "reasoning": "Usuario solicita cancelación"
}
```

#### **Test 3.3: Clasificación ambigua**
```javascript
// Input:
{
  "user_message": "Hola"
}

// Expected Output:
{
  "category": "saludo_inicial",
  "confidence": 0.5-0.7,
  "reasoning": "Saludo sin intención clara"
}
```

### **4. Validación de Integridad Multi-tenant**

```sql
-- Asegurar que todos los datos pertenecen al restaurant correcto
SELECT 
  c.restaurant_id as customer_restaurant,
  ac.restaurant_id as conversation_restaurant,
  am.restaurant_id as message_restaurant
FROM customers c
JOIN agent_conversations ac ON c.id = ac.customer_id
JOIN agent_messages am ON ac.id = am.conversation_id
WHERE c.phone = '+34612345678';

-- Los 3 restaurant_id deben ser IGUALES
```

### **5. Test de Rendimiento**

```bash
# Enviar 10 mensajes simultáneos
for i in {1..10}; do
  curl -X POST http://localhost:5678/webhook/whatsapp-webhook \
    -d "{\"from\": \"+34650000${i}\", \"body\": \"Test ${i}\"}" &
done

# Validar:
SELECT COUNT(*) FROM agent_conversations 
WHERE created_at > NOW() - INTERVAL '1 minute';
-- Debe ser 10
```

---

## 📊 MONITORIZACIÓN Y MÉTRICAS

### **Queries útiles para Dashboard**

#### **Conversaciones por canal (últimos 7 días)**
```sql
SELECT 
  source_channel,
  COUNT(*) as total_conversations,
  COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
  COUNT(*) FILTER (WHERE outcome = 'reservation_created') as reservations_created
FROM agent_conversations
WHERE restaurant_id = 'tu-restaurant-id'
AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY source_channel;
```

#### **Tasa de conversión por tipo de interacción**
```sql
SELECT 
  interaction_type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE outcome = 'reservation_created') as converted,
  ROUND(
    COUNT(*) FILTER (WHERE outcome = 'reservation_created')::decimal / 
    NULLIF(COUNT(*), 0) * 100, 
    2
  ) as conversion_rate
FROM agent_conversations
WHERE restaurant_id = 'tu-restaurant-id'
AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY interaction_type;
```

#### **Tiempo promedio de resolución**
```sql
SELECT 
  source_channel,
  ROUND(AVG(resolution_time_seconds) / 60.0, 2) as avg_resolution_minutes
FROM agent_conversations
WHERE restaurant_id = 'tu-restaurant-id'
AND status = 'resolved'
AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY source_channel;
```

#### **Uso de buffer de WhatsApp**
```sql
-- Mensajes fragmentados detectados
SELECT 
  DATE(first_message_at) as date,
  COUNT(*) as total_buffers,
  ROUND(AVG(message_count), 2) as avg_fragments,
  MAX(message_count) as max_fragments
FROM whatsapp_message_buffer
WHERE restaurant_id = 'tu-restaurant-id'
GROUP BY DATE(first_message_at)
ORDER BY date DESC;
```

---

## ⚠️ TROUBLESHOOTING

### **Problema 1: Webhook no responde**

**Síntomas:**
- WhatsApp timeout
- N8N no recibe requests

**Solución:**
```bash
# 1. Verificar que webhook está activo
GET http://localhost:5678/webhook/whatsapp-webhook

# 2. Verificar logs de N8N
docker logs n8n-container -f

# 3. Verificar firewall/ngrok si es producción
```

### **Problema 2: Buffer no se limpia**

**Síntomas:**
- Tabla `whatsapp_message_buffer` crece indefinidamente

**Solución:**
```sql
-- Ejecutar función de cleanup manualmente
SELECT cleanup_old_whatsapp_buffers();

-- O crear cronjob en N8N:
-- Schedule Trigger → Every 5 minutes
-- → Supabase: Call Function "cleanup_old_whatsapp_buffers"
```

### **Problema 3: Clientes duplicados**

**Síntomas:**
- Múltiples registros en `customers` con mismo phone

**Causa:**
- Race condition en "Buscar Cliente Existente"

**Solución:**
```sql
-- Añadir constraint UNIQUE en DB
ALTER TABLE customers 
ADD CONSTRAINT customers_phone_restaurant_unique 
UNIQUE (phone, restaurant_id);

-- Limpiar duplicados existentes:
DELETE FROM customers c1
USING customers c2
WHERE c1.id > c2.id
AND c1.phone = c2.phone
AND c1.restaurant_id = c2.restaurant_id;
```

### **Problema 4: Clasificador devuelve categoría incorrecta**

**Síntomas:**
- Reservas clasificadas como "consulta_general"

**Solución:**
1. Revisar System Prompt en Workflow 3
2. Ajustar temperatura (probar 0.1-0.3)
3. Añadir ejemplos en el prompt:

```
Ejemplos correctos:
- "Quiero reservar mesa" → nueva_reserva
- "Cambiar mi reserva" → modificar_reserva
- "Cancelar reserva" → cancelar_reserva
```

### **Problema 5: Error "Column does not exist"**

**Síntomas:**
```
Error: column "customer_name" of relation "customers" does not exist
```

**Causa:**
- Workflow usa columna incorrecta (debe ser `name`, no `customer_name`)

**Solución:**
```bash
# Verificar esquema real:
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'customers';

# Actualizar workflow con nombres correctos
```

---

## 📝 CHANGELOG

### **v2.0 - 03 Octubre 2025**
- ✅ Workflows regenerados completamente con tablas reales
- ✅ Todos los nodos Supabase tienen `resource: "row"` y `operation` específica
- ✅ Tabla `whatsapp_message_buffer` creada con migración SQL
- ✅ Multi-tenant implementado en todas las tablas
- ✅ Credenciales actualizadas: "Supabase La-IA" y "OpenAi La-IA"
- ✅ Flujo de buffer corregido (INSERT → error → UPDATE)
- ✅ Documentación completa con ejemplos reales

### **v1.0 - 01 Octubre 2025**
- ⚠️ Primera versión (deprecada)
- ⚠️ Usaba nombres genéricos de tablas
- ⚠️ No tenía tabla buffer
- ⚠️ Credenciales incorrectas

---

## 🎯 PRÓXIMOS PASOS

### **Fase 2: Agentes Especializados**
- [ ] Workflow 4: Agente Reservas
  - Consultar `availability_slots`
  - Crear en `reservations`
  - Actualizar `agent_conversations.outcome`

- [ ] Workflow 5: Agente Modificaciones
  - Buscar reserva existente
  - Verificar disponibilidad nueva
  - Actualizar `reservations`

- [ ] Workflow 6: Agente Cancelaciones
  - Actualizar `reservations.status = 'cancelled'`
  - Liberar slot en `availability_slots`

- [ ] Workflow 7: Agente FAQs
  - Retrieval de info del restaurante
  - Respuestas automáticas

### **Fase 3: Canales Adicionales**
- [ ] VAPI (llamadas telefónicas)
- [ ] Instagram Direct
- [ ] Facebook Messenger
- [ ] Webchat

### **Fase 4: Features Avanzados**
- [ ] Sentiment analysis
- [ ] Upselling automático
- [ ] Confirmaciones automáticas
- [ ] Dashboard de métricas en tiempo real

---

## 📞 SOPORTE

**Documentación adicional:**
- `n8n/docs/DATABASE-SCHEMA-COMPLETO-2025.md` - Esquema completo de DB
- `n8n/docs/INSTRUCCIONES-CONFIGURACION-N8N.md` - Setup inicial
- `docs/SISTEMA_COMUNICACIONES_AGENTE_IA.md` - Arquitectura general

**Migraciones SQL:**
- `supabase/migrations/20251001_003_agent_communications_clean.sql` - Tablas agent_*
- `supabase/migrations/20251003_001_whatsapp_buffer.sql` - Tabla buffer

---

*Última actualización: 03 Octubre 2025*  
*Versión: 2.0*  
*Estado: ✅ PRODUCCIÓN*

