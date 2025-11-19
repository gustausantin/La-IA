# 🔍 AUDITORÍA: Importación por Recurso vs Trabajador

**Fecha:** 2025-11-19  
**Objetivo:** Evaluar la viabilidad de importar calendarios de Google Calendar organizados por **recurso** y convertirlos automáticamente a **trabajadores** basándose en horarios.

---

## 📊 ESTRUCTURA ACTUAL DE LA-IA

### 1. **Jerarquía de Configuración**
```
1. Horario de la Empresa (operating_hours)
   ↓
2. Recursos (resources) - Sillas, mesas, camillas, etc.
   ↓
3. Trabajadores (employees) - Asignados a recursos
```

### 2. **Relación Recurso-Trabajador**

**Tabla `employees`:**
- `id` (UUID)
- `name` (TEXT)
- `assigned_resource_id` (UUID) - **Recurso asignado por defecto**
- `employee_schedules` (relación) - Horarios del trabajador

**Tabla `employee_schedules`:**
- `id` (UUID)
- `employee_id` (UUID)
- `day_of_week` (INTEGER) - 0-6 (Lunes-Domingo)
- `start_time` (TIME)
- `end_time` (TIME)
- `resource_id` (UUID) - **Recurso específico para este horario**

### 3. **Tabla `appointments` (Reservas)**

**Campos clave:**
- `id` (UUID)
- `business_id` (UUID)
- `employee_id` (UUID) - **Trabajador asignado**
- `resource_id` (UUID) - **Recurso asignado**
- `appointment_date` (DATE)
- `appointment_time` (TIME)
- `customer_name`, `customer_phone`, `customer_email`
- `status` (TEXT) - 'pending', 'confirmed', 'completed', 'cancelled', etc.

### 4. **Visualización en Calendario de Reservas**

**En `Reservas.jsx`:**
- Las reservas se muestran **por trabajador** (columnas = trabajadores)
- Cada trabajador tiene un `assigned_resource_id` (recurso por defecto)
- Los trabajadores pueden tener `employee_schedules` con `resource_id` específico por horario

**Código relevante:**
```javascript
// Carga empleados con sus recursos asignados
const { data: employeesData } = await supabase
    .from('employees')
    .select(`
        id, name, assigned_resource_id,
        employee_schedules(*)
    `)
    .eq("business_id", businessId)
    .eq("is_active", true);

// Mapea empleados a columnas del calendario
const mappedEmployees = employeesData.map(emp => ({
    id: emp.id,
    name: emp.name,
    assigned_resource_id: emp.assigned_resource_id,
    employee_schedules: emp.employee_schedules
}));
```

---

## 🎯 PROBLEMA PLANTEADO

### **Escenario:**
1. **Google Calendar organizado por RECURSO:**
   - Calendario "Silla 1" → Eventos de 09:00-14:00 (Andrés)
   - Calendario "Silla 1" → Eventos de 14:00-20:00 (María)
   - Calendario "Silla 2" → Eventos de 10:00-18:00 (Carlos)

2. **LA-IA organizado por TRABAJADOR:**
   - Andrés → Silla 1 (mañana)
   - María → Silla 1 (tarde)
   - Carlos → Silla 2 (todo el día)

### **Pregunta:**
¿Podemos importar un calendario por recurso y **convertirlo automáticamente** a trabajadores basándonos en los horarios de `employee_schedules`?

---

## ✅ ANÁLISIS DE VIABILIDAD

### **OPCIÓN 1: Mapeo Recurso → Trabajador por Horario**

**Lógica propuesta:**
1. Al importar evento de "Silla 1" a las 10:00
2. Consultar `employee_schedules`:
   - Buscar trabajadores con `resource_id = 'Silla 1'`
   - Filtrar por `day_of_week` y `start_time <= 10:00 < end_time`
3. Asignar `employee_id` al trabajador encontrado
4. Si no hay coincidencia exacta, usar `assigned_resource_id` como fallback

**Ventajas:**
- ✅ Respeta la estructura actual de LA-IA (trabajadores)
- ✅ Usa información ya existente (`employee_schedules`)
- ✅ Permite recursos compartidos sin conflictos

**Desventajas:**
- ⚠️ Requiere que `employee_schedules` esté bien configurado
- ⚠️ Si un recurso no tiene horarios definidos, no se puede mapear
- ⚠️ Si hay solapamiento de horarios, puede haber ambigüedad

