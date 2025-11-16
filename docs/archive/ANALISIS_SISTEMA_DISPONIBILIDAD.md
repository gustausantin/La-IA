# 📊 ANÁLISIS Y PROPUESTA: SISTEMA DE DISPONIBILIDAD DINÁMICO

## 🎯 OBJETIVO
Crear un sistema de generación de slots de disponibilidad **completamente dinámico** que se actualice automáticamente cuando cambien los parámetros, protegiendo siempre las reservas existentes.

---

## 📋 ANÁLISIS DEL SISTEMA ACTUAL

### ✅ Lo que ya funciona bien:

1. **Función de generación basada en empleados** (`generate_availability_slots_employee_based`)
   - Genera slots basándose en horarios de empleados
   - Considera ausencias (vacaciones)
   - Asignación manual o automática de recursos
   - Protege slots con reservas (solo elimina `status = 'free'`)

2. **Triggers existentes:**
   - `trigger_regenerate_slots_after_absence_change`: Regenera slots al crear/eliminar ausencias
   - `validate_employee_absence_before_insert`: Bloquea ausencias si hay reservas confirmadas

3. **Validación de reservas:**
   - Sistema protege reservas confirmadas al regenerar slots

### ⚠️ Lo que falta o necesita mejora:

1. **No hay regeneración automática cuando:**
   - Cambia el horario del negocio (`businesses.settings.operating_hours`)
   - Cambia el horario de un empleado (`employee_schedules`)
   - Se crea/modifica un evento especial (`calendar_exceptions`, `special_events`)
   - Cambia la configuración de días de antelación (`advance_booking_days`)
   - Se asigna/desasigna un recurso a un empleado
   - Se activa/desactiva un empleado

2. **No hay mantenimiento automático:**
   - Los slots no se regeneran periódicamente
   - No hay limpieza de slots pasados
   - No hay extensión automática de slots hacia el futuro

3. **Consulta en tiempo real para agentes:**
   - Los agentes necesitan ver disponibilidad actualizada inmediatamente
   - Debe reflejar cambios en tiempo real

---

## 🏗️ ARQUITECTURA PROPUESTA

### 1. **SISTEMA DE DETECCIÓN DE CAMBIOS**

#### A. Triggers en Base de Datos (PostgreSQL)

```sql
-- Trigger: Cambios en horario del negocio
CREATE TRIGGER after_business_schedule_change
AFTER UPDATE ON businesses
FOR EACH ROW
WHEN (OLD.settings->>'operating_hours' IS DISTINCT FROM NEW.settings->>'operating_hours')
EXECUTE FUNCTION trigger_regenerate_all_slots();

-- Trigger: Cambios en horarios de empleados
CREATE TRIGGER after_employee_schedule_change
AFTER INSERT OR UPDATE OR DELETE ON employee_schedules
FOR EACH ROW
EXECUTE FUNCTION trigger_regenerate_employee_slots();

-- Trigger: Cambios en eventos especiales
CREATE TRIGGER after_calendar_exception_change
AFTER INSERT OR UPDATE OR DELETE ON calendar_exceptions
FOR EACH ROW
EXECUTE FUNCTION trigger_regenerate_affected_slots();

-- Trigger: Cambios en configuración de antelación
CREATE TRIGGER after_booking_settings_change
AFTER UPDATE ON businesses
FOR EACH ROW
WHEN (
    OLD.settings->>'advance_booking_days' IS DISTINCT FROM NEW.settings->>'advance_booking_days' OR
    OLD.settings->>'min_advance_minutes' IS DISTINCT FROM NEW.settings->>'min_advance_minutes'
)
EXECUTE FUNCTION trigger_regenerate_all_slots();

-- Trigger: Cambios en asignación de recursos
CREATE TRIGGER after_resource_assignment_change
AFTER UPDATE ON employees
FOR EACH ROW
WHEN (OLD.assigned_resource_id IS DISTINCT FROM NEW.assigned_resource_id)
EXECUTE FUNCTION trigger_regenerate_employee_slots();

-- Trigger: Activación/Desactivación de empleados
CREATE TRIGGER after_employee_status_change
AFTER UPDATE ON employees
FOR EACH ROW
WHEN (OLD.is_active IS DISTINCT FROM NEW.is_active)
EXECUTE FUNCTION trigger_regenerate_employee_slots();
```

#### B. Función de Regeneración Inteligente

