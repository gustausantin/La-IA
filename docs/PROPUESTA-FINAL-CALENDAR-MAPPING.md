# 🎯 PROPUESTA FINAL: Mapeo de Calendarios Google Calendar (SIMPLIFICADA)

**Fecha:** 2025-11-18  
**Versión:** MVP Simplificada

---

## ✅ DECISIÓN: Mapeo por Empleado (OBLIGATORIO)

**Razón:** 
- La mayoría de negocios organizan Google Calendar por trabajador
- Es más natural para los clientes ("quiero con María")
- **CRÍTICO:** Si un calendario tiene reservas de múltiples trabajadores, no podemos usar fallback genérico
- **REQUISITO:** Cada calendario DEBE estar vinculado a un trabajador para sincronizar

---

## 🏗️ ARQUITECTURA OBLIGATORIA

### 1. Configuración en `integrations.config`

```json
{
  "calendar_ids": ["cal1", "cal2", "cal3"],
  "employee_calendar_mapping": {
    "employee_id_1": "calendar_id_1",
    "employee_id_2": "calendar_id_2",
    "employee_id_3": "calendar_id_3"
  },
  "resource_calendar_mapping": {
    // Opcional: mantener para compatibilidad, pero priorizar empleados
    "resource_id_1": "calendar_id_1"
  }
}
```

**OBLIGATORIO:** Cada calendario seleccionado DEBE estar mapeado a un empleado. Sin excepciones.

### 2. Lógica de Mapeo (SIN FALLBACK)

**Cuando se crea una reserva:**
1. Si tiene `employee_id` Y está mapeado → usar calendario del empleado ✅
2. Si no está mapeado → **NO sincronizar** o mostrar error

**IMPORTANTE:** 
- No usar "primer calendario" como fallback
- Si un calendario tiene 3 trabajadores y solo asignan 1, ese trabajador se lleva todas las reservas (responsabilidad del usuario)
- Siempre usar información actualizada de empleados (cargar desde BD cada vez)

---

## 🔄 FLUJO DE CONFIGURACIÓN (SIMPLIFICADO)

### Paso 1: Conectar Google Calendar
- Usuario conecta su cuenta de Google
- Selecciona los calendarios que quiere sincronizar

### Paso 2: Vincular Calendarios a Trabajadores (OBLIGATORIO)
**Después de seleccionar calendarios, mostrar:**
- Lista de trabajadores activos del negocio (cargar desde BD cada vez - información actualizada)
- Para cada calendario seleccionado, un selector de trabajador (OBLIGATORIO)
- Validar que TODOS los calendarios tengan un trabajador asignado
- Guardar en `employee_calendar_mapping`

**Mensaje:** "Cada calendario debe estar vinculado a un trabajador. Si un calendario tiene reservas de múltiples trabajadores, asigna el trabajador principal."

**Validación:** No permitir guardar si hay calendarios sin trabajador asignado.

### Paso 3: Reasignación (Cuando alguien se va)
- Si un empleado se va:
  - Opción 1: Desvincular su calendario (remover del mapping)
  - Opción 2: Reasignar calendario a otro empleado (cambiar `employee_id` en el mapping)
  - Las reservas existentes mantienen su `employee_id` original

---

## 💻 IMPLEMENTACIÓN TÉCNICA

### 1. Función `getCalendarForAppointment(appointment, integration)` (OBLIGATORIA)

```typescript
function getCalendarForAppointment(appointment: any, integration: any): string | null {
  // Cargar información actualizada de empleados desde BD
  // (no confiar solo en el config, porque empleados pueden cambiar)
  
  if (!appointment.employee_id) {
    console.warn(`⚠️ Reserva ${appointment.id} no tiene employee_id - no se puede sincronizar`)
    return null // NO sincronizar si no hay employee_id
  }

  const employeeMapping = integration.config?.employee_calendar_mapping || {}
  const mappedCalendar = employeeMapping[appointment.employee_id]
  
  if (mappedCalendar) {
    console.log(`🔗 Usando calendario del empleado ${appointment.employee_id}: ${mappedCalendar}`)
    return mappedCalendar
  }

  // NO hay fallback - si no está mapeado, no sincronizar
  console.warn(`⚠️ Empleado ${appointment.employee_id} no tiene calendario mapeado - no se sincroniza`)
  return null
}
```

**OBLIGATORIO:** Si no hay mapeo, retornar `null` y NO sincronizar.

### 2. Actualizar `sync-google-calendar/index.ts`

```typescript
// En la función createGoogleCalendarEvent
const targetCalendarId = getCalendarForAppointment(reservation, integration)

if (!targetCalendarId) {
  console.warn(`⚠️ No se puede sincronizar reserva ${reservation.id} - no hay calendario mapeado para el empleado`)
  // Opción A: Lanzar error
  throw new Error(`No hay calendario mapeado para el empleado ${reservation.employee_id}`)
  // Opción B: Continuar sin sincronizar (silenciosamente)
  // return { success: false, skipped: true, reason: 'no_calendar_mapping' }
}
```

### 3. Actualizar `check-availability-unified/index.ts`

```typescript
// Al verificar Google Calendar, usar la misma lógica
const calendarIdsToCheck = getCalendarsForAvailabilityCheck(
  resource_id, 
  employee_id, 
  integration
)
```

### 4. Actualizar `import-google-calendar-initial/index.ts`

