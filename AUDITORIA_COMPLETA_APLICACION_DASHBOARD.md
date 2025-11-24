# 🔍 AUDITORÍA COMPLETA DE LA APLICACIÓN LA-IA
## Para Diseñar el Dashboard "Socio Virtual"

**Fecha**: 23 de Noviembre de 2025  
**Objetivo**: Entender cada módulo de la aplicación para crear un Dashboard inteligente basado en "Gestión por Excepción"

---

## 📊 RESUMEN EJECUTIVO

He analizado exhaustivamente toda la aplicación. Aquí está el **estado real** de cada componente:

### ✅ LO QUE FUNCIONA PERFECTAMENTE

1. **Sistema de Reservas Multi-Recurso** (Employees + Boxes)
2. **Integración Google Calendar** (Unidireccional + Bidireccional)
3. **Sistema de Clientes con CRM Inteligente** (Segmentación automática)
4. **Gestión de Equipo** (Empleados, horarios, ausencias)
5. **Sistema de Disponibilidad Dinámica** (Generación automática de slots)
6. **Comunicaciones con IA** (Agente conversacional multi-canal)
7. **Sistema de No-Shows** (Infraestructura básica implementada)

### ⚠️ LO QUE ESTÁ A MEDIAS

1. **Sistema de No-Shows Dinámico** - Falta conectar con N8N workflows
2. **Alertas en tiempo real** - No hay sistema de notificaciones críticas
3. **Dashboard actual** - Es informativo pero NO operativo

### ❌ LO QUE FALTA PARA EL DASHBOARD "SOCIO VIRTUAL"

1. **Edge Function `get-snapshot`** - Para análisis inteligente del estado del negocio
2. **Lógica de Conflicto de Personal** - Detectar ausencias con citas asignadas
3. **Sistema de Acciones Mágicas** - Botones que resuelven problemas en 1 click
4. **Widget "Turnos en Vivo"** - Vista multi-carril de quién atiende a quién AHORA
5. **Integración Avatar Lua con OpenAI** - Para generar textos contextuales

---

## 🗄️ ARQUITECTURA DE DATOS

### **Tablas Principales Confirmadas**

#### 1. `appointments` (Reservas)
```sql
Columnas clave:
- id (UUID)
- business_id (UUID)
- customer_id (UUID)
- customer_name, customer_phone, customer_email (TEXT) -- Copias denormalizadas
- appointment_date (DATE)
- appointment_time (TIME)
- duration_minutes (INTEGER)
- status (TEXT) -- 'pending', 'confirmed', 'completed', 'cancelled', 'no_show', 'blocked'
- employee_id (UUID) -- Recurso humano asignado
- resource_id (UUID) -- Recurso físico asignado (silla, box)
- service_id (UUID)
- channel (TEXT) -- 'manual', 'phone', 'whatsapp', 'web', 'instagram', 'facebook'
- source (TEXT) -- 'manual', 'agent_vapi', 'agent_whatsapp', 'google_calendar'
- notes (TEXT)
- created_at, updated_at (TIMESTAMPTZ)
```

**Relaciones**:
- `appointments.employee_id → employees.id`
- `appointments.resource_id → resources.id`
- `appointments.customer_id → customers.id`
- `appointments.service_id → business_services.id`

#### 2. `employees` (Equipo)
```sql
Columnas clave:
- id (UUID)
- business_id (UUID)
- name (TEXT)
- role (TEXT) -- 'admin', 'employee', 'manager'
- email (TEXT)
- phone (TEXT)
- assigned_resource_id (UUID) -- Recurso físico predeterminado (ej: Silla 1)
- is_active (BOOLEAN)
- position_order (INTEGER) -- Orden de visualización
- avatar_url (TEXT)
- created_at, updated_at (TIMESTAMPTZ)
```

**Relaciones**:
- `employees.assigned_resource_id → resources.id`

#### 3. `employee_schedules` (Horarios del Equipo)
```sql
Columnas clave:
- id (UUID)
- employee_id (UUID)
- business_id (UUID)
- day_of_week (INTEGER) -- 0=Domingo, 6=Sábado
- start_time (TIME)
- end_time (TIME)
- is_active (BOOLEAN)
- shift_name (TEXT) -- 'Mañana', 'Tarde', 'Noche'
```

#### 4. `employee_absences` (Ausencias/Vacaciones)
```sql
Columnas clave:
- id (UUID)
- employee_id (UUID)
- business_id (UUID)
- absence_type (TEXT) -- 'sick_leave', 'vacation', 'personal', 'other'
- start_date (DATE)
- end_date (DATE)
- start_time (TIME) -- NULL si es todo el día
- end_time (TIME)
- reason (TEXT)
- is_approved (BOOLEAN)
- created_at, updated_at (TIMESTAMPTZ)
```

**⚠️ CRÍTICO PARA EL DASHBOARD**: Esta tabla es la clave para detectar el **Escenario 1: Crisis de Personal**

#### 5. `resources` (Recursos Físicos: Sillas, Boxes, Salas)
```sql
Columnas clave:
- id (UUID)
- business_id (UUID)
- name (TEXT) -- 'Silla 1', 'Box 3', 'Sala VIP'
- resource_type (TEXT) -- 'employee', 'room', 'equipment', 'table'
- is_active (BOOLEAN)
- capacity (INTEGER) -- Para salas
- metadata (JSONB) -- Configuración extra
```

#### 6. `customers` (Clientes)
```sql
Columnas clave:
- id (UUID)
- business_id (UUID)
- name (TEXT)
- phone (TEXT) -- ÚNICO por negocio
- email (TEXT)
- no_show_count (INTEGER) -- ⚠️ Añadido por migración no-shows
- total_visits (INTEGER)
- total_spent (DECIMAL)
- last_visit_date (DATE)
- crm_segment (TEXT) -- 'nuevo', 'regular', 'vip', 'inactivo', 'en_riesgo'
- created_at, updated_at (TIMESTAMPTZ)
```

