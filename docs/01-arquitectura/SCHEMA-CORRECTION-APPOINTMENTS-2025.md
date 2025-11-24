# 🔧 CORRECCIÓN DE ESQUEMA: appointments vs reservations

**Fecha:** 8 de Noviembre 2025  
**Problema:** La app usaba `reservations` pero la BD real usa `appointments`

---

## ✅ ARCHIVOS CORREGIDOS:

### 1. **Migración de Waitlist**
**Archivo:** `supabase/migrations/20251108_03_waitlist_system.sql`

**Cambios:**
- ✅ Trigger ahora apunta a tabla `appointments` (no `reservations`)
- ✅ Función usa columnas correctas: `appointment_date`, `appointment_time`

**Líneas modificadas:**
```sql
-- ANTES:
DROP TRIGGER IF EXISTS trg_notify_waitlist ON reservations;
CREATE TRIGGER trg_notify_waitlist
    AFTER UPDATE ON reservations

-- AHORA:
DROP TRIGGER IF EXISTS trg_notify_waitlist ON appointments;
CREATE TRIGGER trg_notify_waitlist
    AFTER UPDATE ON appointments
```

**Función corregida:**
```sql
WHERE w.preferred_date = NEW.appointment_date  -- ✅ Antes: NEW.reservation_date
```

---

### 2. **Servicio de Waitlist**
**Archivo:** `src/services/WaitlistService.js`

**Cambios:**
- ✅ Método `checkAvailability()` ahora usa tabla `appointments`
- ✅ Columnas: `appointment_date`, `appointment_time`

**Líneas modificadas:**
```javascript
// ANTES:
.from('reservations')
.eq('reservation_date', date)
.eq('reservation_time', time)

// AHORA:
.from('appointments')
.eq('appointment_date', date)
.eq('appointment_time', time)
```

---

## 📋 ESQUEMA OFICIAL (Fuente de Verdad) - ACTUALIZADO 2025-11-21

### **Tabla Real: `appointments`**

**Última actualización:** 21 de Noviembre 2025  
**Migraciones aplicadas:**
- `20251117_04_add_employee_id_to_appointments.sql` - Agregado `employee_id`
- `20251121_01_add_blocked_status_and_gcal_fields.sql` - Agregado `gcal_event_id`, `calendar_id`, status `blocked`
- `20251121_05_verify_appointments_schema.sql` - Convertido `internal_notes` a JSONB, agregado `synced_to_gcal`

