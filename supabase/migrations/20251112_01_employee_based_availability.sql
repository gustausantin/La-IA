-- =====================================================
-- MIGRACIÓN: SISTEMA DE DISPONIBILIDADES BASADO EN EMPLEADOS
-- Fecha: 2025-11-12
-- Objetivo: Permitir asignación flexible de recursos por empleado/día
--           con opción de asignación automática (híbrido)
-- =====================================================

-- =====================================================
-- PASO 1: Añadir resource_id a employee_schedules
-- =====================================================
-- Permite que cada horario de un empleado tenga asignado un recurso específico
-- NULL = Asignación automática (sistema elige el mejor recurso disponible)
-- UUID = Asignación manual (el usuario elige el recurso)
-- =====================================================

DO $$ 
BEGIN
    -- Verificar si la columna ya existe (idempotencia)
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'employee_schedules' 
        AND column_name = 'resource_id'
    ) THEN
        ALTER TABLE employee_schedules
        ADD COLUMN resource_id UUID REFERENCES resources(id) ON DELETE SET NULL;
        
        RAISE NOTICE 'Columna resource_id añadida a employee_schedules';
    ELSE
        RAISE NOTICE 'Columna resource_id ya existe en employee_schedules';
    END IF;
END $$;

-- Índice para optimizar queries
CREATE INDEX IF NOT EXISTS idx_employee_schedules_resource 
ON employee_schedules(resource_id);

-- =====================================================
-- PASO 2: Añadir columna para indicar tipo de asignación
-- =====================================================

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'employee_schedules' 
        AND column_name = 'resource_assignment_type'
    ) THEN
        ALTER TABLE employee_schedules
        ADD COLUMN resource_assignment_type VARCHAR(10) DEFAULT 'auto' CHECK (resource_assignment_type IN ('auto', 'manual'));
        
        RAISE NOTICE 'Columna resource_assignment_type añadida';
    ELSE
        RAISE NOTICE 'Columna resource_assignment_type ya existe';
    END IF;
END $$;

-- =====================================================
-- PASO 3: Migrar datos existentes
-- =====================================================
-- Para employee_schedules ya existentes:
-- Si el empleado tiene assigned_resource_id, copiarlo a todos sus schedules
-- =====================================================

DO $$
DECLARE
    v_employee RECORD;
    v_schedules_updated INTEGER := 0;
BEGIN
    FOR v_employee IN 
        SELECT id, assigned_resource_id
        FROM employees
        WHERE assigned_resource_id IS NOT NULL
    LOOP
        -- Copiar assigned_resource_id a todos los schedules del empleado
        UPDATE employee_schedules
        SET 
            resource_id = v_employee.assigned_resource_id,
            resource_assignment_type = 'manual' -- Asumimos que si estaba asignado, era manual
        WHERE employee_id = v_employee.id
        AND resource_id IS NULL; -- Solo si no tiene ya uno asignado
        
        GET DIAGNOSTICS v_schedules_updated = ROW_COUNT;
        
        IF v_schedules_updated > 0 THEN
            RAISE NOTICE 'Migrados % schedules para empleado %', v_schedules_updated, v_employee.id;
        END IF;
    END LOOP;
END $$;

-- =====================================================
-- PASO 4: FUNCIÓN - Buscar recurso disponible automáticamente
-- =====================================================
-- Encuentra el mejor recurso disponible para un empleado en un horario específico
-- =====================================================

CREATE OR REPLACE FUNCTION find_available_resource(
    p_business_id UUID,
    p_employee_id UUID,
    p_day_of_week INTEGER,
    p_start_time TIME,
    p_end_time TIME
) RETURNS UUID AS $$
DECLARE
    v_resource_id UUID;
BEGIN
    -- Buscar recursos activos del negocio
    -- que NO estén siendo usados por otro empleado en el mismo horario
    SELECT r.id INTO v_resource_id
    FROM resources r
    WHERE r.business_id = p_business_id
    AND r.is_active = true
    -- Verificar que NO haya conflicto con otro empleado
    AND NOT EXISTS (
        SELECT 1
        FROM employee_schedules es
        WHERE es.resource_id = r.id
        AND es.day_of_week = p_day_of_week
        AND es.is_working = true
        AND es.employee_id != p_employee_id
        -- Verificar solapamiento de horarios
        AND (
            (es.start_time, es.end_time) OVERLAPS (p_start_time, p_end_time)
        )
    )
    ORDER BY r.resource_number::INTEGER ASC -- Priorizar número más bajo
    LIMIT 1;
    
    RETURN v_resource_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- PASO 5: FUNCIÓN - Obtener resource_id efectivo
-- =====================================================
-- Devuelve el resource_id a usar (manual si existe, auto si no)
-- =====================================================

CREATE OR REPLACE FUNCTION get_effective_resource_id(
    p_schedule_id UUID
) RETURNS UUID AS $$
DECLARE
    v_schedule RECORD;
    v_assigned_resource UUID;
BEGIN
    -- Obtener datos del schedule
    SELECT * INTO v_schedule
    FROM employee_schedules
    WHERE id = p_schedule_id;
    
    -- Si tiene resource_id asignado manualmente, usarlo
    IF v_schedule.resource_id IS NOT NULL THEN
        RETURN v_schedule.resource_id;
    END IF;
    
    -- Si no, buscar automáticamente
    SELECT find_available_resource(
        v_schedule.business_id,
        v_schedule.employee_id,
        v_schedule.day_of_week,
        v_schedule.start_time,
        v_schedule.end_time
    ) INTO v_assigned_resource;
    
    RETURN v_assigned_resource;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- PASO 6: TRIGGER - Validar conflictos de recursos
-- =====================================================
-- Evita que dos empleados usen el mismo recurso al mismo tiempo
-- =====================================================

CREATE OR REPLACE FUNCTION validate_resource_schedule_conflict()
RETURNS TRIGGER AS $$
DECLARE
    v_conflict_count INTEGER;
BEGIN
    -- Solo validar si resource_id es manual (no NULL)
    IF NEW.resource_id IS NULL THEN
        RETURN NEW; -- Asignación automática, no validar ahora
    END IF;
    
    -- Buscar conflictos: mismo recurso, mismo día, horarios solapados
    SELECT COUNT(*) INTO v_conflict_count
    FROM employee_schedules
    WHERE id != COALESCE(NEW.id, gen_random_uuid()) -- Excluir el registro actual
    AND resource_id = NEW.resource_id
    AND day_of_week = NEW.day_of_week
    AND is_working = true
    -- Verificar solapamiento de horarios
    AND (start_time, end_time) OVERLAPS (NEW.start_time, NEW.end_time);
    
    IF v_conflict_count > 0 THEN
        RAISE EXCEPTION 'Conflicto de horarios: Otro empleado ya usa este recurso en este horario';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER before_insert_update_employee_schedule_resource
    BEFORE INSERT OR UPDATE ON employee_schedules
    FOR EACH ROW
    EXECUTE FUNCTION validate_resource_schedule_conflict();

-- =====================================================
-- COMENTARIOS EN COLUMNAS
-- =====================================================

COMMENT ON COLUMN employee_schedules.resource_id IS 
'Recurso asignado a este horario. NULL = asignación automática, UUID = asignación manual';

COMMENT ON COLUMN employee_schedules.resource_assignment_type IS 
'Tipo de asignación: auto (sistema elige) o manual (usuario elige)';

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================

SELECT 'Migración 20251112_01_employee_based_availability completada' AS status;


