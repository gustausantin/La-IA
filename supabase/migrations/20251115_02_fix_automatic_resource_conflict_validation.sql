-- =====================================================
-- MIGRACIÓN: CORREGIR VALIDACIÓN DE CONFLICTOS PARA RECURSOS AUTOMÁTICOS
-- Fecha: 2025-11-15
-- Objetivo: NO validar conflictos cuando resource_assignment_type = 'auto'
--           porque el sistema puede asignar diferentes recursos automáticamente
-- =====================================================

-- =====================================================
-- 0. ELIMINAR FUNCIÓN ANTIGUA (si existe con firma diferente)
-- =====================================================
DROP FUNCTION IF EXISTS validate_employee_schedule_no_overlap(UUID, UUID, INTEGER, JSONB);

-- =====================================================
-- 1. ACTUALIZAR FUNCIÓN: Validar NO solapamiento SOLO para recursos manuales
-- =====================================================
CREATE OR REPLACE FUNCTION validate_employee_schedule_no_overlap(
    p_employee_id UUID,
    p_resource_id UUID,
    p_day_of_week INTEGER,
    p_new_shifts JSONB,
    p_resource_assignment_type VARCHAR(10) DEFAULT 'auto'
) RETURNS BOOLEAN AS $$
DECLARE
    v_conflict RECORD;
    v_new_shift JSONB;
    v_existing_shift JSONB;
    v_new_start TIME;
    v_new_end TIME;
    v_existing_start TIME;
    v_existing_end TIME;
    -- Variables para validación de recursos automáticos
    v_total_resources INTEGER;
    v_used_resources INTEGER;
    v_employee_business_id UUID;
BEGIN
    -- ✅ CORRECCIÓN: Si es asignación automática CON resource_id asignado, validar conflicto específico
    -- Si es automático pero YA tiene un resource_id (asignado por el frontend), validar conflicto
    IF p_resource_assignment_type = 'auto' AND p_resource_id IS NOT NULL THEN
        -- Validar que no haya conflicto con otros empleados en el mismo recurso
        -- (igual que para asignaciones manuales)
        FOR v_new_shift IN SELECT * FROM jsonb_array_elements(p_new_shifts)
        LOOP
            v_new_start := (v_new_shift->>'start')::TIME;
            v_new_end := (v_new_shift->>'end')::TIME;
            
            -- Buscar conflictos con otros empleados en el mismo recurso
            FOR v_conflict IN
                SELECT 
                    e.id,
                    e.name,
                    es.shifts
                FROM employees e
                JOIN employee_schedules es ON e.id = es.employee_id
                WHERE es.resource_id = p_resource_id
                AND e.id != p_employee_id
                AND e.is_active = true
                AND es.day_of_week = p_day_of_week
                AND es.is_working = true
                AND es.shifts IS NOT NULL
                AND es.shifts != '[]'::jsonb
            LOOP
                FOR v_existing_shift IN SELECT * FROM jsonb_array_elements(v_conflict.shifts)
                LOOP
                    v_existing_start := (v_existing_shift->>'start')::TIME;
                    v_existing_end := (v_existing_shift->>'end')::TIME;
                    
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
    END IF;
    
    -- ✅ Si es automático SIN resource_id, validar que hay suficientes recursos disponibles
    IF p_resource_assignment_type = 'auto' AND p_resource_id IS NULL THEN
        -- Obtener business_id del empleado
        SELECT business_id INTO v_employee_business_id
        FROM employees
        WHERE id = p_employee_id;
        
        IF v_employee_business_id IS NULL THEN
            RETURN true; -- No validar si no hay business_id
        END IF;
        
        -- Contar recursos activos del negocio
        SELECT COUNT(*) INTO v_total_resources
        FROM resources
        WHERE business_id = v_employee_business_id
        AND is_active = true;
        
        -- Contar cuántos empleados ya tienen asignación automática en el mismo horario
        SELECT COUNT(DISTINCT es.employee_id) INTO v_used_resources
        FROM employee_schedules es
        JOIN employees e ON e.id = es.employee_id
        WHERE e.business_id = v_employee_business_id
        AND es.day_of_week = p_day_of_week
        AND es.is_working = true
        AND es.resource_assignment_type = 'auto'
        AND es.shifts IS NOT NULL
        AND es.shifts != '[]'::jsonb
        AND es.employee_id != p_employee_id
        AND EXISTS (
            SELECT 1
            FROM jsonb_array_elements(es.shifts) existing_shift,
                 jsonb_array_elements(p_new_shifts) new_shift
            WHERE (existing_shift->>'start')::TIME < (new_shift->>'end')::TIME
            AND (existing_shift->>'end')::TIME > (new_shift->>'start')::TIME
        );
        
        IF v_used_resources >= v_total_resources THEN
            RAISE EXCEPTION 'No hay suficientes recursos disponibles. Tienes % recursos pero necesitas % empleados en este horario.',
                v_total_resources,
                v_used_resources + 1
            USING HINT = 'Añade más recursos o asigna manualmente algunos empleados a recursos específicos';
        END IF;
        
        RETURN true;
    END IF;
    
    -- ✅ VALIDACIÓN PARA ASIGNACIONES MANUALES: Verificar que no haya conflicto con otros empleados
    -- Si no hay recurso asignado, no validar (no hay conflicto posible)
    IF p_resource_id IS NULL THEN
        RETURN true;
    END IF;

    -- Para cada turno nuevo que queremos guardar
    FOR v_new_shift IN SELECT * FROM jsonb_array_elements(p_new_shifts)
    LOOP
        v_new_start := (v_new_shift->>'start')::TIME;
        v_new_end := (v_new_shift->>'end')::TIME;
        
        -- ✅ Buscar conflictos con otros empleados que tengan el MISMO recurso asignado
        -- (tanto manual como automático, porque ambos ocupan el recurso)
        FOR v_conflict IN
            SELECT 
                e.id,
                e.name,
                es.shifts,
                es.resource_assignment_type
            FROM employees e
            JOIN employee_schedules es ON e.id = es.employee_id
            WHERE es.resource_id = p_resource_id  -- ✅ Mismo recurso
            AND e.id != p_employee_id  -- ✅ Diferente empleado
            AND e.is_active = true
            AND es.day_of_week = p_day_of_week  -- ✅ Mismo día
            AND es.is_working = true
            AND es.shifts IS NOT NULL
            AND es.shifts != '[]'::jsonb
        LOOP
            -- Para cada turno del otro empleado
            FOR v_existing_shift IN SELECT * FROM jsonb_array_elements(v_conflict.shifts)
            LOOP
                v_existing_start := (v_existing_shift->>'start')::TIME;
                v_existing_end := (v_existing_shift->>'end')::TIME;
                
                -- ✅ Verificar solapamiento
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
'Valida que los turnos de un empleado no se solapen con otros empleados en el mismo recurso. 
NO valida conflictos si resource_assignment_type = ''auto'' porque el sistema puede asignar diferentes recursos automáticamente.';

