# 🎙️ AUDITORÍA: SISTEMA DE VOZ BAPI - ANÁLISIS COMPLETO

**Fecha:** 25 de Octubre 2025  
**Versión:** 1.0  
**Objetivo:** Integrar BAPI como cerebro de voz para La-IA App

---

## 📊 RESUMEN EJECUTIVO

### **¿Qué estamos construyendo?**
Un workflow de n8n que actúe como **Gateway de BAPI** para permitir que las llamadas de voz usen el cerebro de BAPI en lugar del Super Agente interno.

### **Arquitectura Actual:**
```
┌────────────────────────────────────────────────────────────┐
│         LLAMADA VOZ (Actual - NO usar)                     │
│  Cliente → Twilio → Gateway VOZ → Gateway → SuperAgente   │
│                                                             │
│  - Gateway VOZ: Procesa audio (STT/TTS)                   │
│  - Gateway: Gestiona conversación/cliente                  │
│  - SuperAgente: Cerebro GPT-4o (dentro de n8n)           │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│         LLAMADA VOZ BAPI (NUEVA - a implementar)          │
│  Cliente → BAPI → Webhook n8n → Response                  │
│                                                             │
│  - BAPI: Cerebro principal (STT + GPT + TTS interno)      │
│  - Webhook n8n: Solo proporciona contexto dinámico        │
│  - BAPI usa las Tools del SuperAgente                     │
└────────────────────────────────────────────────────────────┘
```

---

## 🏗️ ARQUITECTURA DE LA APLICACIÓN

### **1. TABLAS PRINCIPALES (Supabase)**

#### **restaurants**
```sql
id UUID PRIMARY KEY
name VARCHAR(255)
email VARCHAR
phone VARCHAR
address TEXT
settings JSONB  -- ⚠️ CRÍTICO: Contiene toda la config
channels JSONB  -- ⚠️ CRÍTICO: Teléfonos por canal
```

**Estructura `settings`:**
```json
{
  "agent": {
    "name": "María",
    "gender": "female"
  },
  "zones": {
    "interior": { "enabled": true, "display_name": "Interior", "sort_order": 1 },
    "terraza": { "enabled": true, "display_name": "Terraza", "sort_order": 2 },
    "barra": { "enabled": false },
    "privado": { "enabled": true, "display_name": "Sala Privada", "sort_order": 3 }
  },
  "calendar_schedule": [
    { "day_of_week": "monday", "is_open": false },
    { "day_of_week": "tuesday", "is_open": true, "open_time": "18:00", "close_time": "23:00" },
    ...
  ],
  "reservation_duration": 90,
  "slot_duration": 30,
  "min_advance_minutes": 30,
  "advance_booking_days": 30,
  "max_party_size": 8,
  "cancellation_policy": "24h",
  "default_zone": "interior"
}
```

**Estructura `channels`:**
```json
{
  "voice": {
    "phone_number": "+34931234567",
    "enabled": true,
    "provider": "twilio"
  },
  "whatsapp": {
    "phone_number": "+34612345678",
    "enabled": true,
    "emergency_phone": "+34600000000"
  }
}
```

#### **customers**
```sql
id UUID PRIMARY KEY
restaurant_id UUID  -- Multi-tenant
name VARCHAR
phone VARCHAR  -- ⚠️ ÚNICO por restaurant_id
email VARCHAR
segment_auto_v2 VARCHAR
total_visits INTEGER
total_spent NUMERIC
last_visit_at TIMESTAMPTZ
```

#### **agent_conversations**
```sql
id UUID PRIMARY KEY
restaurant_id UUID
customer_id UUID
customer_phone VARCHAR
source_channel VARCHAR  -- 'whatsapp', 'voice', 'web'
interaction_type VARCHAR  -- 'reservation', 'inquiry', 'modification'
status VARCHAR  -- 'active', 'resolved'
created_at TIMESTAMPTZ
```