**Complejidad:** 🟡 **MEDIA**

---

### **OPCIÓN 2: Mapeo Recurso → Trabajador por Asignación por Defecto**

**Lógica propuesta:**
1. Al importar evento de "Silla 1"
2. Buscar trabajador con `assigned_resource_id = 'Silla 1'`
3. Asignar ese trabajador

**Ventajas:**
- ✅ Muy simple de implementar
- ✅ No requiere horarios complejos

**Desventajas:**
- ❌ No maneja recursos compartidos
- ❌ Si "Silla 1" es usada por Andrés (mañana) y María (tarde), solo asignará a uno

**Complejidad:** 🟢 **BAJA** (pero limitada)

---

### **OPCIÓN 3: Mapeo Híbrido (Recomendado)**

**Lógica propuesta:**
1. **Primero:** Intentar mapeo por horario (`employee_schedules`)
2. **Si no hay coincidencia:** Usar asignación por defecto (`assigned_resource_id`)
3. **Si no hay asignación:** Mostrar advertencia y permitir selección manual

**Flujo:**
```
Evento: "Silla 1" a las 10:00
  ↓
¿Hay employee_schedules con resource_id='Silla 1' y horario que incluya 10:00?
  ├─ SÍ → Asignar employee_id del schedule
  └─ NO → ¿Hay employee con assigned_resource_id='Silla 1'?
      ├─ SÍ → Asignar ese employee_id
      └─ NO → Marcar como "sin asignar" y mostrar en UI para selección manual
```

**Ventajas:**
- ✅ Maneja recursos compartidos correctamente
- ✅ Tiene fallback para casos simples
- ✅ Permite corrección manual si es necesario

**Desventajas:**
- ⚠️ Requiere configuración de `employee_schedules` para casos complejos
- ⚠️ Puede requerir intervención manual en algunos casos

**Complejidad:** 🟡 **MEDIA-ALTA**

---

## 🔧 IMPLEMENTACIÓN PROPUESTA

### **1. Modificar `import-google-calendar-initial/index.ts`**

**Nueva función: `getEmployeeForResourceByTime()`**

```typescript
async function getEmployeeForResourceByTime(
  resourceId: string,
  appointmentDate: Date,
  appointmentTime: string,
  businessId: string
): Promise<string | null> {
  const dayOfWeek = appointmentDate.getDay(); // 0-6
  const [hours, minutes] = appointmentTime.split(':').map(Number);
  const timeValue = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;

  // 1. Buscar en employee_schedules (mapeo por horario)
  const { data: schedules } = await supabaseClient
    .from('employee_schedules')
    .select('employee_id, start_time, end_time')
    .eq('resource_id', resourceId)
    .eq('day_of_week', dayOfWeek)
    .lte('start_time', timeValue)
    .gte('end_time', timeValue);

  if (schedules && schedules.length > 0) {
    // Si hay múltiples coincidencias, tomar la primera (o la más específica)
    return schedules[0].employee_id;
  }

  // 2. Fallback: Buscar por assigned_resource_id
  const { data: employees } = await supabaseClient
    .from('employees')
    .select('id')
    .eq('business_id', businessId)
    .eq('assigned_resource_id', resourceId)
    .eq('is_active', true)
    .limit(1);

  if (employees && employees.length > 0) {
    return employees[0].id;
  }

  // 3. No se encontró trabajador
  return null;
}
```

**Modificar `importEventsToAppointments()`:**

```typescript
// Si el calendario está mapeado a un recurso (no a un trabajador)
if (resourceCalendarMapping[calendarId]) {
  const resourceId = resourceCalendarMapping[calendarId];
  
  // Intentar encontrar trabajador por horario
  const employeeId = await getEmployeeForResourceByTime(
    resourceId,
    startTime,
    appointmentTime,
    businessId
  );

  if (employeeId) {
    appointmentData.employee_id = employeeId;
    appointmentData.resource_id = resourceId;
  } else {
    // Marcar como "sin asignar" para revisión manual
    console.warn(`⚠️ No se pudo asignar trabajador para recurso ${resourceId} a las ${appointmentTime}`);
    appointmentData.resource_id = resourceId;
    appointmentData.employee_id = null; // Requerirá asignación manual
  }
}
```

---

### **2. UI para Asignación Manual**

