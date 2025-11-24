# 🔄 SISTEMA DE TURNOS Y VALIDACIÓN DE RECURSOS
## Gestión Profesional de Horarios Partidos y No Solapamiento

**Fecha:** 9 de Noviembre, 2025  
**Objetivo:** Implementar turnos múltiples por día y validación de no solapamiento en recursos  
**Problema:** Los empleados pueden tener horarios partidos (mañana/tarde) y no pueden solaparse en el mismo recurso

---

## 🎯 LOS 3 REQUISITOS

### **1. TURNOS PARTIDOS (Horario Mañana/Tarde)**

**Caso de uso:**
```
Lucía - Lunes:
├─ Turno 1 (Mañana): 09:00 - 14:00
├─ DESCANSO:         14:00 - 16:00 (comida)
└─ Turno 2 (Tarde):  16:00 - 20:00

Total: 9 horas trabajadas (5h mañana + 4h tarde)
```

**UI propuesta:**
```
┌─────────────────────────────────────────┐
│ Lunes                            [ON]   │
│                                         │
│ Turno 1:  [09:00] — [14:00]            │
│ Turno 2:  [16:00] — [20:00]   [+ Añadir]│
│                                  [- Quitar]│
└─────────────────────────────────────────┘
```

---

### **2. RECURSO OBLIGATORIO**

**Regla:**
- **NO puedes crear empleado SIN recurso**
- Dropdown "Recurso asignado" es **OBLIGATORIO**
- Si no hay recursos → Error: "Crea recursos primero en Configuración"

**Flujo:**
```
1. Configuración → Recursos
   ├─ Crear: Silla 1, Silla 2, Silla 3
   └─ Horario del negocio: 8:00-20:00

2. Tu Equipo → Añadir Empleado
   ├─ Nombre: Lucía
   ├─ Recurso: [Silla 1 ▼] ← OBLIGATORIO
   └─ Horario: (después)
```

---

### **3. VALIDACIÓN DE NO SOLAPAMIENTO**

**Reglas:**

#### **Regla 1: Total horas ≤ Horario del recurso**
```
Recurso: Silla 1 (8:00-20:00 = 12 horas)

Empleados:
├─ Lucía:    9:00-14:00 (5h)
├─ Macarena: 14:00-19:00 (5h)
└─ TOTAL: 10 horas ✅ OK (< 12h)

Si intentas añadir Carlos con 4 horas:
└─ TOTAL: 14 horas ❌ ERROR (> 12h del recurso)
```

#### **Regla 2: NO solapamiento en mismo recurso**
```
Silla 1:
├─ Lucía:    [========9:00-14:00========]
└─ Macarena:                       [=14:00-19:00=]
   ✅ OK: No se solapan (14:00 es el límite exacto)

Silla 1:
├─ Lucía:    [========9:00-14:00========]
└─ Carlos:         [===10:00-18:00=======]
   ❌ ERROR: Se solapan (10:00-14:00)
```

**Validación al guardar:**
```javascript
function validateNoOverlap(employeeId, resourceId, newShifts) {
  // 1. Obtener todos los empleados del mismo recurso
  const employeesInResource = employees.filter(
    e => e.assigned_resource_id === resourceId && e.id !== employeeId
  );

  // 2. Para cada día, verificar solapamiento
  newShifts.forEach(newShift => {
    employeesInResource.forEach(otherEmp => {
      const otherShifts = otherEmp.schedules[dayOfWeek].shifts;
      
      otherShifts.forEach(otherShift => {
        if (shiftsOverlap(newShift, otherShift)) {
          throw new Error(
            `⚠️ Conflicto: ${otherEmp.name} ya trabaja en ${resourceName} de ${otherShift.start} a ${otherShift.end}`
          );
        }
      });
    });
  });
}
```

---

## 🗂️ CAMBIOS EN SCHEMA

### **Modificar `employee_schedules`:**

