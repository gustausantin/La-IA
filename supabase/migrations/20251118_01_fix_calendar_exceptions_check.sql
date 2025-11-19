-- =====================================================
-- MIGRACIÓN: VERIFICAR CALENDAR_EXCEPTIONS ANTES DE GENERAR SLOTS
-- Fecha: 2025-11-18
-- Objetivo: Evitar generar disponibilidad en días cerrados o con eventos especiales
--           que bloqueen la operación del negocio
-- =====================================================

-- =====================================================
-- ACTUALIZAR: Función de generación con verificación de calendario
-- =====================================================

-- ⚠️ IMPORTANTE: Eliminar función existente antes de recrearla
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
    -- Variables para verificación de calendario
    v_is_closed BOOLEAN;
    v_calendar_exception RECORD;
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
            -- ✅ PASO 3.5: VERIFICAR CALENDARIO - DÍAS CERRADOS O EVENTOS ESPECIALES
            -- =====================================================
            -- 🚨 CRÍTICO: Verificar SIEMPRE si el día está cerrado en el calendario
            -- Esto previene generar disponibilidad en días festivos, cierres, etc.
            -- IMPORTANTE: Esta verificación debe estar ANTES de cualquier otra lógica
            -- para evitar generar slots en días cerrados
            
            -- Inicializar variable para evitar valores residuales
            v_calendar_exception := NULL;
            
            -- Verificar si existe una excepción de calendario para este día
            BEGIN
                SELECT * INTO v_calendar_exception
                FROM calendar_exceptions
                WHERE business_id = p_business_id
                AND exception_date = v_current_date
                LIMIT 1;
            EXCEPTION
                WHEN NO_DATA_FOUND THEN
                    v_calendar_exception := NULL;
            END;
            
            -- Si se encontró una excepción, verificar si el día está cerrado
            IF v_calendar_exception IS NOT NULL THEN
                -- Verificar si el día está cerrado (is_open = false o NULL)
                -- Si is_open es NULL, asumimos que está cerrado por defecto
                IF v_calendar_exception.is_open = false OR v_calendar_exception.is_open IS NULL THEN
                    -- 🚫 DÍA CERRADO: Eliminar slots libres existentes y saltar este día
                    DELETE FROM availability_slots
                    WHERE business_id = p_business_id
                      AND slot_date = v_current_date
                      AND status = 'free'; -- ✅ SOLO LIBRES - Los reservados se mantienen
                    
                    RAISE NOTICE '🚫 Día % está cerrado en el calendario (razón: %). No se generarán slots para ningún empleado.', 
                        v_current_date, COALESCE(v_calendar_exception.reason, 'Día cerrado');
                    
                    v_current_date := v_current_date + 1;
                    CONTINUE; -- Saltar este día completamente para este empleado
                ELSE
                    -- Si is_open = true, el día tiene horarios especiales pero está abierto
                    RAISE NOTICE 'ℹ️ Día % tiene horarios especiales pero está abierto (razón: %). Continuando con generación normal.', 
                        v_current_date, COALESCE(v_calendar_exception.reason, 'Evento especial');
                END IF;
            END IF;
            
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
            
            -- Si no trabaja este día, ELIMINAR slots libres de este empleado para este día
            -- 🛡️ IMPORTANTE: Solo eliminar slots LIBRES, mantener los que tienen reservas
            IF v_schedule IS NULL OR NOT v_schedule.is_working THEN
                -- Eliminar slots libres de este empleado para este día específico
                DELETE FROM availability_slots
                WHERE business_id = p_business_id
                  AND employee_id = v_employee.id
                  AND slot_date = v_current_date
                  AND status = 'free'; -- ✅ SOLO LIBRES - Los reservados se mantienen
                
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
            -- PASO 6: Verificar si hay shifts definidos
            -- =====================================================
            -- Verificar si hay shifts definidos ANTES de asignar recurso
            v_has_shifts := (
                v_schedule.shifts IS NOT NULL 
                AND v_schedule.shifts != '[]'::jsonb
                AND jsonb_array_length(v_schedule.shifts) > 0
            );
            
            -- =====================================================
            -- PASO 7: Generar slots para este día
            -- =====================================================
            -- ✅ NUEVO: Respetar turnos individuales (shifts) si existen
            -- Si hay shifts definidos, generar slots solo para cada turno
            -- Si no hay shifts, usar comportamiento legacy (start_time/end_time)
            
            IF v_has_shifts THEN
                v_days_count := v_days_count + 1;
                
                -- ✅ ITERAR SOBRE CADA TURNO INDIVIDUAL
                -- Esto respeta los descansos entre turnos (ej: 09:00-14:00, 16:00-18:00)
                -- 🚨 CRÍTICO: Buscar recurso para CADA TURNO individualmente
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
                    
                    -- =====================================================
                    -- Obtener recurso asignado (manual o automático) PARA ESTE TURNO
                    -- =====================================================
                    IF v_schedule.resource_id IS NOT NULL THEN
                        -- Asignación MANUAL (mismo recurso para todos los turnos)
                        v_resource_id := v_schedule.resource_id;
                    ELSE
                        -- Asignación AUTOMÁTICA: Buscar recurso para ESTE TURNO específico
                        BEGIN
                            -- 🚨 CRÍTICO: Buscar recurso usando el horario del TURNO, no el horario completo
                            v_resource_id := find_available_resource(
                                p_business_id,
                                v_employee.id,
                                v_day_of_week,
                                v_shift_start,  -- 🆕 Horario del TURNO, no del schedule completo
                                v_shift_end,    -- 🆕 Horario del TURNO, no del schedule completo
                                v_current_date  -- 🆕 Pasar fecha para verificar slots ya generados
                            );
                        EXCEPTION
                            WHEN OTHERS THEN
                                RAISE WARNING 'Error en find_available_resource para empleado % el día % turno %-%: %', 
                                    v_employee.name, v_current_date, v_shift_start, v_shift_end, SQLERRM;
                                v_resource_id := NULL;
                        END;
                        
                        -- Si no hay recurso disponible para este turno, saltar este turno
                        IF v_resource_id IS NULL THEN
                            RAISE WARNING 'No hay recurso disponible para empleado % el día % en turno %-%', 
                                v_employee.name, v_current_date, v_shift_start, v_shift_end;
                            CONTINUE; -- Saltar este turno, continuar con el siguiente
                        END IF;
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
                        -- PASO 9: Verificar que no exista ya este slot Y que no haya conflicto
                        -- =====================================================
                        -- ✅ CRÍTICO: Verificar por EMPLEADO + RECURSO + FECHA + HORA
                        -- 🚨 ADICIONAL: Verificar que el recurso no esté siendo usado por otro empleado en este slot
                        IF NOT EXISTS (
                            SELECT 1 FROM availability_slots
                            WHERE business_id = p_business_id
                            AND employee_id = v_employee.id
                            AND resource_id = v_resource_id
                            AND slot_date = v_current_date
                            AND start_time = v_slot_time
                        )
                        -- 🚨 PROTECCIÓN: Verificar que ningún otro empleado ya tiene este recurso en este slot
                        AND NOT EXISTS (
                            SELECT 1 FROM availability_slots avs
                            WHERE avs.business_id = p_business_id
                            AND avs.resource_id = v_resource_id
                            AND avs.slot_date = v_current_date
                            AND avs.start_time = v_slot_time
                            AND avs.employee_id != v_employee.id -- Diferente empleado
                            AND avs.status IN ('free', 'reserved', 'blocked') -- Slot activo
                        ) THEN
                            -- =====================================================
                            -- PASO 10: Crear slot
                            -- =====================================================
                            -- ✅ CRÍTICO: Guardar employee_id además de resource_id
                            -- Los slots se generan por EMPLEADO, no por recurso
                            BEGIN
                                INSERT INTO availability_slots (
                                    business_id,
                                    employee_id,  -- ✅ NUEVO: Asociar slot al EMPLEADO
                                    resource_id,
                                    slot_date,
                                    start_time,
                                    end_time,
                                    status,
                                    duration_minutes,
                                    is_available
                                ) VALUES (
                                    p_business_id,
                                    v_employee.id,  -- ✅ NUEVO: ID del empleado que trabaja
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
                    END LOOP; -- Fin del loop de slots del turno
                END LOOP; -- Fin del loop de turnos (shifts)
                ELSE
                    -- ✅ COMPORTAMIENTO LEGACY: Si no hay shifts, usar start_time/end_time
                    -- (Para compatibilidad con horarios antiguos que no usan shifts)
                    IF v_schedule.start_time IS NULL OR v_schedule.end_time IS NULL THEN
                        RAISE WARNING 'Empleado % no tiene horario válido el día % (sin shifts ni start_time/end_time)', 
                            v_employee.name, v_current_date;
                        v_current_date := v_current_date + 1;
                        CONTINUE;
                    END IF;
                    
                    -- =====================================================
                    -- Obtener recurso asignado (manual o automático) para horario legacy
                    -- =====================================================
                    IF v_schedule.resource_id IS NOT NULL THEN
                        -- Asignación MANUAL
                        v_resource_id := v_schedule.resource_id;
                    ELSE
                        -- Asignación AUTOMÁTICA
                        BEGIN
                            -- 🚨 IMPORTANTE: Pasar la fecha actual para verificar conflictos en slots ya generados
                            v_resource_id := find_available_resource(
                                p_business_id,
                                v_employee.id,
                                v_day_of_week,
                                v_schedule.start_time,
                                v_schedule.end_time,
                                v_current_date -- 🆕 Pasar fecha para verificar slots ya generados
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
                        -- PASO 9: Verificar que no exista ya este slot Y que no haya conflicto
                        -- =====================================================
                        -- ✅ CRÍTICO: Verificar por EMPLEADO + RECURSO + FECHA + HORA
                        -- 🚨 ADICIONAL: Verificar que el recurso no esté siendo usado por otro empleado en este slot
                        IF NOT EXISTS (
                            SELECT 1 FROM availability_slots
                            WHERE business_id = p_business_id
                            AND employee_id = v_employee.id
                            AND resource_id = v_resource_id
                            AND slot_date = v_current_date
                            AND start_time = v_slot_time
                        )
                        -- 🚨 PROTECCIÓN: Verificar que ningún otro empleado ya tiene este recurso en este slot
                        AND NOT EXISTS (
                            SELECT 1 FROM availability_slots avs
                            WHERE avs.business_id = p_business_id
                            AND avs.resource_id = v_resource_id
                            AND avs.slot_date = v_current_date
                            AND avs.start_time = v_slot_time
                            AND avs.employee_id != v_employee.id -- Diferente empleado
                            AND avs.status IN ('free', 'reserved', 'blocked') -- Slot activo
                        ) THEN
                            -- =====================================================
                            -- PASO 10: Crear slot
                            -- =====================================================
                            -- ✅ CRÍTICO: Guardar employee_id además de resource_id
                            BEGIN
                                INSERT INTO availability_slots (
                                    business_id,
                                    employee_id,  -- ✅ NUEVO: Asociar slot al EMPLEADO
                                    resource_id,
                                    slot_date,
                                    start_time,
                                    end_time,
                                    status,
                                    duration_minutes,
                                    is_available
                                ) VALUES (
                                    p_business_id,
                                    v_employee.id,  -- ✅ NUEVO: ID del empleado que trabaja
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

COMMENT ON FUNCTION generate_availability_slots_employee_based IS 
'Genera slots de disponibilidad basándose en horarios de empleados, considerando:
- Ausencias de empleados (employee_absences)
- Días cerrados en el calendario (calendar_exceptions con is_open = false)
- Asignación de recursos (manual o automática)
IMPORTANTE: NO genera slots en días marcados como cerrados en calendar_exceptions.';

-- =====================================================
-- FUNCIÓN: Eliminar slots libres de días cerrados
-- =====================================================
-- Esta función puede ser llamada cuando se marca un día como cerrado
-- para limpiar los slots libres existentes de ese día

CREATE OR REPLACE FUNCTION cleanup_closed_day_slots(
    p_business_id UUID,
    p_exception_date DATE
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    -- Eliminar slots libres del día cerrado
    DELETE FROM availability_slots
    WHERE business_id = p_business_id
      AND slot_date = p_exception_date
      AND status = 'free'; -- ✅ SOLO LIBRES - Los reservados se mantienen
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    RETURN v_deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_closed_day_slots IS 
'Elimina slots libres de un día específico cuando se marca como cerrado en el calendario.
Los slots reservados se mantienen para historial.';

-- =====================================================
-- FUNCIÓN: Limpiar TODOS los slots de días cerrados
-- =====================================================
-- Esta función limpia todos los slots libres de días que están marcados como cerrados
-- Útil para corregir slots que se generaron incorrectamente antes de aplicar esta migración

CREATE OR REPLACE FUNCTION cleanup_all_closed_day_slots(
    p_business_id UUID DEFAULT NULL
)
RETURNS TABLE(
    exception_date DATE,
    deleted_slots INTEGER,
    reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_exception RECORD;
    v_deleted_count INTEGER;
BEGIN
    -- Loop por todas las excepciones de calendario cerradas
    FOR v_exception IN 
        SELECT DISTINCT
            ce.business_id,
            ce.exception_date,
            ce.reason
        FROM calendar_exceptions ce
        WHERE (p_business_id IS NULL OR ce.business_id = p_business_id)
        AND (ce.is_open = false OR ce.is_open IS NULL)
        ORDER BY ce.exception_date
    LOOP
        -- Eliminar slots libres del día cerrado
        DELETE FROM availability_slots
        WHERE business_id = v_exception.business_id
          AND slot_date = v_exception.exception_date
          AND status = 'free'; -- ✅ SOLO LIBRES - Los reservados se mantienen
        
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        
        -- Retornar resultado
        RETURN QUERY SELECT
            v_exception.exception_date,
            v_deleted_count,
            v_exception.reason;
    END LOOP;
END;
$$;

COMMENT ON FUNCTION cleanup_all_closed_day_slots IS 
'Limpia todos los slots libres de días marcados como cerrados en el calendario.
Si se proporciona p_business_id, solo limpia para ese negocio.
Si p_business_id es NULL, limpia para todos los negocios.
Útil para corregir slots generados incorrectamente antes de aplicar la verificación de calendario.';

-- =====================================================
-- TRIGGER: Limpiar slots cuando se marca un día como cerrado
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_cleanup_slots_on_closed_day()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted_count INTEGER;
    v_was_closed BOOLEAN;
    v_is_now_closed BOOLEAN;
BEGIN
    -- Determinar si el día estaba cerrado antes (para UPDATE)
    IF TG_OP = 'UPDATE' THEN
        v_was_closed := (OLD.is_open = false OR OLD.is_open IS NULL);
    ELSE
        v_was_closed := false;
    END IF;
    
    -- Determinar si el día está cerrado ahora
    v_is_now_closed := (NEW.is_open = false OR NEW.is_open IS NULL);
    
    -- Solo actuar si:
    -- 1. Es un INSERT y el día está cerrado, O
    -- 2. Es un UPDATE y el día pasó de abierto a cerrado
    IF (TG_OP = 'INSERT' AND v_is_now_closed) OR 
       (TG_OP = 'UPDATE' AND NOT v_was_closed AND v_is_now_closed) THEN
        -- Limpiar slots libres del día cerrado
        SELECT cleanup_closed_day_slots(NEW.business_id, NEW.exception_date) INTO v_deleted_count;
        
        RAISE NOTICE '🚫 Día % marcado como cerrado (razón: %). Eliminados % slots libres.', 
            NEW.exception_date, COALESCE(NEW.reason, 'Día cerrado'), v_deleted_count;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Crear trigger para calendar_exceptions
DROP TRIGGER IF EXISTS trigger_cleanup_slots_on_closed_day ON calendar_exceptions;
CREATE TRIGGER trigger_cleanup_slots_on_closed_day
    AFTER INSERT OR UPDATE ON calendar_exceptions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_cleanup_slots_on_closed_day();

COMMENT ON FUNCTION trigger_cleanup_slots_on_closed_day IS 
'Trigger que elimina automáticamente slots libres cuando se marca un día como cerrado en el calendario.';

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================

SELECT 'Migración 20251118_01_fix_calendar_exceptions_check completada' AS status;