```sql
CREATE OR REPLACE FUNCTION trigger_regenerate_all_slots()
RETURNS TRIGGER AS $$
DECLARE
    v_business_id UUID;
    v_advance_days INTEGER;
    v_settings JSONB;
BEGIN
    -- Obtener business_id
    IF TG_TABLE_NAME = 'businesses' THEN
        v_business_id := NEW.id;
        v_settings := NEW.settings;
    ELSE
        v_business_id := NEW.business_id;
        -- Obtener settings del negocio
        SELECT settings INTO v_settings
        FROM businesses WHERE id = v_business_id;
    END IF;
    
    -- Obtener días de antelación
    v_advance_days := COALESCE((v_settings->>'advance_booking_days')::INTEGER, 90);
    
    -- Regenerar slots (solo libres, protegiendo reservas)
    PERFORM generate_availability_slots_employee_based(
        v_business_id,
        CURRENT_DATE,
        v_advance_days,
        TRUE -- regenerar
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 2. **MANTENIMIENTO AUTOMÁTICO DIARIO**

#### A. Función de Mantenimiento (Cron Job)

```sql
CREATE OR REPLACE FUNCTION maintenance_availability_slots()
RETURNS TABLE(
    business_id UUID,
    slots_regenerated INTEGER,
    slots_cleaned INTEGER,
    message TEXT
) AS $$
DECLARE
    v_business RECORD;
    v_advance_days INTEGER;
    v_result RECORD;
    v_cleaned INTEGER;
BEGIN
    -- Para cada negocio activo
    FOR v_business IN 
        SELECT id, settings
        FROM businesses
        WHERE is_active = true
    LOOP
        -- Obtener días de antelación
        v_advance_days := COALESCE((v_business.settings->>'advance_booking_days')::INTEGER, 90);
        
        -- 1. Limpiar slots pasados (más de 1 día)
        DELETE FROM availability_slots
        WHERE business_id = v_business.id
        AND slot_date < CURRENT_DATE - INTERVAL '1 day'
        AND status = 'free';
        
        GET DIAGNOSTICS v_cleaned = ROW_COUNT;
        
        -- 2. Regenerar slots para el futuro
        SELECT * INTO v_result
        FROM generate_availability_slots_employee_based(
            v_business.id,
            CURRENT_DATE,
            v_advance_days,
            FALSE -- no regenerar, solo añadir nuevos
        );
        
        -- Retornar resultado
        RETURN QUERY SELECT
            v_business.id,
            v_result.total_slots_generated,
            v_cleaned,
            format('Negocio %s: %s slots regenerados, %s slots limpiados', 
                v_business.id, 
                v_result.total_slots_generated, 
                v_cleaned
            );
    END LOOP;
