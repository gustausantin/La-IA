-- =====================================================
-- MIGRACIÓN: MEJORAS PROFESIONALES AL SISTEMA DE GENERACIÓN DE SLOTS
-- Fecha: 2025-11-17
-- Objetivo: Hacer el sistema robusto, confiable y profesional
--           1. Validación previa antes de generar
--           2. Mensajes de error claros y específicos
--           3. Mantenimiento diario automático
--           4. Regeneración automática por cambios
-- =====================================================

-- =====================================================
-- FUNCIÓN: Validación previa antes de generar slots
-- =====================================================

CREATE OR REPLACE FUNCTION validate_slot_generation_prerequisites(
    p_business_id UUID
)
RETURNS TABLE(
    is_valid BOOLEAN,
    error_code TEXT,
    error_message TEXT,
    details JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_business_exists BOOLEAN;
    v_has_operating_hours BOOLEAN;
    v_has_active_employees BOOLEAN;
    v_has_employee_schedules BOOLEAN;
    v_has_resources BOOLEAN;
    v_operating_hours JSONB;
    v_employees_count INTEGER;
    v_schedules_count INTEGER;
    v_resources_count INTEGER;
    v_details JSONB;
BEGIN
    -- Inicializar detalles
    v_details := jsonb_build_object();
    
    -- 1. Verificar que el negocio existe y está activo
    SELECT EXISTS(
        SELECT 1 FROM businesses
        WHERE id = p_business_id
        AND active = true
    ) INTO v_business_exists;
    
    IF NOT v_business_exists THEN
        RETURN QUERY SELECT
            false,
            'BUSINESS_NOT_FOUND'::TEXT,
            'El negocio no existe o no está activo'::TEXT,
            jsonb_build_object(
                'business_id', p_business_id,
                'issue', 'business_not_found_or_inactive'
            );
        RETURN;
    END IF;
    
    -- 2. Verificar horarios de negocio (operating_hours o opening_hours)
    -- Intentar ambos nombres ya que pueden variar según la implementación
    SELECT 
        COALESCE(
            CASE 
                WHEN settings ? 'operating_hours' AND jsonb_typeof(settings->'operating_hours') = 'object' THEN settings->'operating_hours'
                WHEN settings ? 'opening_hours' AND jsonb_typeof(settings->'opening_hours') = 'object' THEN settings->'opening_hours'
                ELSE '{}'::jsonb
            END,
            '{}'::jsonb
        ),
        CASE 
            WHEN (settings ? 'operating_hours' 
                  AND jsonb_typeof(settings->'operating_hours') = 'object' 
                  AND settings->'operating_hours' IS NOT NULL 
                  AND settings->'operating_hours' != '{}'::jsonb) OR
                 (settings ? 'opening_hours' 
                  AND jsonb_typeof(settings->'opening_hours') = 'object' 
                  AND settings->'opening_hours' IS NOT NULL 
                  AND settings->'opening_hours' != '{}'::jsonb)
            THEN true 
            ELSE false 
        END
    INTO v_operating_hours, v_has_operating_hours
    FROM businesses
    WHERE id = p_business_id;
    
    IF NOT v_has_operating_hours THEN
        RETURN QUERY SELECT
            false,
            'NO_OPERATING_HOURS'::TEXT,
            'No se han configurado horarios de apertura del negocio'::TEXT,
            jsonb_build_object(
                'business_id', p_business_id,
                'issue', 'operating_hours_not_configured',
                'solution', 'Configurar horarios de apertura en la configuración del negocio'
            );
        RETURN;
    END IF;
    
    -- 3. Verificar que existan empleados activos
    SELECT COUNT(*) INTO v_employees_count
    FROM employees
    WHERE business_id = p_business_id
    AND is_active = true;
    
    v_has_active_employees := (v_employees_count > 0);
    
    IF NOT v_has_active_employees THEN
        RETURN QUERY SELECT
            false,
            'NO_ACTIVE_EMPLOYEES'::TEXT,
            'No hay empleados activos configurados'::TEXT,
            jsonb_build_object(
                'business_id', p_business_id,
                'issue', 'no_active_employees',
                'employees_count', v_employees_count,
                'solution', 'Agregar al menos un empleado activo en la sección Equipo'
            );
        RETURN;
    END IF;
    
    -- 4. Verificar que los empleados tengan horarios configurados
    SELECT COUNT(*) INTO v_schedules_count
    FROM employee_schedules es
    INNER JOIN employees e ON es.employee_id = e.id
    WHERE e.business_id = p_business_id
    AND e.is_active = true
    AND es.is_working = true;
    
    v_has_employee_schedules := (v_schedules_count > 0);
    
    IF NOT v_has_employee_schedules THEN
        RETURN QUERY SELECT
            false,
            'NO_EMPLOYEE_SCHEDULES'::TEXT,
            'Los empleados activos no tienen horarios de trabajo configurados'::TEXT,
            jsonb_build_object(
                'business_id', p_business_id,
                'issue', 'no_employee_schedules',
                'employees_count', v_employees_count,
                'schedules_count', v_schedules_count,
                'solution', 'Configurar horarios de trabajo para los empleados activos'
            );
        RETURN;
    END IF;
    
    -- 5. Verificar que existan recursos disponibles
    SELECT COUNT(*) INTO v_resources_count
    FROM resources
    WHERE business_id = p_business_id
    AND is_active = true;
    
    v_has_resources := (v_resources_count > 0);
    
    IF NOT v_has_resources THEN
        RETURN QUERY SELECT
            false,
            'NO_RESOURCES'::TEXT,
            'No hay recursos disponibles (mesas, salones, etc.) configurados'::TEXT,
            jsonb_build_object(
                'business_id', p_business_id,
                'issue', 'no_resources',
                'resources_count', v_resources_count,
                'solution', 'Agregar recursos (mesas, salones, etc.) en la configuración'
            );
        RETURN;
    END IF;
    
    -- ✅ Todo está correcto
    RETURN QUERY SELECT
        true,
        'VALID'::TEXT,
        'Todos los requisitos previos están cumplidos'::TEXT,
        jsonb_build_object(
            'business_id', p_business_id,
            'operating_hours_configured', true,
            'employees_count', v_employees_count,
            'schedules_count', v_schedules_count,
            'resources_count', v_resources_count
        );
END;
$$;

COMMENT ON FUNCTION validate_slot_generation_prerequisites IS 
'Valida que existan todos los requisitos previos antes de generar slots: negocio activo, horarios configurados, empleados con horarios, y recursos disponibles';

-- =====================================================
-- MEJORA: Función de generación con validación y mejores errores
-- =====================================================

-- ⚠️ IMPORTANTE: Eliminar función existente antes de recrearla con nuevo tipo de retorno
-- PostgreSQL no permite cambiar el tipo de retorno de una función existente
DROP FUNCTION IF EXISTS generate_availability_slots_employee_based(UUID, DATE, INTEGER, BOOLEAN);

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
    message TEXT,
    error_code TEXT,
    error_message TEXT
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
    v_slot_interval INTERVAL := '15 minutes';
    v_slots_count INTEGER := 0;
    v_days_count INTEGER := 0;
    v_employees_count INTEGER := 0;
    v_has_absence BOOLEAN;
    v_absence RECORD;
    v_validation_result RECORD;
    -- Variables para turnos (shifts)
    v_shift JSONB;
    v_shift_start TIME;
    v_shift_end TIME;
    v_has_shifts BOOLEAN;
BEGIN
    -- =====================================================
    -- PASO 0: VALIDACIÓN PREVIA
    -- =====================================================
    SELECT * INTO v_validation_result
    FROM validate_slot_generation_prerequisites(p_business_id);
    
    IF NOT v_validation_result.is_valid THEN
        RETURN QUERY SELECT
            0::INTEGER,
            0::INTEGER,
            0::INTEGER,
            format('❌ Validación fallida: %s', v_validation_result.error_message)::TEXT,
            v_validation_result.error_code,
            v_validation_result.error_message;
        RETURN;
    END IF;
    
    -- Calcular fecha final
    v_end_date := p_start_date + (p_days_ahead || ' days')::INTERVAL;
    
    -- =====================================================
    -- PASO 1: Si regenerar, eliminar slots existentes LIBRES
    -- =====================================================
    IF p_regenerate THEN
        -- ⚠️ IMPORTANTE: Solo eliminamos slots con status = 'free'
        -- Los slots 'reserved' y 'blocked' se MANTIENEN para historial/auditoría
        -- Esto permite tener registro de quién vino, cuándo, y actividad del negocio
        
        -- ✅ PASO 1A: Eliminar slots libres DENTRO del rango (para regenerar)
        DELETE FROM availability_slots
        WHERE business_id = p_business_id
          AND slot_date >= p_start_date
          AND slot_date <= v_end_date
          AND status = 'free'; -- ✅ SOLO LIBRES - Los reservados/bloqueados se mantienen para historial
          
        GET DIAGNOSTICS v_slots_count = ROW_COUNT;
        RAISE NOTICE 'Slots libres eliminados dentro del rango (% a %): %', p_start_date, v_end_date, v_slots_count;
        
        -- ✅ PASO 1B: Eliminar slots libres FUERA del rango (cuando se reduce el número de días)
        -- Esto asegura que si cambias de 30 días a 10 días, se eliminen los slots libres del día 11 al 30
        DELETE FROM availability_slots
        WHERE business_id = p_business_id
          AND slot_date > v_end_date  -- ✅ Solo slots DESPUÉS del rango configurado
          AND status = 'free'; -- ✅ SOLO LIBRES - Las reservas se protegen automáticamente
          
        GET DIAGNOSTICS v_slots_count = ROW_COUNT;
        IF v_slots_count > 0 THEN
            RAISE NOTICE 'Slots libres eliminados fuera del rango (después de %): %', v_end_date, v_slots_count;
        END IF;
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
        -- ✅ IMPORTANTE: La generación de slots es 100% basada en TRABAJADORES
        -- El horario del negocio es solo para validación previa, NO para restringir la generación
        -- Si hay trabajador disponible + recurso + horario del trabajador → SE GENERAN SLOTS
        -- Si NO hay trabajador → NO se generan slots (incluso si el negocio está abierto)
        v_current_date := p_start_date;
        WHILE v_current_date <= v_end_date LOOP
            -- Obtener día de la semana (0=domingo, 6=sábado)
            v_day_of_week := EXTRACT(DOW FROM v_current_date);
            
            -- =====================================================
            -- PASO 4: Obtener horario del empleado para este día
            -- =====================================================
            -- ✅ PRIORIDAD: Verificar primero si el TRABAJADOR trabaja este día
            -- El horario del negocio es secundario - solo se usa para validación previa
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
                    CONTINUE;
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
                BEGIN
                    v_resource_id := find_available_resource(
                        p_business_id,
                        v_employee.id,
                        v_day_of_week,
                        v_schedule.start_time,
                        v_schedule.end_time
                    );
                EXCEPTION
                    WHEN OTHERS THEN
                        RAISE WARNING 'Error en find_available_resource para empleado % el día %: %', 
                            v_employee.name, v_current_date, SQLERRM;
                        v_resource_id := NULL;
                END;
                
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
            -- ✅ NUEVO: Respetar turnos individuales (shifts) si existen
            -- Si hay shifts definidos, generar slots solo para cada turno
            -- Si no hay shifts, usar comportamiento legacy (start_time/end_time)
            
            -- Verificar si hay shifts definidos
            v_has_shifts := (
                v_schedule.shifts IS NOT NULL 
                AND v_schedule.shifts != '[]'::jsonb
                AND jsonb_array_length(v_schedule.shifts) > 0
            );
            
            IF v_has_shifts THEN
                    -- ✅ ITERAR SOBRE CADA TURNO INDIVIDUAL
                    -- Esto respeta los descansos entre turnos (ej: 09:00-14:00, 16:00-18:00)
                    FOR v_shift IN SELECT * FROM jsonb_array_elements(v_schedule.shifts)
                    LOOP
                        -- Extraer inicio y fin del turno
                        v_shift_start := (v_shift->>'start')::TIME;
                        v_shift_end := (v_shift->>'end')::TIME;
                        
                        -- Validar que el turno tenga valores válidos
                        IF v_shift_start IS NULL OR v_shift_end IS NULL OR v_shift_start >= v_shift_end THEN
                            RAISE WARNING 'Turno inválido para empleado % el día %: % a %', 
                                v_employee.name, v_current_date, v_shift_start, v_shift_end;
                            CONTINUE;
                        END IF;
                        
                        -- Generar slots solo para este turno
                        v_slot_time := v_shift_start;
                        
                        WHILE v_slot_time < v_shift_end LOOP
                            
                            -- =====================================================
                            -- PASO 8: Verificar ausencia PARCIAL en este slot
                            -- =====================================================
                            IF v_has_absence THEN
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
                                BEGIN
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
                                EXCEPTION
                                    WHEN OTHERS THEN
                                        RAISE WARNING 'Error insertando slot para empleado % el día % a las %: %', 
                                            v_employee.name, v_current_date, v_slot_time, SQLERRM;
                                END;
                            END IF;
                            
                            -- Avanzar al siguiente slot
                            v_slot_time := v_slot_time + v_slot_interval;
                        END LOOP;
                    END LOOP;
                ELSE
                    -- ✅ COMPORTAMIENTO LEGACY: Si no hay shifts, usar start_time/end_time
                    -- (Para compatibilidad con horarios antiguos que no usan shifts)
                    IF v_schedule.start_time IS NULL OR v_schedule.end_time IS NULL THEN
                        RAISE WARNING 'Empleado % no tiene horario válido el día % (sin shifts ni start_time/end_time)', 
                            v_employee.name, v_current_date;
                        v_current_date := v_current_date + 1;
                        CONTINUE;
                    END IF;
                    
                    v_slot_time := v_schedule.start_time;
                    
                    WHILE v_slot_time < v_schedule.end_time LOOP
                        
                        -- =====================================================
                        -- PASO 8: Verificar ausencia PARCIAL en este slot
                        -- =====================================================
                        IF v_has_absence THEN
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
                            BEGIN
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
                            EXCEPTION
                                WHEN OTHERS THEN
                                    RAISE WARNING 'Error insertando slot para empleado % el día % a las %: %', 
                                        v_employee.name, v_current_date, v_slot_time, SQLERRM;
                            END;
                        END IF;
                        
                        -- Avanzar al siguiente slot
                        v_slot_time := v_slot_time + v_slot_interval;
                    END LOOP;
                END IF;
            
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
        format('✅ Generados %s slots para %s empleados en %s días laborables', 
            v_slots_count, v_employees_count, v_days_count) AS message,
        'SUCCESS'::TEXT AS error_code,
        NULL::TEXT AS error_message;
END;
$$;

-- =====================================================
-- FUNCIÓN: Mantenimiento diario automático
-- =====================================================
-- PROPÓSITO: Mantener una ventana móvil constante de disponibilidades
-- 
-- EJEMPLO: Si configuras 10 días de anticipación:
--   - Día 1: Tienes slots del día 1 al día 10 (10 días)
--   - Día 2: Elimina slots libres del día 1 (pasado), genera slots del día 11
--            Ahora tienes slots del día 2 al día 11 (10 días)
--   - Día 3: Elimina slots libres del día 2 (pasado), genera slots del día 12
--            Ahora tienes slots del día 3 al día 12 (10 días)
--   Y así sucesivamente... SIEMPRE mantiene 10 días disponibles hacia el futuro
--
-- IMPORTANTE: Solo elimina slots LIBRES del pasado
-- Los slots RESERVADOS y BLOQUEADOS se mantienen para historial/auditoría

CREATE OR REPLACE FUNCTION daily_availability_maintenance()
RETURNS TABLE(
    business_id UUID,
    business_name TEXT,
    slots_deleted INTEGER,
    new_day_date DATE,
    slots_generated INTEGER,
    status TEXT,
    error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_business RECORD;
    v_advance_days INTEGER;
    v_deleted_count INTEGER;
    v_new_day DATE;
    v_generated_count INTEGER;
    v_result RECORD;
    v_validation RECORD;
BEGIN
    -- Loop por cada negocio activo
    FOR v_business IN 
        SELECT 
            b.id,
            b.name,
            COALESCE(
                (b.settings->'booking_settings'->>'advance_booking_days')::INTEGER,
                30
            ) as advance_days
        FROM businesses b
        WHERE b.active = TRUE
    LOOP
        BEGIN
            -- Validar requisitos previos
            SELECT * INTO v_validation
            FROM validate_slot_generation_prerequisites(v_business.id);
            
            IF NOT v_validation.is_valid THEN
                RETURN QUERY SELECT
                    v_business.id,
                    v_business.name,
                    0::INTEGER,
                    NULL::DATE,
                    0::INTEGER,
                    'SKIPPED'::TEXT,
                    format('Validación fallida: %s', v_validation.error_message)::TEXT;
                CONTINUE;
            END IF;
            
            v_advance_days := v_business.advance_days;
            
            -- 1. LIMPIAR slots antiguos LIBRES (del pasado)
            -- ⚠️ IMPORTANTE: Solo eliminamos slots con status = 'free'
            -- Los slots 'reserved' y 'blocked' se MANTIENEN para historial/auditoría
            -- Esto permite tener registro de quién vino, cuándo, y actividad del negocio
            DELETE FROM availability_slots
            WHERE business_id = v_business.id
              AND slot_date < CURRENT_DATE
              AND status = 'free'; -- ✅ SOLO LIBRES - Los reservados/bloqueados se mantienen para historial
            
            GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
            
            -- 2. CALCULAR nuevo día al final del rango
            -- Ejemplo: Si advance_days = 10 y hoy es 2025-11-17
            --   v_new_day = 2025-11-17 + 10 = 2025-11-27
            -- Esto asegura que siempre tengas 10 días disponibles hacia el futuro
            v_new_day := CURRENT_DATE + v_advance_days;
            
            -- 3. GENERAR slots para el nuevo día (solo 1 día)
            -- Esto mantiene la ventana móvil: cada día se agrega un día nuevo al final
            SELECT 
                total_slots_generated,
                error_code
            INTO v_result
            FROM generate_availability_slots_employee_based(
                v_business.id,
                v_new_day,
                1, -- solo 1 día
                FALSE -- no regenerar
            );
            
            v_generated_count := COALESCE(v_result.total_slots_generated, 0);
            
            -- Retornar resultado exitoso
            RETURN QUERY SELECT
                v_business.id,
                v_business.name,
                v_deleted_count,
                v_new_day,
                v_generated_count,
                'COMPLETED'::TEXT,
                NULL::TEXT;
                
        EXCEPTION
            WHEN OTHERS THEN
                RETURN QUERY SELECT
                    v_business.id,
                    v_business.name,
                    0::INTEGER,
                    NULL::DATE,
                    0::INTEGER,
                    'ERROR'::TEXT,
                    SQLERRM::TEXT;
        END;
    END LOOP;
END;
$$;

-- =====================================================
-- ACTUALIZAR: Función alias para compatibilidad
-- =====================================================

-- Eliminar alias existente antes de recrearlo
DROP FUNCTION IF EXISTS generate_employee_slots(UUID, DATE, INTEGER);

CREATE OR REPLACE FUNCTION generate_employee_slots(
    p_business_id UUID,
    p_start_date DATE DEFAULT CURRENT_DATE,
    p_days_ahead INTEGER DEFAULT 90
) RETURNS TABLE(
    total_slots_generated INTEGER,
    days_processed INTEGER,
    employees_processed INTEGER,
    message TEXT,
    error_code TEXT,
    error_message TEXT
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

COMMENT ON FUNCTION generate_employee_slots IS 
'Alias corto para generate_availability_slots_employee_based. Siempre regenera slots existentes.';

COMMENT ON FUNCTION daily_availability_maintenance IS 
'Mantenimiento diario automático: elimina SOLO slots LIBRES del pasado (status = ''free'') y genera slots para el nuevo día al final del rango. 
Los slots RESERVADOS (status = ''reserved'') y BLOQUEADOS (status = ''blocked'') se MANTIENEN para historial/auditoría del negocio.
Esto permite tener registro de quién vino, cuándo, y actividad histórica del negocio.
Debe ejecutarse diariamente con pg_cron.';

-- =====================================================
-- TRIGGER: Regeneración automática por cambios de empleado
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_regenerate_slots_on_employee_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_business_id UUID;
    v_should_regenerate BOOLEAN := false;
BEGIN
    -- Obtener business_id
    IF TG_OP = 'DELETE' THEN
        v_business_id := OLD.business_id;
    ELSE
        v_business_id := NEW.business_id;
    END IF;
    
    -- Determinar si se debe regenerar
    IF TG_OP = 'INSERT' THEN
        -- Nuevo empleado activo con horario
        IF NEW.is_active = true THEN
            v_should_regenerate := true;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Cambio en estado activo o en campos relevantes
        IF (OLD.is_active IS DISTINCT FROM NEW.is_active) OR
           (OLD.assigned_resource_id IS DISTINCT FROM NEW.assigned_resource_id) THEN
            v_should_regenerate := true;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        -- Empleado eliminado
        IF OLD.is_active = true THEN
            v_should_regenerate := true;
        END IF;
    END IF;
    
    -- Regenerar en background (no bloquear la transacción)
    IF v_should_regenerate THEN
        -- Usar pg_notify para que el frontend pueda escuchar
        PERFORM pg_notify(
            'slot_regeneration_needed',
            json_build_object(
                'business_id', v_business_id,
                'reason', 'employee_change',
                'employee_id', COALESCE(NEW.id, OLD.id)
            )::text
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Crear triggers para employees
DROP TRIGGER IF EXISTS trigger_employee_change_slots ON employees;
CREATE TRIGGER trigger_employee_change_slots
    AFTER INSERT OR UPDATE OR DELETE ON employees
    FOR EACH ROW
    EXECUTE FUNCTION trigger_regenerate_slots_on_employee_change();

-- =====================================================
-- TRIGGER: Regeneración automática por cambios en horarios de empleados
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_regenerate_slots_on_schedule_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_business_id UUID;
    v_employee_id UUID;
BEGIN
    -- Obtener IDs
    IF TG_OP = 'DELETE' THEN
        v_employee_id := OLD.employee_id;
    ELSE
        v_employee_id := NEW.employee_id;
    END IF;
    
    -- Obtener business_id del empleado
    SELECT business_id INTO v_business_id
    FROM employees
    WHERE id = v_employee_id;
    
    IF v_business_id IS NOT NULL THEN
        -- Notificar que se necesita regeneración
        PERFORM pg_notify(
            'slot_regeneration_needed',
            json_build_object(
                'business_id', v_business_id,
                'reason', 'employee_schedule_change',
                'employee_id', v_employee_id
            )::text
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Crear triggers para employee_schedules
DROP TRIGGER IF EXISTS trigger_schedule_change_slots ON employee_schedules;
CREATE TRIGGER trigger_schedule_change_slots
    AFTER INSERT OR UPDATE OR DELETE ON employee_schedules
    FOR EACH ROW
    EXECUTE FUNCTION trigger_regenerate_slots_on_schedule_change();

-- =====================================================
-- TRIGGER: Regeneración automática por cambios en ausencias
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_regenerate_slots_on_absence_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_business_id UUID;
    v_employee_id UUID;
BEGIN
    -- Obtener IDs
    IF TG_OP = 'DELETE' THEN
        v_employee_id := OLD.employee_id;
    ELSE
        v_employee_id := NEW.employee_id;
    END IF;
    
    -- Obtener business_id del empleado
    SELECT business_id INTO v_business_id
    FROM employees
    WHERE id = v_employee_id;
    
    IF v_business_id IS NOT NULL THEN
        -- Notificar que se necesita regeneración
        PERFORM pg_notify(
            'slot_regeneration_needed',
            json_build_object(
                'business_id', v_business_id,
                'reason', 'employee_absence_change',
                'employee_id', v_employee_id,
                'start_date', COALESCE(NEW.start_date, OLD.start_date),
                'end_date', COALESCE(NEW.end_date, OLD.end_date)
            )::text
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Crear triggers para employee_absences
DROP TRIGGER IF EXISTS trigger_absence_change_slots ON employee_absences;
CREATE TRIGGER trigger_absence_change_slots
    AFTER INSERT OR UPDATE OR DELETE ON employee_absences
    FOR EACH ROW
    EXECUTE FUNCTION trigger_regenerate_slots_on_absence_change();

-- =====================================================
-- COMENTARIOS
-- =====================================================

COMMENT ON FUNCTION validate_slot_generation_prerequisites IS 
'Valida que existan todos los requisitos previos antes de generar slots: negocio activo, horarios configurados, empleados con horarios, y recursos disponibles';

COMMENT ON FUNCTION daily_availability_maintenance IS 
'Mantenimiento diario automático: elimina SOLO slots LIBRES del pasado (status = ''free'') y genera slots para el nuevo día al final del rango. 
Los slots RESERVADOS (status = ''reserved'') y BLOQUEADOS (status = ''blocked'') se MANTIENEN para historial/auditoría del negocio.
Esto permite tener registro de quién vino, cuándo, y actividad histórica del negocio.
Debe ejecutarse diariamente con pg_cron.';

COMMENT ON FUNCTION trigger_regenerate_slots_on_employee_change IS 
'Trigger que notifica cuando se necesita regenerar slots por cambios en empleados';

COMMENT ON FUNCTION trigger_regenerate_slots_on_schedule_change IS 
'Trigger que notifica cuando se necesita regenerar slots por cambios en horarios de empleados';

COMMENT ON FUNCTION trigger_regenerate_slots_on_absence_change IS 
'Trigger que notifica cuando se necesita regenerar slots por cambios en ausencias de empleados';

-- =====================================================
-- NOTA IMPORTANTE SOBRE CONSERVACIÓN DE HISTORIAL
-- =====================================================
-- ⚠️ REGLA CRÍTICA: Solo se eliminan slots con status = 'free'
-- Los slots con status = 'reserved' o 'blocked' se MANTIENEN para:
--   - Historial de actividad del negocio
--   - Auditoría de quién vino y cuándo
--   - Reportes y análisis de ocupación
--   - Registro de reservas completadas
-- Esto aplica tanto en regeneración como en mantenimiento diario

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================

SELECT 'Migración 20251117_01_improve_slot_generation_system completada' AS status;

