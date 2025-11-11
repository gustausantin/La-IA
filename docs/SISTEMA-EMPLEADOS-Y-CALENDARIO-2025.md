# 👥 SISTEMA DE EMPLEADOS Y CALENDARIO DINÁMICO
## Arquitectura "Basada en Empleados" para LA-IA

**Fecha:** 9 de Noviembre, 2025  
**Objetivo:** Implementar gestión de empleados con horarios individuales, ausencias y calendario dinámico  
**Filosofía:** 1 Empleado = 1 Columna en el calendario

---

## 🎯 LA VISIÓN

```
┌──────────────────────────────────────────────┐
│  COPILOT (Paso 1): Configura tu Equipo      │
│                                              │
│  Por defecto:                                │
│  ├─ Manolo Escobar (Propietario)            │
│  └─ Horario: Lun-Vie 9-18h                  │
│                                              │
│  + Añadir Empleado:                         │
│  ├─ Macarena                                 │
│  └─ Horario: Lun-Vie 10-19h (editable)      │
│                                              │
│  RESULTADO EN CALENDARIO:                    │
│  ├─ 2 COLUMNAS (Manolo | Macarena)          │
│  ├─ Cada uno con su horario propio          │
│  └─ Cada uno con sus ausencias propias      │
└──────────────────────────────────────────────┘
```

---

## 🗂️ ESQUEMA DE BASE DE DATOS

### **TABLA 1: `employees` (NUEVA)**

```sql
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    
    -- Datos personales
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    role VARCHAR(50) DEFAULT 'staff', -- 'owner', 'manager', 'staff'
    
    -- Asignación de recurso (silla, mesa, camilla)
    assigned_resource_id UUID REFERENCES resources(id),
    
    -- Configuración
    color VARCHAR(7) DEFAULT '#6366f1', -- Color en calendario
    avatar_url TEXT,
    position_order INTEGER DEFAULT 0, -- Orden en el calendario
    
    -- Estado
    is_active BOOLEAN DEFAULT true,
    is_owner BOOLEAN DEFAULT false,
    
    -- Metadatos
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_employees_business ON employees(business_id);
CREATE INDEX idx_employees_resource ON employees(assigned_resource_id);
CREATE INDEX idx_employees_active ON employees(is_active);
```

---

### **TABLA 2: `employee_schedules` (NUEVA)**

Horarios base de cada empleado (por día de la semana):

```sql
CREATE TABLE employee_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    
    -- Día de la semana (0=domingo, 1=lunes, ..., 6=sábado)
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    
    -- Horario
    is_working BOOLEAN DEFAULT true,
    start_time TIME,
    end_time TIME,
    
    -- Descansos (JSONB array)
    breaks JSONB DEFAULT '[]', -- [{ start: "11:00", end: "11:15", reason: "café" }]
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(employee_id, day_of_week)
);

CREATE INDEX idx_employee_schedules_business ON employee_schedules(business_id);
CREATE INDEX idx_employee_schedules_employee ON employee_schedules(employee_id);
```

---

### **TABLA 3: `employee_absences` (NUEVA)**

Ausencias individuales (vacaciones, médico, baja):

```sql
CREATE TABLE employee_absences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    
    -- Fechas
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    all_day BOOLEAN DEFAULT true,
    start_time TIME,
    end_time TIME,
    
    -- Motivo
    reason VARCHAR(50) NOT NULL, -- 'vacation', 'medical', 'sick_leave', 'personal', 'other'
    reason_label VARCHAR(100), -- "Vacaciones", "Médico", "Baja", etc.
    notes TEXT,
    
    -- Aprobación
    approved BOOLEAN DEFAULT false,
    approved_by UUID REFERENCES employees(id),
    approved_at TIMESTAMPTZ,
    
    -- Recurrencia
    is_recurring BOOLEAN DEFAULT false,
    recurrence_pattern JSONB, -- { type: 'weekly', days: [1,3,5], end_date: '2025-12-31' }
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_employee_absences_business ON employee_absences(business_id);
CREATE INDEX idx_employee_absences_employee ON employee_absences(employee_id);
CREATE INDEX idx_employee_absences_dates ON employee_absences(start_date, end_date);
```