#### **agent_messages**
```sql
id UUID PRIMARY KEY
conversation_id UUID
restaurant_id UUID
customer_phone VARCHAR
direction VARCHAR  -- 'inbound', 'outbound'
sender VARCHAR  -- 'customer', 'agent'
message_text TEXT
timestamp TIMESTAMPTZ
```

#### **reservations**
```sql
id UUID PRIMARY KEY
restaurant_id UUID
customer_id UUID
customer_name VARCHAR
customer_phone VARCHAR
reservation_date DATE
reservation_time TIME
party_size INTEGER
status VARCHAR  -- 'pending', 'confirmed', 'cancelled', 'seated'
preferred_zone zone_type  -- ENUM: 'interior', 'terraza', 'barra', 'privado'
special_requests TEXT
source VARCHAR  -- 'agent_whatsapp', 'agent_voice', 'manual'
```

---

## 🔄 WORKFLOWS ACTUALES (WhatsApp)

### **Workflow 1: WhatsApp Buffer**
**Propósito:** Agrupa mensajes del cliente en 15s

**Flujo:**
1. Webhook recibe mensaje de Twilio
2. Normaliza teléfono (mantiene `+`)
3. Busca restaurante por `channels.whatsapp.phone_number`
4. UPSERT en `whatsapp_message_buffer`
5. Responde 200 OK inmediatamente
6. Loop de 15s → Verifica si buffer fue actualizado
7. Si NO actualizado → Procesa y elimina buffer
8. Ejecuta Gateway

**Tablas usadas:**
- `restaurants` (buscar por phone)
- `whatsapp_message_buffer`

---

### **Workflow 2: Gateway Unificado**
**Propósito:** Gestiona conversación y cliente

**Flujo:**
1. Recibe input:
   ```json
   {
     "restaurant_id": "uuid",
     "customer_phone": "+34...",
     "customer_name": "Nombre",
     "user_message": "texto",
     "channel": "whatsapp",
     "timestamp": "ISO"
   }
   ```

2. **Normaliza teléfono**
3. **Buscar/crear cliente** en `customers`
4. **Buscar conversaciones activas** (<10 min)
5. **Reusar o crear** conversación
6. **Guardar mensaje** en `agent_messages`
7. **Ejecutar SuperAgente** (Workflow 3)

**Tablas usadas:**
- `customers` (UNIQUE por phone+restaurant_id)
- `agent_conversations` (ventana 10 min)
- `agent_messages`

---

### **Workflow 3: Super Agente Híbrido**
**Propósito:** Cerebro conversacional

**Flujo:**
1. Recibe contexto del Gateway
2. **Clasificar intención** (GPT-4o-mini) si nueva conversación
3. **Buscar reservas activas** del cliente
4. **Obtener info restaurante** completa
5. **Fusionar contexto**:
   ```json
   {
     "conversation_id": "uuid",
     "customer_id": "uuid",
     "customer_name": "Nombre",
     "customer_phone": "+34...",
     "restaurant_id": "uuid",
     "channel": "whatsapp",
     "user_message": "texto",
     "classification": { intent, sentiment, confidence },
     "customer_context": {
       "has_active_reservations": true,
       "active_reservations": [...]
     },
     "restaurant_context": {
       "name": "Restaurante",
       "address": "...",
       "phone": "...",
       "hours_summary": "Lun: 18:00-23:00, Mar: CERRADO...",
       "channels": {...},
       "available_zones": [...],
       "default_zone": "interior",
       "zones_summary": "🏠 Interior, 🌿 Terraza...",
       "settings": {
         "reservation_duration": 90,
         "slot_duration": 30,
         "min_advance_minutes": 30,
         "max_party_size": 8
       }
     }
   }
   ```

6. **Cargar historial conversación** (10 mensajes)
7. **Lógica híbrida** (respuesta fija vs LLM)
8. **Ejecutar LLM** (GPT-4o + Tools):
   - check_availability
   - create_reservation
   - cancel_reservation
   - consultar_informacion_restaurante
   - escalate_to_human

