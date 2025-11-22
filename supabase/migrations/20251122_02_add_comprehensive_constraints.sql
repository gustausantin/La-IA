-- =====================================================
-- MIGRACIÓN: CONSTRAINTS COMPLETOS PARA GARANTIZAR REGLAS DE NEGOCIO
-- Fecha: 2025-11-22
-- Objetivo: Agregar constraints en BD para garantizar que:
--           1. Empleados SIEMPRE tienen recurso asignado
--           2. Slots SIEMPRE tienen recurso
--           3. Horarios requieren recurso antes de generarse
-- =====================================================

-- =====================================================
-- PASO 1: Constraint en EMPLOYEES - Recurso obligatorio
-- =====================================================
-- REGLA: Un empleado NO puede existir sin un recurso asignado
-- =====================================================

ALTER TABLE employees
DROP CONSTRAINT IF EXISTS check_employee_has_resource;

ALTER TABLE employees
ADD CONSTRAINT check_employee_has_resource
CHECK (assigned_resource_id IS NOT NULL);

COMMENT ON CONSTRAINT check_employee_has_resource ON employees IS 
'Garantiza que cada empleado SIEMPRE tiene un recurso asignado. Esta es una regla de negocio crítica: un trabajador necesita una silla/camilla para trabajar.';

-- =====================================================
-- PASO 2: Constraint en AVAILABILITY_SLOTS - Recurso obligatorio
-- =====================================================
-- REGLA: Un slot NO puede existir sin un recurso
-- =====================================================

ALTER TABLE availability_slots
DROP CONSTRAINT IF EXISTS check_slot_has_resource;

ALTER TABLE availability_slots
ADD CONSTRAINT check_slot_has_resource
CHECK (resource_id IS NOT NULL);

COMMENT ON CONSTRAINT check_slot_has_resource ON availability_slots IS 
'Garantiza que cada slot de disponibilidad SIEMPRE tiene un recurso asignado. Sin recurso, no hay disponibilidad.';