```typescript
// Al importar eventos, inferir employee_id desde el mapping inverso
const employeeMapping = integration.config?.employee_calendar_mapping || {}
const employeeId = Object.keys(employeeMapping).find(
  empId => employeeMapping[empId] === event.calendar_id
)
if (employeeId) {
  appointmentData.employee_id = employeeId
  console.log(`🔗 Evento importado asignado a empleado ${employeeId} desde calendario ${event.calendar_id}`)
}
```

---

## 🎨 CAMBIOS EN LA UI (SIMPLIFICADOS)

### 1. Actualizar `IntegracionesContent.jsx`

**Después de seleccionar calendarios, mostrar automáticamente:**

```jsx
{calendarsSelected && (
  <div className="mt-6">
    <h4 className="font-semibold mb-2">
      Asignar Calendarios a Trabajadores (Opcional)
    </h4>
    <p className="text-sm text-gray-600 mb-4">
      Si quieres, puedes asignar un calendario a cada trabajador. 
      Si no, usaremos el primer calendario seleccionado.
    </p>
    <EmployeeCalendarLinker 
      businessId={businessId}
      integrationConfig={integrationConfig}
      onUpdate={refreshIntegration}
    />
  </div>
)}
```

### 2. Crear `EmployeeCalendarLinker.jsx` (NUEVO)

Similar a `ResourceCalendarLinker.jsx` pero para empleados:
- **Cargar empleados activos desde BD cada vez** (información actualizada)
- Para cada calendario seleccionado, selector de trabajador (OBLIGATORIO)
- Validar que todos los calendarios tengan trabajador asignado
- Guardar en `employee_calendar_mapping`
- Mensaje claro: "Cada calendario debe estar vinculado a un trabajador"

**Validación:**
- No permitir guardar si hay calendarios sin trabajador
- Mostrar error claro: "Todos los calendarios deben tener un trabajador asignado"
- Permitir mantener mapeo de recursos (opcional, para compatibilidad)

---

## 📊 CASOS DE USO

### Caso 1: Peluquería (Con Mapeo) ⭐ MÁS COMÚN
**Google Calendar:** "María", "Juan", "Carmen"  
**Configuración:**
```json
{
  "employee_calendar_mapping": {
    "maria_id": "maria_calendar_id",
    "juan_id": "juan_calendar_id",
    "carmen_id": "carmen_calendar_id"
  }
}
```
**Resultado:** ✅ Perfecto - Cliente pide "con María" → va al calendario de María

### Caso 2: Calendario con Múltiples Trabajadores
**Google Calendar:** "Calendario Compartido" (tiene reservas de María, Juan y Carmen)  
**Configuración:**
```json
{
  "calendar_ids": ["calendario_compartido_id"],
  "employee_calendar_mapping": {
    "maria_id": "calendario_compartido_id" // Solo María asignada
  }
}
```
**Resultado:** ⚠️ Todas las reservas del calendario se asignan a María (responsabilidad del usuario de asignar el trabajador correcto)

### Caso 3: Empleado se va
**Situación:** María se va, llega Ana  
**Acción:**
1. Opción A: Desvincular calendario de María
2. Opción B: Reasignar calendario "María" a Ana (cambiar `employee_id` en mapping)
3. Las reservas existentes de María mantienen su `employee_id` original

---

## ✅ VENTAJAS DE ESTA PROPUESTA (OBLIGATORIA)

1. **Claro y Directo:** Cada calendario debe tener un trabajador asignado
2. **Sin Confusión:** No hay fallback genérico que cause problemas
3. **Natural:** Prioriza empleado (como piensan los clientes)
4. **Actualizado:** Siempre carga información fresca de empleados desde BD
5. **Responsabilidad del Usuario:** Si un calendario tiene múltiples trabajadores, el usuario decide cuál asignar

---

## 🚀 PLAN DE IMPLEMENTACIÓN

### Fase 1: Backend
1. ✅ Actualizar `sync-google-calendar` para usar `getCalendarForAppointment`
2. ✅ Actualizar `check-availability-unified` para usar la misma lógica
3. ✅ Actualizar `import-google-calendar-initial` para inferir `employee_id`

### Fase 2: Frontend
1. ✅ Crear `EmployeeCalendarLinker.jsx`
2. ✅ Mostrar automáticamente después de seleccionar calendarios
3. ✅ **Validar que todos los calendarios tengan trabajador asignado (OBLIGATORIO)**
4. ✅ Cargar empleados activos desde BD cada vez (información actualizada)
5. ✅ Mantener opción de mapeo de recursos (opcional, para compatibilidad)

### Fase 3: Testing
1. ✅ Probar con mapeo de empleados
2. ✅ Probar sin mapeo (debe usar primer calendario)
3. ✅ Probar reasignación de calendarios
4. ✅ Probar importación desde Google Calendar

---

## 📝 NOTAS IMPORTANTES

- **OBLIGATORIO:** Cada calendario DEBE estar vinculado a un trabajador. Sin excepciones.
- **Sin Fallback:** NO usar "primer calendario" como fallback. Si no hay mapeo, no sincronizar.
- **Información Actualizada:** Siempre cargar empleados activos desde BD (no cachear, porque pueden cambiar)
- **Múltiples Trabajadores:** Si un calendario tiene reservas de varios trabajadores, el usuario asigna el trabajador principal
- **Recursos:** Mantener opción de mapeo de recursos (opcional) para compatibilidad, pero priorizar empleados
- **Shifts:** No necesitamos implementar "Shifts" como propone ChatGPT, porque ya tenemos `employee_schedules` que maneja horarios

---

**Fin de la propuesta**