---

### **TABLA 4: `employee_blocks` (NUEVA)**

Bloqueos temporales (comida, reunión, limpieza) - "Falta de disponibilidad":

```sql
CREATE TABLE employee_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    
    -- Fecha y hora
    block_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    
    -- Motivo
    reason VARCHAR(100), -- "Comida", "Reunión", "Limpieza", etc.
    color VARCHAR(7) DEFAULT '#94a3b8', -- Gris por defecto
    
    -- Recurrencia
    is_recurring BOOLEAN DEFAULT false,
    recurrence_pattern JSONB,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_employee_blocks_business ON employee_blocks(business_id);
CREATE INDEX idx_employee_blocks_employee ON employee_blocks(employee_id);
CREATE INDEX idx_employee_blocks_date ON employee_blocks(block_date);
```

---

## 🎨 FLUJO DE USUARIO: Copilot → Calendario

### **PASO 1: Copilot - Configura tu Equipo**

```
Dashboard → Banner Copilot → "1. Configura tu Equipo y Horarios"

┌─────────────────────────────────────────┐
│  👥 Tu Equipo                           │
│                                         │
│  [✓] Manolo Escobar (Propietario)      │
│      Lun-Vie: 9:00-18:00               │
│      Silla 1                            │
│      [Editar horario]                   │
│                                         │
│  + Añadir Empleado                      │
│                                         │
│  [CONTINUAR A SERVICIOS →]             │
└─────────────────────────────────────────┘
```

**Al añadir empleado:**

```
Modal:
┌─────────────────────────────────────────┐
│ X  Añadir Empleado                      │
│                                         │
│ Nombre: [_____________]                 │
│ Email:  [_____________]                 │
│ Teléfono: [___________]                 │
│                                         │
│ Recurso asignado:                       │
│ [Silla 1 ▼]                             │
│                                         │
│ Horario (copiar de Manolo):             │
│ [☑] Sí (después lo edito)               │
│                                         │
│ [AÑADIR]                                 │
└─────────────────────────────────────────┘
```

---

### **PASO 2: Editar Horarios Individuales**

```
Pantalla "Horarios del Equipo":

┌─────────────────────────────────────────┐
│  👥 Horarios del Equipo                 │
│                                         │
│  [Manolo Escobar] [Macarena]            │
│       ACTIVO        ACTIVO              │
│                                         │
│  Lunes a Viernes:                       │
│  [ON]  Lunes     9:00-18:00        >    │
│  [ON]  Martes    9:00-18:00        >    │
│  [ON]  Miércoles 9:00-18:00        >    │
│  [ON]  Jueves    9:00-18:00        >    │
│  [ON]  Viernes   9:00-18:00        >    │
│  [OFF] Sábado    Cerrado           >    │
│  [OFF] Domingo   Cerrado           >    │
│                                         │
│  Descansos:                             │
│  + Añadir descanso (ej: 11:00-11:15)   │
│                                         │
│  [GUARDAR]                              │
└─────────────────────────────────────────┘
```

---

### **PASO 3: Calendario Dinámico**

```
Calendario muestra COLUMNAS según EMPLEADOS:

┌─────────────────────────────────────────┐
│  Lun., 10 Nov.    9:00-20:00           │
│                                         │
│  Manolo (9-18h)  Macarena (10-19h)     │
│ ─────────────────────────────────────── │
│ 09:00 [Libre]      [CERRADO]           │
│ 09:15 [Libre]      [CERRADO]           │
│ 09:30 [Libre]      [CERRADO]           │
│ 09:45 [Libre]      [CERRADO]           │
│ 10:00 [Libre]      [Libre]             │
│ 10:15 [Cita: Ana]  [Libre]             │
│ 10:30 [Cita: Ana]  [Libre]             │
│ 11:00 [DESCANSO]   [Libre]             │
│ 11:15 [Libre]      [Libre]             │
│ ...                                     │
│ 14:00 [Libre]      [COMIDA]            │
│ 14:30 [Libre]      [COMIDA]            │
│ 15:00 [Libre]      [Libre]             │
│ ...                                     │
│ 18:00 [CERRADO]    [Libre]             │
│ 19:00 [CERRADO]    [CERRADO]           │
└─────────────────────────────────────────┘
```

