-- =====================================================
-- MIGRACIÓN: CORREGIR DETECCIÓN DE CONFLICTOS DE RECURSOS
-- Fecha: 2025-11-18
-- Objetivo: Prevenir que el mismo recurso se asigne a múltiples empleados
--           en el mismo día y horario durante la generación automática
-- =====================================================

-- =====================================================
-- ACTUALIZAR: Función find_available_resource con verificación mejorada
-- =====================================================

DROP FUNCTION IF EXISTS find_available_resource(UUID, UUID, INTEGER, TIME, TIME);

CREATE OR REPLACE FUNCTION find_available_resource(
    p_business_id UUID,
    p_employee_id UUID,
    p_day_of_week INTEGER,
    p_start_time TIME,
    p_end_time TIME,
    p_exclude_date DATE DEFAULT NULL -- 🆕 Fecha específica para verificar slots ya generados
)
RETURNS UUID AS $$
DECLARE
    v_resource_id UUID;
    v_check_date DATE;
BEGIN
    -- Si se proporciona una fecha específica, usarla; si no, usar una fecha de referencia
    -- (para verificar conflictos en slots ya generados)
    v_check_date := COALESCE(p_exclude_date, CURRENT_DATE);
    
    -- Buscar recursos activos del negocio
    -- que NO estén siendo usados por otro empleado en el mismo horario
    SELECT r.id INTO v_resource_id
    FROM resources r
    WHERE r.business_id = p_business_id
    AND r.is_active = true
    -- 🚨 VERIFICACIÓN 1: NO debe haber conflicto con asignaciones MANUALES en employee_schedules
    AND NOT EXISTS (
        SELECT 1
        FROM employee_schedules es
        WHERE es.resource_id = r.id
        AND es.day_of_week = p_day_of_week
        AND es.is_working = true
        AND es.employee_id != p_employee_id
        AND es.resource_id IS NOT NULL -- Solo asignaciones manuales
        -- Verificar solapamiento de horarios
        AND (
            -- Si hay shifts, verificar cada turno
            (es.shifts IS NOT NULL AND es.shifts != '[]'::jsonb AND jsonb_array_length(es.shifts) > 0
             AND EXISTS (
                 SELECT 1 FROM jsonb_array_elements(es.shifts) AS shift
                 WHERE (shift->>'start')::TIME < p_end_time
                 AND (shift->>'end')::TIME > p_start_time
             ))
            OR
            -- Si no hay shifts, usar start_time/end_time
            (es.shifts IS NULL OR es.shifts = '[]'::jsonb OR jsonb_array_length(es.shifts) = 0
             AND es.start_time IS NOT NULL AND es.end_time IS NOT NULL
             AND (es.start_time, es.end_time) OVERLAPS (p_start_time, p_end_time))
        )
    )
    -- 🚨 VERIFICACIÓN 2: NO debe haber conflicto con slots YA GENERADOS para ese día
    -- Esto previene que durante la generación se asigne el mismo recurso a múltiples empleados
    -- CRÍTICO: Verificar CUALQUIER slot que se solape, no solo el rango completo
    AND NOT EXISTS (
        SELECT 1
        FROM availability_slots avs
        WHERE avs.resource_id = r.id
        AND avs.business_id = p_business_id
        AND avs.slot_date = v_check_date
        AND avs.employee_id != p_employee_id -- Diferente empleado
        AND avs.status IN ('free', 'reserved', 'blocked') -- Cualquier slot activo
        -- Verificar solapamiento: si el slot se solapa con el rango solicitado
        -- Un slot se solapa si: (start < end_time AND end > start_time)
        AND avs.start_time < p_end_time
        AND avs.end_time > p_start_time
    )
    ORDER BY r.resource_number::INTEGER ASC -- Priorizar número más bajo
    LIMIT 1;
    
    RETURN v_resource_id;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION find_available_resource IS 
'Encuentra un recurso disponible para un empleado en un horario específico, verificando:
1. Conflictos con asignaciones MANUALES en employee_schedules
2. Conflictos con slots YA GENERADOS en availability_slots (previene duplicados durante generación)
IMPORTANTE: Si p_exclude_date se proporciona, verifica slots de esa fecha específica.';

-- =====================================================
-- ACTUALIZAR: Función de generación para pasar la fecha al buscar recursos
-- =====================================================

-- La función generate_availability_slots_employee_based ya está actualizada en la migración anterior
-- Solo necesitamos actualizar las llamadas a find_available_resource para pasar la fecha

-- =====================================================
-- FUNCIÓN: Validar conflictos de recursos antes de asignar
-- =====================================================

