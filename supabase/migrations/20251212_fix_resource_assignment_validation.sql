-- =====================================================
-- MIGRACIÓN: CORREGIR VALIDACIÓN DE ASIGNACIÓN DE RECURSOS
-- Fecha: 2025-12-12
-- Objetivo: Validar contra employee_schedules en lugar de availability_slots
--           para evitar que slots viejos bloqueen la reutilización de recursos
-- =====================================================

-- ✅ NUEVA FUNCIÓN: Valida solo contra horarios reales de empleados activos
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
BEGIN
    -- ✅ SOLO verificar contra employee_schedules (horarios reales de empleados activos)
    -- NO verificar contra availability_slots (pueden tener datos viejos)
    
    SELECT EXISTS(
        SELECT 1
        FROM employee_schedules es
        INNER JOIN employees e ON es.employee_id = e.id
        WHERE es.resource_id = p_resource_id
        AND es.day_of_week = p_day_of_week
        AND es.is_working = true
        AND es.employee_id != p_employee_id
        AND e.is_active = true  -- Solo empleados activos
        AND e.business_id = p_business_id
        -- Verificar solapamiento de horarios
        AND es.shifts IS NOT NULL 
        AND es.shifts != '[]'::jsonb 
        AND jsonb_array_length(es.shifts) > 0
        AND EXISTS (
            SELECT 1 FROM jsonb_array_elements(es.shifts) AS shift
            WHERE (shift->>'start')::TIME < p_end_time
            AND (shift->>'end')::TIME > p_start_time
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
        AND e.is_active = true
        LIMIT 1;
        
        RAISE EXCEPTION 'Conflicto de horario: % ya trabaja en este recurso en este horario', v_conflicting_employee
        USING HINT = 'Cambia el horario o elige otro recurso';
    END IF;
    
    RETURN true;  -- No hay conflicto
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION validate_resource_assignment IS 
'Valida que un recurso puede ser asignado a un empleado verificando SOLO contra 
employee_schedules de empleados activos. NO verifica availability_slots para 
permitir reutilización de recursos con horarios compatibles.';


