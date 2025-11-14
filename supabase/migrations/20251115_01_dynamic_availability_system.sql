    -- =====================================================
    -- MIGRACIÓN: SISTEMA DE DISPONIBILIDAD DINÁMICO COMPLETO
    -- Fecha: 2025-11-15
    -- Objetivo: Sistema automático de generación y mantenimiento de slots
    --           con protección total de reservas existentes
    -- =====================================================

    -- =====================================================
    -- PARTE 1: MANTENIMIENTO AUTOMÁTICO DIARIO
    -- =====================================================
    -- Cada día a las 4 AM, agregar 1 día nuevo al final del rango
    -- Mantener siempre exactamente N días disponibles (según configuración)
    -- =====================================================

    CREATE OR REPLACE FUNCTION maintenance_availability_slots_daily()
    RETURNS TABLE(
        business_id UUID,
        slots_added INTEGER,
        slots_cleaned INTEGER,
        message TEXT
    ) 
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    DECLARE
        v_business RECORD;
        v_settings JSONB;
        v_advance_days INTEGER;
        v_current_max_date DATE;
        v_new_date DATE;
        v_slots_added INTEGER;
        v_slots_cleaned INTEGER;
        v_result RECORD;
    BEGIN
        -- Para cada negocio activo
        FOR v_business IN 
            SELECT id, settings
            FROM businesses
            WHERE is_active = true
        LOOP
            v_slots_added := 0;
            v_slots_cleaned := 0;
            
            -- Obtener configuración de días de antelación
            v_settings := v_business.settings;
            v_advance_days := COALESCE((v_settings->>'advance_booking_days')::INTEGER, 30);
            
            -- 1. Limpiar slots pasados (más de 1 día, solo libres)
            DELETE FROM availability_slots
            WHERE business_id = v_business.id
            AND slot_date < CURRENT_DATE - INTERVAL '1 day'
            AND status = 'free';
            
            GET DIAGNOSTICS v_slots_cleaned = ROW_COUNT;
            
            -- 2. Encontrar la fecha máxima actual con slots
            SELECT MAX(slot_date) INTO v_current_max_date
            FROM availability_slots
            WHERE business_id = v_business.id;
            
            -- Si no hay slots, generar desde hoy
            IF v_current_max_date IS NULL THEN
                v_current_max_date := CURRENT_DATE - 1;
            END IF;
            
            -- 3. Calcular fecha objetivo (hoy + días de antelación)
            v_new_date := CURRENT_DATE + (v_advance_days || ' days')::INTERVAL;
            
            -- 4. Si la fecha máxima es menor que la objetivo, generar días faltantes
            IF v_current_max_date < v_new_date THEN
                -- Generar solo los días nuevos (sin regenerar existentes)
                SELECT * INTO v_result
                FROM generate_availability_slots_employee_based(
                    v_business.id,
                    v_current_max_date + 1, -- Empezar desde el día siguiente al máximo
                    (v_new_date - v_current_max_date)::INTEGER, -- Días a generar
                    FALSE -- NO regenerar, solo añadir nuevos
                );
                
                v_slots_added := COALESCE(v_result.total_slots_generated, 0);
            END IF;
            
            -- Retornar resultado
            RETURN QUERY SELECT
                v_business.id,
                v_slots_added,
                v_slots_cleaned,
                format('Negocio %s: %s slots añadidos, %s slots limpiados', 
                    v_business.id, 
                    v_slots_added, 
                    v_slots_cleaned
                );
        END LOOP;
    END;
    $$;

    -- Programar cron job (requiere extensión pg_cron)
    -- NOTA: En Supabase, los cron jobs se programan desde el dashboard o usando SQL directo
    -- Si pg_cron está disponible, descomentar y ejecutar manualmente:
    /*
    SELECT cron.schedule(
        'maintenance-availability-slots-daily',
        '0 4 * * *', -- 4 AM diario
        'SELECT maintenance_availability_slots_daily();'
    );
    */

    -- Alternativa: Crear función que se puede llamar manualmente o desde un trigger
    -- Esta función se puede ejecutar manualmente o programar externamente
    COMMENT ON FUNCTION maintenance_availability_slots_daily IS 
    'Función de mantenimiento diario. Ejecutar cada día a las 4 AM. 
    Para programar automáticamente, usar pg_cron o programador externo.
    Ejecutar manualmente: SELECT maintenance_availability_slots_daily();';

    -- =====================================================
    -- PARTE 2: VALIDACIÓN DE MINUTOS DE ANTELACIÓN MÍNIMA
    -- =====================================================

    CREATE OR REPLACE FUNCTION validate_min_advance_time(
        p_business_id UUID,
        p_appointment_date DATE,
        p_appointment_time TIME
    )
    RETURNS TABLE(
        is_valid BOOLEAN,
        reason TEXT,
        min_advance_minutes INTEGER,
        actual_minutes INTEGER
    ) 
    LANGUAGE plpgsql
    STABLE
    AS $$
    DECLARE
        v_settings JSONB;
        v_min_advance_minutes INTEGER;
        v_appointment_datetime TIMESTAMP;
        v_now TIMESTAMP;
        v_actual_minutes INTEGER;
    BEGIN
        -- Obtener configuración del negocio
        SELECT settings INTO v_settings
        FROM businesses
        WHERE id = p_business_id;
        
        -- Obtener minutos de antelación mínima
        v_min_advance_minutes := COALESCE(
            (v_settings->>'min_advance_minutes')::INTEGER,
            60 -- Default: 60 minutos (1 hora)
        );
        
        -- Calcular datetime de la reserva
        v_appointment_datetime := (p_appointment_date || ' ' || p_appointment_time)::TIMESTAMP;
        v_now := NOW();
        
        -- Calcular minutos hasta la reserva
        v_actual_minutes := EXTRACT(EPOCH FROM (v_appointment_datetime - v_now))::INTEGER / 60;
        
        -- Validar
        IF v_actual_minutes < v_min_advance_minutes THEN
            RETURN QUERY SELECT
                FALSE AS is_valid,
                format('La reserva debe hacerse con al menos %s minutos de antelación. Tiempo actual: %s minutos', 
                    v_min_advance_minutes, 
                    v_actual_minutes
                ) AS reason,
                v_min_advance_minutes,
                v_actual_minutes;
        ELSE
            RETURN QUERY SELECT
                TRUE AS is_valid,
                'Tiempo de antelación válido' AS reason,
                v_min_advance_minutes,
                v_actual_minutes;
        END IF;
    END;
    $$;

    -- =====================================================
    -- PARTE 3: PROTECCIÓN DE RESERVAS AL CERRAR DÍAS
    -- =====================================================

    CREATE OR REPLACE FUNCTION check_reservations_before_close_day(
        p_business_id UUID,
        p_date DATE,
        p_start_time TIME DEFAULT NULL,
        p_end_time TIME DEFAULT NULL
    )
    RETURNS TABLE(
        has_reservations BOOLEAN,
        reservation_count INTEGER,
        reservations JSONB
    ) 
    LANGUAGE plpgsql
    STABLE
    AS $$
    DECLARE
        v_reservations JSONB;
        v_count INTEGER;
    BEGIN
        -- Buscar reservas confirmadas o pendientes en esta fecha
        SELECT 
            jsonb_agg(
                jsonb_build_object(
                    'id', a.id,
                    'customer_name', a.customer_name,
                    'appointment_date', a.appointment_date,
                    'appointment_time', a.appointment_time,
                    'status', a.status,
                    'resource_id', a.resource_id
                )
            ),
            COUNT(*)
        INTO v_reservations, v_count
        FROM appointments a
        WHERE a.business_id = p_business_id
        AND a.appointment_date = p_date
        AND a.status IN ('confirmed', 'pending');
        
        -- Si hay horas específicas, filtrar por rango
        IF p_start_time IS NOT NULL AND p_end_time IS NOT NULL THEN
            SELECT 
                jsonb_agg(elem),
                COUNT(*)
            INTO v_reservations, v_count
            FROM jsonb_array_elements(COALESCE(v_reservations, '[]'::jsonb)) AS elem
            WHERE (elem->>'appointment_time')::TIME >= p_start_time
            AND (elem->>'appointment_time')::TIME < p_end_time;
        END IF;
        
        RETURN QUERY SELECT
            COALESCE(v_count, 0) > 0 AS has_reservations,
            COALESCE(v_count, 0) AS reservation_count,
            COALESCE(v_reservations, '[]'::jsonb) AS reservations;
    END;
    $$;

    -- =====================================================
    -- PARTE 3.5: FUNCIÓN PARA OBTENER FECHAS ÚNICAS DE SLOTS
    -- =====================================================

    CREATE OR REPLACE FUNCTION get_unique_slot_dates(
        p_business_id UUID,
        p_from_date DATE DEFAULT CURRENT_DATE
    )
    RETURNS TABLE(
        slot_date DATE,
        slots_count BIGINT
    ) 
    LANGUAGE plpgsql
    STABLE
    AS $$
    BEGIN
        RETURN QUERY
        SELECT
            a.slot_date,
            COUNT(*)::BIGINT AS slots_count
        FROM availability_slots a
        WHERE a.business_id = p_business_id
        AND a.slot_date >= p_from_date
        GROUP BY a.slot_date
        ORDER BY a.slot_date;
    END;
    $$;

    -- =====================================================
    -- PARTE 4: FUNCIÓN MEJORADA PARA CONSULTAR HORARIOS DE UN DÍA
    -- =====================================================

    CREATE OR REPLACE FUNCTION get_day_availability_details(
        p_business_id UUID,
        p_date DATE
    )
    RETURNS TABLE(
        slot_time TIME,
        end_time TIME,
        resource_id UUID,
        resource_name TEXT,
        employee_id UUID,
        employee_name TEXT,
        status TEXT,
        has_appointment BOOLEAN,
        appointment_id UUID,
        customer_name TEXT,
        duration_minutes INTEGER
    ) 
    LANGUAGE plpgsql
    STABLE
    AS $$
    BEGIN
        RETURN QUERY
        SELECT
            a.start_time AS slot_time,
            a.end_time,
            a.resource_id,
            COALESCE(r.name::TEXT, 'Sin recurso') AS resource_name, -- ✅ CAST a TEXT
            e.id AS employee_id,
            COALESCE(e.name::TEXT, NULL) AS employee_name, -- ✅ CAST a TEXT
            a.status::TEXT,
            (a.status IN ('reserved', 'booked')) AS has_appointment,
            app.id AS appointment_id,
            app.customer_name::TEXT,
            a.duration_minutes
        FROM availability_slots a
        LEFT JOIN resources r ON r.id = a.resource_id
        LEFT JOIN employees e ON (
            e.assigned_resource_id = a.resource_id 
            OR e.id IN (
                SELECT es.employee_id 
                FROM employee_schedules es 
                WHERE es.resource_id = a.resource_id
                AND es.day_of_week = EXTRACT(DOW FROM p_date)
                LIMIT 1
            )
        )
        LEFT JOIN appointments app ON (
            app.business_id = a.business_id
            AND app.resource_id = a.resource_id
            AND app.appointment_date = a.slot_date
            AND app.appointment_time = a.start_time
            AND app.status IN ('confirmed', 'pending')
        )
        WHERE a.business_id = p_business_id
        AND a.slot_date = p_date
        ORDER BY a.start_time, r.name;
    END;
    $$;

    -- =====================================================
    -- PARTE 5: TRIGGERS PARA REGENERACIÓN AUTOMÁTICA
    -- =====================================================

    -- Trigger: Cambios en configuración de días de antelación
    CREATE OR REPLACE FUNCTION trigger_regenerate_on_advance_days_change()
    RETURNS TRIGGER AS $$
    DECLARE
        v_old_days INTEGER;
        v_new_days INTEGER;
        v_business_id UUID;
        v_result RECORD;
    BEGIN
        v_business_id := NEW.id;
        
        -- Extraer días de antelación
        v_old_days := COALESCE((OLD.settings->>'advance_booking_days')::INTEGER, 30);
        v_new_days := COALESCE((NEW.settings->>'advance_booking_days')::INTEGER, 30);
        
        -- Solo actuar si cambió
        IF v_old_days IS DISTINCT FROM v_new_days THEN
            RAISE NOTICE 'Cambio detectado en días de antelación: % -> %', v_old_days, v_new_days;
            
            IF v_new_days > v_old_days THEN
                -- AUMENTAR: Generar días adicionales
                RAISE NOTICE 'Generando % días adicionales...', (v_new_days - v_old_days);
                
                SELECT * INTO v_result
                FROM generate_availability_slots_employee_based(
                    v_business_id,
                    CURRENT_DATE + (v_old_days || ' days')::INTERVAL + 1, -- Empezar desde el día siguiente al máximo actual
                    (v_new_days - v_old_days), -- Días adicionales a generar
                    FALSE -- No regenerar, solo añadir
                );
                
                RAISE NOTICE 'Días adicionales generados: %', v_result.message;
                
            ELSIF v_new_days < v_old_days THEN
                -- DISMINUIR: Eliminar solo slots libres fuera del rango
                DELETE FROM availability_slots
                WHERE business_id = v_business_id
                AND slot_date > CURRENT_DATE + (v_new_days || ' days')::INTERVAL
                AND status = 'free'; -- ⚠️ SOLO LIBRES (protección de reservas)
                
                RAISE NOTICE 'Slots libres eliminados fuera del nuevo rango';
            END IF;
        END IF;
        
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- Crear trigger si no existe
    DROP TRIGGER IF EXISTS after_business_advance_days_change ON businesses;
    CREATE TRIGGER after_business_advance_days_change
        AFTER UPDATE ON businesses
        FOR EACH ROW
        WHEN (
            OLD.settings->>'advance_booking_days' IS DISTINCT FROM NEW.settings->>'advance_booking_days'
        )
        EXECUTE FUNCTION trigger_regenerate_on_advance_days_change();

    -- Trigger: Cambios en horarios de empleados
    CREATE OR REPLACE FUNCTION trigger_regenerate_on_employee_schedule_change()
    RETURNS TRIGGER AS $$
    DECLARE
        v_business_id UUID;
        v_employee_id UUID;
        v_result RECORD;
        v_advance_days INTEGER;
        v_settings JSONB;
    BEGIN
        -- Obtener business_id y employee_id
        IF TG_OP = 'DELETE' THEN
            v_employee_id := OLD.employee_id;
            SELECT business_id INTO v_business_id FROM employees WHERE id = v_employee_id;
        ELSE
            v_employee_id := NEW.employee_id;
            SELECT business_id INTO v_business_id FROM employees WHERE id = v_employee_id;
        END IF;
        
        IF v_business_id IS NULL THEN
            RETURN COALESCE(NEW, OLD);
        END IF;
        
        -- Obtener días de antelación
        SELECT settings INTO v_settings FROM businesses WHERE id = v_business_id;
        v_advance_days := COALESCE((v_settings->>'advance_booking_days')::INTEGER, 30);
        
        -- Regenerar slots para este empleado (solo libres)
        SELECT * INTO v_result
        FROM generate_availability_slots_employee_based(
            v_business_id,
            CURRENT_DATE,
            v_advance_days,
            TRUE -- Regenerar (solo libres)
        );
        
        RAISE NOTICE 'Slots regenerados después de cambio en horario de empleado: %', v_result.message;
        
        RETURN COALESCE(NEW, OLD);
    END;
    $$ LANGUAGE plpgsql;

    -- Crear trigger si no existe
    DROP TRIGGER IF EXISTS after_employee_schedule_change ON employee_schedules;
    CREATE TRIGGER after_employee_schedule_change
        AFTER INSERT OR UPDATE OR DELETE ON employee_schedules
        FOR EACH ROW
        EXECUTE FUNCTION trigger_regenerate_on_employee_schedule_change();

    -- Trigger: Cambios en estado de empleados (activar/desactivar)
    CREATE OR REPLACE FUNCTION trigger_regenerate_on_employee_status_change()
    RETURNS TRIGGER AS $$
    DECLARE
        v_result RECORD;
        v_advance_days INTEGER;
        v_settings JSONB;
    BEGIN
        -- Solo actuar si cambió is_active
        IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
            -- Obtener días de antelación
            SELECT settings INTO v_settings FROM businesses WHERE id = NEW.business_id;
            v_advance_days := COALESCE((v_settings->>'advance_booking_days')::INTEGER, 30);
            
            -- Regenerar slots (solo libres)
            SELECT * INTO v_result
            FROM generate_availability_slots_employee_based(
                NEW.business_id,
                CURRENT_DATE,
                v_advance_days,
                TRUE -- Regenerar (solo libres)
            );
            
            RAISE NOTICE 'Slots regenerados después de cambio de estado de empleado: %', v_result.message;
        END IF;
        
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- Crear trigger si no existe
    DROP TRIGGER IF EXISTS after_employee_status_change ON employees;
    CREATE TRIGGER after_employee_status_change
        AFTER UPDATE ON employees
        FOR EACH ROW
        WHEN (OLD.is_active IS DISTINCT FROM NEW.is_active)
        EXECUTE FUNCTION trigger_regenerate_on_employee_status_change();

    -- =====================================================
    -- COMENTARIOS
    -- =====================================================

    COMMENT ON FUNCTION maintenance_availability_slots_daily IS 
    'Mantenimiento automático diario: limpia slots pasados y añade 1 día nuevo al final del rango. Ejecutar cada día a las 4 AM.';

    COMMENT ON FUNCTION validate_min_advance_time IS 
    'Valida que una reserva cumpla con el tiempo mínimo de antelación configurado en el negocio.';

    COMMENT ON FUNCTION check_reservations_before_close_day IS 
    'Verifica si hay reservas confirmadas o pendientes en una fecha/hora antes de permitir cerrar el día.';

    COMMENT ON FUNCTION get_day_availability_details IS 
    'Consulta detallada de todos los slots de disponibilidad para un día específico, incluyendo información de recursos, empleados y reservas.';

    -- =====================================================
    -- FIN DE LA MIGRACIÓN
    -- =====================================================

    SELECT 'Migración 20251115_01_dynamic_availability_system completada' AS status;