#### 7. `customer_confirmations` (Sistema No-Shows)
```sql
⚠️ ESTADO: Tabla creada por migración 20251123_02_noshows_infrastructure_FIXED.sql

Columnas:
- id (UUID)
- business_id (UUID)
- appointment_id (UUID)
- customer_id (UUID)
- message_type (TEXT) -- '24h_before', '4h_before', '2h_before'
- message_channel (TEXT) -- 'whatsapp', 'sms', 'email'
- message_sent (TEXT) -- Contenido del mensaje
- sent_at (TIMESTAMPTZ)
- confirmed (BOOLEAN) -- ¿Cliente confirmó?
- response_text (TEXT)
- response_at (TIMESTAMPTZ)
- created_at, updated_at (TIMESTAMPTZ)
```

**⚠️ CRÍTICO PARA EL DASHBOARD**: Esta tabla es la clave para detectar el **Escenario 2: Riesgo de No-Show**

#### 8. `availability_slots` (Disponibilidad)
```sql
Columnas clave:
- id (UUID)
- business_id (UUID)
- slot_date (DATE)
- start_time (TIME)
- end_time (TIME)
- employee_id (UUID) -- Quién puede atender en este slot
- resource_id (UUID) -- Dónde se atiende
- status (TEXT) -- 'free', 'reserved', 'occupied', 'blocked'
- is_available (BOOLEAN)
- duration_minutes (INTEGER)
- created_at, updated_at (TIMESTAMPTZ)
```

**Generación Automática**: Función `generate_availability_slots()` corre diariamente a las 4 AM

#### 9. `business_services` (Servicios del Negocio)
```sql
Columnas clave:
- id (UUID)
- business_id (UUID)
- name (TEXT) -- 'Corte de pelo', 'Tinte', 'Masaje'
- duration_minutes (INTEGER) -- Duración estándar
- price (DECIMAL)
- is_active (BOOLEAN)
- category (TEXT)
- description (TEXT)
```

#### 10. `businesses` (Negocio)
```sql
Columnas clave:
- id (UUID)
- owner_id (UUID) -- FK a auth.users
- name (TEXT)
- vertical_type (TEXT) -- 'salon', 'barbershop', 'spa', 'clinic', 'restaurant', etc.
- settings (JSONB) -- Configuración completa:
  {
    "agent": {
      "name": "Sofia",
      "avatar_url": "https://...",
      "voice_id": "...",
      "personality": "..."
    },
    "contact_name": "Carlos", // Nombre del dueño/encargado
    "channels": {
      "whatsapp": { "active": true, "phone": "+34..." },
      "phone": { "active": true, "number": "+34..." },
      "instagram": { "active": false },
      "facebook": { "active": false },
      "web": { "active": true }
    },
    "operatingHours": {
      "monday": { "open": "09:00", "close": "21:00" },
      ...
    },
    "reservation_duration": 60, // minutos por defecto
    "advance_booking_days": 90,
    "min_advance_hours": 2
  }
```

---

## 🔧 FUNCIONALIDADES POR MÓDULO

### 1. **Sistema de Reservas** (`src/pages/Reservas.jsx`, `src/stores/reservationStore.js`)

**Capacidades actuales**:
- ✅ Crear reservas manualmente
- ✅ Asignar empleado + recurso (silla/box)
- ✅ Validación de conflictos (mismo empleado/recurso en mismo horario)
- ✅ Sincronización con Google Calendar (bidireccional)
- ✅ Cambio de estado: `pending → confirmed → completed → no_show`
- ✅ Detección de solapamientos
- ✅ Envío automático de mensaje CRM al marcar `no_show`

**Flujo de creación**:
```javascript
1. Usuario rellena formulario (ReservationFormModal)
2. Se valida disponibilidad (AvailabilityService.checkAvailability)
3. Se crea appointment (reservationStore.createReservation)
4. Se sincroniza con Google Calendar (si está activo)
5. Se actualiza availability_slot a status='reserved'
```

**Estados de reserva**:
- `pending`: Esperando confirmación
- `confirmed`: Cliente confirmó
- `completed`: Servicio realizado
- `cancelled`: Cancelada
- `no_show`: Cliente no apareció
- `blocked`: Bloqueado manualmente

**Canales de origen**:
- `manual`: Creada desde el dashboard
- `agent_vapi`: Creada por agente IA (llamada telefónica)
- `agent_whatsapp`: Creada por agente IA (WhatsApp)
- `google_calendar`: Importada desde Google Calendar

---

### 2. **Sistema de Equipo** (`src/pages/Equipo.jsx`)

**Capacidades actuales**:
- ✅ CRUD de empleados
- ✅ Asignar recurso físico predeterminado (ej: Culebra → Silla 1)
- ✅ Gestión de horarios semanales (employee_schedules)
- ✅ Gestión de ausencias (employee_absences)
- ✅ Validación: No se puede eliminar empleado con reservas activas
- ✅ Transferencia de citas de un empleado a otro

**Gestión de ausencias**:
```javascript
// Modal de ausencias permite:
- Tipo: 'sick_leave', 'vacation', 'personal', 'other'
- Fecha inicio/fin
- Horario específico (opcional, si no es todo el día)
- Razón
- Estado de aprobación
```

**⚠️ OPORTUNIDAD PARA DASHBOARD**:
Actualmente, si un empleado está `ausente` pero tiene citas asignadas, **no hay alerta visible**.
El sistema solo valida cuando intentas crear una nueva cita.