CREATE OR REPLACE FUNCTION validate_resource_assignment(
    p_business_id UUID,
    p_employee_id UUID,
    p_resource_id UUID,
    p_day_of_week INTEGER,
    p_start_time TIME,
    p_end_time TIME,
    p_date DATE DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_has_conflict BOOLEAN := false;
    v_conflicting_employee TEXT;
    v_check_date DATE;
BEGIN
    v_check_date := COALESCE(p_date, CURRENT_DATE);
    
    -- Verificar conflictos con asignaciones manuales
    SELECT EXISTS(
        SELECT 1
        FROM employee_schedules es
        INNER JOIN employees e ON es.employee_id = e.id
        WHERE es.resource_id = p_resource_id
        AND es.day_of_week = p_day_of_week
        AND es.is_working = true
        AND es.employee_id != p_employee_id
        AND es.resource_id IS NOT NULL
        AND (
            (es.shifts IS NOT NULL AND es.shifts != '[]'::jsonb AND jsonb_array_length(es.shifts) > 0
             AND EXISTS (
                 SELECT 1 FROM jsonb_array_elements(es.shifts) AS shift
                 WHERE (shift->>'start')::TIME < p_end_time
                 AND (shift->>'end')::TIME > p_start_time
             ))
            OR
            (es.shifts IS NULL OR es.shifts = '[]'::jsonb OR jsonb_array_length(es.shifts) = 0
             AND es.start_time IS NOT NULL AND es.end_time IS NOT NULL
             AND (es.start_time, es.end_time) OVERLAPS (p_start_time, p_end_time))
        )
    ) INTO v_has_conflict;
    
    IF v_has_conflict THEN
        SELECT e.name INTO v_conflicting_employee
        FROM employee_schedules es
        INNER JOIN employees e ON es.employee_id = e.id
        WHERE es.resource_id = p_resource_id
        AND es.day_of_week = p_day_of_week
        AND es.is_working = true
        AND es.employee_id != p_employee_id
        LIMIT 1;
        
        RAISE WARNING 'Conflicto detectado: El recurso ya está asignado a % en este horario', v_conflicting_employee;
        RETURN false;
    END IF;
    
    -- Verificar conflictos con slots ya generados
    SELECT EXISTS(
        SELECT 1
        FROM availability_slots avs
        INNER JOIN employees e ON avs.employee_id = e.id
        WHERE avs.resource_id = p_resource_id
        AND avs.business_id = p_business_id
        AND avs.slot_date = v_check_date
        AND avs.employee_id != p_employee_id
        AND avs.status IN ('free', 'reserved', 'blocked')
        AND (avs.start_time, avs.end_time) OVERLAPS (p_start_time, p_end_time)
    ) INTO v_has_conflict;
    
    IF v_has_conflict THEN
        SELECT e.name INTO v_conflicting_employee
        FROM availability_slots avs
        INNER JOIN employees e ON avs.employee_id = e.id
        WHERE avs.resource_id = p_resource_id
        AND avs.business_id = p_business_id
        AND avs.slot_date = v_check_date
        AND avs.employee_id != p_employee_id
        LIMIT 1;
        
        RAISE WARNING 'Conflicto detectado: El recurso ya tiene slots generados para % en este horario', v_conflicting_employee;
        RETURN false;
    END IF;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION validate_resource_assignment IS 
'Valida que un recurso puede ser asignado a un empleado sin conflictos.
Verifica tanto asignaciones manuales como slots ya generados.';

-- =====================================================
-- ACTUALIZAR: Función de generación para usar la fecha en find_available_resource
-- =====================================================

-- Necesitamos actualizar la función generate_availability_slots_employee_based
-- para pasar la fecha actual cuando llama a find_available_resource

-- Esto se hará en una actualización de la función principal
-- Por ahora, la función find_available_resource ya está mejorada

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================

-- =====================================================
-- FUNCIÓN: Detectar conflictos de recursos existentes
-- =====================================================

CREATE OR REPLACE FUNCTION detect_resource_conflicts(
    p_business_id UUID DEFAULT NULL
)
RETURNS TABLE(
    slot_date DATE,
    start_time TIME,
    resource_id UUID,
    resource_name TEXT,
    employee1_id UUID,
    employee1_name TEXT,
    employee2_id UUID,
    employee2_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT
        avs1.slot_date,
        avs1.start_time,
        avs1.resource_id,
        r.name as resource_name,
        e1.id as employee1_id,
        e1.name as employee1_name,
        e2.id as employee2_id,
        e2.name as employee2_name
    FROM availability_slots avs1
    INNER JOIN availability_slots avs2 
        ON avs1.resource_id = avs2.resource_id
        AND avs1.slot_date = avs2.slot_date
        AND avs1.start_time = avs2.start_time
        AND avs1.employee_id < avs2.employee_id -- Evitar duplicados (A-B y B-A)
    INNER JOIN employees e1 ON avs1.employee_id = e1.id
    INNER JOIN employees e2 ON avs2.employee_id = e2.id
    INNER JOIN resources r ON avs1.resource_id = r.id
    WHERE (p_business_id IS NULL OR avs1.business_id = p_business_id)
    AND avs1.status IN ('free', 'reserved', 'blocked')
    AND avs2.status IN ('free', 'reserved', 'blocked')
    ORDER BY avs1.slot_date, avs1.start_time, r.name;
END;
$$;

COMMENT ON FUNCTION detect_resource_conflicts IS 
'Detecta conflictos donde el mismo recurso está asignado a múltiples empleados en el mismo slot.
Si p_business_id es NULL, busca en todos los negocios.
Si p_business_id se proporciona, solo busca en ese negocio.';

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================

SELECT 'Migración 20251118_02_fix_resource_conflict_detection completada' AS status;