-- =====================================================
-- 2. ACTUALIZAR TRIGGER: Pasar resource_assignment_type a la validación
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_validate_schedule_overlap()
RETURNS TRIGGER AS $$
DECLARE
    v_resource_id UUID;
    v_resource_assignment_type VARCHAR(10);
BEGIN
    -- Solo validar si está trabajando y tiene shifts
    IF NEW.is_working = false OR NEW.shifts IS NULL OR NEW.shifts = '[]'::jsonb THEN
        RETURN NEW;
    END IF;
    
    -- Obtener recurso y tipo de asignación del schedule
    v_resource_id := NEW.resource_id;
    v_resource_assignment_type := COALESCE(NEW.resource_assignment_type, 'auto');
    
    -- ✅ VALIDAR SIEMPRE (tanto automático como manual)
    -- Para automático: valida que hay suficientes recursos
    -- Para manual: valida que no hay conflictos con otros en el mismo recurso
    PERFORM validate_employee_schedule_no_overlap(
        NEW.employee_id,
        v_resource_id,
        NEW.day_of_week,
        NEW.shifts,
        v_resource_assignment_type
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trigger_validate_schedule_overlap IS 
'Trigger que valida solapamiento de horarios. NO valida si resource_assignment_type = ''auto''.';

-- =====================================================
-- 3. ACTUALIZAR FUNCIÓN RPC: Pasar resource_assignment_type
-- =====================================================
CREATE OR REPLACE FUNCTION save_employee_schedule_with_validation(
    p_employee_id UUID,
    p_schedules JSONB -- Array de 7 elementos (uno por día)
) RETURNS JSONB AS $$
DECLARE
    v_employee RECORD;
    v_resource_id UUID;
    v_resource_assignment_type VARCHAR(10);
    v_schedule JSONB;
    v_day INTEGER;
    v_shifts JSONB;
    v_result JSONB;
BEGIN
    -- Obtener empleado
    SELECT id, assigned_resource_id, business_id INTO v_employee
    FROM employees
    WHERE id = p_employee_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Empleado no encontrado';
    END IF;
    
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
        v_resource_id := (v_schedule->>'resource_id')::UUID;
        v_resource_assignment_type := COALESCE(v_schedule->>'resource_assignment_type', 'auto');
        
        -- Si está trabajando y tiene turnos, validar SOLO si es asignación manual
        IF (v_schedule->>'is_working')::BOOLEAN = true 
           AND v_resource_id IS NOT NULL 
           AND v_shifts IS NOT NULL 
           AND v_shifts != '[]'::jsonb 
           AND v_resource_assignment_type = 'manual' THEN  -- ✅ SOLO validar si es manual
            
            -- Validar no solapamiento
            PERFORM validate_employee_schedule_no_overlap(
                p_employee_id,
                v_resource_id,
                v_day,
                v_shifts,
                v_resource_assignment_type
            );
        END IF;
        
        -- Insertar horario
        INSERT INTO employee_schedules (
            business_id,
            employee_id,
            day_of_week,
            is_working,
            shifts,
            breaks,
            resource_id,
            resource_assignment_type
        ) VALUES (
            v_employee.business_id,
            p_employee_id,
            v_day,
            (v_schedule->>'is_working')::BOOLEAN,
            v_shifts,
            COALESCE(v_schedule->'breaks', '[]'::jsonb),
            v_resource_id,
            v_resource_assignment_type
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
'Guarda el horario de un empleado validando que no se solape con otros en el mismo recurso.
NO valida conflictos si resource_assignment_type = ''auto''.';

