# 📝 CHANGELOG: Tabla `appointments`

**Archivo de referencia:** `docs/01-arquitectura/SCHEMA-COMPLETO-2025-11-13.json`  
**Última actualización:** 21 de Noviembre 2025

---

## 🔄 Cambios Realizados en la Tabla `appointments`

### **Versión Original (2025-11-13):**
La tabla `appointments` tenía **21 columnas** con la siguiente estructura:

1. `id` (UUID, PK)
2. `business_id` (UUID, NOT NULL)
3. `customer_id` (UUID, NOT NULL)
4. `service_id` (UUID, NOT NULL)
5. `resource_id` (UUID, nullable)
6. `customer_name` (VARCHAR(255), NOT NULL)
7. `customer_email` (VARCHAR(255), nullable)
8. `customer_phone` (VARCHAR(50), nullable)
9. `appointment_date` (DATE, NOT NULL)
10. `appointment_time` (TIME, NOT NULL)
11. `duration_minutes` (INTEGER, NOT NULL)
12. `end_time` (TIME, nullable)
13. `status` (appointment_status, default 'confirmed')
14. `source` (VARCHAR(50), default 'web')
15. `channel` (channel_type, default 'web')
16. `notes` (TEXT, nullable)
17. `special_requests` (TEXT, nullable)
18. `internal_notes` (TEXT, nullable) ⚠️
19. `amount_paid` (NUMERIC, default 0.00)
20. `created_at` (TIMESTAMPTZ, NOT NULL, default now())
21. `updated_at` (TIMESTAMPTZ, NOT NULL, default now())

---

## ✅ Cambios Aplicados

### **1. Migración 2025-11-17: `20251117_04_add_employee_id_to_appointments.sql`**

**Agregado:**
- ✅ `employee_id` (UUID, nullable, FK a `employees(id)`)
  - **Ordinal Position:** 22
  - **Propósito:** Asociar reservas directamente con el empleado que las atiende
  - **Índices creados:**
    - `idx_appointments_employee_id`
    - `idx_appointments_business_employee_date`

---

### **2. Migración 2025-11-21: `20251121_01_add_blocked_status_and_gcal_fields.sql`**

**Agregado:**
- ✅ `gcal_event_id` (TEXT, nullable)
  - **Ordinal Position:** 23
  - **Propósito:** ID del evento en Google Calendar para sincronización bidireccional
  - **Índice:** `idx_appointments_gcal_event_id`

- ✅ `calendar_id` (TEXT, nullable)
  - **Ordinal Position:** 24
  - **Propósito:** ID del calendario de Google Calendar del que proviene el evento
  - **Índice:** `idx_appointments_calendar_id`

**Modificado:**
- ✅ Enum `appointment_status`: Agregado valor `'blocked'`
  - **Propósito:** Estado para eventos bloqueados importados de Google Calendar

---

### **3. Migración 2025-11-21: `20251121_05_verify_appointments_schema.sql`**

**Modificado:**
- ✅ `internal_notes`: Convertido de **TEXT** a **JSONB**
  - **Antes:** `data_type: "text", column_default: null`
  - **Ahora:** `data_type: "jsonb", column_default: "'{}'::jsonb"`
  - **Propósito:** Almacenar información estructurada (gcal_event_id, calendar_id, original_summary, etc.)
  - **Índice GIN:** `idx_appointments_internal_notes_gin` para búsquedas eficientes

**Agregado:**
- ✅ `synced_to_gcal` (BOOLEAN, nullable, default FALSE)
  - **Ordinal Position:** 25
  - **Propósito:** Indica si la reserva ha sido sincronizada con Google Calendar
  - **Índice:** `idx_appointments_synced_to_gcal`

---

## 📊 Estructura Actual (2025-11-21)

La tabla `appointments` ahora tiene **25 columnas**:

1. `id` (UUID, PK)
2. `business_id` (UUID, NOT NULL)
3. `customer_id` (UUID, NOT NULL)
4. `service_id` (UUID, NOT NULL)
5. `resource_id` (UUID, nullable)
6. `customer_name` (VARCHAR(255), NOT NULL)
7. `customer_email` (VARCHAR(255), nullable)
8. `customer_phone` (VARCHAR(50), nullable)
9. `appointment_date` (DATE, NOT NULL)
10. `appointment_time` (TIME, NOT NULL)
11. `duration_minutes` (INTEGER, NOT NULL)
12. `end_time` (TIME, nullable)
13. `status` (appointment_status, default 'confirmed') - ✅ Incluye 'blocked'
14. `source` (VARCHAR(50), default 'web')
15. `channel` (channel_type, default 'web')
16. `notes` (TEXT, nullable)
17. `special_requests` (TEXT, nullable)
18. `internal_notes` (JSONB, default '{}'::jsonb) - ✅ Convertido de TEXT
19. `amount_paid` (NUMERIC, default 0.00)
20. `created_at` (TIMESTAMPTZ, NOT NULL, default now())
21. `updated_at` (TIMESTAMPTZ, NOT NULL, default now())
22. `employee_id` (UUID, nullable) - ✅ NUEVO
23. `gcal_event_id` (TEXT, nullable) - ✅ NUEVO
24. `calendar_id` (TEXT, nullable) - ✅ NUEVO
25. `synced_to_gcal` (BOOLEAN, default FALSE) - ✅ NUEVO

---

## 📚 Referencias

- **Documentación completa:** `docs/SCHEMA-APPOINTMENTS-COMPLETO-2025-11-21.md`
- **Esquema JSON actualizado:** `docs/01-arquitectura/SCHEMA-COMPLETO-2025-11-13.json`
- **Migraciones:** `supabase/migrations/`

---

## 🔍 Cómo Verificar los Cambios

```sql
-- Verificar estructura actual
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'appointments'
ORDER BY ordinal_position;

-- Verificar que internal_notes es JSONB
SELECT 
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_name = 'appointments'
  AND column_name = 'internal_notes';
-- Debe mostrar: data_type = 'jsonb', column_default = '''{}''::jsonb'

-- Verificar nuevas columnas
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'appointments'
  AND column_name IN ('employee_id', 'gcal_event_id', 'calendar_id', 'synced_to_gcal');
-- Debe devolver 4 filas

-- Verificar enum appointment_status incluye 'blocked'
SELECT enumlabel
FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'appointment_status')
ORDER BY enumsortorder;
-- Debe incluir: 'blocked'
```

---

**Última actualización:** 21 de Noviembre 2025  
**Mantenido por:** Sistema de migraciones de Supabase

