# 🔍 AUDITORÍA: Integración Recursos-Empleados-Google Calendar

**Fecha:** 2025-11-18  
**Objetivo:** Analizar el problema de mapeo entre recursos, empleados y calendarios de Google Calendar

---

## 📋 PROBLEMA PLANTEADO

### Situación Actual
1. **En LA-IA:**
   - Tenemos **Recursos** (sillas, boxes, camillas) - objetos físicos
   - Tenemos **Empleados** (personas) - trabajadores
   - Los empleados tienen `assigned_resource_id` - un empleado puede estar asignado a un recurso
   - Las reservas (`appointments`) tienen tanto `resource_id` como `employee_id`

2. **En Google Calendar:**
   - Pueden tener calendarios por **RECURSO** (ej: "Silla 1", "Silla 2", "Box 3")
   - Pueden tener calendarios por **PERSONA** (ej: "María", "Juan", "Carmen")
   - O una mezcla de ambos

3. **El Problema:**
   - Cuando un cliente llama, normalmente pide una **PERSONA** específica: "Quiero reservar con Juan"
   - Pero si el calendario de Google está vinculado al **RECURSO**, y ese recurso es usado por diferentes personas en diferentes horarios, hay un desajuste
   - Si una persona se va, ¿cómo se reasigna el calendario?
   - Si un recurso es compartido (ej: Silla 1 usada por María en la mañana y Juan en la tarde), ¿cómo se maneja?

---

## 🔎 AUDITORÍA DE LA ESTRUCTURA ACTUAL

### 1. Tabla `resources`
```sql
- id (UUID)
- business_id (UUID)
- name (TEXT) - ej: "Silla 1", "Box 2"
- is_active (BOOLEAN)
```

**Uso:** Representa recursos físicos del negocio.

### 2. Tabla `employees`
```sql
- id (UUID)
- business_id (UUID)
- name (TEXT) - ej: "María", "Juan"
- assigned_resource_id (UUID) - FK a resources.id
- is_active (BOOLEAN)
```

**Relación:** Un empleado puede estar asignado a un recurso específico.

**Problema identificado:** 
- ¿Qué pasa si un recurso es usado por múltiples empleados en diferentes horarios?
- ¿Qué pasa si un empleado trabaja en diferentes recursos según el día?

### 3. Tabla `appointments`
```sql
- id (UUID)
- business_id (UUID)
- resource_id (UUID) - FK a resources.id
- employee_id (UUID) - FK a employees.id
- customer_name (TEXT)
- appointment_date (DATE)
- appointment_time (TIME)
- status (TEXT)
- gcal_event_id (TEXT) - ID del evento en Google Calendar
- synced_to_gcal (BOOLEAN)
```

**Observación:** Las reservas tienen AMBOS campos, lo cual es correcto.

### 4. Configuración Actual en `integrations.config`
```json
{
  "calendar_ids": ["cal1", "cal2", "cal3"],
  "resource_calendar_mapping": {
    "resource_id_1": "calendar_id_1",
    "resource_id_2": "calendar_id_2"
  }
}
```

**Problema:** Solo mapea **recursos → calendarios**, no **empleados → calendarios**.

---

## 🎯 ESCENARIOS REALES

### Escenario 1: Calendario por Recurso (Actual)
**Situación:**
- Google Calendar tiene: "Silla 1", "Silla 2", "Silla 3"
- En LA-IA: Recurso "Silla 1" vinculado a calendario "Silla 1"
- **Problema:** 
  - Cliente llama: "Quiero reservar con María"
  - María trabaja en Silla 1 (mañana) y Silla 2 (tarde)
  - ¿A qué calendario se envía la reserva?

### Escenario 2: Calendario por Persona
**Situación:**
- Google Calendar tiene: "María", "Juan", "Carmen"
- En LA-IA: No hay forma de vincular empleados a calendarios
- **Problema:**
  - Cliente llama: "Quiero reservar con María"
  - ¿A qué calendario se envía? No hay mapeo.

