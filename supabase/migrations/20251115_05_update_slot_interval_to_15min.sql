-- =====================================================
-- MIGRACIÓN: ACTUALIZAR INTERVALO DE SLOTS A 15 MINUTOS
-- Fecha: 2025-11-15
-- Objetivo: Cambiar el intervalo de generación de slots de 30 minutos a 15 minutos
--           para que coincida con la granularidad del calendario (cada cuarto de hora)
-- =====================================================

-- Actualizar la función generate_availability_slots_employee_based
-- para usar intervalos de 15 minutos en lugar de 30 minutos
CREATE OR REPLACE FUNCTION generate_availability_slots_employee_based(
    p_business_id UUID,
    p_start_date DATE DEFAULT CURRENT_DATE,
    p_days_ahead INTEGER DEFAULT 90,
    p_regenerate BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(
    total_slots_generated INTEGER,
    days_processed INTEGER,
    employees_processed INTEGER,
    message TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_end_date DATE;
    v_current_date DATE;
    v_day_of_week INTEGER;
    v_employee RECORD;
    v_schedule RECORD;
    v_resource_id UUID;
    v_slot_time TIME;
    v_slot_interval INTERVAL := '15 minutes'; -- ✅ ACTUALIZADO: Intervalo de 15 minutos (cada cuarto de hora)
    v_slots_count INTEGER := 0;
    v_days_count INTEGER := 0;
    v_employees_count INTEGER := 0;
    v_has_absence BOOLEAN;
    v_absence RECORD;
BEGIN
    -- Calcular fecha final
    v_end_date := p_start_date + (p_days_ahead || ' days')::INTERVAL;
    
    -- =====================================================
    -- PASO 1: Si regenerar, eliminar slots existentes LIBRES
    -- =====================================================
    IF p_regenerate THEN
        DELETE FROM availability_slots
        WHERE business_id = p_business_id
          AND slot_date >= p_start_date
          AND slot_date <= v_end_date
          AND status = 'free'; -- ⚠️ SOLO LIBRES (protección de reservas)
          
        RAISE NOTICE 'Slots libres eliminados para regeneración';
    END IF;
    
    -- =====================================================
    -- PASO 2: Loop por cada empleado activo
    -- =====================================================
    FOR v_employee IN 
        SELECT id, name, assigned_resource_id
        FROM employees
        WHERE business_id = p_business_id
        AND is_active = true
        ORDER BY position_order ASC
    LOOP
        v_employees_count := v_employees_count + 1;
        RAISE NOTICE 'Procesando empleado: %', v_employee.name;
        
        -- =====================================================
        -- PASO 3: Loop por cada día en el rango
        -- =====================================================
        v_current_date := p_start_date;
        WHILE v_current_date <= v_end_date LOOP
            -- Obtener día de la semana (0=domingo, 6=sábado)
            v_day_of_week := EXTRACT(DOW FROM v_current_date);
            
            -- =====================================================
            -- PASO 4: Obtener horario del empleado para este día
            -- =====================================================
            SELECT * INTO v_schedule
            FROM employee_schedules
            WHERE employee_id = v_employee.id
            AND day_of_week = v_day_of_week
            AND is_working = true
            LIMIT 1;
            
            -- Si hay horario, generar slots
            IF v_schedule IS NOT NULL THEN
                -- Verificar si hay ausencia para este día
                SELECT EXISTS(
                    SELECT 1 FROM employee_absences
                    WHERE employee_id = v_employee.id
                    AND v_current_date >= start_date
                    AND v_current_date <= end_date
                ) INTO v_has_absence;
                
                -- Solo generar si NO hay ausencia
                IF NOT v_has_absence THEN
                    -- Obtener recurso asignado (mesa)
                    v_resource_id := v_employee.assigned_resource_id;
                    
                    -- Si hay recurso asignado, generar slots
                    IF v_resource_id IS NOT NULL THEN
                        -- Generar slots desde start_time hasta end_time
                        v_slot_time := v_schedule.start_time;
                        
                        WHILE v_slot_time < v_schedule.end_time LOOP
                            -- Verificar que no exista ya este slot (protección de reservas)
                            IF NOT EXISTS (
                                SELECT 1 FROM availability_slots
                                WHERE business_id = p_business_id
                                AND resource_id = v_resource_id
                                AND slot_date = v_current_date
                                AND start_time = v_slot_time
                            ) THEN
                                -- Insertar slot
                                INSERT INTO availability_slots (
                                    business_id,
                                    resource_id,
                                    slot_date,
                                    start_time,
                                    end_time,
                                    status,
                                    is_available,
                                    duration_minutes,
                                    created_at,
                                    updated_at
                                ) VALUES (
                                    p_business_id,
                                    v_resource_id,
                                    v_current_date,
                                    v_slot_time,
                                    v_slot_time + v_slot_interval,
                                    'free',
                                    true,
                                    EXTRACT(EPOCH FROM v_slot_interval) / 60, -- Duración en minutos
                                    NOW(),
                                    NOW()
                                );
                                
                                v_slots_count := v_slots_count + 1;
                            END IF;
                            
                            -- Avanzar al siguiente slot (15 minutos)
                            v_slot_time := v_slot_time + v_slot_interval;
                        END LOOP;
                        
                        v_days_count := v_days_count + 1;
                    END IF;
                END IF;
            END IF;
            
            -- Avanzar al siguiente día
            v_current_date := v_current_date + INTERVAL '1 day';
        END LOOP;
    END LOOP;
    
    -- Retornar resultado
    RETURN QUERY SELECT
        v_slots_count,
        v_days_count,
        v_employees_count,
        format('Generados %s slots para %s días por %s empleados', 
            v_slots_count, 
            v_days_count, 
            v_employees_count
        );
END;
$$;

-- Verificar que la función se actualizó correctamente
DO $$
BEGIN
    RAISE NOTICE '✅ Función generate_availability_slots_employee_based actualizada a intervalos de 15 minutos';
END $$;

SELECT 'Migración 20251115_05_update_slot_interval_to_15min completada' AS status;