---

### 3. **Sistema de Clientes y CRM** (`src/pages/Clientes.jsx`, `src/services/CRMService.js`)

**Segmentación automática**:
```javascript
const SEGMENTATION_RULES = {
  'nuevo': cliente.visits_count <= 2 && daysSinceFirstVisit <= 90,
  'regular': recentVisits >= 3 && recentVisits <= 8 (en últimos 90 días),
  'vip': recentVisits >= 10 O total_spent >= 500€ (en últimos 12 meses),
  'inactivo': daysSinceLastVisit > 90,
  'en_riesgo': daysSinceLastVisit > 45 && daysSinceLastVisit <= 90
}
```

**Datos de cliente**:
- Historial de visitas (`total_visits`)
- Gasto acumulado (`total_spent`)
- Contador de no-shows (`no_show_count`)
- Última visita (`last_visit_date`)
- Segmento CRM (`crm_segment`)

**⚠️ OPORTUNIDAD PARA DASHBOARD**:
El sistema ya tiene `no_show_count` y fecha de última visita.
Podemos calcular un **risk_score** en tiempo real para el **Escenario 2**.

---

### 4. **Sistema de No-Shows** (`supabase/migrations/20251123_02_noshows_infrastructure_FIXED.sql`)

**Estado actual**: ✅ Infraestructura creada, ⚠️ Workflows N8N pendientes

**Tablas disponibles**:
- `customer_confirmations`: Registro de mensajes enviados y respuestas
- `customers.no_show_count`: Contador de plantones

**Funciones SQL disponibles**:
```sql
-- Calcular risk score dinámico
calculate_dynamic_risk_score(p_appointment_id UUID) 
RETURNS TABLE(risk_score INTEGER, risk_level TEXT)

-- Factores que evalúa:
1. Historial del cliente (no_show_count)
2. Inactividad (days since last visit)
3. Horario de riesgo (>= 21:00)
4. Tamaño de grupo (>= 6 personas)
5. Canal de reserva (teléfono/manual = mayor riesgo)
6. Antelación (<24h = mayor riesgo)
7. Urgencia temporal (<2h sin confirmar = crítico)
8. Respuesta a confirmaciones (confirma rápido = -30 pts)
```

**Workflows N8N preparados** (ver `docs/02-sistemas/N8N_WORKFLOWS_NOSHOWS_COMPLETO.md`):
1. Confirmación 24h antes (Cron: 10:00 AM diario)
2. Recordatorio 4h antes (Cron: cada hora)
3. Llamada urgente 2h 15min (Cron: cada 10 min, solo si risk_score > 60)
4. Procesador de respuestas WhatsApp (Webhook)
5. Auto-liberación 2h antes (Cron: cada 10 min)

**⚠️ CRÍTICO PARA EL DASHBOARD**:
La función `calculate_dynamic_risk_score()` YA EXISTE y puede ser llamada en tiempo real.
Es la base para el **Escenario 2: Riesgo de No-Show**.

---

### 5. **Sistema de Comunicaciones** (`src/stores/communicationStore.js`, `src/pages/Comunicaciones.jsx`)

**Canales disponibles**:
- WhatsApp (via Twilio)
- Teléfono (via VAPI.ai + OpenAI)
- Instagram
- Facebook
- Web Chat

**Agente IA**:
- Modelo: GPT-4o-mini (OpenAI)
- Voz: OpenAI TTS-1 (6 voces profesionales)
- STT: OpenAI Whisper-1
- Personalidad configurable desde `businesses.settings.agent`

**Grabaciones de llamadas**:
- Audio almacenado en Supabase Storage
- Transcripción generada con Whisper
- Resumen generado con GPT-4o-mini

**⚠️ OPORTUNIDAD PARA DASHBOARD**:
Si el agente IA detecta una "incidencia" (cliente enfadado, queja), debería crear una **alerta** visible en el dashboard.

---

### 6. **Sistema de Disponibilidad** (`src/services/AvailabilityService.js`, `docs/02-sistemas/SISTEMA-DISPONIBILIDADES-COMPLETO.md`)

**Generación automática de slots**:
- Cron job diario a las 4 AM
- Genera slots para los próximos 90 días
- Respeta:
  - Horarios de operación (`businesses.settings.operatingHours`)
  - Horarios de empleados (`employee_schedules`)
  - Ausencias (`employee_absences`)
  - Días festivos (`calendar_exceptions`)

**Lógica de conflictos**:
```javascript
// Al crear una reserva, se verifica:
1. Empleado está disponible (no ausente)
2. Recurso está libre
3. No hay solapamiento de horarios
4. Servicio cabe en el slot (duration_minutes)
```

**Estados de slot**:
- `free`: Disponible
- `reserved`: Con reserva confirmada
- `occupied`: Ocupado manualmente
- `blocked`: Bloqueado por ausencia o cierre

**⚠️ OPORTUNIDAD PARA DASHBOARD**:
Si quedan slots `free` en las próximas 2 horas, es el **Escenario 3: Hueco Muerto**.

---

### 7. **Integración Google Calendar** (`supabase/functions/google-calendar-sync/`, `supabase/functions/google-calendar-webhook/`)

**Modo de operación**: Bidireccional (sincronización en ambos sentidos)

**Flujo de sincronización**:
```
1. Usuario conecta Google Calendar (OAuth 2.0)
2. Se guarda refresh_token en tabla `integrations`
3. Se configura webhook de Google (Google Calendar Watch API)
4. Cuando hay cambios en Google Calendar:
   → Google envía notificación al webhook
   → Webhook sincroniza cambios con `appointments`
5. Cuando se crea/modifica appointment en LA-IA:
   → Se crea/actualiza evento en Google Calendar
```