**Nuevo componente: `UnassignedAppointmentsReview.jsx`**

- Lista de eventos importados sin `employee_id`
- Permite seleccionar trabajador manualmente
- Muestra recurso y horario para facilitar decisión

---

### **3. Configuración de Mapeo**

**En `IntegracionesContent.jsx`:**
- Opción: "Importar por Recurso" vs "Importar por Trabajador"
- Si selecciona "Por Recurso", mostrar `ResourceCalendarLinker`
- Si selecciona "Por Trabajador", mostrar `EmployeeCalendarLinker`

---

## 📋 CASOS DE USO

### **Caso 1: Recurso Compartido (Horarios No Solapados)**
- **Google Calendar:** "Silla 1" → 09:00-14:00, 14:00-20:00
- **LA-IA:**
  - Andrés → `employee_schedules`: Silla 1, Lunes, 09:00-14:00
  - María → `employee_schedules`: Silla 1, Lunes, 14:00-20:00
- **Resultado:** ✅ Se asignan correctamente por horario

### **Caso 2: Recurso Compartido (Horarios Solapados)**
- **Google Calendar:** "Silla 1" → 10:00-15:00, 12:00-18:00
- **LA-IA:**
  - Andrés → `employee_schedules`: Silla 1, Lunes, 10:00-15:00
  - María → `employee_schedules`: Silla 1, Lunes, 12:00-18:00
- **Resultado:** ⚠️ Evento a las 12:00-15:00 es ambiguo → Requiere selección manual

### **Caso 3: Recurso No Compartido**
- **Google Calendar:** "Silla 2" → 10:00-18:00
- **LA-IA:**
  - Carlos → `assigned_resource_id`: Silla 2
- **Resultado:** ✅ Se asigna a Carlos automáticamente

### **Caso 4: Recurso Sin Configuración**
- **Google Calendar:** "Silla 3" → 10:00-18:00
- **LA-IA:** No hay trabajador asignado a Silla 3
- **Resultado:** ⚠️ Se marca como "sin asignar" → Requiere configuración manual

---

## 🎯 RECOMENDACIÓN FINAL

### **✅ SÍ, ES VIABLE** con las siguientes condiciones:

1. **Implementar OPCIÓN 3 (Híbrida):**
   - Mapeo por horario como primera opción
   - Fallback a asignación por defecto
   - UI para corrección manual

2. **Requisitos previos:**
   - Los usuarios deben configurar `employee_schedules` correctamente
   - Si un recurso es compartido, los horarios NO deben solaparse (o se requerirá intervención manual)

3. **Complejidad:**
   - 🟡 **MEDIA** - Requiere lógica de mapeo inteligente
   - 🟡 **MEDIA** - Requiere UI para casos edge
   - 🟢 **BAJA** - No rompe funcionalidad existente

4. **Riesgos:**
   - ⚠️ Si `employee_schedules` no está bien configurado, habrá eventos sin asignar
   - ⚠️ Si hay solapamientos, requerirá intervención manual
   - ✅ No afecta reservas existentes

---

## 🚀 PLAN DE IMPLEMENTACIÓN

### **Fase 1: Mapeo Básico (MVP)**
1. Implementar `getEmployeeForResourceByTime()` con fallback a `assigned_resource_id`
2. Modificar `import-google-calendar-initial` para usar esta función
3. Marcar eventos sin asignar con `employee_id = null`

### **Fase 2: UI de Revisión**
1. Crear componente para revisar eventos sin asignar
2. Permitir asignación manual de trabajador
3. Mostrar advertencias si hay ambigüedad

### **Fase 3: Validación y Mejoras**
1. Validar que no hay conflictos (mismo recurso, mismo horario, diferentes trabajadores)
2. Sugerir trabajador basándose en historial
3. Permitir configuración de "reglas de mapeo" personalizadas

---

## 📝 CONCLUSIÓN

**Respuesta:** ✅ **SÍ, ES VIABLE** pero requiere:
- Configuración adecuada de `employee_schedules`
- Lógica de mapeo inteligente
- UI para casos edge

**Complejidad:** 🟡 **MEDIA** (no es trivial, pero es manejable)

**Riesgo:** 🟢 **BAJO** (no rompe funcionalidad existente)

**Recomendación:** Implementar en **2 fases**:
1. MVP con mapeo básico + fallback
2. UI de revisión para casos complejos

