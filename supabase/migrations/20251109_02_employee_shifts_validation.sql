-- =====================================================
-- MIGRACIÓN: TURNOS MÚLTIPLES Y VALIDACIÓN DE NO SOLAPAMIENTO
-- Fecha: 2025-11-09
-- Objetivo: Soportar turnos partidos (mañana/tarde) y validar que no se solapen empleados en el mismo recurso
-- =====================================================

-- =====================================================
-- 1. AÑADIR COLUMNA 'shifts' A employee_schedules
-- =====================================================
ALTER TABLE employee_schedules
ADD COLUMN IF NOT EXISTS shifts JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN employee_schedules.shifts IS 'Array de turnos del día: [{"start":"09:00","end":"14:00"},{"start":"16:00","end":"20:00"}]';

-- =====================================================
-- 2. MIGRAR DATOS EXISTENTES (start_time/end_time → shifts)
-- =====================================================
-- Si existe un horario en start_time/end_time, convertirlo a shifts
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
AND (shifts IS NULL OR shifts = '[]'::jsonb);

-- =====================================================
-- 3. FUNCIÓN: Validar NO solapamiento de empleados en mismo recurso
-- =====================================================
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
    v_new_start TIME;
    v_new_end TIME;
    v_existing_start TIME;
    v_existing_end TIME;
BEGIN
    -- Si no hay recurso asignado, no validar (no hay conflicto posible)
    IF p_resource_id IS NULL THEN
        RETURN true;
    END IF;

    -- Para cada turno nuevo que queremos guardar
    FOR v_new_shift IN SELECT * FROM jsonb_array_elements(p_new_shifts)
    LOOP
        v_new_start := (v_new_shift->>'start')::TIME;
        v_new_end := (v_new_shift->>'end')::TIME;
        
        -- Buscar conflictos con otros empleados en el mismo recurso y día
        FOR v_conflict IN
            SELECT 
                e.id,
                e.name,
                es.shifts
            FROM employees e
            JOIN employee_schedules es ON e.id = es.employee_id
            WHERE e.assigned_resource_id = p_resource_id
            AND e.id != p_employee_id
            AND e.is_active = true
            AND es.day_of_week = p_day_of_week
            AND es.is_working = true
            AND es.shifts IS NOT NULL
            AND es.shifts != '[]'::jsonb
        LOOP
            -- Para cada turno del otro empleado
            FOR v_existing_shift IN SELECT * FROM jsonb_array_elements(v_conflict.shifts)
            LOOP
                v_existing_start := (v_existing_shift->>'start')::TIME;
                v_existing_end := (v_existing_shift->>'end')::TIME;
                
                -- Verificar solapamiento
                -- Dos rangos se solapan si: (start1 < end2) AND (end1 > start2)
                IF v_new_start < v_existing_end AND v_new_end > v_existing_start THEN
                    RAISE EXCEPTION 'Conflicto de horario: % ya trabaja en este recurso de % a % ese día', 
                        v_conflict.name,
                        v_existing_start,
                        v_existing_end
                    USING HINT = 'Cambia el horario o asigna a otro recurso';
                END IF;
            END LOOP;
        END LOOP;
    END LOOP;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_employee_schedule_no_overlap IS 
'Valida que los turnos de un empleado no se solapen con otros empleados en el mismo recurso';

-- =====================================================
-- 4. HACER RECURSO OBLIGATORIO (Constraint)
-- =====================================================
-- Por ahora NO hacemos el constraint a nivel DB (para no romper datos existentes)
-- La validación será en el frontend

-- =====================================================
-- 5. FUNCIÓN RPC: Guardar horario con validación
-- =====================================================
CREATE OR REPLACE FUNCTION save_employee_schedule_with_validation(
    p_employee_id UUID,
    p_schedules JSONB -- Array de 7 elementos (uno por día)
) RETURNS JSONB AS $$
DECLARE
    v_employee RECORD;
    v_resource_id UUID;
    v_schedule JSONB;
    v_day INTEGER;
    v_shifts JSONB;
    v_result JSONB;
BEGIN
    -- Obtener empleado y recurso asignado
    SELECT id, assigned_resource_id, business_id INTO v_employee
    FROM employees
    WHERE id = p_employee_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Empleado no encontrado';
    END IF;
    
    v_resource_id := v_employee.assigned_resource_id;
    
    -- Eliminar horarios existentes
    DELETE FROM employee_schedules
    WHERE employee_id = p_employee_id;
    
    -- Insertar nuevos horarios con validación
    FOR v_day IN 0..6 LOOP
        v_schedule := p_schedules->v_day;
        
        IF v_schedule IS NULL THEN
            CONTINUE;
        END IF;
        
        v_shifts := v_schedule->'shifts';
        
        -- Si está trabajando y tiene turnos, validar
        IF (v_schedule->>'is_working')::BOOLEAN = true 
           AND v_resource_id IS NOT NULL 
           AND v_shifts IS NOT NULL 
           AND v_shifts != '[]'::jsonb THEN
            
            -- Validar no solapamiento
            PERFORM validate_employee_schedule_no_overlap(
                p_employee_id,
                v_resource_id,
                v_day,
                v_shifts
            );
        END IF;
        
        -- Insertar horario
        INSERT INTO employee_schedules (
            business_id,
            employee_id,
            day_of_week,
            is_working,
            shifts,
            breaks
        ) VALUES (
            v_employee.business_id,
            p_employee_id,
            v_day,
            (v_schedule->>'is_working')::BOOLEAN,
            v_shifts,
            COALESCE(v_schedule->'breaks', '[]'::jsonb)
        );
    END LOOP;
    
    -- Devolver éxito
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Horario guardado correctamente'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        -- Devolver error con mensaje
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION save_employee_schedule_with_validation IS 
'Guarda el horario de un empleado validando que no se solape con otros en el mismo recurso';

-- =====================================================
-- 6. TRIGGER: Validar solapamiento ANTES de insertar/actualizar horario
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_validate_schedule_overlap()
RETURNS TRIGGER AS $$
DECLARE
    v_resource_id UUID;
BEGIN
    -- Solo validar si está trabajando y tiene shifts
    IF NEW.is_working = false OR NEW.shifts IS NULL OR NEW.shifts = '[]'::jsonb THEN
        RETURN NEW;
    END IF;
    
    -- Obtener recurso asignado del empleado
    SELECT assigned_resource_id INTO v_resource_id
    FROM employees
    WHERE id = NEW.employee_id;
    
    -- Si no tiene recurso, no validar
    IF v_resource_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Validar solapamiento con otros empleados
    PERFORM validate_employee_schedule_no_overlap(
        NEW.employee_id,
        v_resource_id,
        NEW.day_of_week,
        NEW.shifts
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger
DROP TRIGGER IF EXISTS validate_schedule_before_insert ON employee_schedules;
CREATE TRIGGER validate_schedule_before_insert
    BEFORE INSERT OR UPDATE ON employee_schedules
    FOR EACH ROW
    EXECUTE FUNCTION trigger_validate_schedule_overlap();

