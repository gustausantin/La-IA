-- =====================================================
-- MIGRACIÓN: Eliminación automática de slots libres
-- cuando se elimina un horario de empleado
-- =====================================================
-- Fecha: 2025-11-19
-- Descripción: 
--   - Función para eliminar slots libres de un empleado
--   - Trigger automático al eliminar employee_schedule
--   - Protección de reservas (solo elimina slots 'free')
-- =====================================================

-- =====================================================
-- FUNCIÓN: Eliminar slots libres de un empleado
-- =====================================================
CREATE OR REPLACE FUNCTION cleanup_employee_free_slots(
    p_employee_id UUID,
    p_business_id UUID DEFAULT NULL,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE(
    deleted_count INTEGER,
    protected_count INTEGER,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted_count INTEGER := 0;
    v_protected_count INTEGER := 0;
    v_start_date DATE;
    v_end_date DATE;
    v_today DATE := CURRENT_DATE;
BEGIN
    -- Validar que el empleado existe
    IF NOT EXISTS (SELECT 1 FROM employees WHERE id = p_employee_id) THEN
        RETURN QUERY SELECT 
            0::INTEGER,
            0::INTEGER,
            'Error: Empleado no encontrado'::TEXT;
        RETURN;
    END IF;
    
    -- Determinar rango de fechas
    -- Si no se especifica, eliminar desde hoy hasta 90 días adelante
    v_start_date := COALESCE(p_start_date, v_today)::DATE;
    
    IF p_end_date IS NULL THEN
        -- Si no hay horarios, eliminar slots futuros (hasta 90 días)
        v_end_date := (v_today + INTERVAL '90 days')::DATE;
    ELSE
        v_end_date := p_end_date::DATE;
    END IF;
    
    -- 🛡️ CONTAR slots protegidos (con reservas) antes de eliminar
    SELECT COUNT(*) INTO v_protected_count
    FROM availability_slots
    WHERE employee_id = p_employee_id
      AND slot_date >= v_start_date
      AND slot_date <= v_end_date
      AND (status != 'free' OR appointment_id IS NOT NULL);
    
    -- 🗑️ ELIMINAR solo slots LIBRES (status = 'free' y sin appointment_id)
    DELETE FROM availability_slots
    WHERE employee_id = p_employee_id
      AND slot_date >= v_start_date
      AND slot_date <= v_end_date
      AND status = 'free'
      AND appointment_id IS NULL;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    -- Retornar resultado
    RETURN QUERY SELECT 
        v_deleted_count,
        v_protected_count,
        format(
            'Eliminados %s slots libres. Protegidos %s slots con reservas.',
            v_deleted_count,
            v_protected_count
        )::TEXT;
END;
$$;

COMMENT ON FUNCTION cleanup_employee_free_slots IS 
'Elimina slots libres de un empleado en un rango de fechas.
Solo elimina slots con status=''free'' y sin appointment_id.
Protege automáticamente slots con reservas.';

-- =====================================================
-- FUNCIÓN: Limpiar slots libres cuando un empleado
-- no tiene horarios configurados
-- =====================================================
CREATE OR REPLACE FUNCTION cleanup_slots_for_employees_without_schedules(
    p_business_id UUID,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE(
    employee_id UUID,
    employee_name TEXT,
    deleted_count INTEGER,
    protected_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_employee RECORD;
    v_start_date DATE;
    v_end_date DATE;
    v_today DATE := CURRENT_DATE;
    v_deleted_count INTEGER;
    v_protected_count INTEGER;
BEGIN
    -- Determinar rango de fechas
    v_start_date := COALESCE(p_start_date, v_today)::DATE;
    
    IF p_end_date IS NULL THEN
        v_end_date := (v_today + INTERVAL '90 days')::DATE;
    ELSE
        v_end_date := p_end_date::DATE;
    END IF;
    
    -- Iterar sobre empleados activos sin horarios
    FOR v_employee IN
        SELECT e.id, e.name
        FROM employees e
        WHERE e.business_id = p_business_id
          AND e.is_active = true
          AND NOT EXISTS (
              SELECT 1 
              FROM employee_schedules es
              WHERE es.employee_id = e.id
                AND es.is_working = true
          )
    LOOP
        -- Limpiar slots libres de este empleado
        SELECT cleanup_result.deleted_count, cleanup_result.protected_count 
        INTO v_deleted_count, v_protected_count
        FROM cleanup_employee_free_slots(
            v_employee.id,
            p_business_id,
            v_start_date,
            v_end_date
        ) AS cleanup_result;
        
        -- Retornar resultado para este empleado
        RETURN QUERY SELECT 
            v_employee.id,
            v_employee.name::TEXT,
            v_deleted_count,
            v_protected_count;
    END LOOP;
END;
$$;

COMMENT ON FUNCTION cleanup_slots_for_employees_without_schedules IS 
'Encuentra empleados activos sin horarios configurados y elimina sus slots libres.
Útil cuando se eliminan todos los horarios de un empleado.';

-- =====================================================
-- TRIGGER: Eliminar slots libres automáticamente
-- cuando se elimina un employee_schedule
-- =====================================================

-- Función del trigger
CREATE OR REPLACE FUNCTION trigger_cleanup_slots_on_schedule_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted_count INTEGER;
    v_protected_count INTEGER;
    v_result RECORD;
BEGIN
    -- Solo procesar si se está eliminando (OLD existe, NEW no)
    IF TG_OP = 'DELETE' THEN
        -- 🗑️ Eliminar slots libres del empleado afectado
        -- Usar rango desde hoy hasta 90 días adelante
        SELECT deleted_count, protected_count 
        INTO v_deleted_count, v_protected_count
        FROM cleanup_employee_free_slots(
            OLD.employee_id,
            OLD.business_id,
            CURRENT_DATE::DATE, -- Desde hoy
            (CURRENT_DATE + INTERVAL '90 days')::DATE -- Hasta 90 días adelante
        );
        
        -- Log (solo en desarrollo, no en producción para evitar spam)
        IF v_deleted_count > 0 THEN
            RAISE NOTICE '🧹 Trigger eliminó % slots libres del empleado % (protegidos: %)', 
                v_deleted_count, OLD.employee_id, v_protected_count;
        END IF;
    END IF;
    
    RETURN OLD;
END;
$$;

-- Crear el trigger
DROP TRIGGER IF EXISTS cleanup_slots_on_schedule_delete ON employee_schedules;

CREATE TRIGGER cleanup_slots_on_schedule_delete
    AFTER DELETE ON employee_schedules
    FOR EACH ROW
    EXECUTE FUNCTION trigger_cleanup_slots_on_schedule_delete();

COMMENT ON TRIGGER cleanup_slots_on_schedule_delete ON employee_schedules IS 
'Trigger que elimina automáticamente slots libres cuando se elimina un employee_schedule.
Solo elimina slots con status=''free'' y sin appointment_id. Protege reservas.';

-- =====================================================
-- TRIGGER ADICIONAL: Limpiar slots cuando un empleado
-- queda sin horarios (después de DELETE)
-- =====================================================

-- Función del trigger para verificar si el empleado quedó sin horarios
CREATE OR REPLACE FUNCTION trigger_cleanup_slots_if_no_schedules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_has_schedules BOOLEAN;
    v_deleted_count INTEGER;
    v_protected_count INTEGER;
BEGIN
    -- Verificar si el empleado tiene algún horario activo después del DELETE
    SELECT EXISTS (
        SELECT 1 
        FROM employee_schedules
        WHERE employee_id = OLD.employee_id
          AND is_working = true
    ) INTO v_has_schedules;
    
    -- Si NO tiene horarios activos, limpiar slots libres
    IF NOT v_has_schedules THEN
        SELECT deleted_count, protected_count 
        INTO v_deleted_count, v_protected_count
        FROM cleanup_employee_free_slots(
            OLD.employee_id,
            OLD.business_id,
            CURRENT_DATE::DATE,
            (CURRENT_DATE + INTERVAL '90 days')::DATE
        );
        
        IF v_deleted_count > 0 THEN
            RAISE NOTICE '🧹 Empleado % quedó sin horarios. Eliminados % slots libres (protegidos: %)', 
                OLD.employee_id, v_deleted_count, v_protected_count;
        END IF;
    END IF;
    
    RETURN OLD;
END;
$$;

-- Crear el trigger
DROP TRIGGER IF EXISTS cleanup_slots_if_no_schedules ON employee_schedules;

CREATE TRIGGER cleanup_slots_if_no_schedules
    AFTER DELETE ON employee_schedules
    FOR EACH ROW
    EXECUTE FUNCTION trigger_cleanup_slots_if_no_schedules();

COMMENT ON TRIGGER cleanup_slots_if_no_schedules ON employee_schedules IS 
'Verifica si un empleado quedó sin horarios activos después de eliminar un schedule.
Si no tiene horarios, elimina automáticamente sus slots libres.';

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================

SELECT 'Migración 20251119_01_auto_cleanup_slots_on_schedule_delete completada' AS status;