```sql
CREATE TABLE appointments (
    -- PRIMARY KEY
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- FOREIGN KEYS
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES business_services(id) ON DELETE CASCADE,
    resource_id UUID REFERENCES resources(id) ON DELETE SET NULL,
    employee_id UUID REFERENCES employees(id) ON DELETE SET NULL, -- ✅ Agregado 2025-11-17
    
    -- Datos del cliente (duplicados para performance)
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    
    -- Fecha y hora (NOMBRES CORRECTOS)
    appointment_date DATE NOT NULL,        -- ✅ NO 'reservation_date'
    appointment_time TIME NOT NULL,       -- ✅ NO 'reservation_time'
    duration_minutes INTEGER NOT NULL,
    end_time TIME,
    
    -- Estado y metadata
    status appointment_status DEFAULT 'confirmed'::appointment_status, -- ✅ Enum: pending, confirmed, completed, cancelled, no_show, pending_approval, blocked
    source VARCHAR(50) DEFAULT 'web',
    channel channel_type DEFAULT 'web'::channel_type,
    notes TEXT,
    special_requests TEXT,
    internal_notes JSONB DEFAULT '{}'::jsonb, -- ✅ Convertido de TEXT a JSONB (2025-11-21)
    amount_paid NUMERIC DEFAULT 0.00,
    
    -- Google Calendar Integration (✅ Agregado 2025-11-21)
    gcal_event_id TEXT,                   -- ✅ ID del evento en Google Calendar
    calendar_id TEXT,                     -- ✅ ID del calendario de Google Calendar
    synced_to_gcal BOOLEAN DEFAULT FALSE, -- ✅ Indica si está sincronizado con Google Calendar
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### **Columnas Detalladas:**

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | `gen_random_uuid()` | Primary Key |
| `business_id` | UUID | NO | - | FK a `businesses` |
| `customer_id` | UUID | NO | - | FK a `customers` |
| `service_id` | UUID | NO | - | FK a `business_services` |
| `resource_id` | UUID | YES | - | FK a `resources` (legacy, usar `employee_id`) |
| `employee_id` | UUID | YES | - | FK a `employees` (✅ Agregado 2025-11-17) |
| `customer_name` | VARCHAR(255) | NO | - | Nombre del cliente (duplicado para performance) |
| `customer_email` | VARCHAR(255) | YES | - | Email del cliente |
| `customer_phone` | VARCHAR(50) | YES | - | Teléfono del cliente |
| `appointment_date` | DATE | NO | - | Fecha de la cita (✅ NO usar `reservation_date`) |
| `appointment_time` | TIME | NO | - | Hora de la cita (✅ NO usar `reservation_time`) |
| `duration_minutes` | INTEGER | NO | - | Duración en minutos |
| `end_time` | TIME | YES | - | Hora de finalización |
| `status` | appointment_status | YES | `'confirmed'` | Estado: `pending`, `confirmed`, `completed`, `cancelled`, `no_show`, `pending_approval`, `blocked` |
| `source` | VARCHAR(50) | YES | `'web'` | Fuente: `'web'`, `'dashboard'`, `'google_calendar'`, `'agent_ia'`, etc. |
| `channel` | channel_type | YES | `'web'` | Canal: `'web'`, `'whatsapp'`, `'telefono'`, etc. |
| `notes` | TEXT | YES | - | Notas generales |
| `special_requests` | TEXT | YES | - | Peticiones especiales del cliente |
| `internal_notes` | JSONB | YES | `'{}'::jsonb` | Notas internas (✅ JSONB desde 2025-11-21) |
| `amount_paid` | NUMERIC | YES | `0.00` | Monto pagado |
| `gcal_event_id` | TEXT | YES | - | ID del evento en Google Calendar (✅ Agregado 2025-11-21) |
| `calendar_id` | TEXT | YES | - | ID del calendario de Google Calendar (✅ Agregado 2025-11-21) |
| `synced_to_gcal` | BOOLEAN | YES | `FALSE` | Indica si está sincronizado con Google Calendar (✅ Agregado 2025-11-21) |
| `created_at` | TIMESTAMPTZ | NO | `now()` | Fecha de creación |
| `updated_at` | TIMESTAMPTZ | NO | `now()` | Última actualización |

### **Estructura de `internal_notes` (JSONB):**

El campo `internal_notes` es un JSONB que puede contener:

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

### **Índices:**

```sql
-- Índices existentes
CREATE INDEX idx_appointments_business_id ON appointments(business_id);
CREATE INDEX idx_appointments_customer_id ON appointments(customer_id);
CREATE INDEX idx_appointments_appointment_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_employee_id ON appointments(employee_id); -- ✅ Agregado 2025-11-17
CREATE INDEX idx_appointments_business_employee_date ON appointments(business_id, employee_id, appointment_date) WHERE employee_id IS NOT NULL; -- ✅ Agregado 2025-11-17

-- Índices para Google Calendar (✅ Agregado 2025-11-21)
CREATE INDEX idx_appointments_gcal_event_id ON appointments(gcal_event_id) WHERE gcal_event_id IS NOT NULL;
CREATE INDEX idx_appointments_calendar_id ON appointments(calendar_id) WHERE calendar_id IS NOT NULL;
CREATE INDEX idx_appointments_synced_to_gcal ON appointments(synced_to_gcal) WHERE synced_to_gcal = TRUE;
CREATE INDEX idx_appointments_internal_notes_gin ON appointments USING GIN (internal_notes) WHERE internal_notes IS NOT NULL;
```

### **Enum `appointment_status`:**

Valores válidos (actualizado 2025-11-21):
- `pending` - Pendiente de confirmación
- `pending_approval` - Requiere aprobación (grupos grandes)
- `confirmed` - Confirmada
- `completed` - Completada
- `cancelled` - Cancelada
- `no_show` - No se presentó
- `blocked` - Bloqueado (eventos de Google Calendar) ✅ Agregado 2025-11-21

---

## ⚠️ IMPORTANTE: Nombres de Columnas

| ❌ INCORRECTO (No existe) | ✅ CORRECTO (Usar siempre) |
|---------------------------|----------------------------|
| `reservations`            | `appointments`             |
| `reservation_date`        | `appointment_date`         |
| `reservation_time`        | `appointment_time`         |
| `services`                | `business_services`         |
| `internal_notes` (TEXT)   | `internal_notes` (JSONB)    |

## 🔄 Cambios Recientes (2025-11-21):

### **1. Google Calendar Integration:**
- ✅ Agregado `gcal_event_id` (TEXT) - ID del evento en Google Calendar
- ✅ Agregado `calendar_id` (TEXT) - ID del calendario de Google Calendar
- ✅ Agregado `synced_to_gcal` (BOOLEAN) - Estado de sincronización
- ✅ Agregado status `blocked` al enum `appointment_status`

### **2. Estructura de Datos:**
- ✅ `internal_notes` convertido de TEXT a JSONB
- ✅ `employee_id` agregado (UUID, nullable) - FK a `employees`

### **3. Índices:**
- ✅ Índices GIN para búsquedas eficientes en `internal_notes` (JSONB)
- ✅ Índices para `gcal_event_id`, `calendar_id`, `synced_to_gcal`

---

## 🔄 PRÓXIMOS PASOS:

### **Aplicar la migración corregida:**

```bash
# Opción 1: Desde Supabase Dashboard
# SQL Editor → Pegar contenido de:
# supabase/migrations/20251108_03_waitlist_system.sql

