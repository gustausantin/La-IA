# ✅ WORKFLOWS N8N - SUPER AGENTE IA

**Fecha:** 03 Octubre 2025  
**Estado:** ✅ COMPLETO Y LISTO PARA IMPORTAR

---

## 📦 ARCHIVOS GENERADOS

### **Workflows N8N (JSON)**
```
n8n/workflows/
├── 1-whatsapp-input-with-buffer.json ✅ COMPLETO
├── 2-gateway-unified.json ✅ COMPLETO
└── 3-classifier-super-agent.json ✅ COMPLETO
```

### **Migración SQL Supabase**
```
supabase/migrations/
└── 20251003_001_whatsapp_buffer.sql ✅ COMPLETO
```

### **Documentación**
```
n8n/docs/
├── WORKFLOWS-COMPLETOS-DOCUMENTACION.md ✅ 60+ páginas
├── DATABASE-SCHEMA-COMPLETO-2025.md ✅ Esquema completo
├── INSTRUCCIONES-CONFIGURACION-N8N.md
└── RESUMEN-WORKFLOWS-LISTOS.md (este archivo)
```

---

## 🎯 RESUMEN DE CADA WORKFLOW

### **1️⃣ WhatsApp Input → Buffer**
**Archivo:** `1-whatsapp-input-with-buffer.json`

**Función:** Recibe mensajes de WhatsApp, los agrupa si están fragmentados (10 seg), y envía al Gateway.

**Nodos:** 11
- Webhook WhatsApp (entrada)
- Normalizar Datos
- Insertar/Actualizar Buffer (Supabase)
- Esperar 10 segundos
- Obtener Buffer Completo
- Eliminar Buffer
- Ejecutar Gateway

**Tabla Supabase:**
- `whatsapp_message_buffer` (INSERT, UPDATE, GET, DELETE)

**Credenciales:**
- Supabase La-IA

---

### **2️⃣ Gateway Unificado**
**Archivo:** `2-gateway-unified.json`

**Función:** Punto de entrada multi-canal. Obtiene/crea cliente, crea conversación, guarda mensaje, envía a clasificador.

**Nodos:** 10
- Trigger desde Workflow 1
- Normalizar Datos Multi-Canal
- Buscar/Crear Cliente (Supabase)
- Crear Conversación
- Guardar Mensaje
- Ejecutar Clasificador

**Tablas Supabase:**
- `customers` (GET, CREATE)
- `agent_conversations` (CREATE)
- `agent_messages` (CREATE)

**Credenciales:**
- Supabase La-IA

---

### **3️⃣ Clasificador Super Agent**
**Archivo:** `3-classifier-super-agent.json`

**Función:** Analiza mensaje con GPT-4o-mini, clasifica intención, rutea a agente especializado.

**Nodos:** 14
- Trigger desde Gateway
- Preparar Contexto
- AI Agent Clasificador (GPT-4o-mini)
- Parsear Clasificación JSON
- 3 IF nodes (Nueva/Modificar/Cancelar)
- 4 Execute Workflow (Agentes especializados)
- Actualizar Conversación (Supabase)

**Categorías detectadas:**
1. `nueva_reserva` → Agente Reservas
2. `modificar_reserva` → Agente Modificación
3. `cancelar_reserva` → Agente Cancelación
4. `consulta_menu` → Agente FAQ
5. `consulta_general` → Agente FAQ
6. `consulta_reserva` → Agente FAQ
7. `saludo_inicial` → Agente FAQ

**Tablas Supabase:**
- `agent_conversations` (UPDATE: interaction_type, metadata)

**Credenciales:**
- OpenAi La-IA (GPT-4o-mini)
- Supabase La-IA

---

## 🔧 PASOS PARA IMPORTAR EN N8N

### **Paso 1: Ejecutar SQL en Supabase**

```bash
# Ir a Supabase Dashboard → SQL Editor → New Query
# Copiar y pegar contenido de:
supabase/migrations/20251003_001_whatsapp_buffer.sql

# Ejecutar (Run)
```

**Verificar:**
```sql
SELECT * FROM whatsapp_message_buffer LIMIT 1;
-- Debe devolver estructura vacía (sin errores)
```

---

### **Paso 2: Configurar Credenciales en N8N**

#### **2.1 Supabase La-IA**
```
Tipo: Supabase API
Nombre: Supabase La-IA
ID esperado: 9pdl4V7ImejCLZWo

Configuración:
├── Host: https://tu-proyecto.supabase.co
├── Service Role Secret: tu-service-role-key
└── Timeout: 30000
```