9. **Procesar respuesta**
10. **Guardar en BD**
11. **Actualizar conversación**
12. **Enviar WhatsApp**

**Tablas usadas:**
- `reservations` (buscar activas)
- `restaurants` (info completa)
- `agent_messages` (historial)
- `agent_conversations` (actualizar)

---

## 🛠️ TOOLS DISPONIBLES

### **1. check_availability**
**Workflow:** `01-check-availability-OPTIMIZADO.json`

**Input:**
```json
{
  "date": "2025-10-25",
  "time": "20:00",
  "party_size": 4,
  "preferred_zone": "terraza",  // o "any"
  "restaurant_id": "uuid"
}
```

**Output:**
```json
{
  "disponible": true,
  "mensaje": "¡Perfecto! Sí tenemos disponibilidad...",
  "detalles": {
    "fecha": "2025-10-25",
    "hora": "20:00",
    "personas": 4,
    "zona_solicitada": "terraza",
    "mesas_disponibles": 2
  }
}
```

**Flujo interno:**
1. Valida input (fecha, hora, personas)
2. Calcula tiempo hasta reserva
3. Busca slots en `availability_slots`:
   - `restaurant_id` = input
   - `slot_date` = fecha
   - `status` = 'free'
   - `start_time` = hora
   - `zone` = zona (si especificada)
   - `capacity` >= personas

4. Si HAY slots → Respuesta disponible
5. Si NO HAY → Busca alternativas (±2h, máx 4)

**Tablas usadas:**
- `availability_slots`

---

### **2. create_reservation**
**Workflow:** `TOOL-create-reservation-FINAL-COMPLETO.json`

**Input:**
```json
{
  "restaurant_id": "uuid",
  "customer_id": "uuid",
  "customer_phone": "+34...",
  "customer_name": "Nombre",
  "reservation_date": "2025-10-25",
  "reservation_time": "20:00",
  "party_size": 4,
  "preferred_zone": "terraza",
  "special_requests": "Cumpleaños",
  "source": "agent_whatsapp"
}
```

**Flujo interno:**
1. Valida input
2. Llama RPC `find_table_combinations` (verifica disponibilidad + tiempo mínimo)
3. Procesa disponibilidad (single/combination)
4. Si disponible:
   - Crea reserva en `reservations`
   - Crea `reservation_tables` (relación mesas)
   - Actualiza `availability_slots` (status='reserved')
5. Retorna éxito/error

**Tablas usadas:**
- `reservations`
- `reservation_tables`
- `availability_slots`
- RPC: `find_table_combinations`

---

### **3. cancel_reservation**
**Input:**
```json
{
  "reservation_id": "uuid",
  "cancellation_reason": "Cliente solicitó",
  "restaurant_id": "uuid"
}
```

**Flujo interno:**
1. Actualiza `reservations.status` = 'cancelled'
2. Libera slots (`status` = 'free', `is_available` = true)

**Tablas usadas:**
- `reservations`
- `availability_slots`

---

## 🎯 PROMPT DEL SUPER AGENTE

**Ubicación:** `n8n/prompts/PROMPT-SUPER-AGENT-v12-OPTIMIZADO.txt`

**Estructura:**
1. **Reglas de Oro:** Idioma, memoria, verificación, confirmación
2. **Contexto:** Fecha actual, restaurante, políticas, zonas, cliente, reservas activas
3. **Flujo Reserva Nueva:** 5 pasos (fecha → hora → personas → zona → verificar → confirmar → crear)
4. **Flujo Modificación:** Crear nueva + cancelar antigua
5. **Herramientas:** check_availability, create_reservation, cancel_reservation, etc.
6. **Prohibiciones:** Lista de "NUNCA hacer"
7. **Personalidad:** Cercana, profesional, natural
8. **Ejemplos prácticos**

**Variables usadas:**
- `$json.restaurant_context.name`
- `$json.restaurant_context.hours_summary`
- `$json.restaurant_context.zones_summary`
- `$json.customer_name`
- `$json.customer_active_reservations_summary`
- `$json.restaurant_id`
- `$json.customer_id`
- `$json.user_message`

