-- =====================================================
-- MIGRACIÓN: CORREGIR DATOS EXISTENTES ANTES DE APLICAR CONSTRAINT
-- Fecha: 2025-11-22
-- Objetivo: Corregir appointments existentes que violan la regla
--           antes de aplicar la constraint check_employee_id_with_resource
-- =====================================================

-- =====================================================
-- PASO 1: Corregir appointments existentes
-- =====================================================
DO $$
DECLARE
    v_fixed_count INTEGER := 0;
    v_failed_count INTEGER := 0;
    v_result RECORD;
    v_employee_id UUID;
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
        -- Intentar encontrar el empleado que tiene este recurso asignado
        v_employee_id := NULL;
        
        -- Opción 1: Buscar empleado con assigned_resource_id = resource_id
        SELECT e.id INTO v_employee_id
        FROM employees e
        WHERE e.business_id = v_result.business_id
          AND e.assigned_resource_id = v_result.resource_id
          AND e.is_active = true
        LIMIT 1;
        
        -- Opción 2: Si no se encontró, verificar si resource_id es directamente un employee_id
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
            RAISE NOTICE '✅ Corregido appointment % (status: %): asignado employee_id %', 
                v_result.id, v_result.status, v_employee_id;
        ELSE
            -- No se encontró empleado
            v_failed_count := v_failed_count + 1;
            RAISE WARNING '⚠️ No se pudo corregir appointment % (status: %): recurso % no tiene empleado asignado', 
                v_result.id, v_result.status, v_result.resource_id;
            
            -- Para appointments cancelados/completados, podemos poner resource_id a NULL
            -- Para otros, es un problema que necesita atención manual
            IF v_result.status IN ('cancelled', 'completed', 'no_show') THEN
                UPDATE appointments
                SET resource_id = NULL,
                    updated_at = NOW()
                WHERE id = v_result.id;
                
                RAISE NOTICE '✅ Appointment % (cancelado/completado): resource_id puesto a NULL', v_result.id;
                v_failed_count := v_failed_count - 1; -- No cuenta como fallido
            END IF;
        END IF;
    END LOOP;
    
    RAISE NOTICE '📊 Resumen de corrección:';
    RAISE NOTICE '   ✅ Corregidos: % appointments', v_fixed_count;
    RAISE NOTICE '   ⚠️ Con problemas: % appointments', v_failed_count;
    
    -- Si hay appointments que no se pudieron corregir, informar
    IF v_failed_count > 0 THEN
        RAISE WARNING '⚠️ Hay % appointments activos que no se pudieron corregir. Revisa manualmente.', v_failed_count;
    END IF;
END $$;

-- =====================================================
-- PASO 2: Verificar que no queden datos que violen la constraint
-- =====================================================
DO $$
DECLARE
    v_violating_count INTEGER;
    v_violating_active_count INTEGER;
BEGIN
    -- Contar appointments que violan la regla (todos)
    SELECT COUNT(*) INTO v_violating_count
    FROM appointments
    WHERE resource_id IS NOT NULL
      AND employee_id IS NULL;
    
    -- Contar appointments activos que violan la regla
    SELECT COUNT(*) INTO v_violating_active_count
    FROM appointments
    WHERE resource_id IS NOT NULL
      AND employee_id IS NULL
      AND status NOT IN ('cancelled', 'completed', 'no_show');
    
    IF v_violating_active_count > 0 THEN
        RAISE EXCEPTION 'No se puede aplicar la constraint: hay % appointments ACTIVOS que violan la regla. Revisa manualmente y corrige antes de continuar.', 
            v_violating_active_count;
    END IF;
    
    IF v_violating_count > 0 THEN
        RAISE WARNING 'Hay % appointments (cancelados/completados) que violan la regla. Se ignorarán para la constraint.', v_violating_count;
    END IF;
    
    RAISE NOTICE '✅ Verificación completada: No hay appointments activos que violen la regla.';
END $$;

SELECT 'Migración 20251122_01_fix_existing_data_before_constraint completada' AS status;

