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

## 📋 ESQUEMA OFICIAL (Fuente de Verdad)

### **Tabla Real: `appointments`**

```sql
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    service_id UUID NOT NULL REFERENCES services(id),
    resource_id UUID REFERENCES resources(id),
    
    -- Datos del cliente (duplicados para performance)
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    
    -- Fecha y hora (NOMBRES CORRECTOS)
    appointment_date DATE NOT NULL,        -- ✅ NO 'reservation_date'
    appointment_time TIME NOT NULL,        -- ✅ NO 'reservation_time'
    duration_minutes INTEGER NOT NULL,
    end_time TIME,
    
    -- Estado y metadata
    status VARCHAR DEFAULT 'confirmed'::appointment_status,
    source VARCHAR(50) DEFAULT 'web',
    channel VARCHAR DEFAULT 'web'::channel_type,
    notes TEXT,
    special_requests TEXT,
    internal_notes TEXT,
    amount_paid NUMERIC DEFAULT 0.00,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## ⚠️ IMPORTANTE: Nombres de Columnas

| ❌ INCORRECTO (No existe) | ✅ CORRECTO (Usar siempre) |
|---------------------------|----------------------------|
| `reservations`            | `appointments`             |
| `reservation_date`        | `appointment_date`         |
| `reservation_time`        | `appointment_time`         |

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