# Opción 2: CLI
supabase db push
```

---

## ✅ VERIFICACIÓN:

Después de aplicar, verifica que:

1. **Tabla `waitlist` existe:**
```sql
SELECT * FROM waitlist LIMIT 1;
```

2. **Trigger funciona:**
```sql
SELECT tgname, tgrelid::regclass 
FROM pg_trigger 
WHERE tgname = 'trg_notify_waitlist';
-- Debe devolver: trg_notify_waitlist | appointments
```

3. **Función existe:**
```sql
SELECT proname FROM pg_proc 
WHERE proname = 'notify_waitlist_on_cancellation';
```

---

## 📝 NOTAS:

- El esquema oficial está en: `docs/01-arquitectura/SCHEMA-REAL-SUPABASE-2025.sql`
- **SIEMPRE** consultar ese archivo antes de crear migraciones
- La app usa `appointments`, no `reservations`
- Los campos de fecha/hora son `appointment_*`, no `reservation_*`

---

## 🎯 ESTADO ACTUAL:

✅ **Migración corregida y lista para aplicar**  
✅ **Servicio WaitlistService corregido**  
✅ **Funciones UUID corregidas** (`gen_random_uuid()` en lugar de `uuid_generate_v4()`)  
✅ **Timestamps corregidos** (`TIMESTAMPTZ` en lugar de `TIMESTAMP`)  
✅ **Funciones SQL** (`now()` en lugar de `NOW()`)  

---

## 🆕 ERRORES ADICIONALES CORREGIDOS:

### **Error #2: `uuid_generate_v4()` no existe**

**Problema:**
```sql
-- ❌ INCORRECTO:
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()

-- ✅ CORRECTO:
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
```

**Razón:** Supabase usa `gen_random_uuid()` por defecto, no `uuid_generate_v4()`

---

### **Error #3: Tipo de timestamp incorrecto**

**Problema:**
```sql
-- ❌ INCORRECTO:
created_at TIMESTAMP DEFAULT NOW()

-- ✅ CORRECTO:
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
```

**Cambios:**
- `TIMESTAMP` → `TIMESTAMPTZ` (con zona horaria)
- `NOW()` → `now()` (minúscula, estándar PostgreSQL)
- Agregado `NOT NULL` donde corresponde

---

## 📂 ARCHIVOS DISPONIBLES:

### **Opción 1: Migración Completa**
**Archivo:** `supabase/migrations/20251108_03_waitlist_system.sql`

Incluye:
- ✅ Tabla `waitlist`
- ✅ Índices
- ✅ RLS Policies
- ✅ Trigger para notificaciones
- ✅ Función de limpieza
- ✅ Vista de resumen

**Usar si:** Quieres implementar todo el sistema de una vez

---

### **Opción 2: Solo Tabla (Recomendado para testing)**
**Archivo:** `supabase/migrations/20251108_03_waitlist_SOLO_TABLA.sql`

Incluye:
- ✅ Tabla `waitlist`
- ✅ Índices
- ✅ RLS Policies
- ❌ Sin triggers (menos complejidad)
- ❌ Sin funciones adicionales

**Usar si:** Quieres probar primero que la tabla se cree correctamente

---

## 🚀 RECOMENDACIÓN:

**Paso 1:** Probar primero con `20251108_03_waitlist_SOLO_TABLA.sql`

```sql
-- Copiar contenido de:
supabase/migrations/20251108_03_waitlist_SOLO_TABLA.sql

-- Ejecutar en:
Supabase Dashboard → SQL Editor → Pegar → Run
```

**Paso 2:** Si funciona, aplicar la versión completa o agregar triggers después

---

**¿Listo para aplicar?** 🚀