---

## 🎯 LÓGICA DEL SISTEMA

### **Popup al tocar slot:**

```
Si slot VACÍO:
┌─────────────────────────┐
│ NUEVA CITA              │ → Modal nueva cita
├─────────────────────────┤
│ LISTA DE ESPERA         │ → Modal waitlist
├─────────────────────────┤
│ BLOQUEAR HORA           │ → employee_blocks
│ (Falta disponibilidad)  │
├─────────────────────────┤
│ AÑADIR AUSENCIA         │ → employee_absences
└─────────────────────────┘
```

### **Diferencias:**

| Tipo | Qué es | Tabla | Ejemplo |
|------|--------|-------|---------|
| **CITA** | Cliente reserva | `appointments` | "10:00 Ana García - Corte" |
| **BLOQUEO** | Empleado SÍ está, hueco NO | `employee_blocks` | "14:00 Comida" |
| **AUSENCIA** | Empleado NO está | `employee_absences` | "15 nov - Médico" |
| **WAITLIST** | Cliente quiere pero no hay | `waitlist` | "María López - 10:00" |

---

## 🚀 PLAN DE IMPLEMENTACIÓN

### **FASE 1: Base de Datos (30 min)**
1. Crear migración con 4 tablas:
   - `employees`
   - `employee_schedules`
   - `employee_absences`
   - `employee_blocks`

### **FASE 2: Copilot - Gestión de Equipo (2 horas)**
1. Pantalla "Configura tu Equipo"
2. Modal "Añadir Empleado"
3. Pantalla "Horarios del Equipo" (por empleado)
4. Integración con recursos existentes

### **FASE 3: Calendario Dinámico (3 horas)**
1. Renderizar columnas según empleados activos
2. Mostrar horarios individuales (cerrado si fuera de horario)
3. Mostrar bloqueos (gris)
4. Mostrar ausencias (rojo/naranja)
5. Popup con 4 opciones

### **FASE 4: Modales (2 horas)**
1. Modal "Añadir Ausencia"
2. Modal "Bloquear Hora"
3. Mejorar modal "Nueva Cita" (pestañas)

---

## 🔧 CAMBIOS EN CALENDARIO ACTUAL

### **FIX INMEDIATO (10 min):**

**Problema:** Las horas en punto (8:00, 9:00, 10:00) son más grandes que los cuartos (8:15, 8:30, 8:45)

**Solución:** Todos los intervalos de 15min con **mismo height**

```javascript
// ANTES (MALO):
if (minutos === 0) {
  return <tr style={{ height: '60px' }}>...</tr>; // MÁS GRANDE
} else {
  return <tr style={{ height: '15px' }}>...</tr>; // Pequeño
}

// DESPUÉS (BUENO):
return <tr style={{ height: '20px' }}>...</tr>; // TODOS IGUALES
```

---

## 📋 ROADMAP

### **HOY (Quick Fix):**
- ✅ Arreglar tamaño de intervalos (10 min)
- ✅ Crear documento de diseño (este)

### **MAÑANA (Base de Datos):**
- ✅ Migración con 4 tablas
- ✅ Seed data (propietario por defecto)

### **ESTA SEMANA (Copilot):**
- ✅ Pantalla "Configura tu Equipo"
- ✅ Modal "Añadir Empleado"
- ✅ Pantalla "Horarios"

### **PRÓXIMA SEMANA (Calendario):**
- ✅ Columnas dinámicas por empleado
- ✅ Ausencias y bloqueos
- ✅ Modales completos

---

## 🎯 PRÓXIMO PASO INMEDIATO

### **¿Empezamos con el QUICK FIX?**

Voy a arreglar el tamaño de los intervalos en el calendario **AHORA MISMO** (10 min).

Luego creamos las tablas y seguimos con el Copilot.

**¿De acuerdo?** 🚀