---

## 🎙️ PROMPT ADAPTADO PARA VOZ (BAPI)

**Diferencias clave:**
1. **Una pregunta a la vez** (no listar opciones)
2. **Frases cortas** (conversacional)
3. **Gestión de interrupciones** (stop inmediato)
4. **NO listar horarios** inicialmente (solo si falla)
5. **Cierre decidido** (no "¿algo más?")

---

## 📋 DATOS QUE BAPI NECESITA

### **Al inicio de la llamada:**

**1. Identificar Restaurante:**
- Por teléfono llamado (`call.to` o `call.forwardedFrom`)
- Buscar en `restaurants.channels.voice.phone_number`

**2. Identificar Cliente:**
- Por teléfono llamante (`call.from`)
- Buscar/crear en `customers` por `phone` + `restaurant_id`

**3. Contexto del Restaurante:**
```json
{
  "restaurant_id": "uuid",
  "restaurant_name": "Nombre",
  "agent_name": "María",
  "agent_gender": "female",
  
  "horarios": "Lun: 18:00-23:00, Mar: CERRADO, Mié-Dom: 13:00-16:00, 20:00-23:00",
  
  "zonas_disponibles": [
    { "id": "interior", "name": "Interior", "icon": "🏠" },
    { "id": "terraza", "name": "Terraza", "icon": "🌿" },
    { "id": "privado", "name": "Sala Privada", "icon": "🔒" }
  ],
  "zona_por_defecto": "interior",
  
  "politicas": {
    "reservation_duration": 90,
    "slot_duration": 30,
    "min_advance_minutes": 30,
    "max_party_size": 8,
    "cancellation_policy": "24h"
  },
  
  "contacto": {
    "address": "Calle Mayor 123, Barcelona",
    "phone": "+34931234567",
    "email": "info@restaurante.com"
  }
}
```

**4. Contexto del Cliente:**
```json
{
  "customer_id": "uuid",
  "customer_name": "Gustau",
  "customer_phone": "+34671126148",
  
  "reservas_activas": [
    {
      "reservation_id": "uuid",
      "date": "2025-10-26",
      "time": "21:00:00",
      "party_size": 4,
      "zone": "interior",
      "status": "confirmed",
      "special_requests": "Cumpleaños"
    }
  ],
  
  "tiene_reservas_activas": true,
  "total_reservas_activas": 1
}
```

---

## 🔧 WORKFLOW BAPI - DISEÑO

### **Nombre:** `BAPI-Voice-Gateway.json`

### **Propósito:**
Webhook que recibe llamada de BAPI y devuelve contexto dinámico.

### **Input de BAPI:**
```json
{
  "call": {
    "from": "+34671126148",
    "to": "+34931234567",
    "forwardedFrom": "+34931234567",
    "callSid": "CA...",
    "direction": "inbound"
  },
  "messages": [],  // Vacío en primer turno
  "timestamp": "2025-10-25T10:00:00Z"
}
```

### **Output esperado:**
```json
{
  "context": {
    "restaurant_id": "uuid",
    "restaurant_name": "Gustau Restaurant",
    "agent_name": "María",
    "agent_gender": "female",
    "horarios": "Lun: 18:00-23:00, Mar: CERRADO...",
    "zonas_disponibles": [...],
    "politicas": {...},
    "customer_id": "uuid",
    "customer_name": "Gustau",
    "customer_phone": "+34671126148",
    "reservas_activas": [...]
  },
  "tools_url": "https://n8n.tu-dominio.com/webhook/bapi-tools",
  "prompt": "Eres María, del restaurante Gustau..."
}
```

---

## ✅ VALIDACIÓN DE NORMAS SAGRADAS

### **NORMA 1: Ajustes Quirúrgicos**
✅ NO degradamos nada
✅ Solo añadimos nuevo flujo BAPI
✅ Workflows WhatsApp intactos