```sql
-- Migración: 20251109_02_employee_shifts.sql

-- 1. Añadir columna 'shifts' (array de turnos)
ALTER TABLE employee_schedules
ADD COLUMN IF NOT EXISTS shifts JSONB DEFAULT '[]'::jsonb;

-- 2. Migrar datos existentes (start_time/end_time → shifts)
UPDATE employee_schedules
SET shifts = jsonb_build_array(
  jsonb_build_object(
    'start', start_time::text,
    'end', end_time::text
  )
)
WHERE is_working = true
AND start_time IS NOT NULL
AND end_time IS NOT NULL
AND shifts = '[]'::jsonb;

-- 3. (Opcional) Deprecar start_time/end_time
-- COMMENT ON COLUMN employee_schedules.start_time IS 'DEPRECATED: Usar shifts';
-- COMMENT ON COLUMN employee_schedules.end_time IS 'DEPRECATED: Usar shifts';

-- 4. Crear función de validación de solapamiento
CREATE OR REPLACE FUNCTION validate_employee_schedule_no_overlap(
    p_employee_id UUID,
    p_resource_id UUID,
    p_day_of_week INTEGER,
    p_new_shifts JSONB
) RETURNS BOOLEAN AS $$
DECLARE
    v_conflict RECORD;
    v_new_shift JSONB;
    v_existing_shift JSONB;
BEGIN
    -- Validar que el recurso existe y obtener su horario
    -- (Esto asume que resources tiene operating_hours en metadata)
    
    -- Para cada turno nuevo
    FOR v_new_shift IN SELECT * FROM jsonb_array_elements(p_new_shifts)
    LOOP
        -- Buscar conflictos con otros empleados en el mismo recurso y día
        FOR v_conflict IN
            SELECT 
                e.name,
                e.id,
                es.shifts
            FROM employees e
            JOIN employee_schedules es ON e.id = es.employee_id
            WHERE e.assigned_resource_id = p_resource_id
            AND e.id != p_employee_id
            AND e.is_active = true
            AND es.day_of_week = p_day_of_week
            AND es.is_working = true
        LOOP
            -- Para cada turno del otro empleado
            FOR v_existing_shift IN SELECT * FROM jsonb_array_elements(v_conflict.shifts)
            LOOP
                -- Verificar solapamiento
                IF (
                    (v_new_shift->>'start')::TIME < (v_existing_shift->>'end')::TIME
                    AND (v_new_shift->>'end')::TIME > (v_existing_shift->>'start')::TIME
                ) THEN
                    RAISE EXCEPTION 'Conflicto de horario: % ya trabaja en este recurso de % a % ese día', 
                        v_conflict.name,
                        v_existing_shift->>'start',
                        v_existing_shift->>'end';
                END IF;
            END LOOP;
        END LOOP;
    END LOOP;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;
```

---

## 🎨 UI: Modal Editar Horario (con turnos)

### **Versión SIMPLE (botón + Añadir turno):**

```
┌─────────────────────────────────────────┐
│ 📅 Horario de Lucía                     │
│                                         │
│ [ON]  Lunes                             │
│                                         │
│   Turno 1:  [09:00] — [14:00]   [- Quitar]│
│   Turno 2:  [16:00] — [20:00]   [- Quitar]│
│   [+ Añadir turno]                      │
│                                         │
│ [ON]  Martes                            │
│   Turno 1:  [10:00] — [19:00]   [- Quitar]│
│   [+ Añadir turno]                      │
│                                         │
│ [OFF] Sábado  Cerrado                   │
│                                         │
│ [GUARDAR]                               │
└─────────────────────────────────────────┘
```

### **Versión BOOKSY (tabs Mañana/Tarde):**

```
┌─────────────────────────────────────────┐
│ 📅 Horario de Lucía                     │
│                                         │
│ [ON]  Lunes                             │
│                                         │
│   [Continuo] [Partido]  ← Tabs          │
│                                         │
│   Si "Partido":                         │
│   Mañana:  [09:00] — [14:00]            │
│   Tarde:   [16:00] — [20:00]            │
│                                         │
│ [GUARDAR]                               │
└─────────────────────────────────────────┘
```

---

## 🚀 IMPLEMENTACIÓN

### **FASE 1: Migración SQL (15 min)**
1. Añadir columna `shifts` a `employee_schedules`
2. Migrar datos existentes
3. Crear función `validate_employee_schedule_no_overlap()`

### **FASE 2: Modal "Añadir Empleado" (30 min)**
1. Hacer recurso **OBLIGATORIO**
2. Cargar recursos disponibles
3. Validar que existe al menos 1 recurso

### **FASE 3: Modal "Editar Horario" (1 hora)**
1. Cambiar de `start_time/end_time` a `shifts` (array)
2. Botón "+ Añadir turno" por día
3. Botón "- Quitar" por turno
4. Validación de solapamiento al guardar

### **FASE 4: Botón "Editar" en tarjeta (15 min)**
1. Añadir botón "Editar" (lápiz)
2. Modal completo con:
   - Nombre
   - Email
   - Teléfono
   - Recurso (dropdown)
   - Botón "Editar horario" (abre modal horarios)

---

## 🤔 ¿QUÉ PREFIERES?

### **Opción A: Todo de una vez** (2-3 horas)
- Migración + Validación + UI completa
- Lo dejamos perfecto

### **Opción B: Paso a paso** (ir probando)
1. Primero: Recurso obligatorio (15 min)
2. Luego: Turnos múltiples (1 hora)
3. Luego: Validación solapamiento (30 min)
4. Luego: Botón editar (15 min)

### **Opción C: Solo diseño** (30 min)
- Documento completo del sistema
- Lo implementamos mañana

---

**¿Qué hacemos?** Yo recomiendo **Opción B** (paso a paso). 🎯