END;
$$ LANGUAGE plpgsql;
```

#### B. Programar Cron Job (Supabase)

```sql
-- Ejecutar cada día a las 4:00 AM
SELECT cron.schedule(
    'maintenance-availability-slots',
    '0 4 * * *', -- 4 AM diario
    $$SELECT maintenance_availability_slots()$$
);
```

### 3. **CONSULTA EN TIEMPO REAL PARA AGENTES**

#### A. Función RPC Optimizada

```sql
CREATE OR REPLACE FUNCTION get_realtime_availability(
    p_business_id UUID,
    p_date DATE,
    p_time TIME DEFAULT NULL,
    p_duration_minutes INTEGER DEFAULT 60
)
RETURNS TABLE(
    slot_time TIME,
    available_resources INTEGER,
    total_slots INTEGER,
    reserved_slots INTEGER,
    is_available BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.start_time AS slot_time,
        COUNT(DISTINCT a.resource_id) FILTER (WHERE a.status = 'free') AS available_resources,
        COUNT(*) AS total_slots,
        COUNT(*) FILTER (WHERE a.status IN ('reserved', 'booked')) AS reserved_slots,
        COUNT(*) FILTER (WHERE a.status = 'free') > 0 AS is_available
    FROM availability_slots a
    WHERE a.business_id = p_business_id
    AND a.slot_date = p_date
    AND (p_time IS NULL OR a.start_time = p_time)
    AND a.duration_minutes >= p_duration_minutes
    GROUP BY a.start_time
    ORDER BY a.start_time;
END;
$$ LANGUAGE plpgsql STABLE;
```

#### B. Endpoint en Frontend

```javascript
// En AvailabilityService.js
static async getRealtimeAvailability(businessId, date, time = null, durationMinutes = 60) {
    const { data, error } = await supabase.rpc('get_realtime_availability', {
        p_business_id: businessId,
        p_date: date,
        p_time: time,
        p_duration_minutes: durationMinutes
    });
    
    if (error) throw error;
    return data;
}
```

### 4. **PROTECCIÓN DE RESERVAS (REGLA SAGRADA)**

#### A. Función de Validación Mejorada

```sql
CREATE OR REPLACE FUNCTION validate_slot_regeneration(
    p_business_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE(
    can_regenerate BOOLEAN,
    protected_slots_count INTEGER,
    protected_reservations JSONB
) AS $$
DECLARE
    v_protected_count INTEGER;
    v_protected_reservations JSONB;
BEGIN
    -- Contar slots con reservas confirmadas
    SELECT 
        COUNT(*),
        jsonb_agg(
            jsonb_build_object(
                'appointment_id', a.id,
                'customer_name', a.customer_name,
                'appointment_date', a.appointment_date,
                'appointment_time', a.appointment_time,
                'resource_id', a.resource_id
            )
        )
    INTO v_protected_count, v_protected_reservations
    FROM appointments a
    INNER JOIN availability_slots s ON (
        s.business_id = a.business_id
        AND s.resource_id = a.resource_id
        AND s.slot_date = a.appointment_date
        AND s.start_time = a.appointment_time
    )
    WHERE a.business_id = p_business_id
    AND a.appointment_date >= p_start_date
    AND a.appointment_date <= p_end_date
    AND a.status IN ('confirmed', 'pending');
    
    RETURN QUERY SELECT
        TRUE AS can_regenerate, -- Siempre permitir, pero proteger
        COALESCE(v_protected_count, 0),
        COALESCE(v_protected_reservations, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql;
```

#### B. Modificar Función de Generación

La función `generate_availability_slots_employee_based` ya protege reservas:
- Solo elimina slots con `status = 'free'`
- No toca slots con `status = 'reserved'` o `'booked'`

**✅ Esto ya está implementado correctamente.**

---

## 🔄 FLUJO DE ACTUALIZACIÓN DINÁMICA

```
┌─────────────────────────────────────────────────────────────┐
│                    CAMBIO EN PARÁMETRO                       │
│  (Horario, Empleado, Calendario, Configuración, etc.)        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              TRIGGER DETECTA EL CAMBIO                        │
│  (after_business_schedule_change, etc.)                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         VALIDAR RESERVAS EXISTENTES                          │
│  (No eliminar slots con reservas confirmadas)                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│      REGENERAR SLOTS (Solo libres)                            │
│  generate_availability_slots_employee_based()                │
│  - Elimina slots libres obsoletos                            │
│  - Genera nuevos slots según nueva configuración             │
│  - Protege slots con reservas                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         NOTIFICAR FRONTEND (Opcional)                        │
│  (WebSocket o Polling para actualizar UI)                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 📝 PARÁMETROS QUE ACTIVAN REGENERACIÓN

1. **Horario del Negocio** (`businesses.settings.operating_hours`)
2. **Horarios de Empleados** (`employee_schedules`)
3. **Ausencias/Vacaciones** (`employee_absences`) ✅ Ya implementado
4. **Eventos Especiales** (`calendar_exceptions`, `special_events`)
5. **Días de Antelación** (`businesses.settings.advance_booking_days`)
6. **Minutos de Antelación Mínima** (`businesses.settings.min_advance_minutes`)
7. **Asignación de Recursos** (`employees.assigned_resource_id`)
8. **Estado de Empleados** (`employees.is_active`)

---

## 🛡️ REGLAS DE PROTECCIÓN

### Regla Sagrada #1: Las Reservas Son Intocables
- ❌ **NUNCA** eliminar slots con reservas confirmadas o pendientes
- ✅ Solo regenerar slots con `status = 'free'`
- ✅ Si un slot tiene reserva, mantenerlo aunque cambie la configuración

### Regla Sagrada #2: Validación Antes de Cambios
- ✅ Verificar conflictos antes de crear ausencias
- ✅ Bloquear cambios que afecten reservas existentes
- ✅ Mostrar lista de reservas afectadas si hay conflicto

### Regla Sagrada #3: Regeneración Inteligente
- ✅ Regenerar solo el rango afectado (no todo)
- ✅ No duplicar slots existentes
- ✅ Limpiar slots obsoletos (pasados y libres)

---

## 🚀 PLAN DE IMPLEMENTACIÓN

### Fase 1: Triggers de Detección (Prioridad ALTA)
1. ✅ Trigger para ausencias (ya existe)
2. ⏳ Trigger para horarios de negocio
3. ⏳ Trigger para horarios de empleados
4. ⏳ Trigger para eventos especiales
5. ⏳ Trigger para configuración de antelación
6. ⏳ Trigger para asignación de recursos

### Fase 2: Mantenimiento Automático (Prioridad MEDIA)
1. ⏳ Función de mantenimiento diario
2. ⏳ Cron job programado
3. ⏳ Limpieza de slots pasados

### Fase 3: Consulta en Tiempo Real (Prioridad ALTA)
1. ⏳ Función RPC optimizada
2. ⏳ Endpoint en frontend
3. ⏳ UI para agentes

### Fase 4: Testing y Optimización (Prioridad MEDIA)
1. ⏳ Tests de regeneración
2. ⏳ Tests de protección de reservas
3. ⏳ Optimización de queries
4. ⏳ Monitoreo de rendimiento

---

## 📊 MÉTRICAS DE ÉXITO

1. **Tiempo de actualización**: < 5 segundos para regenerar slots
2. **Protección de reservas**: 100% de reservas protegidas
3. **Disponibilidad en tiempo real**: < 100ms para consulta
4. **Automatización**: 100% de cambios detectados automáticamente

---

## 🔍 PRÓXIMOS PASOS

1. **Revisar y aprobar esta propuesta**
2. **Implementar triggers de detección**
3. **Implementar mantenimiento automático**
4. **Crear función de consulta en tiempo real**
5. **Testing exhaustivo**
6. **Documentación para usuarios**

---

**¿Procedemos con la implementación?**