-- =====================================================
-- PASO 3: Modificar Trigger de Creación de Horarios
-- =====================================================
-- REGLA: No se pueden crear horarios para empleados sin recurso
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_create_employee_schedule()
RETURNS TRIGGER AS $$
BEGIN
    -- ✅ VALIDACIÓN CRÍTICA: El empleado DEBE tener recurso asignado
    IF NEW.assigned_resource_id IS NULL THEN
        RAISE EXCEPTION 'No se pueden crear horarios para un empleado sin recurso asignado. Asigna un recurso al empleado antes de crear horarios.';
    END IF;
    
    -- Crear horarios por defecto solo si tiene recurso
    PERFORM create_default_schedule_for_employee(NEW.id, NEW.business_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trigger_create_employee_schedule() IS 
'Trigger que crea horarios por defecto para nuevos empleados. Valida que el empleado tenga recurso asignado antes de crear horarios.';

-- =====================================================
-- PASO 4: Función para Validar Recurso en Horarios
-- =====================================================
-- REGLA: Al guardar un horario, debe haber recurso (manual o automático)
-- =====================================================

CREATE OR REPLACE FUNCTION validate_schedule_has_resource()
RETURNS TRIGGER AS $$
DECLARE
    v_employee_resource_id UUID;
BEGIN
    -- Solo validar si el empleado está trabajando
    IF NOT NEW.is_working THEN
        RETURN NEW;
    END IF;
    
    -- Obtener recurso asignado del empleado
    SELECT assigned_resource_id INTO v_employee_resource_id
    FROM employees
    WHERE id = NEW.employee_id
    AND is_active = true;
    
    -- Si el empleado no tiene recurso asignado, ERROR
    IF v_employee_resource_id IS NULL THEN
        RAISE EXCEPTION 'No se puede guardar horario: el empleado no tiene recurso asignado. Asigna un recurso al empleado primero.';
    END IF;
    
    -- Si el schedule no tiene resource_id (asignación automática), asignar el del empleado
    IF NEW.resource_id IS NULL THEN
        NEW.resource_id := v_employee_resource_id;
        NEW.resource_assignment_type := 'auto';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para validar recurso antes de insertar/actualizar horario
DROP TRIGGER IF EXISTS validate_schedule_resource_before_save ON employee_schedules;
CREATE TRIGGER validate_schedule_resource_before_save
    BEFORE INSERT OR UPDATE ON employee_schedules
    FOR EACH ROW
    EXECUTE FUNCTION validate_schedule_has_resource();

COMMENT ON FUNCTION validate_schedule_has_resource() IS 
'Valida que al guardar un horario, el empleado tenga recurso asignado. Si el schedule no tiene resource_id, asigna automáticamente el del empleado.';

-- =====================================================
-- PASO 5: Función para Validar Recurso en Generación de Slots
-- =====================================================
-- REGLA: Solo generar slots si hay recurso disponible
-- =====================================================
-- (Ya está implementado en generate_availability_slots_employee_based,
--  pero podemos mejorar el mensaje de error)

-- =====================================================
-- PASO 6: Función Helper para Verificar Integridad
-- =====================================================

CREATE OR REPLACE FUNCTION verify_employee_resource_integrity(p_business_id UUID DEFAULT NULL)
RETURNS TABLE(
    check_name TEXT,
    status TEXT,
    details TEXT,
    count_affected BIGINT
) AS $$
BEGIN
    -- Verificar empleados sin recurso
    RETURN QUERY
    SELECT 
        'Empleados sin recurso asignado'::TEXT AS check_name,
        CASE 
            WHEN COUNT(*) = 0 THEN 'OK'::TEXT
            ELSE 'ERROR'::TEXT
        END AS status,
        format('Encontrados %s empleados sin recurso', COUNT(*)) AS details,
        COUNT(*) AS count_affected
    FROM employees
    WHERE is_active = true
    AND assigned_resource_id IS NULL
    AND (p_business_id IS NULL OR business_id = p_business_id);
    
    -- Verificar slots sin recurso
    RETURN QUERY
    SELECT 
        'Slots sin recurso asignado'::TEXT AS check_name,
        CASE 
            WHEN COUNT(*) = 0 THEN 'OK'::TEXT
            ELSE 'ERROR'::TEXT
        END AS status,
        format('Encontrados %s slots sin recurso', COUNT(*)) AS details,
        COUNT(*) AS count_affected
    FROM availability_slots
    WHERE status = 'free'
    AND resource_id IS NULL
    AND (p_business_id IS NULL OR business_id = p_business_id);
    
    -- Verificar reservas con resource_id pero sin employee_id
    RETURN QUERY
    SELECT 
        'Reservas con recurso pero sin empleado'::TEXT AS check_name,
        CASE 
            WHEN COUNT(*) = 0 THEN 'OK'::TEXT
            ELSE 'ERROR'::TEXT
        END AS status,
        format('Encontradas %s reservas con recurso pero sin empleado', COUNT(*)) AS details,
        COUNT(*) AS count_affected
    FROM appointments
    WHERE resource_id IS NOT NULL
    AND employee_id IS NULL
    AND status NOT IN ('cancelled', 'completed', 'no_show')
    AND (p_business_id IS NULL OR business_id = p_business_id);
    
    -- Verificar horarios de empleados sin recurso
    RETURN QUERY
    SELECT 
        'Horarios de empleados sin recurso'::TEXT AS check_name,
        CASE 
            WHEN COUNT(*) = 0 THEN 'OK'::TEXT
            ELSE 'ERROR'::TEXT
        END AS status,
        format('Encontrados %s horarios de empleados sin recurso', COUNT(*)) AS details,
        COUNT(*) AS count_affected
    FROM employee_schedules es
    JOIN employees e ON e.id = es.employee_id
    WHERE es.is_working = true
    AND e.assigned_resource_id IS NULL
    AND e.is_active = true
    AND (p_business_id IS NULL OR es.business_id = p_business_id);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION verify_employee_resource_integrity(UUID) IS 
'Función de verificación que comprueba la integridad del sistema: empleados sin recurso, slots sin recurso, reservas inconsistentes, etc.';

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================

SELECT 'Migración 20251122_02_add_comprehensive_constraints completada' AS status;

