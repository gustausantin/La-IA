# 🔍 AUDITORÍA COMPLETA: SISTEMA DE RESERVAS
**Fecha:** 2025-11-22  
**Objetivo:** Verificar que se cumplen todas las reglas de negocio críticas

---

## 📋 REGLAS DE NEGOCIO A VERIFICAR

1. ✅ **No se pueden crear reservas sin recursos**
2. ✅ **No se pueden crear reservas sin trabajadores**
3. ✅ **Cada trabajador DEBE tener un recurso asignado**
4. ✅ **Cuando se asigna un horario a un trabajador, se debe asignar un recurso (automático o manual)**
5. ✅ **No se puede generar disponibilidad sin trabajador + recurso + horario**
6. ✅ **Cuando se crea una reserva, debe tener: trabajador + recurso + horario**

---

## 🔍 AUDITORÍA POR COMPONENTE

### 1. CREACIÓN DE TRABAJADORES (EMPLOYEES)

**Archivo:** `src/pages/Equipo.jsx`

#### ✅ **HALLAZGOS POSITIVOS:**
- **Línea 981:** Cuando se crea un empleado, SIEMPRE se asigna un recurso (`assigned_resource_id: finalResourceId`)
- **Líneas 765-966:** Algoritmo inteligente para asignación automática de recursos
- **Línea 684:** Validación: no se puede crear empleado sin recurso seleccionado o "auto"

#### ⚠️ **PROBLEMAS ENCONTRADOS:**
1. **NO HAY CONSTRAINT EN BD:** La tabla `employees` permite `assigned_resource_id = NULL`
   - **Riesgo:** Se puede crear un empleado sin recurso desde SQL directo
   - **Solución:** Agregar constraint `CHECK (assigned_resource_id IS NOT NULL)`

2. **Trigger de horarios por defecto:** El trigger `trigger_create_employee_schedule()` crea horarios incluso si el empleado no tiene recurso
   - **Riesgo:** Se generan horarios sin recurso asignado
   - **Solución:** Modificar trigger para validar que haya recurso antes de crear horarios

---

### 2. ASIGNACIÓN DE HORARIOS (EMPLOYEE_SCHEDULES)

**Archivo:** `supabase/migrations/20251112_01_employee_based_availability.sql`

#### ✅ **HALLAZGOS POSITIVOS:**
- **Líneas 176-207:** Trigger `validate_resource_schedule_conflict()` valida conflictos de recursos
- **Líneas 203-240:** Trigger `trigger_validate_schedule_overlap()` valida solapamiento de horarios
- **Línea 128:** La función de generación de slots verifica si hay recurso asignado

#### ⚠️ **PROBLEMAS ENCONTRADOS:**
1. **NO HAY VALIDACIÓN OBLIGATORIA:** `employee_schedules.resource_id` puede ser NULL (asignación automática)
   - **Riesgo:** Se pueden crear horarios sin recurso asignado
   - **Solución:** Validar en el frontend que siempre haya recurso (manual o automático) antes de guardar

2. **Asignación automática puede fallar:** Si `find_available_resource()` retorna NULL, no se genera slot
   - **Riesgo:** Empleado con horario pero sin slots generados
   - **Solución:** Validar que siempre haya recurso disponible antes de permitir guardar horario

---

### 3. GENERACIÓN DE DISPONIBILIDAD (AVAILABILITY_SLOTS)

**Archivo:** `supabase/migrations/20251112_02_generate_slots_employee_based.sql`

#### ✅ **HALLAZGOS POSITIVOS:**
- **Líneas 63-68:** Solo procesa empleados activos
- **Líneas 84-94:** Solo genera slots si el empleado trabaja ese día
- **Líneas 128-148:** Si no hay recurso disponible, NO genera slots (línea 142-147)
- **Líneas 195-213:** Solo crea slot si tiene `resource_id`

#### ⚠️ **PROBLEMAS ENCONTRADOS:**
1. **NO HAY CONSTRAINT:** La tabla `availability_slots` permite `resource_id = NULL`
   - **Riesgo:** Se pueden crear slots sin recurso desde SQL directo
   - **Solución:** Agregar constraint `CHECK (resource_id IS NOT NULL)`

2. **NO HAY VALIDACIÓN DE EMPLEADO:** `availability_slots` no tiene `employee_id` obligatorio
   - **Riesgo:** Slots sin empleado asociado
   - **Solución:** Agregar constraint o validar en la función de generación

---

### 4. CREACIÓN DE RESERVAS (APPOINTMENTS)

**Archivo:** `src/components/ReservationFormModal.jsx`

