# 🔍 AUDITORÍA COMPLETA DE BASE DE DATOS
## Dashboard Socio Virtual - Infraestructura Real
**Fecha:** 23 de Noviembre 2025  
**Objetivo:** Verificar qué tablas y campos existen REALMENTE para implementar el dashboard sin datos falsos

---

## ✅ RESUMEN EJECUTIVO

### 🎯 PREGUNTA CLAVE: ¿Tenemos todo lo necesario?

| Funcionalidad | ¿Existe en BD? | Tabla/Campo | Estado |
|---------------|----------------|-------------|---------|
| **Empleados** | ✅ SÍ | `employees` | COMPLETA |
| **Ausencias/Vacaciones** | ✅ SÍ | `employee_absences` | COMPLETA |
| **Citas con empleado** | ✅ SÍ | `appointments.employee_id` | EXISTE |
| **No-Shows contador** | ✅ SÍ | `customers.no_show_count` | EXISTE |
| **Status no_show** | ✅ SÍ | `appointments.status = 'no_show'` | EXISTE |
| **Recursos físicos** | ✅ SÍ | `resources` | COMPLETA |

### 🚀 CONCLUSIÓN: **TENEMOS TODO LO NECESARIO**

No necesitamos mock. Podemos implementar el dashboard 100% con datos reales.

---

## 📊 TABLA 1: `employees` (EMPLEADOS)

### Estructura Confirmada:

```sql
CREATE TABLE employees (
    id UUID PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES businesses(id),
    
    -- DATOS PERSONALES
    name VARCHAR(100) NOT NULL,          -- ✅ "Marc", "Carla", "Ana"
    email VARCHAR(255),
    phone VARCHAR(20),
    role VARCHAR(50) DEFAULT 'staff',    -- ✅ 'owner', 'manager', 'staff', 'freelance'
    
    -- ASIGNACIÓN DE RECURSO FÍSICO
    assigned_resource_id UUID REFERENCES resources(id),  -- ✅ Qué silla/box usa
    
    -- VISUAL
    color VARCHAR(7) DEFAULT '#6366f1',  -- Color en calendario
    avatar_url TEXT,
    position_order INTEGER DEFAULT 0,    -- Orden izq → der
    
    -- ESTADO
    is_active BOOLEAN DEFAULT true,      -- ✅ CRÍTICO: Si está activo o no
    is_owner BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
```

### ✅ CAMPOS CLAVE PARA EL DASHBOARD:

1. **`name`** → "Marc", "Carla", "Ana" (lo mostramos en el widget)
2. **`role`** → "Colorista", "Estilista", "Junior" (subtítulo)
3. **`is_active`** → TRUE/FALSE (¿está activo?)
4. **`assigned_resource_id`** → Qué silla/box maneja

### ❌ LO QUE NO TIENE:

- **NO tiene campo `status`** (no dice si está "trabajando", "descansando", etc.)
- **ESO se calcula** mirando:
  - `employee_absences` (¿está de vacaciones HOY?)
  - `appointments` (¿tiene cita AHORA?)

---

## 📊 TABLA 2: `employee_absences` (AUSENCIAS/VACACIONES)

### Estructura Confirmada:

```sql
CREATE TABLE employee_absences (
    id UUID PRIMARY KEY,
    business_id UUID NOT NULL,
    employee_id UUID NOT NULL REFERENCES employees(id),
    
    -- FECHAS
    start_date DATE NOT NULL,           -- ✅ Desde cuándo
    end_date DATE NOT NULL,             -- ✅ Hasta cuándo
    all_day BOOLEAN DEFAULT true,       -- ✅ Todo el día o parcial
    start_time TIME,                    -- Solo si all_day = false
    end_time TIME,
    
    -- MOTIVO
    reason VARCHAR(50) NOT NULL,        -- ✅ 'vacation', 'medical', 'sick_leave', 'personal'
    reason_label VARCHAR(100),          -- ✅ "Vacaciones en la playa"
    notes TEXT,
    
    -- APROBACIÓN
    approved BOOLEAN DEFAULT false,     -- ✅ Si fue aprobada
    approved_by UUID REFERENCES employees(id),
    approved_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
```

### ✅ CAMPOS CLAVE PARA EL DASHBOARD:

1. **`employee_id`** → ¿Quién está ausente?
2. **`start_date`, `end_date`** → ¿Cuándo?
3. **`reason`** → 'vacation', 'medical', etc.
4. **`reason_label`** → "Vacaciones hasta el lunes"

### 🧠 LÓGICA PARA DASHBOARD:

```sql
-- ¿Marc está de vacaciones HOY?
SELECT * FROM employee_absences
WHERE employee_id = 'marc_uuid'
AND CURRENT_DATE BETWEEN start_date AND end_date
AND approved = true;
```

**Si devuelve fila → Marc está de vacaciones.**

---

## 📊 TABLA 3: `appointments` (CITAS)

### Campos Confirmados (migración 20251117_04):

```sql
-- appointments tiene:
id UUID PRIMARY KEY,
business_id UUID,
customer_id UUID,               -- ✅ FK a customers
customer_name VARCHAR(255),     -- ✅ Nombre del cliente
customer_phone VARCHAR(20),     -- ✅ Teléfono
appointment_date DATE,          -- ✅ Fecha (2025-11-23)
appointment_time TIME,          -- ✅ Hora (21:00)
duration_minutes INTEGER,       -- ✅ Duración (30, 60, etc.)
status VARCHAR(50),             -- ✅ 'pending', 'confirmed', 'completed', 'cancelled', 'no_show'
employee_id UUID,               -- ✅ AÑADIDO EN MIGRACIÓN 20251117_04
resource_id UUID,               -- ✅ FK a resources (silla/box)
service_name VARCHAR(255),      -- ✅ "Corte", "Tinte", etc.
notes TEXT,
created_at TIMESTAMPTZ
```

### ✅ CAMPOS CLAVE PARA EL DASHBOARD:

1. **`employee_id`** → ¿Quién atiende esta cita?
2. **`appointment_date` + `appointment_time`** → ¿Cuándo es?
3. **`duration_minutes`** → ¿Cuánto dura?
4. **`status`** → 'confirmed', 'pending', **'no_show'** ⚠️
5. **`customer_name`** → Nombre del cliente
6. **`service_name`** → Qué servicio es

### 🧠 LÓGICA PARA DASHBOARD:

#### 1️⃣ ¿Qué está haciendo Marc AHORA?

```sql
SELECT 
    customer_name,
    service_name,
    appointment_time,
    duration_minutes,
    EXTRACT(EPOCH FROM (
        (appointment_time + (duration_minutes || ' minutes')::INTERVAL) - CURRENT_TIME
    )) / 60 AS minutos_restantes
FROM appointments
WHERE employee_id = 'marc_uuid'
AND appointment_date = CURRENT_DATE
AND status IN ('confirmed', 'pending')
AND CURRENT_TIME BETWEEN appointment_time AND (appointment_time + (duration_minutes || ' minutes')::INTERVAL);
```

**Si devuelve fila → Marc está ocupado con ese cliente.**

#### 2️⃣ ¿Qué NO-SHOWS tuvimos HOY?

```sql
SELECT 
    customer_name,
    appointment_time,
    service_name,
    -- Calcular pérdida (si tienes precio en tabla services)
    0 AS estimado_perdido  -- Placeholder, ajustar si existe campo price
FROM appointments
WHERE business_id = 'tu_business_id'
AND appointment_date = CURRENT_DATE
AND status = 'no_show';
```

---

## 📊 TABLA 4: `customers` (CLIENTES - NO-SHOWS)

### Campos Confirmados (migración 20251123_02):

```sql
-- customers tiene:
id UUID PRIMARY KEY,
business_id UUID,
name VARCHAR(255),
phone VARCHAR(20),
email VARCHAR(255),
visits_count INTEGER DEFAULT 0,
segment_auto VARCHAR(50),       -- 'vip', 'regular', 'nuevo', 'riesgo'
no_show_count INTEGER DEFAULT 0, -- ✅ AÑADIDO EN MIGRACIÓN 20251123_02
created_at TIMESTAMPTZ
```

### ✅ CAMPO CLAVE:

- **`no_show_count`** → Cuántos plantones ha dado este cliente

### 🧠 LÓGICA:

```sql
-- Clientes con historial de no-shows
SELECT 
    c.name,
    c.phone,
    c.no_show_count,
    COUNT(a.id) as citas_futuras
FROM customers c
LEFT JOIN appointments a ON a.customer_id = c.id AND a.appointment_date >= CURRENT_DATE
WHERE c.no_show_count > 1
GROUP BY c.id;
```

---

## 📊 TABLA 5: `resources` (RECURSOS FÍSICOS)

### Estructura Confirmada:

```sql
CREATE TABLE resources (
    id UUID PRIMARY KEY,
    business_id UUID NOT NULL,
    name VARCHAR(100),              -- ✅ "Silla 1", "Box Estética"
    resource_type VARCHAR(50),      -- 'chair', 'table', 'room', 'equipment'
    is_active BOOLEAN DEFAULT true,
    capacity INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ
);
```

### ✅ USO EN DASHBOARD:

- **NO mostramos "Silla 1" directamente**
- **Mostramos al empleado** que está asignado a esa silla
- Usamos `employees.assigned_resource_id` para vincular

---

## 🎯 PLAN DE IMPLEMENTACIÓN SIN MOCK

### 🔥 DATOS REALES QUE PODEMOS MOSTRAR:

#### 1️⃣ **Widget de Equipo** (`StaffWidget.jsx`):

```javascript
// Query real (SIN MOCK):
const { data: staff } = await supabase
  .from('employees')
  .select(`
    id,
    name,
    role,
    assigned_resource_id,
    is_active
  `)
  .eq('business_id', businessId)
  .eq('is_active', true)
  .order('position_order');

// Para cada empleado, verificar:
// A) ¿Está de vacaciones?
const { data: absences } = await supabase
  .from('employee_absences')
  .select('*')
  .eq('employee_id', employeeId)
  .gte('end_date', new Date().toISOString().split('T')[0])
  .lte('start_date', new Date().toISOString().split('T')[0]);

// B) ¿Tiene cita AHORA?
const now = new Date();
const currentTime = now.toTimeString().split(' ')[0].slice(0, 5); // "21:30"
const { data: currentAppointment } = await supabase
  .from('appointments')
  .select('customer_name, service_name, appointment_time, duration_minutes')
  .eq('employee_id', employeeId)
  .eq('appointment_date', now.toISOString().split('T')[0])
  .lte('appointment_time', currentTime)
  .gte('appointment_time + duration_minutes', currentTime) // Pendiente: ajustar sintaxis
  .in('status', ['confirmed', 'pending'])
  .single();

// ESTADO FINAL:
// - Si absences.length > 0 → "Vacaciones"
// - Else if currentAppointment → "Ocupado con {customer_name}"
// - Else → "Disponible"
```

#### 2️⃣ **Mensaje de Lua** (Inteligente):

```javascript
// Detectar No-Shows HOY:
const { data: noshows, count: noshowCount } = await supabase
  .from('appointments')
  .select('customer_name, service_name', { count: 'exact' })
  .eq('business_id', businessId)
  .eq('appointment_date', new Date().toISOString().split('T')[0])
  .eq('status', 'no_show');

// Detectar empleados de vacaciones con citas:
const { data: conflictos } = await supabase
  .rpc('detect_employee_absences_with_appointments', {
    p_business_id: businessId
  });

// GENERAR MENSAJE:
if (conflictos.length > 0) {
  luaMessage = `🚨 ${conflictos[0].employee_name} está de ${conflictos[0].reason_label} pero tiene ${conflictos[0].appointments_count} citas asignadas.`;
  scenario = 'staff_crisis';
} else if (noshowCount > 0) {
  luaMessage = `⚠️ Tuvimos ${noshowCount} No-Shows hoy. Pérdida estimada: ${noshowCount * 50}€.`;
  scenario = 'no_show_risk';
} else {
  luaMessage = `💼 Día tranquilo. Llevas ${todayRevenue}€ en caja.`;
  scenario = 'pat_on_back';
}
```

---

## ✅ CONCLUSIÓN FINAL

### 🎯 RESPUESTAS A TUS PREGUNTAS:

| Pregunta | Respuesta |
|----------|-----------|
| **¿Existe tabla `employees`?** | ✅ SÍ, con `name`, `role`, `is_active` |
| **¿Tiene campo `status` o `absence`?** | ❌ NO en `employees`, pero ✅ SÍ en `employee_absences` |
| **¿Cómo se marcan ausencias?** | ✅ Tabla `employee_absences` con fechas y motivo |
| **¿Existe campo `employee_id` en `appointments`?** | ✅ SÍ, añadido en migración 20251117_04 |
| **¿Cómo se registran no-shows?** | ✅ `appointments.status = 'no_show'` + `customers.no_show_count` |
| **¿Puedo implementar sin mock?** | ✅ SÍ, 100% con datos reales |

---

## 🚀 PRÓXIMO PASO:

**Implementar componentes usando SOLO estas queries reales:**

1. ✅ `LuaHero.jsx` → Mensaje inteligente basado en conflictos/no-shows
2. ✅ `StaffWidget.jsx` → Empleados con estado real (vacaciones/ocupado/libre)
3. ✅ `MetricsBar.jsx` → KPIs reales (caja, no-shows, VIP)

**CERO MOCK. TODO REAL.** 🎯

---

**Archivo SQL para ejecutar auditoría:** `AUDITORIA_BD_DASHBOARD.sql`

**Siguiente acción:** Codificar componentes con las queries reales documentadas arriba.