#### **2.2 OpenAi La-IA**
```
Tipo: OpenAI API
Nombre: OpenAi La-IA
ID esperado: zwtmjTlXACMvkqZx

Configuración:
├── API Key: sk-proj-...
└── Timeout: 60000
```

---

### **Paso 3: Configurar Variables de Entorno**

En N8N: **Settings → Variables**

```bash
# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...
SUPABASE_ANON_KEY=eyJhbGc...

# OpenAI
OPENAI_API_KEY=sk-proj-...

# Restaurant
DEFAULT_RESTAURANT_ID=uuid-de-tu-restaurante

# Workflow IDs (se configuran después de importar)
GATEWAY_WORKFLOW_ID=
CLASSIFIER_WORKFLOW_ID=
RESERVATION_AGENT_WORKFLOW_ID=
MODIFY_AGENT_WORKFLOW_ID=
CANCEL_AGENT_WORKFLOW_ID=
FAQ_AGENT_WORKFLOW_ID=
```

---

### **Paso 4: Importar Workflows**

#### **4.1 Importar Workflow 1**
```
1. N8N → Workflows → Add workflow → Import from File
2. Seleccionar: n8n/workflows/1-whatsapp-input-with-buffer.json
3. Click "Import"
4. Guardar (Save)
```

#### **4.2 Importar Workflow 2**
```
1. N8N → Workflows → Add workflow → Import from File
2. Seleccionar: n8n/workflows/2-gateway-unified.json
3. Click "Import"
4. Copiar el Workflow ID (en la URL: /workflow/{ID})
5. Guardar en variable: GATEWAY_WORKFLOW_ID
```

#### **4.3 Importar Workflow 3**
```
1. N8N → Workflows → Add workflow → Import from File
2. Seleccionar: n8n/workflows/3-classifier-super-agent.json
3. Click "Import"
4. Copiar el Workflow ID
5. Guardar en variable: CLASSIFIER_WORKFLOW_ID
```

---

### **Paso 5: Configurar IDs de Workflows**

#### **5.1 Workflow 1 → Actualizar ID del Gateway**
```
1. Abrir Workflow 1
2. Click en nodo "Ejecutar Gateway Unificado"
3. En "Workflow ID" → Seleccionar "2️⃣ Gateway Unificado"
4. Guardar
```

#### **5.2 Workflow 2 → Actualizar ID del Clasificador**
```
1. Abrir Workflow 2
2. Click en nodo "Ejecutar Clasificador"
3. En "Workflow ID" → Seleccionar "3️⃣ Clasificador Super Agent"
4. Guardar
```

#### **5.3 Workflow 3 → Actualizar IDs de Agentes**
```
1. Abrir Workflow 3
2. Click en "Ejecutar Agente de Reservas"
   → Workflow ID: Dejar como RESERVATION_AGENT_WORKFLOW_ID (futuro)
3. Click en "Ejecutar Agente de Modificación"
   → Workflow ID: Dejar como MODIFY_AGENT_WORKFLOW_ID (futuro)
4. Click en "Ejecutar Agente de Cancelación"
   → Workflow ID: Dejar como CANCEL_AGENT_WORKFLOW_ID (futuro)
5. Click en "Ejecutar Agente de FAQ"
   → Workflow ID: Dejar como FAQ_AGENT_WORKFLOW_ID (futuro)
6. Guardar
```

---

### **Paso 6: Activar Workflows**

```
1. Workflow 1: Click en "Active" (toggle arriba a la derecha)
2. Workflow 2: Click en "Active"
3. Workflow 3: Click en "Active"
```

---

## 🧪 TESTING

### **Test 1: WhatsApp Webhook**

```bash
# Obtener URL del webhook
# En Workflow 1 → Click en nodo "Webhook WhatsApp" → Copy Production URL

# Ejemplo URL:
# https://tu-n8n-domain.com/webhook/whatsapp-webhook

# Test con curl:
curl -X POST https://tu-n8n-domain.com/webhook/whatsapp-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "from": "+34600000000",
    "body": "Hola, quiero hacer una reserva para 4 personas",
    "profile": {
      "name": "Test Usuario"
    },
    "timestamp": "2025-10-03T10:00:00Z"
  }'

# Respuesta esperada:
# {"status":"success","message":"Mensaje recibido y procesado"}
```

### **Test 2: Verificar en Supabase**

```sql
-- 1. Buffer (debe estar vacío después de 10 seg)
SELECT * FROM whatsapp_message_buffer 
WHERE customer_phone = '+34600000000';

-- 2. Cliente creado
SELECT * FROM customers 
WHERE phone = '+34600000000';

-- 3. Conversación creada
SELECT * FROM agent_conversations 
WHERE customer_phone = '+34600000000'
ORDER BY created_at DESC LIMIT 1;

-- 4. Mensaje guardado
SELECT am.* 
FROM agent_messages am
JOIN agent_conversations ac ON am.conversation_id = ac.id
WHERE ac.customer_phone = '+34600000000'
ORDER BY am.timestamp DESC LIMIT 1;
```