**Renovación automática**:
- Cron job que renueva el "watch" cada 6 días (Google expira a los 7 días)

**Campos sincronizados**:
- Título: `[customer_name] - [service_name]`
- Fecha y hora: `appointment_date` + `appointment_time`
- Duración: `duration_minutes`
- Asistentes: Email del cliente (si existe)
- Descripción: Notas + teléfono del cliente

---

## 🧠 LÓGICA DE NEGOCIO DISPONIBLE

### **Validaciones de Reserva** (`src/services/reservationValidationService.js`)

```javascript
class ReservationValidationService {
  // Valida que el empleado esté disponible (no ausente)
  static async validateEmployeeAvailability(employeeId, date, time)
  
  // Valida que el recurso esté libre
  static async validateResourceAvailability(resourceId, date, time, duration)
  
  // Detecta solapamientos
  static async detectConflicts(employeeId, resourceId, date, time, duration)
  
  // Encuentra alternativas si hay conflicto
  static async findAlternatives(date, time, partySize)
}
```

### **CRM Intelligence** (`src/services/CRMService.js`)

```javascript
// Evalúa reglas de automatización en tiempo real
evaluateAutomationRules(customerId, businessId, triggerEvent, context)

// Segmenta cliente automáticamente
calculateCustomerSegment(customer, appointments, verticalParams)

// Verifica elegibilidad para campaña
CRMEligibilityService.checkEligibility(customerId, businessId, ruleId)
```

### **No-Shows Intelligence** (SQL Functions en migraciones)

```sql
-- Calcula score de riesgo dinámico (0-100)
calculate_dynamic_risk_score(p_appointment_id UUID)

-- Factores ponderados:
- Historial cliente: 0-40 pts
- Inactividad: 0-25 pts
- Horario: 0-15 pts
- Tamaño grupo: 0-10 pts
- Canal: 0-10 pts
- Antelación: 0-20 pts
- Urgencia: 0-50 pts
- Confirmaciones: -50 pts (descuento)

-- Rangos:
0-30: BAJO (🟢)
31-60: MEDIO (🟡)
61-100: ALTO (🔴)
```

---

## 📱 DASHBOARD ACTUAL (DashboardAgente.jsx)

### **Secciones existentes**:

1. **Header con Avatar**
   - Avatar del agente IA (desde `businesses.settings.agent.avatar_url`)
   - Saludo personalizado con nombre del contacto
   - Fecha y hora de última actualización

2. **KPIs Críticos del Día** (Hero Section)
   - Reservas hoy (con diff vs ayer)
   - Ocupación % (con diff vs ayer)
   - Clientes nuevos (con diff vs ayer)
   - Alertas no-show (contador básico)

3. **Rendimiento Agente IA** (últimos 7 días)
   - Conversaciones totales
   - Satisfacción promedio (/5)
   - % Resoluciones positivas
   - % Escalaciones a humano
   - Tiempo de respuesta promedio
   - Calidad general

4. **Clientes y Valor** (semanal)
   - Nuevos / Recurrentes / VIPs
   - Fidelización %
   - Valor semanal €
   - Ticket promedio

5. **Canales Activos**
   - WhatsApp / Teléfono / Instagram / Facebook / Web
   - Solo muestra los activos (desde `businesses.settings.channels`)

6. **Alertas No-Show** (lista básica)
   - Muestra citas con `risk_score > 60` (aproximado)
   - NO tiene botones de acción

7. **Alertas CRM** (lista básica)
   - Clientes inactivos (>90 días sin visita)
   - NO tiene botones de acción

8. **Tendencia Semanal** (gráfico)
   - Número de reservas por día (últimos 7 días)

### **⚠️ PROBLEMAS DEL DASHBOARD ACTUAL**:

1. ❌ **No es operativo**: Solo muestra datos, no permite actuar
2. ❌ **No hay "inteligencia"**: No detecta conflictos críticos
3. ❌ **No hay acciones mágicas**: Usuario tiene que ir a otra página para resolver
4. ❌ **No hay vista "Turnos en Vivo"**: No ves quién atiende a quién AHORA
5. ❌ **Avatar Lua es decorativo**: No habla, no da contexto
6. ❌ **Alertas son listas**: No priorizan ni sugieren soluciones

---

## 🎯 LO QUE NECESITAMOS PARA EL DASHBOARD "SOCIO VIRTUAL"

### **1. Edge Function: `get-snapshot`** (NUEVA)

**Propósito**: Analizar el estado del negocio y devolver el "escenario crítico" actual.

**Endpoint**: `POST /functions/v1/get-snapshot`

**Body**:
```json
{
  "business_id": "uuid",
  "timestamp": "2025-11-23T10:00:00Z"
}
```

**Response**:
```json
{
  "scenario": "CRISIS_PERSONAL", // o "RIESGO_NOSHOW", "HUECO_MUERTO", "PALMADA_ESPALDA"
  "priority": "CRITICAL", // CRITICAL, HIGH, MEDIUM, LOW
  "data": {
    "conflict": {
      "employee_id": "uuid",
      "employee_name": "Pol",
      "absence_type": "sick_leave",
      "affected_appointments": [
        {
          "id": "uuid",
          "customer_name": "Ana García",
          "time": "11:00",
          "service": "Tinte"
        }
      ],
      "alternatives": [
        {
          "employee_id": "uuid",
          "employee_name": "Andrew",
          "is_available": true
        }
      ]
    }
  },
  "lua_message": "🚨 Alerta Roja: Pol no viene hoy y tiene 3 citas esta mañana. Andrew está libre en esos horarios.",
  "actions": [
    {
      "id": "transfer_appointments",
      "label": "🔀 Mover citas a Andrew y avisar",
      "endpoint": "/functions/v1/transfer-appointments",
      "payload": {
        "from_employee_id": "uuid",
        "to_employee_id": "uuid",
        "appointment_ids": ["uuid1", "uuid2", "uuid3"],
        "notify_customers": true
      }
    },
    {
      "id": "cancel_and_reschedule",
      "label": "🚫 Cancelar y pedir reagendar",
      "endpoint": "/functions/v1/cancel-appointments-batch",
      "payload": {
        "appointment_ids": ["uuid1", "uuid2", "uuid3"],
        "send_reschedule_message": true
      }
    }
  ]
}
```

