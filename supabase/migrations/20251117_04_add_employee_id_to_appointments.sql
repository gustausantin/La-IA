-- =====================================================
-- MIGRACIÓN: Añadir employee_id a appointments
-- Fecha: 2025-11-17
-- Objetivo: Asociar reservas directamente con el empleado que las atiende
-- =====================================================

-- PASO 1: Añadir la columna employee_id a appointments
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'appointments'
        AND column_name = 'employee_id'
    ) THEN
        ALTER TABLE appointments
        ADD COLUMN employee_id UUID REFERENCES employees(id) ON DELETE SET NULL;
        
        RAISE NOTICE 'Columna employee_id añadida a appointments';
    ELSE
        RAISE NOTICE 'Columna employee_id ya existe en appointments';
    END IF;
END $$;

-- PASO 2: Crear un índice para optimizar las consultas por employee_id
CREATE INDEX IF NOT EXISTS idx_appointments_employee_id
ON appointments(employee_id);

-- PASO 3: Crear índice compuesto para búsquedas comunes (business + employee + date)
CREATE INDEX IF NOT EXISTS idx_appointments_business_employee_date
ON appointments(business_id, employee_id, appointment_date)
WHERE employee_id IS NOT NULL;

-- PASO 4: Actualizar appointments existentes para inferir employee_id desde availability_slots
-- Esto es un intento de migración de datos basado en la relación actual
DO $$
DECLARE
    r RECORD;
    v_updated_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Intentando actualizar employee_id para appointments existentes...';
    
    -- Actualizar appointments que tienen appointment_id en availability_slots
    FOR r IN
        SELECT DISTINCT 
            a.id AS appointment_id,
            asl.employee_id
        FROM appointments a
        INNER JOIN availability_slots asl ON asl.appointment_id = a.id
        WHERE a.employee_id IS NULL
        AND asl.employee_id IS NOT NULL
    LOOP
        UPDATE appointments
        SET employee_id = r.employee_id
        WHERE id = r.appointment_id
        AND employee_id IS NULL;
        
        GET DIAGNOSTICS v_updated_count = ROW_COUNT;
        RAISE NOTICE 'Actualizados % appointments con employee_id %', v_updated_count, r.employee_id;
    END LOOP;
    
    -- Si no se encontró por availability_slots, intentar inferir desde resource_id
    -- Buscar empleados que tienen ese resource_id asignado
    FOR r IN
        SELECT DISTINCT 
            a.id AS appointment_id,
            e.id AS employee_id
        FROM appointments a
        INNER JOIN employees e ON e.assigned_resource_id = a.resource_id
        WHERE a.employee_id IS NULL
        AND a.resource_id IS NOT NULL
        AND e.is_active = TRUE
        AND NOT EXISTS (
            SELECT 1 FROM appointments a2 
            WHERE a2.id = a.id AND a2.employee_id IS NOT NULL
        )
    LOOP
        UPDATE appointments
        SET employee_id = r.employee_id
        WHERE id = r.appointment_id
        AND employee_id IS NULL;
        
        GET DIAGNOSTICS v_updated_count = ROW_COUNT;
        IF v_updated_count > 0 THEN
            RAISE NOTICE 'Actualizado appointment % con employee_id % (desde resource_id)', r.appointment_id, r.employee_id;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Actualización de employee_id para appointments existentes completada.';
END $$;

-- PASO 5: Comentario en la columna
COMMENT ON COLUMN appointments.employee_id IS 
'ID del empleado que atiende esta reserva. Permite asociar directamente las reservas con los empleados, mejorando la gestión y consultas.';