### **NORMA 2: Datos Reales**
✅ TODO desde Supabase
✅ 0% hardcoding
✅ Dinámico por restaurant_id

### **NORMA 3: Multi-tenant**
✅ Búsqueda por restaurant_id siempre
✅ Clientes aislados por tenant
✅ JSONB `channels` flexible

### **NORMA 4: Revisar Supabase**
✅ Tablas existentes verificadas
✅ NO crear nuevas tablas
✅ Usar estructura actual

---

## 🚨 PUNTOS CRÍTICOS

### **1. Búsqueda de Restaurante**
**Problema:** `restaurants.channels` es JSONB, no se puede filtrar directo por SQL.

**Solución:**
```javascript
// En n8n Code node
const allRestaurants = await getAllRestaurants();
const restaurantPhone = call.to || call.forwardedFrom;

const matched = allRestaurants.find(r => {
  const voicePhone = r.channels?.voice?.phone_number;
  return voicePhone === restaurantPhone;
});
```

### **2. Formato de Horarios**
**Problema:** `settings.calendar_schedule` es array, necesita format ear.

**Solución:**
```javascript
const schedule = restaurant.settings.calendar_schedule || [];
const dayMap = { monday: 'Lun', tuesday: 'Mar', ... };

const formatted = schedule.map(day => {
  const name = dayMap[day.day_of_week];
  return day.is_open 
    ? `${name}: ${day.open_time}-${day.close_time}`
    : `${name}: CERRADO`;
}).join(', ');
```

### **3. Zonas Activas**
**Problema:** `settings.zones` puede tener zonas deshabilitadas.

**Solución:**
```javascript
const zones = restaurant.settings.zones || {};
const available = Object.entries(zones)
  .filter(([key, data]) => data.enabled === true)
  .map(([key, data]) => ({
    id: key,
    name: data.display_name,
    icon: data.icon,
    sort_order: data.sort_order
  }))
  .sort((a, b) => a.sort_order - b.sort_order);
```

### **4. Reservas Activas**
**Problema:** Filtrar solo estados activos.

**Solución:**
```sql
SELECT * FROM reservations
WHERE restaurant_id = $1
  AND customer_phone = $2
  AND status IN ('pending', 'confirmed', 'pending_approval', 'seated')
ORDER BY reservation_date DESC, reservation_time DESC
```

---

## 📊 CHECKLIST FINAL

### **Antes de codificar:**
- [x] Leer CHECKLIST_OBLIGATORIO.md
- [x] Leer NORMAS_SAGRADAS.md
- [x] Verificar esquema BD completo
- [x] Entender workflows actuales
- [x] Identificar tablas necesarias
- [x] Verificar campos JSONB
- [x] Auditar prompt del agente

### **Durante codificación:**
- [ ] Verificar nombres de tablas exactos
- [ ] Verificar nombres de columnas exactos
- [ ] Usar IDs correctos (UUID)
- [ ] Manejo de errores en CADA nodo
- [ ] Logs claros para debugging
- [ ] Validar entrada BAPI
- [ ] Formato de salida correcto

### **Después de codificar:**
- [ ] Probar con datos reales
- [ ] Verificar multi-tenant
- [ ] Comprobar performance
- [ ] Documentar workflow
- [ ] Exportar JSON

---

## 🎯 CONCLUSIÓN

**LISTO PARA IMPLEMENTAR:**
✅ Arquitectura analizada
✅ Tablas identificadas
✅ Flujos comprendidos
✅ Normas verificadas
✅ Puntos críticos mapeados

**PRÓXIMO PASO:**
Construir `BAPI-Voice-Gateway.json` con 3 workflows:
1. **BAPI Gateway** (recibe llamada, devuelve contexto)
2. **BAPI Tools Dispatcher** (recibe llamadas de tools, ejecuta)
3. **BAPI Post-Call** (guarda transcripción final)

---

**Fecha de auditoría:** 25 Octubre 2025  
**Auditado por:** Claude + Gustau  
**Estado:** ✅ APROBADO PARA IMPLEMENTACIÓN





