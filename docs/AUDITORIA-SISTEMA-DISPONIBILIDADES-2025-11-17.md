# 🔍 AUDITORÍA COMPLETA: SISTEMA DE GENERACIÓN DE DISPONIBILIDADES

**Fecha:** 2025-11-17  
**Objetivo:** Entender completamente cómo funciona la generación de slots, cuándo se ejecuta, dónde se almacenan y cómo se relacionan con las reservas.

---

## 📋 TABLA DE CONTENIDOS

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Función de Generación](#función-de-generación)
4. [Cuándo se Generan los Slots](#cuándo-se-generan-los-slots)
5. [Factores que Afectan las Reservas](#factores-que-afectan-las-reservas)
6. [Almacenamiento y Estructura](#almacenamiento-y-estructura)
7. [Protección de Reservas](#protección-de-reservas)
8. [Comparación con el Mercado](#comparación-con-el-mercado)
9. [Recomendaciones](#recomendaciones)

---

## 🎯 RESUMEN EJECUTIVO

### Estado Actual

El sistema utiliza una **generación basada en empleados** (`generate_availability_slots_employee_based`) que:

- ✅ Genera slots de 15 minutos basándose en horarios de empleados
- ✅ Considera ausencias de empleados (todo el día y parciales)
- ✅ Asigna recursos automáticamente o manualmente
- ✅ **PROTEGE reservas existentes** al regenerar
- ✅ Se ejecuta automáticamente al guardar configuración de reservas
- ✅ Se puede ejecutar manualmente desde "Disponibilidades"

### Problema Identificado

**La generación automática requiere:**
1. ✅ Horarios de negocio configurados (`operating_hours` en `businesses.settings`)
2. ✅ Empleados activos con horarios (`employee_schedules`)
3. ✅ Recursos asignados (manual o automático)

**Si falta alguno de estos elementos, los slots NO se generan correctamente.**

---

## 🏗️ ARQUITECTURA DEL SISTEMA

### Flujo de Datos

```
┌─────────────────────────────────────────────────────────────┐
│                    CONFIGURACIÓN INICIAL                      │
├─────────────────────────────────────────────────────────────┤
│  1. Negocio: operating_hours (horarios de apertura)          │
│  2. Empleados: employee_schedules (horarios de trabajo)      │
│  3. Recursos: resources (mesas, salones, etc.)                │
│  4. Política: booking_settings (días adelantados, etc.)      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              GENERACIÓN DE SLOTS                              │
├─────────────────────────────────────────────────────────────┤
│  Función: generate_availability_slots_employee_based()        │
│  - Lee horarios de empleados                                 │
│  - Considera ausencias                                       │
│  - Asigna recursos                                            │
│  - Genera slots de 15 minutos                                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              ALMACENAMIENTO                                   │
├─────────────────────────────────────────────────────────────┤
│  Tabla: availability_slots                                     │
│  - business_id                                                │
│  - resource_id (mesa/salón)                                   │
│  - slot_date                                                 │
│  - start_time, end_time                                       │
│  - status: 'free' | 'reserved' | 'blocked'                   │
│  - metadata: { appointment_id, ... }                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              RESERVAS                                         │
├─────────────────────────────────────────────────────────────┤
│  Tabla: appointments                                         │
│  - appointment_date                                           │
│  - appointment_time                                           │
│  - resource_id                                               │
│  - status: 'confirmed' | 'pending' | 'cancelled'             │
│                                                               │
│  ⚠️ Las reservas MARCAN los slots como 'reserved'            │
│  ⚠️ Los slots protegidos NO se eliminan al regenerar         │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚙️ FUNCIÓN DE GENERACIÓN

### Función Principal: `generate_availability_slots_employee_based`

**Ubicación:** `supabase/migrations/20251112_02_generate_slots_employee_based.sql`

**Parámetros:**
- `p_business_id` (UUID): ID del negocio
- `p_start_date` (DATE): Fecha de inicio (default: CURRENT_DATE)
- `p_days_ahead` (INTEGER): Días a generar (default: 90)
- `p_regenerate` (BOOLEAN): Si regenerar slots existentes (default: FALSE)

**Proceso:**

1. **Eliminación de slots libres** (si `p_regenerate = TRUE`)
   ```sql
   DELETE FROM availability_slots
   WHERE business_id = p_business_id
     AND slot_date >= p_start_date
     AND slot_date <= v_end_date
     AND status = 'free'; -- ⚠️ SOLO LIBRES (protección de reservas)
   ```

2. **Loop por cada empleado activo**
   ```sql
   FOR v_employee IN 
       SELECT id, name, assigned_resource_id
       FROM employees
       WHERE business_id = p_business_id
       AND is_active = true
   ```

3. **Loop por cada día en el rango**
   - Obtiene día de la semana (0=domingo, 6=sábado)
   - Busca horario del empleado para ese día
   - Verifica ausencias (todo el día o parciales)

4. **Asignación de recursos**
   - Manual: `v_schedule.resource_id` (si existe)
   - Automático: `find_available_resource()` (si no existe)

5. **Generación de slots**
   - Intervalo: **15 minutos** (`v_slot_interval := '15 minutes'`)
   - Desde `start_time` hasta `end_time` del horario
   - Verifica que no exista ya el slot
   - Inserta con `status = 'free'`

**Retorno:**
```sql
RETURNS TABLE(
    total_slots_generated INTEGER,
    days_processed INTEGER,
    employees_processed INTEGER,
    message TEXT
)
```

---

## ⏰ CUÁNDO SE GENERAN LOS SLOTS

### 1. **Al Guardar Configuración de Reservas** ⭐ PRINCIPAL

**Ubicación:** `src/components/configuracion/RestaurantSettings.jsx`

**Trigger:** `handleSave()` detecta cambios en:
- `opening_hours` (horarios de negocio)
- `booking_settings.advance_booking_days` (días adelantados)
- `booking_settings.min_advance_minutes` (minutos mínimos)

**Proceso:**
```javascript
// 1. Guardar configuración
await onUpdate(settingsToSave);

// 2. Detectar cambios
const hoursChanged = JSON.stringify(previousSettings.opening_hours) !== JSON.stringify(settings.opening_hours);
const advanceDaysChanged = previousSettings.booking_settings?.advance_booking_days !== settings.booking_settings?.advance_booking_days;

// 3. Si hay cambios Y existen slots previos, regenerar automáticamente
if (hoursChanged || advanceDaysChanged) {
  const result = await AutoSlotRegenerationService.regenerate(businessId, reason, {
    advanceDays: settings.booking_settings?.advance_booking_days || 30
  });
}
```

**Características:**
- ✅ Automático (no requiere confirmación)
- ✅ Solo si ya existen slots previos (no en primera configuración)
- ✅ Muestra toast informativo
- ✅ Protege reservas existentes

### 2. **Manual desde Disponibilidades**

**Ubicación:** `src/components/AvailabilityManager.jsx`

**Trigger:** Usuario hace clic en "Regenerar Disponibilidades"

**Proceso:**
```javascript
const smartRegeneration = async (changeType = 'general', changeData = {}) => {
  // 1. Obtener configuración actual
  const { data: businessSettings } = await supabase
    .from('businesses')
    .select('settings')
    .eq('id', businessId)
    .single();

  // 2. Calcular rango de fechas
  const advanceDays = businessSettings?.settings?.booking_settings?.advance_booking_days || 30;
  const endDate = format(addDays(new Date(), advanceDays), 'yyyy-MM-dd');

  // 3. Proteger reservas existentes
  const { datesWithReservations, slotsProtectedByResource } = await protectSlotsWithReservations(...);

  // 4. Eliminar solo slots libres fuera del rango
  const slotsToDeleteSafe = slotsToDelete.filter(slot => {
    const slotKey = `${slot.slot_date}_${slot.resource_id || 'null'}`;
    return !slotsProtectedByResource.has(slotKey);
  });

  // 5. Generar nuevos slots
  const { data, error } = await supabase.rpc('generate_availability_slots_employee_based', {
    p_business_id: businessId,
    p_start_date: today,
    p_days_ahead: daysToGenerate,
    p_regenerate: true
  });
}
```

### 3. **Cambios en Horarios de Empleados** (Pendiente)

**Estado:** No implementado automáticamente

**Recomendación:** Agregar trigger o hook que detecte cambios en `employee_schedules` y regenere automáticamente.

### 4. **Cambios en Ausencias de Empleados** (Pendiente)

**Estado:** No implementado automáticamente

**Recomendación:** Agregar trigger o hook que detecte cambios en `employee_absences` y regenere automáticamente.

### 5. **Mantenimiento Diario Automático** (Pendiente)

**Estado:** Documentado pero no implementado

**Ubicación:** `docs/02-sistemas/SISTEMA-DISPONIBILIDADES-COMPLETO.md`

**Propósito:** Mantener ventana móvil constante de disponibilidades

**Recomendación:** Implementar con `pg_cron` en Supabase:
```sql
SELECT cron.schedule(
  'daily-availability-maintenance',
  '0 2 * * *', -- 2 AM todos los días
  $$
  SELECT daily_availability_maintenance();
  $$
);
```

---

## 🔗 FACTORES QUE AFECTAN LAS RESERVAS

### 1. **Horarios de Negocio** (`operating_hours`)

**Ubicación:** `businesses.settings.operating_hours`

**Formato:**
```json
{
  "monday": { "open": "09:00", "close": "18:00" },
  "tuesday": { "open": "11:00", "close": "18:00" },
  ...
}
```

**Impacto:**
- ✅ El calendario muestra solo horarios dentro de `operating_hours`
- ✅ Los slots se generan SOLO dentro de estos horarios
- ⚠️ Si un empleado tiene horario fuera de `operating_hours`, NO se generan slots

**Validación:** Implementada en `src/pages/Calendario.jsx`
- Detecta conflictos entre horarios de negocio y horarios de empleados
- Muestra advertencia antes de guardar

### 2. **Horarios de Empleados** (`employee_schedules`)

**Ubicación:** Tabla `employee_schedules`

**Estructura:**
- `employee_id`
- `day_of_week` (0=domingo, 6=sábado)
- `start_time`, `end_time`
- `is_working` (boolean)
- `resource_id` (opcional, asignación manual)

**Impacto:**
- ✅ Los slots se generan SOLO para empleados activos con `is_working = true`
- ✅ Si un empleado no trabaja un día, NO se generan slots para ese día
- ⚠️ Si un empleado no tiene `resource_id` asignado, se busca automáticamente

### 3. **Ausencias de Empleados** (`employee_absences`)

**Ubicación:** Tabla `employee_absences`

**Estructura:**
- `employee_id`
- `start_date`, `end_date`
- `start_time`, `end_time` (para ausencias parciales)
- `all_day` (boolean)
- `approved` (boolean)

**Impacto:**
- ✅ Si `all_day = true`, NO se generan slots para ese día
- ✅ Si `all_day = false`, NO se generan slots en el rango `start_time` - `end_time`
- ⚠️ Solo se consideran ausencias con `approved = true`

### 4. **Recursos** (`resources`)

**Ubicación:** Tabla `resources`

**Estructura:**
- `id`
- `business_id`
- `name`
- `type` ('table', 'room', 'chair', etc.)
- `is_active`

**Impacto:**
- ✅ Cada slot se asocia a un `resource_id`
- ✅ Si no hay recursos disponibles, NO se generan slots
- ⚠️ La asignación puede ser manual (en `employee_schedules.resource_id`) o automática

### 5. **Política de Reservas** (`booking_settings`)

**Ubicación:** `businesses.settings.booking_settings`

**Parámetros:**
- `advance_booking_days`: Días adelantados a generar (default: 30)
- `min_advance_minutes`: Minutos mínimos antes de la cita
- `max_party_size`: Tamaño máximo de grupo
- `cancellation_policy`: Política de cancelación

**Impacto:**
- ✅ `advance_booking_days` determina cuántos días hacia el futuro se generan slots
- ✅ `min_advance_minutes` filtra slots que están muy cerca en el tiempo
- ⚠️ Si cambia `advance_booking_days`, se regeneran automáticamente los slots

---

## 💾 ALMACENAMIENTO Y ESTRUCTURA

### Tabla: `availability_slots`

**Esquema:**
```sql
CREATE TABLE availability_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id),
    resource_id UUID REFERENCES resources(id),
    slot_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status TEXT NOT NULL DEFAULT 'free', -- 'free' | 'reserved' | 'blocked'
    duration_minutes INTEGER DEFAULT 15,
    is_available BOOLEAN DEFAULT true,
    metadata JSONB, -- { appointment_id, ... }
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**Índices:**
```sql
CREATE INDEX idx_availability_slots_business_date 
  ON availability_slots(business_id, slot_date);

CREATE INDEX idx_availability_slots_resource_date 
  ON availability_slots(resource_id, slot_date);

CREATE INDEX idx_availability_slots_status 
  ON availability_slots(status);
```

**Relaciones:**
- `business_id` → `businesses.id`
- `resource_id` → `resources.id`
- `metadata.appointment_id` → `appointments.id` (cuando está reservado)

### Tabla: `appointments`

**Esquema:**
```sql
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id),
    resource_id UUID REFERENCES resources(id),
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    customer_name TEXT,
    customer_phone TEXT,
    customer_email TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- 'confirmed' | 'pending' | 'cancelled' | 'completed'
    duration_minutes INTEGER DEFAULT 60,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**Relación con Slots:**
- Cuando se crea una reserva, se marcan los slots correspondientes como `status = 'reserved'`
- Los slots almacenan `metadata.appointment_id` para referencia
- Si se cancela una reserva, los slots vuelven a `status = 'free'`

---

## 🛡️ PROTECCIÓN DE RESERVAS

### Regla Sagrada: NUNCA ELIMINAR RESERVAS

**Implementación:**

1. **Al Regenerar Slots:**
   ```sql
   -- SOLO eliminar slots LIBRES
   DELETE FROM availability_slots
   WHERE business_id = p_business_id
     AND slot_date >= p_start_date
     AND slot_date <= v_end_date
     AND status = 'free'; -- ⚠️ NO elimina 'reserved' ni 'blocked'
   ```

2. **Al Eliminar Slots Fuera del Rango:**
   ```javascript
   // Verificar reservas activas antes de eliminar
   const { datesWithReservations, slotsProtectedByResource } = await protectSlotsWithReservations(slotsToDelete, endDate);

   // Filtrar slots protegidos
   const slotsToDeleteSafe = slotsToDelete.filter(slot => {
     const slotKey = `${slot.slot_date}_${slot.resource_id || 'null'}`;
     return !slotsProtectedByResource.has(slotKey);
   });
   ```

3. **Al Crear Reserva:**
   ```javascript
   // Marcar slots como reservados
   for (let i = 0; i < slotsNeeded; i++) {
     await supabase
       .from('availability_slots')
       .update({
         status: 'reserved',
         metadata: { appointment_id: reservation.id }
       })
       .eq('business_id', businessId)
       .eq('resource_id', resourceId)
       .eq('slot_date', slotDate)
       .eq('start_time', targetTime);
   }
   ```

4. **Al Cancelar Reserva:**
   ```javascript
   // Liberar slots
   await supabase
     .from('availability_slots')
     .update({
       status: 'free',
       metadata: null
     })
     .eq('business_id', businessId)
     .contains('metadata', { appointment_id: reservationId });
   ```

---

## 📊 COMPARACIÓN CON EL MERCADO

### Aplicaciones Populares

#### 1. **Calendly**
- ✅ Generación automática basada en horarios
- ✅ Ventana móvil de disponibilidades
- ✅ Protección de reservas existentes
- ✅ Regeneración automática al cambiar horarios

#### 2. **Resy**
- ✅ Generación basada en horarios de restaurante
- ✅ Considera capacidad de mesas
- ✅ Regeneración diaria automática
- ✅ Protección de reservas confirmadas

#### 3. **OpenTable**
- ✅ Generación basada en horarios y capacidad
- ✅ Ventana móvil de 30-90 días
- ✅ Regeneración automática al cambiar configuración
- ✅ Protección de reservas existentes

### Nuestro Sistema vs. Competencia

| Característica | Nuestro Sistema | Calendly | Resy | OpenTable |
|---------------|----------------|----------|------|-----------|
| Generación automática | ✅ | ✅ | ✅ | ✅ |
| Basado en empleados | ✅ | ❌ | ❌ | ❌ |
| Considera ausencias | ✅ | ✅ | ❌ | ❌ |
| Protección de reservas | ✅ | ✅ | ✅ | ✅ |
| Regeneración al guardar | ✅ | ✅ | ✅ | ✅ |
| Mantenimiento diario | ⚠️ Pendiente | ✅ | ✅ | ✅ |
| Regeneración por cambios de empleado | ⚠️ Pendiente | N/A | N/A | N/A |

### Ventajas de Nuestro Sistema

1. ✅ **Basado en empleados:** Más flexible para negocios con múltiples trabajadores
2. ✅ **Considera ausencias:** Más preciso que sistemas basados solo en horarios
3. ✅ **Protección robusta:** No elimina reservas al regenerar
4. ✅ **Regeneración automática:** Al guardar configuración

### Mejoras Necesarias

1. ⚠️ **Mantenimiento diario automático:** Implementar con `pg_cron`
2. ⚠️ **Regeneración por cambios de empleado:** Agregar triggers/hooks
3. ⚠️ **Regeneración por ausencias:** Agregar triggers/hooks
4. ⚠️ **Validación previa:** Verificar que existan horarios antes de generar

---

## 💡 RECOMENDACIONES

### 1. **Validación Previa a la Generación**

**Problema:** Si faltan horarios de negocio o empleados, los slots no se generan correctamente.

**Solución:**
```javascript
// Antes de generar, validar:
const validation = await validateSlotGeneration(businessId);
if (!validation.valid) {
  toast.error(`⚠️ No se pueden generar slots: ${validation.message}`);
  return;
}

function validateSlotGeneration(businessId) {
  // 1. Verificar que existan operating_hours
  // 2. Verificar que existan empleados activos
  // 3. Verificar que existan recursos
  // 4. Verificar que los empleados tengan horarios configurados
}
```

### 2. **Mantenimiento Diario Automático**

**Implementar:**
```sql
-- Crear función de mantenimiento
CREATE OR REPLACE FUNCTION daily_availability_maintenance()
RETURNS TABLE(...) AS $$
BEGIN
  -- 1. Eliminar slots libres del pasado
  -- 2. Generar slots para el nuevo día al final del rango
END;
$$;

-- Programar con pg_cron
SELECT cron.schedule(
  'daily-availability-maintenance',
  '0 2 * * *', -- 2 AM todos los días
  $$ SELECT daily_availability_maintenance(); $$
);
```

### 3. **Regeneración Automática por Cambios de Empleado**

**Implementar:**
```javascript
// En el componente de gestión de empleados
const handleEmployeeScheduleChange = async (employeeId, schedule) => {
  // 1. Guardar cambios
  await saveEmployeeSchedule(employeeId, schedule);
  
  // 2. Regenerar slots automáticamente
  await AutoSlotRegenerationService.regenerate(businessId, 'employee_schedule_changed', {
    affectedEmployeeId: employeeId
  });
};
```

### 4. **Regeneración Automática por Ausencias**

**Implementar:**
```javascript
// En el componente de gestión de ausencias
const handleAbsenceChange = async (absence) => {
  // 1. Guardar cambios
  await saveAbsence(absence);
  
  // 2. Regenerar slots automáticamente
  await AutoSlotRegenerationService.regenerate(businessId, 'employee_absence_changed', {
    affectedEmployeeId: absence.employee_id,
    affectedDates: getDateRange(absence.start_date, absence.end_date)
  });
};
```

### 5. **Mejorar Mensajes de Error**

**Problema:** Si la generación falla, el mensaje no es claro.

**Solución:**
```javascript
try {
  const result = await supabase.rpc('generate_availability_slots_employee_based', {...});
  if (result.error) {
    // Mensajes específicos según el error
    if (result.error.code === 'P0001') {
      toast.error('⚠️ No hay empleados activos con horarios configurados');
    } else if (result.error.code === 'P0002') {
      toast.error('⚠️ No hay recursos disponibles para asignar');
    } else {
      toast.error(`❌ Error generando slots: ${result.error.message}`);
    }
  }
} catch (error) {
  console.error('Error:', error);
  toast.error('❌ Error inesperado al generar slots');
}
```

### 6. **Dashboard de Estado de Generación**

**Implementar:**
```javascript
// Componente que muestre:
// - Última generación: fecha/hora
// - Slots generados: cantidad
// - Próxima generación: fecha/hora (si hay mantenimiento diario)
// - Estado: ✅ OK | ⚠️ Pendiente | ❌ Error
```

---

## ✅ CHECKLIST DE VALIDACIÓN

Antes de considerar el sistema completo, verificar:

- [x] Función de generación implementada
- [x] Protección de reservas funcionando
- [x] Regeneración automática al guardar configuración
- [x] Regeneración manual desde Disponibilidades
- [ ] Validación previa a la generación
- [ ] Mantenimiento diario automático
- [ ] Regeneración por cambios de empleado
- [ ] Regeneración por ausencias
- [ ] Dashboard de estado
- [ ] Mensajes de error claros

---

## 📝 CONCLUSIÓN

El sistema actual está **bien implementado** en términos de:
- ✅ Generación basada en empleados
- ✅ Protección de reservas
- ✅ Regeneración automática al guardar configuración

**Faltan mejoras en:**
- ⚠️ Mantenimiento diario automático
- ⚠️ Regeneración por cambios de empleado/ausencias
- ⚠️ Validación previa a la generación

**Recomendación:** Implementar las mejoras sugeridas para alcanzar paridad con aplicaciones del mercado.

---

**Documento generado:** 2025-11-17  
**Última actualización:** 2025-11-17

