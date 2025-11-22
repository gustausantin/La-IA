-- =====================================================
-- MIGRACIÓN: Garantizar que appointments con resource_id 
-- siempre tengan employee_id
-- =====================================================

-- PASO 1: PRIMERO corregir datos existentes que violan la regla
-- =====================================================
-- Ejecutar función de corrección para appointments existentes
-- =====================================================
DO $$
DECLARE
    v_fixed_count INTEGER := 0;
    v_failed_count INTEGER := 0;
    v_result RECORD;
    v_employee_id UUID;
    v_appointment_status TEXT;
BEGIN
    RAISE NOTICE '🔧 Corrigiendo appointments existentes que violan la regla...';
    
    -- Buscar appointments con resource_id pero sin employee_id
    FOR v_result IN
        SELECT 
            a.id,
            a.resource_id,
            a.business_id,
            a.status
        FROM appointments a
        WHERE a.resource_id IS NOT NULL
          AND a.employee_id IS NULL
    LOOP
        v_employee_id := NULL;
        v_appointment_status := v_result.status;
        
        -- Buscar empleado con assigned_resource_id = resource_id
        SELECT e.id INTO v_employee_id
        FROM employees e
        WHERE e.business_id = v_result.business_id
          AND e.assigned_resource_id = v_result.resource_id
          AND e.is_active = true
        LIMIT 1;
        
        -- Si no se encontró, verificar si resource_id es directamente un employee_id
        IF v_employee_id IS NULL THEN
            SELECT e.id INTO v_employee_id
            FROM employees e
            WHERE e.business_id = v_result.business_id
              AND e.id = v_result.resource_id
              AND e.is_active = true
            LIMIT 1;
        END IF;
        
        -- Si se encontró un empleado, actualizar
        IF v_employee_id IS NOT NULL THEN
            UPDATE appointments
            SET employee_id = v_employee_id,
                updated_at = NOW()
            WHERE id = v_result.id;
            
            v_fixed_count := v_fixed_count + 1;
            RAISE NOTICE '✅ Corregido appointment %: asignado employee_id %', v_result.id, v_employee_id;
        ELSE
            -- No se encontró empleado - REGLA ABSOLUTA: NO se puede tener resource_id sin employee_id
            -- Para TODOS los appointments (sin excepciones), poner resource_id a NULL si no hay empleado
            UPDATE appointments
            SET resource_id = NULL,
                updated_at = NOW()
            WHERE id = v_result.id;
            
            v_fixed_count := v_fixed_count + 1;
            RAISE NOTICE '✅ Appointment % (status: %): resource_id puesto a NULL (no tiene empleado asignado)', 
                v_result.id, v_appointment_status;
        END IF;
    END LOOP;
    
    RAISE NOTICE '📊 Resumen: % appointments corregidos', v_fixed_count;
END $$;

-- PASO 2: Agregar restricción CHECK para garantizar la regla de negocio
-- REGLA: Si hay resource_id, DEBE haber employee_id
-- NOTA: Solo se aplica si no hay datos que la violen
ALTER TABLE appointments
DROP CONSTRAINT IF EXISTS check_employee_id_with_resource;

-- Verificar que no haya datos ACTIVOS que violen la constraint antes de aplicarla
DO $$
DECLARE
    v_violating_active_count INTEGER;
    v_violating_total_count INTEGER;
BEGIN
    -- Contar appointments activos que violan la regla
    SELECT COUNT(*) INTO v_violating_active_count
    FROM appointments
    WHERE resource_id IS NOT NULL
      AND employee_id IS NULL
      AND status NOT IN ('cancelled', 'completed', 'no_show');
    
    -- Contar total (incluyendo cancelados/completados)
    SELECT COUNT(*) INTO v_violating_total_count
    FROM appointments
    WHERE resource_id IS NOT NULL
      AND employee_id IS NULL;
    
    IF v_violating_active_count > 0 THEN
        RAISE EXCEPTION 'No se puede aplicar la constraint: hay % appointments ACTIVOS que violan la regla. Revisa y corrige manualmente primero.', 
            v_violating_active_count;
    END IF;
    
    IF v_violating_total_count > 0 THEN
        RAISE WARNING 'Hay % appointments cancelados/completados que violan la regla. La constraint solo se aplicará a appointments activos.', v_violating_total_count;
    END IF;
    
    RAISE NOTICE '✅ Verificación completada: No hay appointments activos que violen la regla.';
