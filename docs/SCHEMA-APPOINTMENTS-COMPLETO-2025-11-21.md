# 📋 ESQUEMA COMPLETO: Tabla `appointments`

**Última actualización:** 21 de Noviembre 2025  
**Versión del esquema:** 2.0 (con Google Calendar Integration)  
**Fuente de verdad:** Migraciones aplicadas en Supabase

---

## 🎯 Tabla: `appointments`

### **CREATE TABLE Statement:**

```sql
CREATE TABLE appointments (
    -- PRIMARY KEY
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- FOREIGN KEYS
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES business_services(id) ON DELETE CASCADE,
    resource_id UUID REFERENCES resources(id) ON DELETE SET NULL,
    employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    
    -- Datos del cliente (duplicados para performance)
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    
    -- Fecha y hora
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    duration_minutes INTEGER NOT NULL,
    end_time TIME,
    
    -- Estado y metadata
    status appointment_status DEFAULT 'confirmed'::appointment_status,
    source VARCHAR(50) DEFAULT 'web',
    channel channel_type DEFAULT 'web'::channel_type,
    notes TEXT,
    special_requests TEXT,
    internal_notes JSONB DEFAULT '{}'::jsonb,
    amount_paid NUMERIC DEFAULT 0.00,
    
    -- Google Calendar Integration
    gcal_event_id TEXT,
    calendar_id TEXT,
    synced_to_gcal BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 📊 Columnas Detalladas

| Columna | Tipo | Nullable | Default | Descripción | Agregado |
|---------|------|----------|---------|-------------|----------|
| `id` | UUID | NO | `gen_random_uuid()` | Primary Key | Original |
| `business_id` | UUID | NO | - | FK a `businesses` | Original |
| `customer_id` | UUID | NO | - | FK a `customers` | Original |
| `service_id` | UUID | NO | - | FK a `business_services` | Original |
| `resource_id` | UUID | YES | - | FK a `resources` (legacy) | Original |
| `employee_id` | UUID | YES | - | FK a `employees` | 2025-11-17 |
| `customer_name` | VARCHAR(255) | NO | - | Nombre del cliente | Original |
| `customer_email` | VARCHAR(255) | YES | - | Email del cliente | Original |
| `customer_phone` | VARCHAR(50) | YES | - | Teléfono del cliente | Original |
| `appointment_date` | DATE | NO | - | Fecha de la cita | Original |
| `appointment_time` | TIME | NO | - | Hora de la cita | Original |
| `duration_minutes` | INTEGER | NO | - | Duración en minutos | Original |
| `end_time` | TIME | YES | - | Hora de finalización | Original |
| `status` | appointment_status | YES | `'confirmed'` | Estado de la cita | Original |
| `source` | VARCHAR(50) | YES | `'web'` | Fuente de creación | Original |
| `channel` | channel_type | YES | `'web'` | Canal de reserva | Original |
| `notes` | TEXT | YES | - | Notas generales | Original |
| `special_requests` | TEXT | YES | - | Peticiones especiales | Original |
| `internal_notes` | JSONB | YES | `'{}'::jsonb` | Notas internas (JSONB) | 2025-11-21* |
| `amount_paid` | NUMERIC | YES | `0.00` | Monto pagado | Original |
| `gcal_event_id` | TEXT | YES | - | ID evento Google Calendar | 2025-11-21 |
| `calendar_id` | TEXT | YES | - | ID calendario Google Calendar | 2025-11-21 |
| `synced_to_gcal` | BOOLEAN | YES | `FALSE` | Sincronizado con GCal | 2025-11-21 |
| `created_at` | TIMESTAMPTZ | NO | `now()` | Fecha de creación | Original |
| `updated_at` | TIMESTAMPTZ | NO | `now()` | Última actualización | Original |

*`internal_notes` fue convertido de TEXT a JSONB el 2025-11-21

---

## 📦 Estructura de `internal_notes` (JSONB)

El campo `internal_notes` es un JSONB que almacena información adicional:

```json
{
  "gcal_event_id": "event_id_from_google_calendar",
  "calendar_id": "calendar_id_from_google_calendar",
  "synced_to_gcal": true,
  "synced_at": "2025-11-21T10:00:00Z",
  "source": "google_calendar_import",
  "original_summary": "Título original del evento",
  "original_description": "Descripción original del evento",
  "extracted_customer_name": "Nombre extraído del evento",
  "extracted_customer_email": "Email extraído del evento",
  "extracted_customer_phone": "Teléfono extraído del evento",
  "requires_manual_assignment": false,
  "import_source": "google_calendar"
}
```

### **Uso en Código:**

```typescript
// ✅ CORRECTO: Supabase maneja JSONB automáticamente
await supabaseClient
  .from('appointments')
  .update({
    internal_notes: {
      gcal_event_id: eventId,
      calendar_id: calendarId,
      synced_to_gcal: true,
    }
  })

// ❌ INCORRECTO: No usar JSON.stringify() con JSONB
await supabaseClient
  .from('appointments')
  .update({
    internal_notes: JSON.stringify({ ... }) // ❌ NO hacer esto
  })

