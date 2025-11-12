-- =====================================================
-- MIGRACIÓN: VALIDACIÓN DE AUSENCIAS VS RESERVAS
-- Fecha: 2025-11-12
-- Objetivo: REGLA SAGRADA - No se puede crear ausencia si hay reservas confirmadas
-- =====================================================

-- =====================================================
-- FUNCIÓN: Verificar conflictos de ausencia con reservas
-- =====================================================

CREATE OR REPLACE FUNCTION check_absence_conflicts(
    p_employee_id UUID,
    p_start_date DATE,
    p_end_date DATE,
    p_all_day BOOLEAN,
    p_start_time TIME,
    p_end_time TIME
) RETURNS TABLE(
    has_conflicts BOOLEAN,
    conflict_count INTEGER,
    conflicts JSONB
) AS $$
DECLARE
    v_conflicts JSONB;
    v_count INTEGER;
BEGIN
    -- Buscar citas confirmadas del empleado en el rango de fechas
    -- Las citas están asignadas a RECURSOS, así que necesitamos buscar
    -- recursos que pertenecen a este empleado
    
    SELECT 
        jsonb_agg(
            jsonb_build_object(
                'appointment_id', a.id,
                'customer_name', a.customer_name,
                'appointment_date', a.appointment_date,
                'appointment_time', a.appointment_time,
                'service_id', a.service_id,
                'resource_id', a.resource_id
            )
        ),
        COUNT(*)
    INTO v_conflicts, v_count
    FROM appointments a
    WHERE a.business_id = (SELECT business_id FROM employees WHERE id = p_employee_id)
    AND a.status IN ('confirmed', 'pending')
    AND a.appointment_date >= p_start_date
    AND a.appointment_date <= p_end_date
    -- Verificar que la reserva esté asignada a un recurso del empleado
    AND a.resource_id IN (
        SELECT resource_id 
        FROM employee_schedules
        WHERE employee_id = p_employee_id
        AND resource_id IS NOT NULL
        UNION
        SELECT assigned_resource_id
        FROM employees
        WHERE id = p_employee_id
        AND assigned_resource_id IS NOT NULL
    );
    
    -- Si es ausencia parcial (no todo el día), verificar solapamiento de horas
    IF NOT p_all_day AND v_count > 0 THEN
        -- Filtrar solo las que solapen en horario
        SELECT 
            jsonb_agg(conflicts.value),
            jsonb_array_length(conflicts.value)
        INTO v_conflicts, v_count
        FROM jsonb_array_elements(COALESCE(v_conflicts, '[]'::jsonb)) AS conflicts(value)
        WHERE (
            ((conflicts.value->>'appointment_time')::TIME >= p_start_time AND 
             (conflicts.value->>'appointment_time')::TIME < p_end_time)
        );
    END IF;
    
    RETURN QUERY SELECT
        COALESCE(v_count, 0) > 0 AS has_conflicts,
        COALESCE(v_count, 0) AS conflict_count,
        COALESCE(v_conflicts, '[]'::jsonb) AS conflicts;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGER: Validar ausencias antes de crearlas
-- =====================================================

CREATE OR REPLACE FUNCTION validate_employee_absence_before_insert()
RETURNS TRIGGER AS $$
DECLARE
    v_conflict_check RECORD;
    v_conflict_list TEXT := '';
    v_conflict JSONB;
BEGIN
    -- Verificar conflictos con reservas
    SELECT * INTO v_conflict_check
    FROM check_absence_conflicts(
        NEW.employee_id,
        NEW.start_date,
        NEW.end_date,
        NEW.all_day,
        NEW.start_time,
        NEW.end_time
    );
    
    -- Si hay conflictos, construir mensaje detallado y bloquear
    IF v_conflict_check.has_conflicts THEN
        -- Construir lista de conflictos
        FOR v_conflict IN SELECT * FROM jsonb_array_elements(v_conflict_check.conflicts)
        LOOP
            v_conflict_list := v_conflict_list || format(
                E'\n  - %s a las %s (%s)',
                v_conflict->>'appointment_date',
                v_conflict->>'appointment_time',
                COALESCE(v_conflict->>'customer_name', 'Cliente')
            );
        END LOOP;
        
        RAISE EXCEPTION E'No puedes crear esta ausencia.\nTienes % reserva(s) confirmada(s) en este período:%\n\nDebes cancelar manualmente estas reservas primero.',
            v_conflict_check.conflict_count,
            v_conflict_list;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger ANTES de insertar
CREATE TRIGGER before_insert_employee_absence_validate
    BEFORE INSERT ON employee_absences
    FOR EACH ROW
    EXECUTE FUNCTION validate_employee_absence_before_insert();

-- Crear trigger ANTES de actualizar (por si cambian fechas)
CREATE TRIGGER before_update_employee_absence_validate
    BEFORE UPDATE ON employee_absences
    FOR EACH ROW
    WHEN (
        OLD.start_date IS DISTINCT FROM NEW.start_date OR
        OLD.end_date IS DISTINCT FROM NEW.end_date OR
        OLD.start_time IS DISTINCT FROM NEW.start_time OR
        OLD.end_time IS DISTINCT FROM NEW.end_time OR
        OLD.all_day IS DISTINCT FROM NEW.all_day
    )
    EXECUTE FUNCTION validate_employee_absence_before_insert();

-- =====================================================
-- TRIGGER: Auto-regenerar slots al crear/eliminar ausencia
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_regenerate_slots_after_absence_change()
RETURNS TRIGGER AS $$
DECLARE
    v_business_id UUID;
    v_start_date DATE;
    v_end_date DATE;
    v_result RECORD;
BEGIN
    -- Obtener business_id
    IF TG_OP = 'DELETE' THEN
        v_business_id := OLD.business_id;
        v_start_date := OLD.start_date;
        v_end_date := OLD.end_date;
    ELSE
        v_business_id := NEW.business_id;
        v_start_date := NEW.start_date;
        v_end_date := NEW.end_date;
    END IF;
    
    -- Regenerar slots en el rango afectado
    SELECT * INTO v_result
    FROM generate_availability_slots_employee_based(
        v_business_id,
        v_start_date,
        (v_end_date - v_start_date)::INTEGER, -- días afectados
        TRUE -- regenerar
    );
    
    RAISE NOTICE 'Slots regenerados después de cambio en ausencia: %', v_result.message;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_employee_absence_change_regenerate_slots
    AFTER INSERT OR DELETE ON employee_absences
    FOR EACH ROW
    EXECUTE FUNCTION trigger_regenerate_slots_after_absence_change();

-- =====================================================
-- COMENTARIOS
-- =====================================================

COMMENT ON FUNCTION check_absence_conflicts IS 
'Verifica si una ausencia de empleado tiene conflictos con reservas confirmadas. Devuelve lista detallada de conflictos.';

COMMENT ON FUNCTION validate_employee_absence_before_insert IS 
'Trigger que BLOQUEA la creación de ausencias si hay reservas confirmadas en ese período (REGLA SAGRADA)';

COMMENT ON FUNCTION trigger_regenerate_slots_after_absence_change IS 
'Regenera automáticamente los slots afectados cuando se crea o elimina una ausencia';

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================

SELECT 'Migración 20251112_03_validate_employee_absences completada' AS status;