### Escenario 3: Recurso Compartido
**Situación:**
- Silla 1: María (9:00-14:00), Juan (15:00-20:00)
- Google Calendar: "Silla 1" (un solo calendario)
- **Problema:**
  - Cliente llama: "Quiero reservar con Juan a las 16:00"
  - Se crea reserva con `employee_id=Juan`, `resource_id=Silla1`
  - Se envía a calendario "Silla 1" ✅ (funciona)
  - Pero en Google Calendar no se ve que es con Juan específicamente

### Escenario 4: Persona que se va
**Situación:**
- María tiene calendario "María" vinculado
- María se va del negocio
- **Problema:**
  - ¿Qué pasa con el calendario "María"?
  - ¿Se reasigna a otro empleado?
  - ¿Se desvincula?

---

## 💡 OPCIONES DE SOLUCIÓN

### Opción 1: Mapeo Dual (Recursos + Empleados) ⭐ RECOMENDADA

**Concepto:** Permitir mapear tanto recursos como empleados a calendarios.

**Estructura:**
```json
{
  "calendar_ids": ["cal1", "cal2", "cal3", "cal4"],
  "resource_calendar_mapping": {
    "resource_id_1": "calendar_id_1",
    "resource_id_2": "calendar_id_2"
  },
  "employee_calendar_mapping": {
    "employee_id_1": "calendar_id_3",
    "employee_id_2": "calendar_id_4"
  }
}
```

**Lógica de selección:**
1. Si la reserva tiene `employee_id` Y hay mapeo para ese empleado → usar calendario del empleado
2. Si no, pero tiene `resource_id` Y hay mapeo para ese recurso → usar calendario del recurso
3. Si no, usar el primer calendario seleccionado

**Ventajas:**
- ✅ Flexible: soporta ambos casos (calendarios por recurso y por persona)
- ✅ Prioriza persona sobre recurso (más natural para el cliente)
- ✅ Permite migración gradual

**Desventajas:**
- ⚠️ Más complejo de configurar
- ⚠️ Puede haber conflictos si ambos están mapeados

---

### Opción 2: Solo Mapeo por Empleado

**Concepto:** Eliminar mapeo por recurso, solo por empleado.

**Estructura:**
```json
{
  "calendar_ids": ["cal1", "cal2", "cal3"],
  "employee_calendar_mapping": {
    "employee_id_1": "calendar_id_1",
    "employee_id_2": "calendar_id_2"
  }
}
```

**Lógica:**
- Si la reserva tiene `employee_id` Y hay mapeo → usar calendario del empleado
- Si no, usar el primer calendario seleccionado

**Ventajas:**
- ✅ Más simple
- ✅ Alineado con cómo piensan los clientes ("quiero con María")

**Desventajas:**
- ❌ No funciona si Google Calendar está organizado por recursos
- ❌ Si un empleado no está mapeado, todas sus reservas van al mismo calendario

---

### Opción 3: Mapeo Híbrido con Prioridad Configurable

**Concepto:** Permitir ambos mapeos pero con una prioridad configurable.

**Estructura:**
```json
{
  "calendar_ids": ["cal1", "cal2", "cal3"],
  "resource_calendar_mapping": {...},
  "employee_calendar_mapping": {...},
  "calendar_mapping_priority": "employee" // o "resource"
}
```

**Lógica:**
- Si `priority === "employee"`: intentar empleado primero, luego recurso
- Si `priority === "resource"`: intentar recurso primero, luego empleado

**Ventajas:**
- ✅ Máxima flexibilidad
- ✅ Permite cambiar la estrategia según el negocio

**Desventajas:**
- ⚠️ Más complejo
- ⚠️ Puede ser confuso para el usuario

---

### Opción 4: Mapeo Inteligente con Horarios

**Concepto:** Mapear empleados a calendarios considerando horarios de trabajo.