END $$;

-- Constraint CRÍTICA: SIEMPRE requiere employee_id cuando hay resource_id
-- REGLA DE NEGOCIO: NO se puede crear una reserva sin trabajador asignado
-- Sin excepciones - esto es una regla absoluta
ALTER TABLE appointments
ADD CONSTRAINT check_employee_id_with_resource
CHECK (
  -- Si resource_id es NULL, employee_id puede ser NULL (reservas sin recurso específico)
  -- Si resource_id NO es NULL, employee_id DEBE estar presente (SIN EXCEPCIONES)
  (resource_id IS NULL) OR (employee_id IS NOT NULL)
);

COMMENT ON CONSTRAINT check_employee_id_with_resource ON appointments IS 
'Garantiza que si una reserva tiene un recurso asignado (resource_id), siempre debe tener un empleado asignado (employee_id). Esta es una regla de negocio crítica: cada recurso necesita un trabajador.';

-- PASO 2: Crear función para inferir y actualizar employee_id desde resource_id
-- para appointments existentes que violan la regla
CREATE OR REPLACE FUNCTION fix_missing_employee_id_from_resource()
RETURNS TABLE(
  appointment_id UUID,
  resource_id UUID,
  inferred_employee_id UUID,
  updated BOOLEAN
) AS $$
DECLARE
  r RECORD;
  v_employee_id UUID;
  v_updated_count INTEGER := 0;
BEGIN
  -- Buscar appointments con resource_id pero sin employee_id
  FOR r IN
    SELECT 
      a.id,
      a.resource_id,
      a.business_id
    FROM appointments a
    WHERE a.resource_id IS NOT NULL
      AND a.employee_id IS NULL
      AND a.status NOT IN ('cancelled', 'completed', 'no_show')
  LOOP
    -- Intentar encontrar el empleado que tiene este recurso asignado
    SELECT e.id INTO v_employee_id
    FROM employees e
    WHERE e.business_id = r.business_id
      AND e.assigned_resource_id = r.resource_id
      AND e.is_active = true
    LIMIT 1;
    
    -- Si se encontró un empleado, actualizar el appointment
    IF v_employee_id IS NOT NULL THEN
      UPDATE appointments
      SET employee_id = v_employee_id,
          updated_at = NOW()
      WHERE id = r.id;
      
      v_updated_count := v_updated_count + 1;
      
      RETURN QUERY SELECT r.id, r.resource_id, v_employee_id, true;
    ELSE
      -- No se encontró empleado, marcar como problema
      RETURN QUERY SELECT r.id, r.resource_id, NULL::UUID, false;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Función ejecutada: % appointments procesados', v_updated_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fix_missing_employee_id_from_resource() IS 
'Función para corregir appointments que tienen resource_id pero no employee_id. Busca el empleado que tiene el recurso asignado y actualiza el appointment.';

-- PASO 3: Crear función para verificar recursos sin empleados asignados
CREATE OR REPLACE FUNCTION find_resources_without_employees(business_uuid UUID DEFAULT NULL)
RETURNS TABLE(
  resource_id UUID,
  resource_name TEXT,
  business_id UUID,
  has_active_employees BOOLEAN,
  employee_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id AS resource_id,
    r.name AS resource_name,
    r.business_id,
    CASE 
      WHEN COUNT(e.id) > 0 THEN true 
      ELSE false 
    END AS has_active_employees,
    COUNT(e.id) AS employee_count
  FROM resources r
  LEFT JOIN employees e ON e.assigned_resource_id = r.id AND e.is_active = true
  WHERE r.is_active = true
    AND (business_uuid IS NULL OR r.business_id = business_uuid)
  GROUP BY r.id, r.name, r.business_id
  HAVING COUNT(e.id) = 0
  ORDER BY r.business_id, r.name;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION find_resources_without_employees(UUID) IS 
'Encuentra recursos que no tienen empleados activos asignados. Esto viola la regla de negocio: cada recurso debe tener al menos un trabajador.';

-- PASO 4: Ejecutar la función de corrección automáticamente
-- (Opcional: se puede ejecutar manualmente cuando sea necesario)
-- SELECT * FROM fix_missing_employee_id_from_resource();

