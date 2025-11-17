-- =====================================================
-- MIGRACIÓN: Agregar employee_id a availability_slots
-- Fecha: 2025-11-17
-- Objetivo: Los slots deben estar asociados al EMPLEADO, no solo al recurso
--           Esto permite identificar correctamente quién trabaja en cada slot
-- =====================================================

-- =====================================================
-- PASO 1: Agregar columna employee_id a availability_slots
-- =====================================================
DO $$ 
BEGIN
    -- Verificar si la columna ya existe (idempotencia)
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'availability_slots' 
        AND column_name = 'employee_id'
    ) THEN
        ALTER TABLE availability_slots
        ADD COLUMN employee_id UUID REFERENCES employees(id) ON DELETE SET NULL;
        
        RAISE NOTICE 'Columna employee_id añadida a availability_slots';
    ELSE
        RAISE NOTICE 'Columna employee_id ya existe en availability_slots';
    END IF;
END $$;

-- =====================================================
-- PASO 2: Crear índice para optimizar consultas
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_availability_slots_employee_id 
ON availability_slots(employee_id);

-- =====================================================
-- PASO 3: Actualizar slots existentes con employee_id
-- =====================================================
-- Intentar inferir el employee_id desde el resource_id
-- basándose en la asignación actual de recursos a empleados
DO $$
DECLARE
    v_slot RECORD;
    v_employee_id UUID;
    v_updated_count INTEGER := 0;
BEGIN
    -- Para cada slot que no tiene employee_id pero tiene resource_id
    FOR v_slot IN 
        SELECT id, resource_id, slot_date, start_time
        FROM availability_slots
        WHERE employee_id IS NULL
        AND resource_id IS NOT NULL
    LOOP
        -- Buscar el empleado que tiene este recurso asignado
        -- Prioridad 1: Empleado con assigned_resource_id = resource_id
        SELECT id INTO v_employee_id
        FROM employees
        WHERE assigned_resource_id = v_slot.resource_id
        AND is_active = true
        LIMIT 1;
        
        -- Si no se encuentra, buscar en employee_schedules
        -- (puede que el recurso esté asignado solo para ese día)
        IF v_employee_id IS NULL THEN
            SELECT DISTINCT es.employee_id INTO v_employee_id
            FROM employee_schedules es
            INNER JOIN employees e ON es.employee_id = e.id
            WHERE es.resource_id = v_slot.resource_id
            AND e.is_active = true
            AND es.is_working = true
            LIMIT 1;
        END IF;
        
        -- Si encontramos un empleado, actualizar el slot
        IF v_employee_id IS NOT NULL THEN
            UPDATE availability_slots
            SET employee_id = v_employee_id
            WHERE id = v_slot.id;
            
            v_updated_count := v_updated_count + 1;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Actualizados % slots con employee_id', v_updated_count;
END $$;

-- =====================================================
-- PASO 4: Actualizar constraint único para incluir employee_id
-- =====================================================
-- El constraint único debe ser: business_id + employee_id + resource_id + slot_date + start_time
-- Esto permite que el mismo recurso pueda tener múltiples slots si hay múltiples empleados
DO $$
BEGIN
    -- Eliminar constraint único antiguo si existe (puede variar según la migración original)
    -- Nota: Esto puede fallar si el constraint no existe, pero eso está bien
    BEGIN
        ALTER TABLE availability_slots
        DROP CONSTRAINT IF EXISTS availability_slots_business_resource_date_time_key;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'No se pudo eliminar constraint antiguo (puede no existir): %', SQLERRM;
    END;
    
    -- Crear nuevo constraint único que incluye employee_id
    -- Esto asegura que no haya duplicados para la misma combinación de empleado + recurso + fecha + hora
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'availability_slots_employee_resource_date_time_unique'
    ) THEN
        ALTER TABLE availability_slots
        ADD CONSTRAINT availability_slots_employee_resource_date_time_unique
        UNIQUE (business_id, employee_id, resource_id, slot_date, start_time);
        
        RAISE NOTICE 'Constraint único actualizado para incluir employee_id';
    ELSE
        RAISE NOTICE 'Constraint único ya existe';
    END IF;
END $$;

-- =====================================================
-- COMENTARIOS
-- =====================================================
COMMENT ON COLUMN availability_slots.employee_id IS 
'ID del empleado que trabaja en este slot. CRÍTICO: Los slots se generan por EMPLEADO, no por recurso. 
El recurso puede cambiar (asignación automática), pero el empleado es quien realmente trabaja.';