**Estructura:**
```json
{
  "employee_calendar_mapping": {
    "employee_id_1": {
      "calendar_id": "calendar_id_1",
      "schedule": {
        "monday": {"start": "09:00", "end": "14:00"},
        "tuesday": {"start": "09:00", "end": "14:00"}
      }
    }
  }
}
```

**Lógica:**
- Si la reserva tiene `employee_id` Y el empleado tiene mapeo Y está en su horario → usar calendario del empleado
- Si no, intentar recurso

**Ventajas:**
- ✅ Maneja casos complejos (empleado en diferentes recursos según horario)

**Desventajas:**
- ❌ Muy complejo de implementar y mantener
- ❌ Requiere sincronización con horarios de empleados

---

## 🎯 RECOMENDACIÓN: OPCIÓN 1 (Mapeo Dual)

### Implementación Propuesta

#### 1. Actualizar `ResourceCalendarLinker` → `CalendarLinker`
- Permitir vincular tanto recursos como empleados
- UI con dos pestañas: "Recursos" y "Empleados"
- Mostrar advertencias si hay conflictos

#### 2. Actualizar `sync-google-calendar`
- Prioridad: `employee_id` → `resource_id` → primer calendario
- Logs claros indicando qué calendario se usó y por qué

#### 3. Actualizar `import-google-calendar-initial`
- Al importar eventos, intentar inferir `employee_id` desde el mapeo inverso
- Si el calendario está mapeado a un empleado, asignar ese `employee_id`

#### 4. Documentación
- Guía clara sobre cuándo usar mapeo por recurso vs. por empleado
- Ejemplos de casos de uso

---

## 📊 CASOS DE USO ESPECÍFICOS

### Caso 1: Peluquería con Calendarios por Estilista
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
**Resultado:** ✅ Funciona perfectamente

### Caso 2: Fisioterapia con Calendarios por Box
**Google Calendar:** "Box 1", "Box 2", "Box 3"  
**Configuración:**
```json
{
  "resource_calendar_mapping": {
    "box1_id": "box1_calendar_id",
    "box2_id": "box2_calendar_id",
    "box3_id": "box3_calendar_id"
  }
}
```
**Resultado:** ✅ Funciona perfectamente

### Caso 3: Mixto (Algunos por persona, algunos por recurso)
**Google Calendar:** "María", "Juan", "Box 3"  
**Configuración:**
```json
{
  "employee_calendar_mapping": {
    "maria_id": "maria_calendar_id",
    "juan_id": "juan_calendar_id"
  },
  "resource_calendar_mapping": {
    "box3_id": "box3_calendar_id"
  }
}
```
**Resultado:** ✅ Funciona con mapeo dual

---

## 🔄 MIGRACIÓN Y REASIGNACIÓN

### Cuando un Empleado se va:
1. **Opción A:** Desvincular su calendario
   - Remover del `employee_calendar_mapping`
   - Las reservas futuras usarán el recurso o calendario por defecto

2. **Opción B:** Reasignar calendario a nuevo empleado
   - Cambiar `employee_id` en el mapeo
   - Las reservas existentes mantienen su `employee_id` original

### Cuando un Recurso se desactiva:
1. Remover del `resource_calendar_mapping`
2. Las reservas futuras usarán el empleado o calendario por defecto

---

## ✅ PRÓXIMOS PASOS

1. **Revisar y aprobar** esta auditoría
2. **Decidir** qué opción implementar (recomendamos Opción 1)
3. **Implementar** el mapeo dual
4. **Actualizar** la UI para permitir vincular empleados
5. **Probar** con casos reales
6. **Documentar** para usuarios finales

---

## 📝 NOTAS ADICIONALES

- **Importante:** La tabla `appointments` ya tiene ambos campos (`resource_id` y `employee_id`), lo cual es perfecto
- **Consideración:** Si un empleado trabaja en múltiples recursos, el mapeo por empleado es más útil
- **Consideración:** Si un recurso es usado por múltiples empleados, el mapeo por recurso es más útil
- **Recomendación:** Permitir ambos y dejar que el usuario elija según su caso de uso

---

**Fin del documento de auditoría**