// ✅ Lectura: Supabase devuelve JSONB como objeto
const notes = appointment.internal_notes // Ya es un objeto
const gcalEventId = notes?.gcal_event_id

// ✅ Manejo de legacy (si viene como string)
const notes = typeof appointment.internal_notes === 'string'
  ? JSON.parse(appointment.internal_notes)
  : appointment.internal_notes
```

---

## 🔢 Enum `appointment_status`

Valores válidos (actualizado 2025-11-21):

| Valor | Descripción | Agregado |
|-------|-------------|----------|
| `pending` | Pendiente de confirmación | Original |
| `pending_approval` | Requiere aprobación (grupos grandes) | Original |
| `confirmed` | Confirmada | Original |
| `completed` | Completada | Original |
| `cancelled` | Cancelada | Original |
| `no_show` | No se presentó | Original |
| `blocked` | Bloqueado (eventos de Google Calendar) | 2025-11-21 |

---

## 🔍 Índices

```sql
-- Índices básicos
CREATE INDEX idx_appointments_business_id ON appointments(business_id);
CREATE INDEX idx_appointments_customer_id ON appointments(customer_id);
CREATE INDEX idx_appointments_appointment_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_status ON appointments(status);

-- Índices para employee_id (2025-11-17)
CREATE INDEX idx_appointments_employee_id ON appointments(employee_id);
CREATE INDEX idx_appointments_business_employee_date 
ON appointments(business_id, employee_id, appointment_date) 
WHERE employee_id IS NOT NULL;

-- Índices para Google Calendar (2025-11-21)
CREATE INDEX idx_appointments_gcal_event_id 
ON appointments(gcal_event_id) 
WHERE gcal_event_id IS NOT NULL;

CREATE INDEX idx_appointments_calendar_id 
ON appointments(calendar_id) 
WHERE calendar_id IS NOT NULL;

CREATE INDEX idx_appointments_synced_to_gcal 
ON appointments(synced_to_gcal) 
WHERE synced_to_gcal = TRUE;

-- Índice GIN para búsquedas en JSONB (2025-11-21)
CREATE INDEX idx_appointments_internal_notes_gin 
ON appointments USING GIN (internal_notes) 
WHERE internal_notes IS NOT NULL;
```

---

## 🔗 Foreign Keys

| Columna | Tabla Referenciada | Columna Referenciada | ON DELETE |
|---------|-------------------|---------------------|-----------|
| `business_id` | `businesses` | `id` | CASCADE |
| `customer_id` | `customers` | `id` | CASCADE |
| `service_id` | `business_services` | `id` | CASCADE |
| `resource_id` | `resources` | `id` | SET NULL |
| `employee_id` | `employees` | `id` | SET NULL |

---

## 📝 Migraciones Aplicadas

### **2025-11-17:**
- `20251117_04_add_employee_id_to_appointments.sql`
  - Agregado `employee_id` (UUID, nullable)
  - Índices para `employee_id`

### **2025-11-21:**
- `20251121_01_add_blocked_status_and_gcal_fields.sql`
  - Agregado `gcal_event_id` (TEXT)
  - Agregado `calendar_id` (TEXT)
  - Agregado status `blocked` al enum `appointment_status`
  - Índices para campos de Google Calendar

- `20251121_05_verify_appointments_schema.sql`
  - Convertido `internal_notes` de TEXT a JSONB
  - Agregado `synced_to_gcal` (BOOLEAN)
  - Índice GIN para `internal_notes`

---

## ⚠️ Nombres Correctos vs Incorrectos

| ❌ INCORRECTO | ✅ CORRECTO |
|--------------|-------------|
| `reservations` | `appointments` |
| `reservation_date` | `appointment_date` |
| `reservation_time` | `appointment_time` |
| `services` | `business_services` |
| `internal_notes` (TEXT) | `internal_notes` (JSONB) |

---

## 🔧 Edge Functions Relacionadas

### **`import-google-calendar-initial`**
- Importa eventos de Google Calendar a `appointments`
- Usa `gcal_event_id`, `calendar_id`, `internal_notes`
- Crea appointments con status `blocked`

### **`sync-google-calendar`**
- Sincronización bidireccional con Google Calendar
- Usa `gcal_event_id`, `calendar_id`, `synced_to_gcal`
- Actualiza `internal_notes` con información de sincronización

### **`google-calendar-webhook`**
- Recibe notificaciones push de Google Calendar
- Actualiza `appointments` cuando hay cambios en Google Calendar

---

## 📚 Referencias

- **Documentación de corrección:** `docs/SCHEMA-CORRECTION-APPOINTMENTS-2025.md`
- **Schema principal:** `docs/01-arquitectura/⚠️-LEER-PRIMERO-SCHEMA-SUPABASE.md`
- **Migraciones:** `supabase/migrations/`

---

**Última actualización:** 21 de Noviembre 2025  
**Mantenido por:** Sistema de migraciones de Supabase