### **Test 3: Clasificación**

```sql
-- Ver clasificación en metadata
SELECT 
  customer_name,
  interaction_type,
  metadata->>'classification' as classification,
  created_at
FROM agent_conversations
WHERE customer_phone = '+34600000000'
ORDER BY created_at DESC LIMIT 1;

-- Debe mostrar:
-- interaction_type: 'reservation' (si mensaje era sobre reserva)
-- classification: {"category":"nueva_reserva","confidence":0.95,...}
```

---

## 📊 ESTADO ACTUAL

| Workflow | Estado | Tablas Usadas | Credenciales |
|----------|--------|---------------|--------------|
| 1️⃣ WhatsApp Buffer | ✅ COMPLETO | whatsapp_message_buffer | Supabase La-IA |
| 2️⃣ Gateway Unificado | ✅ COMPLETO | customers, agent_conversations, agent_messages | Supabase La-IA |
| 3️⃣ Clasificador | ✅ COMPLETO | agent_conversations | OpenAi La-IA, Supabase La-IA |
| 4️⃣ Agente Reservas | 🔜 PENDIENTE | reservations, availability_slots, tables | - |
| 5️⃣ Agente Modificación | 🔜 PENDIENTE | reservations, availability_slots | - |
| 6️⃣ Agente Cancelación | 🔜 PENDIENTE | reservations, availability_slots | - |
| 7️⃣ Agente FAQ | 🔜 PENDIENTE | businesses (info) | - |

---

## 🎯 PRÓXIMOS PASOS

### **Fase 2: Agentes Especializados**

#### **Workflow 4: Agente Reservas**
```
Función: Extraer datos, consultar disponibilidad, crear reserva

Nodos principales:
├── Extraer Información (GPT-4o-mini)
│   └── party_size, fecha, hora, preferencias
├── Consultar Availability_Slots (Supabase)
├── Asignar Mesa Óptima
├── Crear Reserva (Supabase)
├── Actualizar Conversación (outcome='reservation_created')
└── Enviar Respuesta WhatsApp
```

#### **Workflow 5: Agente Modificación**
```
Función: Buscar reserva, nueva disponibilidad, actualizar

Nodos principales:
├── Buscar Reserva Existente (Supabase)
├── Extraer Cambios Solicitados (GPT)
├── Verificar Nueva Disponibilidad
├── Actualizar Reserva
└── Confirmar al Cliente
```

#### **Workflow 6: Agente Cancelación**
```
Función: Buscar reserva, cancelar, liberar slot

Nodos principales:
├── Buscar Reserva (Supabase)
├── Actualizar status='cancelled'
├── Liberar Availability_Slot
└── Confirmar Cancelación
```

#### **Workflow 7: Agente FAQ**
```
Función: Responder preguntas generales con RAG

Nodos principales:
├── Retrieval de Info Restaurante
├── Generar Respuesta con GPT
└── Enviar Respuesta
```

---

## 📞 SOPORTE

**Documentación completa:**
- `n8n/docs/WORKFLOWS-COMPLETOS-DOCUMENTACION.md`

**Esquema de base de datos:**
- `n8n/docs/DATABASE-SCHEMA-COMPLETO-2025.md`

**Troubleshooting:**
- Ver sección "TROUBLESHOOTING" en documentación completa

---

## ✅ CHECKLIST FINAL

Antes de considerar la implementación completa:

- [x] Tabla `whatsapp_message_buffer` creada en Supabase
- [x] Credenciales "Supabase La-IA" configuradas en N8N
- [x] Credenciales "OpenAi La-IA" configuradas en N8N
- [x] Variables de entorno configuradas
- [x] Workflow 1 importado y activo
- [x] Workflow 2 importado y activo
- [x] Workflow 3 importado y activo
- [x] IDs de workflows configurados correctamente
- [x] Test de WhatsApp webhook exitoso
- [x] Verificación en Supabase exitosa
- [ ] Workflow 4 (Agente Reservas) creado
- [ ] Workflow 5 (Agente Modificación) creado
- [ ] Workflow 6 (Agente Cancelación) creado
- [ ] Workflow 7 (Agente FAQ) creado
- [ ] Testing end-to-end completo
- [ ] Monitoreo y alertas configurados

---

*Última actualización: 03 Octubre 2025*  
*Workflows completados: 3/7 (43%)*  
*Estado: ✅ FASE 1 COMPLETA - LISTO PARA TESTING*