#### ✅ **HALLAZGOS POSITIVOS:**
- **Líneas 246-310:** Lógica robusta para obtener `employee_id` desde `resource_id`
- **Líneas 312-322:** Validación final: no se crea reserva sin `resource_id` y `employee_id`
- **Líneas 423-442:** Todos los campos obligatorios se incluyen en `appointmentData`
- **Líneas 472-498:** Verificación post-creación de que todos los campos están presentes

#### ⚠️ **PROBLEMAS ENCONTRADOS:**
1. **NO HAY CONSTRAINT EN BD:** La tabla `appointments` permite `resource_id` sin `employee_id`
   - **Riesgo:** Se puede crear reserva sin `employee_id` desde SQL directo
   - **Solución:** Ya creada en `20251122_01_ensure_employee_id_with_resource.sql` (pendiente aplicar)

2. **Validación solo en frontend:** Si se crea reserva desde otra fuente (API, SQL), puede violar regla
   - **Riesgo:** Datos inconsistentes
   - **Solución:** Constraint en BD (ya creada, pendiente aplicar)

---

## 🛠️ SOLUCIONES PROPUESTAS

### **SOLUCIÓN 1: Constraints en Base de Datos**

```sql
-- 1. Empleados SIEMPRE deben tener recurso
ALTER TABLE employees
ADD CONSTRAINT check_employee_has_resource
CHECK (assigned_resource_id IS NOT NULL);

-- 2. Slots SIEMPRE deben tener recurso
ALTER TABLE availability_slots
ADD CONSTRAINT check_slot_has_resource
CHECK (resource_id IS NOT NULL);

-- 3. Reservas con resource_id DEBEN tener employee_id
-- (Ya creada en 20251122_01_ensure_employee_id_with_resource.sql)
ALTER TABLE appointments
ADD CONSTRAINT check_employee_id_with_resource
CHECK ((resource_id IS NULL) OR (employee_id IS NOT NULL));
```

### **SOLUCIÓN 2: Modificar Trigger de Creación de Horarios**

```sql
-- Modificar trigger para validar recurso antes de crear horarios
CREATE OR REPLACE FUNCTION trigger_create_employee_schedule()
RETURNS TRIGGER AS $$
BEGIN
    -- Validar que el empleado tenga recurso asignado
    IF NEW.assigned_resource_id IS NULL THEN
        RAISE EXCEPTION 'No se pueden crear horarios para un empleado sin recurso asignado';
    END IF;
    
    PERFORM create_default_schedule_for_employee(NEW.id, NEW.business_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### **SOLUCIÓN 3: Validar Recurso en Generación de Slots**

```sql
-- Modificar función de generación para validar recurso antes de generar
-- (Ya está implementado en líneas 128-148, pero podemos mejorar el mensaje)
```

### **SOLUCIÓN 4: Validación en Frontend al Guardar Horarios**

**Archivo:** `src/pages/Equipo.jsx` (líneas 684-694)

Ya existe validación, pero podemos mejorarla:

```javascript
// Asegurar que SIEMPRE haya recurso (manual o automático)
if (!formData.assigned_resource_id || formData.assigned_resource_id === '') {
    toast.error('Debes seleccionar un recurso o dejar en Automático');
    return;
}

// Si es automático, verificar que haya recursos disponibles
if (formData.assigned_resource_id === 'auto') {
    // ... lógica existente ...
    // Si no hay recursos disponibles, ERROR
    if (!availableResources || availableResources.length === 0) {
        toast.error('❌ No hay recursos disponibles. Crea primero un recurso.');
        return;
    }
}
```

---

## 📊 RESUMEN DE ESTADO

| Componente | Estado | Problemas | Soluciones |
|------------|--------|-----------|------------|
| **Creación de Empleados** | ✅ Bueno | ⚠️ Falta constraint en BD | Solución 1 |
| **Asignación de Horarios** | ✅ Bueno | ⚠️ Falta validación de recurso | Solución 2, 4 |
| **Generación de Slots** | ✅ Bueno | ⚠️ Falta constraint en BD | Solución 1 |
| **Creación de Reservas** | ✅ Bueno | ⚠️ Falta constraint en BD | Solución 1 (ya creada) |

---

## ✅ ACCIONES INMEDIATAS

1. **Aplicar migración `20251122_01_ensure_employee_id_with_resource.sql`** ✅ (Ya creada)
2. **Crear migración con constraints adicionales** (Solución 1)
3. **Modificar trigger de creación de horarios** (Solución 2)
4. **Mejorar validación en frontend** (Solución 4)

---

## 🎯 CONCLUSIÓN

El sistema tiene **buena lógica en el frontend**, pero **falta protección a nivel de base de datos**. Las validaciones en el frontend pueden ser bypasseadas si se accede directamente a la BD o desde APIs.

**Recomendación:** Aplicar todas las soluciones propuestas para garantizar integridad de datos a todos los niveles.