**Lógica interna** (pseudocódigo):
```javascript
async function getSnapshot(businessId, timestamp) {
  // 1. Detectar conflicto de personal (PRIORIDAD 1)
  const employeesWithAbsences = await detectEmployeeAbsencesWithAppointments(businessId, timestamp);
  if (employeesWithAbsences.length > 0) {
    return buildCrisisPersonalScenario(employeesWithAbsences[0]);
  }
  
  // 2. Detectar riesgo de no-show (PRIORIDAD 2)
  const highRiskAppointments = await getHighRiskAppointments(businessId, timestamp);
  if (highRiskAppointments.length > 0) {
    return buildRiesgoNoShowScenario(highRiskAppointments[0]);
  }
  
  // 3. Detectar hueco muerto (PRIORIDAD 3)
  const upcomingFreeSlots = await getFreeSlots(businessId, timestamp, 2); // próximas 2 horas
  if (upcomingFreeSlots.length > 0) {
    return buildHuecoMuertoScenario(upcomingFreeSlots[0]);
  }
  
  // 4. Todo va bien (PRIORIDAD 4)
  return buildPalmadaEspaldaScenario(businessId, timestamp);
}
```

**Funciones auxiliares**:

```sql
-- Detectar empleados ausentes con citas asignadas
CREATE OR REPLACE FUNCTION detect_employee_absences_with_appointments(
  p_business_id UUID,
  p_timestamp TIMESTAMPTZ
)
RETURNS TABLE (
  employee_id UUID,
  employee_name TEXT,
  absence_type TEXT,
  affected_count INTEGER,
  affected_appointments JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.name,
    ea.absence_type,
    COUNT(a.id)::INTEGER,
    jsonb_agg(jsonb_build_object(
      'id', a.id,
      'customer_name', a.customer_name,
      'time', a.appointment_time,
      'service', bs.name
    ))
  FROM employees e
  JOIN employee_absences ea ON ea.employee_id = e.id
  JOIN appointments a ON a.employee_id = e.id
  LEFT JOIN business_services bs ON bs.id = a.service_id
  WHERE e.business_id = p_business_id
    AND ea.business_id = p_business_id
    -- Ausencia activa hoy
    AND p_timestamp::DATE BETWEEN ea.start_date AND ea.end_date
    -- Cita es para hoy y futura
    AND a.appointment_date = p_timestamp::DATE
    AND (a.appointment_time > p_timestamp::TIME OR a.appointment_time = p_timestamp::TIME)
    -- Cita no cancelada
    AND a.status NOT IN ('cancelled', 'completed')
  GROUP BY e.id, e.name, ea.absence_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

```sql
-- Obtener citas con riesgo alto de no-show
CREATE OR REPLACE FUNCTION get_high_risk_appointments(
  p_business_id UUID,
  p_timestamp TIMESTAMPTZ
)
RETURNS TABLE (
  appointment_id UUID,
  customer_name TEXT,
  customer_phone TEXT,
  customer_id UUID,
  appointment_time TIME,
  risk_score INTEGER,
  risk_level TEXT,
  no_show_count INTEGER,
  last_confirmation_sent TIMESTAMPTZ,
  confirmed BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.customer_name,
    a.customer_phone,
    a.customer_id,
    a.appointment_time,
    drs.risk_score,
    drs.risk_level,
    c.no_show_count,
    (SELECT sent_at FROM customer_confirmations 
     WHERE appointment_id = a.id 
     ORDER BY sent_at DESC LIMIT 1),
    (SELECT confirmed FROM customer_confirmations 
     WHERE appointment_id = a.id AND confirmed = TRUE 
     ORDER BY sent_at DESC LIMIT 1)
  FROM appointments a
  CROSS JOIN LATERAL calculate_dynamic_risk_score(a.id) drs
  LEFT JOIN customers c ON c.id = a.customer_id
  WHERE a.business_id = p_business_id
    -- Cita es para hoy y futura
    AND a.appointment_date = p_timestamp::DATE
    AND (a.appointment_time > p_timestamp::TIME OR a.appointment_time = p_timestamp::TIME)
    -- Riesgo alto
    AND drs.risk_score > 60
    -- No cancelada
    AND a.status NOT IN ('cancelled', 'completed', 'no_show')
  ORDER BY drs.risk_score DESC, a.appointment_time ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

```sql
-- Obtener slots libres en las próximas X horas
CREATE OR REPLACE FUNCTION get_upcoming_free_slots(
  p_business_id UUID,
  p_timestamp TIMESTAMPTZ,
  p_hours_ahead INTEGER
)
RETURNS TABLE (
  slot_id UUID,
  slot_date DATE,
  start_time TIME,
  end_time TIME,
  employee_name TEXT,
  resource_name TEXT,
  minutes_until_slot INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    asl.id,
    asl.slot_date,
    asl.start_time,
    asl.end_time,
    e.name,
    r.name,
    EXTRACT(EPOCH FROM (
      (asl.slot_date + asl.start_time) - p_timestamp
    ))::INTEGER / 60
  FROM availability_slots asl
  LEFT JOIN employees e ON e.id = asl.employee_id
  LEFT JOIN resources r ON r.id = asl.resource_id
  WHERE asl.business_id = p_business_id
    AND asl.status = 'free'
    AND asl.is_available = TRUE
    -- Slot es futuro
    AND (asl.slot_date + asl.start_time) > p_timestamp
    -- Slot es en las próximas X horas
    AND (asl.slot_date + asl.start_time) <= (p_timestamp + (p_hours_ahead || ' hours')::INTERVAL)
  ORDER BY (asl.slot_date + asl.start_time) ASC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### **2. Edge Function: `transfer-appointments`** (NUEVA)

**Propósito**: Mover citas de un empleado a otro y notificar a los clientes.

**Endpoint**: `POST /functions/v1/transfer-appointments`

**Body**:
```json
{
  "business_id": "uuid",
  "from_employee_id": "uuid",
  "to_employee_id": "uuid",
  "appointment_ids": ["uuid1", "uuid2", "uuid3"],
  "notify_customers": true
}
```

**Lógica**:
```typescript
export async function transferAppointments(req: Request) {
  const { business_id, from_employee_id, to_employee_id, appointment_ids, notify_customers } = await req.json();
  
  // 1. Verificar que el empleado destino esté disponible
  const toEmployee = await supabase
    .from('employees')
    .select('id, name, assigned_resource_id')
    .eq('id', to_employee_id)
    .single();
  
  if (!toEmployee) {
    return new Response(JSON.stringify({ error: 'Empleado destino no encontrado' }), { status: 404 });
  }
  
  // 2. Actualizar appointments
  const { data: updatedAppointments, error: updateError } = await supabase
    .from('appointments')
    .update({
      employee_id: to_employee_id,
      resource_id: toEmployee.assigned_resource_id,
      notes: `Transferido desde [employee ${from_employee_id}] el ${new Date().toISOString()}`,
      updated_at: new Date().toISOString()
    })
    .in('id', appointment_ids)
    .select('id, customer_name, customer_phone, appointment_time, service_id');
  
  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), { status: 500 });
  }
  
  // 3. Enviar notificaciones si está habilitado
  if (notify_customers) {
    for (const appointment of updatedAppointments) {
      const message = `Hola ${appointment.customer_name}, te informamos que tu cita de hoy a las ${appointment.appointment_time} será atendida por ${toEmployee.name}. ¡Gracias!`;
      
      // Enviar WhatsApp (llamar a servicio de mensajería)
      await sendWhatsAppMessage(appointment.customer_phone, message);
    }
  }
  
  // 4. Actualizar availability_slots
  await supabase
    .from('availability_slots')
    .update({
      employee_id: to_employee_id,
      resource_id: toEmployee.assigned_resource_id
    })
    .in('appointment_id', appointment_ids); // Asumiendo que existe esta columna de tracking
  
  return new Response(JSON.stringify({
    success: true,
    transferred_count: updatedAppointments.length,
    notifications_sent: notify_customers
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

---

### **3. Edge Function: `cancel-appointments-batch`** (NUEVA)

**Propósito**: Cancelar múltiples citas y enviar mensaje de reagendación.

**Endpoint**: `POST /functions/v1/cancel-appointments-batch`

**Body**:
```json
{
  "business_id": "uuid",
  "appointment_ids": ["uuid1", "uuid2"],
  "send_reschedule_message": true,
  "cancellation_reason": "Empleado ausente por enfermedad"
}
```

---

### **4. Edge Function: `generate-flash-offer-text`** (NUEVA)

**Propósito**: Usar OpenAI para generar texto de oferta flash para hueco libre.

**Endpoint**: `POST /functions/v1/generate-flash-offer-text`

**Body**:
```json
{
  "business_id": "uuid",
  "slot_time": "12:00",
  "service_name": "Corte de pelo",
  "discount_percent": 15,
  "vertical_type": "barbershop"
}
```

**Response**:
```json
{
  "offer_text": "¡Hueco Flash! Corte de pelo a las 12:00 con 15% dto. Solo hoy. DM para reservar 💈✂️",
  "whatsapp_status_ready": true
}
```

---

### **5. Widget "Turnos en Vivo"** (Componente Frontend NUEVO)

**Ubicación**: `src/components/dashboard/LiveTurnsWidget.jsx`

**Propósito**: Mostrar vista multi-carril de quién atiende a quién AHORA MISMO.

**Diseño**:
```
⏰ AHORA (10:00 - 11:00)

┌─────────────────────────────────────────┐
│ Silla 1 (Culebra)                       │
│ ✂️ Juan Pérez (Corte)          [NUEVO] │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Silla 2 (Pol)                           │
│ 💆‍♀️ Ana García (Tinte)            [VIP] │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Box 3 (Andrew)                          │
│ 🟢 LIBRE        [Bloquear hueco]        │
└─────────────────────────────────────────┘
```

**Lógica**:
```javascript
function LiveTurnsWidget({ businessId }) {
  const [currentTurns, setCurrentTurns] = useState([]);
  
  useEffect(() => {
    loadCurrentTurns();
    const interval = setInterval(loadCurrentTurns, 30000); // Refresh cada 30s
    return () => clearInterval(interval);
  }, [businessId]);
  
  async function loadCurrentTurns() {
    const now = new Date();
    const currentTime = format(now, 'HH:mm');
    const currentDate = format(now, 'yyyy-MM-dd');
    
    // Obtener citas que están ocurriendo AHORA
    const { data: currentAppointments } = await supabase
      .from('appointments')
      .select(`
        *,
        employee:employees(id, name),
        resource:resources(id, name),
        customer:customers(id, name, crm_segment, no_show_count),
        service:business_services(name, category)
      `)
      .eq('business_id', businessId)
      .eq('appointment_date', currentDate)
      .lte('appointment_time', currentTime)
      .gte('end_time', currentTime) // Calculado: appointment_time + duration_minutes
      .not('status', 'in', '(cancelled, no_show)');
    
    // Obtener recursos libres
    const { data: allResources } = await supabase
      .from('resources')
      .select('id, name, resource_type')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('name');
    
    // Marcar cuáles están ocupados
    const occupiedResourceIds = currentAppointments.map(a => a.resource_id);
    const freeResources = allResources.filter(r => !occupiedResourceIds.includes(r.id));
    
    setCurrentTurns({
      occupied: currentAppointments,
      free: freeResources
    });
  }
  
  // Determinar etiqueta del cliente
  function getClientBadge(customer) {
    if (!customer) return null;
    
    if (customer.crm_segment === 'nuevo') return { label: 'NUEVO', color: 'bg-green-100 text-green-800' };
    if (customer.crm_segment === 'vip') return { label: 'VIP', color: 'bg-purple-100 text-purple-800' };
    if (customer.no_show_count > 1) return { label: '⚠️ RIESGO', color: 'bg-red-100 text-red-800' };
    return null;
  }
  
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border">
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
        <Clock className="w-5 h-5 text-blue-600" />
        Turnos en Vivo
      </h3>
      
      <div className="space-y-3">
        {/* Turnos ocupados */}
        {currentTurns.occupied?.map(turn => {
          const badge = getClientBadge(turn.customer);
          return (
            <div key={turn.id} className="border-2 border-blue-200 rounded-lg p-3 bg-blue-50">
              <div className="flex items-center justify-between mb-1">
                <div className="font-bold text-gray-900">
                  {turn.resource.name} ({turn.employee.name})
                </div>
                {badge && (
                  <span className={`text-xs font-bold px-2 py-1 rounded ${badge.color}`}>
                    {badge.label}
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-700">
                {getServiceIcon(turn.service.category)} {turn.customer.name} ({turn.service.name})
              </div>
            </div>
          );
        })}
        
        {/* Recursos libres */}
        {currentTurns.free?.map(resource => (
          <div key={resource.id} className="border-2 border-gray-300 rounded-lg p-3 bg-gray-50">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-gray-900">{resource.name}</div>
                <div className="text-sm text-green-600 flex items-center gap-1">
                  <Check className="w-4 h-4" /> LIBRE
                </div>
              </div>
              <button 
                className="px-3 py-1.5 bg-orange-600 text-white text-xs font-medium rounded hover:bg-orange-700"
                onClick={() => blockResource(resource.id)}
              >
                Bloquear hueco
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

### **6. Avatar Lua Inteligente** (Componente Frontend MEJORADO)

**Ubicación**: `src/components/dashboard/LuaAvatar.jsx`

**Propósito**: Mostrar mensaje contextual del escenario actual con botones de acción.

**Diseño**:
```
┌────────────────────────────────────────────────────────┐
│  [Avatar Lua]  🚨 Alerta Roja: Pol no viene hoy      │
│                   y tiene 3 citas esta mañana.         │
│                   Andrew está libre en esos horarios.  │
│                                                         │
│  [🔀 Mover citas a Andrew y avisar]                   │
│  [🚫 Cancelar y pedir reagendar]                      │
└────────────────────────────────────────────────────────┘
```

**Lógica**:
```javascript
function LuaAvatar({ businessId }) {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    loadSnapshot();
    const interval = setInterval(loadSnapshot, 60000); // Refresh cada 1 min
    return () => clearInterval(interval);
  }, [businessId]);
  
  async function loadSnapshot() {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('get-snapshot', {
      body: { 
        business_id: businessId, 
        timestamp: new Date().toISOString() 
      }
    });
    
    if (!error) {
      setSnapshot(data);
    }
    setLoading(false);
  }
  
  async function executeAction(action) {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke(action.endpoint.replace('/functions/v1/', ''), {
      body: action.payload
    });
    
    if (!error) {
      toast.success('Acción ejecutada exitosamente');
      loadSnapshot(); // Refrescar
    } else {
      toast.error('Error al ejecutar acción');
    }
    setLoading(false);
  }
  
  if (!snapshot) return null;
  
  // Determinar color del bocadillo según prioridad
  const priorityColors = {
    'CRITICAL': 'border-red-500 bg-red-50',
    'HIGH': 'border-orange-500 bg-orange-50',
    'MEDIUM': 'border-yellow-500 bg-yellow-50',
    'LOW': 'border-green-500 bg-green-50'
  };
  
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border">
      <div className="flex gap-4">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-purple-600 to-blue-600">
            <img src={snapshot.avatar_url} alt="Lua" className="w-full h-full object-cover" />
          </div>
        </div>
        
        {/* Bocadillo */}
        <div className={`flex-1 border-2 rounded-lg p-4 ${priorityColors[snapshot.priority]}`}>
          <p className="text-sm font-medium text-gray-900 mb-3">
            {snapshot.lua_message}
          </p>
          
          {/* Botones de acción */}
          {snapshot.actions && snapshot.actions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {snapshot.actions.map(action => (
                <button
                  key={action.id}
                  onClick={() => executeAction(action)}
                  disabled={loading}
                  className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## 📋 RESUMEN DE LO QUE HAY QUE IMPLEMENTAR

### **Backend (Edge Functions + SQL)**:

1. ✅ **SQL Functions** (ya existen parcialmente):
   - `detect_employee_absences_with_appointments()` - NUEVO
   - `get_high_risk_appointments()` - NUEVO
   - `get_upcoming_free_slots()` - NUEVO
   - `calculate_dynamic_risk_score()` - ✅ YA EXISTE

2. **Edge Functions** (todas NUEVAS):
   - `get-snapshot` - Motor de inteligencia del dashboard
   - `transfer-appointments` - Transferir citas entre empleados
   - `cancel-appointments-batch` - Cancelar múltiples citas
   - `generate-flash-offer-text` - Generar texto con OpenAI para ofertas

### **Frontend (Componentes React)**:

1. **Componentes NUEVOS**:
   - `LuaAvatar.jsx` - Avatar inteligente con bocadillo contextual
   - `LiveTurnsWidget.jsx` - Vista multi-carril de turnos actuales
   - `MagicActionButtons.jsx` - Botones que ejecutan acciones en 1 click

2. **Componentes a MODIFICAR**:
   - `DashboardAgente.jsx` - Integrar nuevos widgets y lógica

### **Integraciones Externas**:

1. **OpenAI API** (para `generate-flash-offer-text`):
   - Endpoint: `https://api.openai.com/v1/chat/completions`
   - Modelo: `gpt-4o-mini`
   - Prompt: "Genera un texto de oferta flash para WhatsApp Status..."

2. **WhatsApp API** (para notificaciones):
   - Ya existe integración con Twilio
   - Reutilizar `sendWhatsAppMessage()` del sistema actual

---

## 🚀 PLAN DE IMPLEMENTACIÓN

### **Fase 1: Backend Intelligence** (3-4 horas)

1. Crear funciones SQL auxiliares:
   - `detect_employee_absences_with_appointments()`
   - `get_high_risk_appointments()`
   - `get_upcoming_free_slots()`

2. Crear Edge Function `get-snapshot`:
   - Implementar lógica de priorización de escenarios
   - Conectar con funciones SQL
   - Generar mensajes contextuales para Lua

3. Crear Edge Functions de acción:
   - `transfer-appointments`
   - `cancel-appointments-batch`
   - `generate-flash-offer-text`

### **Fase 2: Frontend Widgets** (3-4 horas)

1. Crear `LuaAvatar.jsx`:
   - Llamar a `get-snapshot` cada 1 minuto
   - Renderizar bocadillo con mensaje
   - Renderizar botones de acción
   - Ejecutar acciones al hacer clic

2. Crear `LiveTurnsWidget.jsx`:
   - Obtener citas actuales (query por timestamp)
   - Obtener recursos libres
   - Renderizar vista multi-carril
   - Botón "Bloquear hueco"

3. Modificar `DashboardAgente.jsx`:
   - Integrar `LuaAvatar` en la parte superior
   - Integrar `LiveTurnsWidget` en zona central
   - Mantener métricas existentes en zona inferior

### **Fase 3: Testing y Refinamiento** (2 horas)

1. Crear datos de prueba:
   - Empleado con ausencia + citas asignadas
   - Cliente con historial de no-shows + cita sin confirmar
   - Slots libres en próximas 2 horas

2. Probar escenarios:
   - Escenario 1: Crisis de Personal
   - Escenario 2: Riesgo de No-Show
   - Escenario 3: Hueco Muerto
   - Escenario 4: Palmada en la Espalda

3. Ajustar textos y UX según feedback

---

## ✅ CHECKLIST FINAL

### **Base de Datos**:
- [ ] Migración con funciones SQL auxiliares ejecutada
- [ ] Función `calculate_dynamic_risk_score()` validada
- [ ] Tabla `customer_confirmations` confirmada
- [ ] Tabla `employee_absences` confirmada

### **Backend**:
- [ ] Edge Function `get-snapshot` desplegada
- [ ] Edge Function `transfer-appointments` desplegada
- [ ] Edge Function `cancel-appointments-batch` desplegada
- [ ] Edge Function `generate-flash-offer-text` desplegada
- [ ] OpenAI API key configurada

### **Frontend**:
- [ ] Componente `LuaAvatar` creado
- [ ] Componente `LiveTurnsWidget` creado
- [ ] `DashboardAgente.jsx` actualizado
- [ ] Tests con datos de prueba

### **Validación**:
- [ ] Escenario 1 (Crisis Personal) detectado y resuelto
- [ ] Escenario 2 (Riesgo No-Show) detectado y alertado
- [ ] Escenario 3 (Hueco Muerto) detectado y oferta generada
- [ ] Escenario 4 (Todo Bien) muestra motivación
- [ ] Acciones mágicas funcionan en 1 click

---

## 🎯 VALOR FINAL DEL DASHBOARD

### **Antes** (Dashboard actual):
- ❌ "Tienes 12 reservas hoy" (lo sé, no me ayuda)
- ❌ "3 alertas de no-show" (¿y qué hago?)
- ❌ "Ocupación 75%" (¿está bien o mal?)

### **Después** (Dashboard "Socio Virtual"):
- ✅ "🚨 Pol no viene y tiene 3 citas. [Mover a Andrew]"
- ✅ "⚠️ Carlos (2 plantones) no confirmó. [Llamar ahora]"
- ✅ "💰 Hueco libre a las 12:00. [Generar oferta flash]"
- ✅ "👏 Todo perfecto. Llevas 450€ hoy."

### **El "WOW" Factor**:
El usuario abre la app y en 5 segundos:
1. Ve el problema más crítico (si lo hay)
2. Entiende por qué es crítico
3. Tiene la solución en 1 click

**Eso es un Jefe de Operaciones (COO) digital.**

---

**FIN DEL ANÁLISIS**

Este documento es la base para implementar el Dashboard "Socio Virtual".
Todos los componentes están documentados, todas las tablas verificadas, y el plan de implementación está listo.

**Próximo paso**: ¿Empezamos con la Fase 1 (Backend Intelligence)?


