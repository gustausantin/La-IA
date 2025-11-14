-- =====================================================
-- MIGRACIÓN: FUNCIÓN DE GENERACIÓN DE SLOTS BASADA EN EMPLEADOS
-- Fecha: 2025-11-12
-- Objetivo: Generar availability_slots basándose en:
--           1. Horarios de empleados (employee_schedules)
--           2. Ausencias de empleados (employee_absences)
--           3. Asignación de recursos (manual o automática)
-- =====================================================

-- =====================================================
-- FUNCIÓN PRINCIPAL: generate_availability_slots_employee_based()
-- =====================================================

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
    v_current_date DATE;
    v_end_date DATE;
    v_day_of_week INTEGER;
    v_employee RECORD;
    v_schedule RECORD;
    v_resource_id UUID;
    v_slot_time TIME;
    v_slot_interval INTERVAL := '15 minutes'; -- Intervalo de 15 minutos (cada cuarto de hora)
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
            AND is_working = true;
            
            -- Si no trabaja este día, saltar
            IF v_schedule IS NULL OR NOT v_schedule.is_working THEN
                v_current_date := v_current_date + 1;
                CONTINUE;
            END IF;
            
            -- =====================================================
            -- PASO 5: Verificar ausencias del empleado
            -- =====================================================
            SELECT EXISTS (
                SELECT 1
                FROM employee_absences
                WHERE employee_id = v_employee.id
                AND start_date <= v_current_date
                AND end_date >= v_current_date
                AND approved = true
            ) INTO v_has_absence;
            
            -- Si tiene ausencia TODO EL DÍA, saltar
            IF v_has_absence THEN
                SELECT * INTO v_absence
                FROM employee_absences
                WHERE employee_id = v_employee.id
                AND start_date <= v_current_date
                AND end_date >= v_current_date
                AND approved = true
                AND all_day = true
                LIMIT 1;
                
                IF v_absence.all_day THEN
                    v_current_date := v_current_date + 1;
                    CONTINUE; -- Ausencia todo el día, no generar ningún slot
                END IF;
            END IF;
            
            -- =====================================================
            -- PASO 6: Obtener recurso asignado (manual o automático)
            -- =====================================================
            IF v_schedule.resource_id IS NOT NULL THEN
                -- Asignación MANUAL
                v_resource_id := v_schedule.resource_id;
            ELSE
                -- Asignación AUTOMÁTICA
                v_resource_id := find_available_resource(
                    p_business_id,
                    v_employee.id,
                    v_day_of_week,
                    v_schedule.start_time,
                    v_schedule.end_time
                );
                
                -- Si no hay recurso disponible, saltar este empleado este día
                IF v_resource_id IS NULL THEN
                    RAISE WARNING 'No hay recurso disponible para empleado % el día %', 
                        v_employee.name, v_current_date;
                    v_current_date := v_current_date + 1;
                    CONTINUE;
                END IF;
            END IF;
            
            v_days_count := v_days_count + 1;
            
            -- =====================================================
            -- PASO 7: Generar slots para este día
            -- =====================================================
            v_slot_time := v_schedule.start_time;
            
            WHILE v_slot_time < v_schedule.end_time LOOP
                
                -- =====================================================
                -- PASO 8: Verificar ausencia PARCIAL en este slot
                -- =====================================================
                IF v_has_absence THEN
                    -- Buscar ausencia parcial que afecte este slot
                    SELECT * INTO v_absence
                    FROM employee_absences
                    WHERE employee_id = v_employee.id
                    AND start_date <= v_current_date
                    AND end_date >= v_current_date
                    AND approved = true
                    AND all_day = false
                    AND start_time <= v_slot_time
                    AND end_time > v_slot_time
                    LIMIT 1;
                    
                    -- Si hay ausencia en este slot, saltarlo
                    IF FOUND THEN
                        v_slot_time := v_slot_time + v_slot_interval;
                        CONTINUE;
                    END IF;
                END IF;
                
                -- =====================================================
                -- PASO 9: Verificar que no exista ya este slot
                -- =====================================================
                IF NOT EXISTS (
                    SELECT 1 FROM availability_slots
                    WHERE business_id = p_business_id
                    AND resource_id = v_resource_id
                    AND slot_date = v_current_date
                    AND start_time = v_slot_time
                ) THEN
                    -- =====================================================
                    -- PASO 10: Crear slot
                    -- =====================================================
                    INSERT INTO availability_slots (
                        business_id,
                        resource_id,
                        slot_date,
                        start_time,
                        end_time,
                        status,
                        duration_minutes,
                        is_available
                    ) VALUES (
                        p_business_id,
                        v_resource_id,
                        v_current_date,
                        v_slot_time,
                        v_slot_time + v_slot_interval,
                        'free',
                        EXTRACT(EPOCH FROM v_slot_interval)::INTEGER / 60,
                        true
                    );
                    
                    v_slots_count := v_slots_count + 1;
                END IF;
                
                -- Avanzar al siguiente slot
                v_slot_time := v_slot_time + v_slot_interval;
            END LOOP;
            
            -- Siguiente día
            v_current_date := v_current_date + 1;
        END LOOP;
    END LOOP;
    
    -- =====================================================
    -- RETORNAR RESULTADO
    -- =====================================================
    RETURN QUERY SELECT 
        v_slots_count AS total_slots_generated,
        v_days_count AS days_processed,
        v_employees_count AS employees_processed,
        format('Generados %s slots para %s empleados en %s días laborables', 
            v_slots_count, v_employees_count, v_days_count) AS message;
END;
$$;

-- =====================================================
-- FUNCIÓN: Alias corto para compatibilidad
-- =====================================================

CREATE OR REPLACE FUNCTION generate_employee_slots(
    p_business_id UUID,
    p_start_date DATE DEFAULT CURRENT_DATE,
    p_days_ahead INTEGER DEFAULT 90
) RETURNS TABLE(
    total_slots_generated INTEGER,
    days_processed INTEGER,
    employees_processed INTEGER,
    message TEXT
) AS $$
BEGIN
    RETURN QUERY SELECT * FROM generate_availability_slots_employee_based(
        p_business_id,
        p_start_date,
        p_days_ahead,
        TRUE -- Siempre regenerar
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- COMENTARIOS
-- =====================================================

COMMENT ON FUNCTION generate_availability_slots_employee_based IS 
'Genera slots de disponibilidad basándose en horarios de empleados, considerando ausencias y asignación de recursos (manual o automática)';

COMMENT ON FUNCTION find_available_resource IS 
'Encuentra el mejor recurso disponible para un empleado en un horario específico, evitando conflictos con otros empleados';

COMMENT ON FUNCTION get_effective_resource_id IS 
'Devuelve el resource_id efectivo para un schedule (manual si existe, automático si no)';

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================

SELECT 'Migración 20251112_02_generate_slots_employee_based completada' AS status;


