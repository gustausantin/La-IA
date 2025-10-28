-- =====================================================
-- FIX: PERMITIR AÑADIR HORAS EN DÍAS CON RESERVAS
-- =====================================================
-- Fecha: 22 Octubre 2025
-- Problema: Si un día tiene reservas, NO se pueden añadir horas nuevas
-- Solución: Detectar horarios nuevos y crear slots SOLO en esos rangos
-- =====================================================

CREATE OR REPLACE FUNCTION cleanup_and_regenerate_availability(
    p_restaurant_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_settings JSONB;
    v_operating_hours JSONB;
    v_slot_interval INTEGER;
    v_reservation_duration INTEGER;
    v_current_date DATE;
    v_day_of_week INTEGER;
    v_day_config JSONB;
    v_is_open BOOLEAN;
    v_open_time TIME;
    v_close_time TIME;
    v_current_time TIME;
    v_end_time TIME;
    v_slots_created INTEGER := 0;
    v_slots_deleted INTEGER := 0;
    v_deleted_today INTEGER;
    v_days_protected INTEGER := 0;
    v_slots_marked INTEGER := 0;
    v_slots_added_to_reserved_days INTEGER := 0;
    v_table RECORD;
    v_has_exception BOOLEAN;
    v_exception_is_open BOOLEAN;
    v_exception_open_time TIME;
    v_exception_close_time TIME;
    v_has_reservations BOOLEAN;
    v_is_day_open BOOLEAN;
    v_existing_min_time TIME;
    v_existing_max_time TIME;
BEGIN
    -- 1. Obtener configuración del restaurante
    SELECT settings INTO v_settings
    FROM businesses
    WHERE id = p_restaurant_id;
    
    IF v_settings IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Restaurante no encontrado o sin configuración'
        );
    END IF;
    
    -- Extraer configuraciones
    v_operating_hours := v_settings->'operating_hours';
    v_slot_interval := COALESCE((v_settings->>'slot_interval')::INTEGER, 30);
    v_reservation_duration := COALESCE((v_settings->>'reservation_duration')::INTEGER, 90);
    
    RAISE NOTICE '🔧 Configuración: interval=% min, duration=% min', v_slot_interval, v_reservation_duration;
    
    -- 2. Iterar por cada día
    v_current_date := p_start_date;
    
    WHILE v_current_date <= p_end_date LOOP
        -- 🛡️ PROTECCIÓN 1: Si el día está cerrado manualmente en calendario, SALTAR
        SELECT is_open INTO v_is_day_open
        FROM calendar_exceptions
        WHERE restaurant_id = p_restaurant_id
          AND exception_date = v_current_date;
        
        IF v_is_day_open IS NOT NULL AND v_is_day_open = FALSE THEN
            RAISE NOTICE '🚫 Día % está CERRADO manualmente (vacaciones/festivo) - SALTADO', v_current_date;
            v_days_protected := v_days_protected + 1;
            v_current_date := v_current_date + 1;
            CONTINUE;
        END IF;
        
        -- 🛡️ PROTECCIÓN 2: Verificar si el día tiene reservas activas
        SELECT EXISTS(
            SELECT 1 FROM reservations
            WHERE restaurant_id = p_restaurant_id
              AND reservation_date = v_current_date
              AND status IN ('pending', 'confirmed', 'pending_approval', 'seated')
        ) INTO v_has_reservations;
        
        -- ✨ NUEVA LÓGICA: Si hay reservas, NO borrar, SOLO añadir horas nuevas
        IF v_has_reservations THEN
            RAISE NOTICE '🛡️ Día % tiene reservas - NO se borra nada, solo se AÑADEN horas nuevas', v_current_date;
            
            -- Detectar el rango horario EXISTENTE (min y max)
            SELECT MIN(start_time), MAX(end_time)
            INTO v_existing_min_time, v_existing_max_time
            FROM availability_slots
            WHERE restaurant_id = p_restaurant_id
              AND slot_date = v_current_date;
            
            RAISE NOTICE '⏰ Horario existente: % - %', v_existing_min_time, v_existing_max_time;
            
            -- Obtener día de la semana
            v_day_of_week := EXTRACT(DOW FROM v_current_date);
            
            -- Verificar excepción
            SELECT 
                TRUE,
                is_open,
                open_time,
                close_time
            INTO 
                v_has_exception,
                v_exception_is_open,
                v_exception_open_time,
                v_exception_close_time
            FROM calendar_exceptions
            WHERE restaurant_id = p_restaurant_id
              AND exception_date = v_current_date;
            
            -- Determinar horarios NUEVOS
            IF v_has_exception THEN
                v_is_open := v_exception_is_open;
                v_open_time := v_exception_open_time;
                v_close_time := v_exception_close_time;
            ELSE
                v_day_config := CASE v_day_of_week
                    WHEN 0 THEN v_operating_hours->'sunday'
                    WHEN 1 THEN v_operating_hours->'monday'
                    WHEN 2 THEN v_operating_hours->'tuesday'
                    WHEN 3 THEN v_operating_hours->'wednesday'
                    WHEN 4 THEN v_operating_hours->'thursday'
                    WHEN 5 THEN v_operating_hours->'friday'
                    WHEN 6 THEN v_operating_hours->'saturday'
                END;
                
                v_is_open := NOT COALESCE((v_day_config->>'closed')::BOOLEAN, false);
                v_open_time := (v_day_config->>'open')::TIME;
                v_close_time := (v_day_config->>'close')::TIME;
            END IF;
            
            RAISE NOTICE '⏰ Horario NUEVO configurado: % - %', v_open_time, v_close_time;
            
            -- ✨ CREAR SLOTS EN RANGOS NUEVOS (que antes NO existían)
            IF v_is_open AND v_existing_min_time IS NOT NULL THEN
                FOR v_table IN 
                    SELECT id, name, capacity FROM tables 
                    WHERE restaurant_id = p_restaurant_id 
                      AND is_active = true
                LOOP
                    -- RANGO 1: Crear slots ANTES del horario existente (si el nuevo open es más temprano)
                    IF v_open_time < v_existing_min_time THEN
                        RAISE NOTICE '➕ Añadiendo slots ANTES: % - %', v_open_time, v_existing_min_time;
                        v_current_time := v_open_time;
                        
                        WHILE v_current_time < v_existing_min_time LOOP
                            v_end_time := v_current_time + (v_reservation_duration || ' minutes')::INTERVAL;
                            
                            IF v_end_time <= v_close_time + INTERVAL '1 minute' THEN
                                INSERT INTO availability_slots (
                                    restaurant_id,
                                    slot_date,
                                    start_time,
                                    end_time,
                                    table_id,
                                    table_name,
                                    capacity,
                                    status,
                                    is_available,
                                    duration_minutes,
                                    source,
                                    created_at,
                                    updated_at
                                ) VALUES (
                                    p_restaurant_id,
                                    v_current_date,
                                    v_current_time,
                                    v_end_time,
                                    v_table.id,
                                    v_table.name,
                                    v_table.capacity,
                                    'free',
                                    true,
                                    v_reservation_duration,
                                    'system',
                                    NOW(),
                                    NOW()
                                )
                                ON CONFLICT (restaurant_id, slot_date, start_time, table_id) 
                                DO NOTHING;
                                
                                v_slots_added_to_reserved_days := v_slots_added_to_reserved_days + 1;
                            END IF;
                            
                            v_current_time := v_current_time + (v_slot_interval || ' minutes')::INTERVAL;
                        END LOOP;
                    END IF;
                    
                    -- RANGO 2: Crear slots DESPUÉS del horario existente (si el nuevo close es más tarde)
                    IF v_close_time > v_existing_max_time THEN
                        RAISE NOTICE '➕ Añadiendo slots DESPUÉS: % - %', v_existing_max_time, v_close_time;
                        v_current_time := v_existing_max_time;
                        
                        WHILE v_current_time <= v_close_time LOOP
                            v_end_time := v_current_time + (v_reservation_duration || ' minutes')::INTERVAL;
                            
                            IF v_end_time <= v_close_time + INTERVAL '1 minute' THEN
                                INSERT INTO availability_slots (
                                    restaurant_id,
                                    slot_date,
                                    start_time,
                                    end_time,
                                    table_id,
                                    capacity,
                                    table_name,
                                    status,
                                    is_available,
                                    duration_minutes,
                                    source,
                                    created_at,
                                    updated_at
                                ) VALUES (
                                    p_restaurant_id,
                                    v_current_date,
                                    v_current_time,
                                    v_end_time,
                                    v_table.id,
                                    v_table.capacity,
                                    v_table.name,
                                    'free',
                                    true,
                                    v_reservation_duration,
                                    'system',
                                    NOW(),
                                    NOW()
                                )
                                ON CONFLICT (restaurant_id, slot_date, start_time, table_id) 
                                DO NOTHING;
                                
                                v_slots_added_to_reserved_days := v_slots_added_to_reserved_days + 1;
                            END IF;
                            
                            v_current_time := v_current_time + (v_slot_interval || ' minutes')::INTERVAL;
                        END LOOP;
                    END IF;
                END LOOP;
            END IF;
            
            -- Marcar día como protegido (no se borró nada)
            v_days_protected := v_days_protected + 1;
            v_current_date := v_current_date + INTERVAL '1 day';
            CONTINUE;
        END IF;
        
        -- 3. Si NO hay reservas, borrar slots 'free' de este día (LÓGICA ANTIGUA SIN CAMBIOS)
        DELETE FROM availability_slots
        WHERE restaurant_id = p_restaurant_id
          AND slot_date = v_current_date
          AND status = 'free';
        
        GET DIAGNOSTICS v_deleted_today = ROW_COUNT;
        v_slots_deleted := v_slots_deleted + v_deleted_today;
        
        -- Obtener día de la semana
        v_day_of_week := EXTRACT(DOW FROM v_current_date);
        
        -- Verificar excepción
        SELECT 
            TRUE,
            is_open,
            open_time,
            close_time
        INTO 
            v_has_exception,
            v_exception_is_open,
            v_exception_open_time,
            v_exception_close_time
        FROM calendar_exceptions
        WHERE restaurant_id = p_restaurant_id
          AND exception_date = v_current_date;
        
        -- Determinar horarios
        IF v_has_exception THEN
            v_is_open := v_exception_is_open;
            v_open_time := v_exception_open_time;
            v_close_time := v_exception_close_time;
        ELSE
            v_day_config := CASE v_day_of_week
                WHEN 0 THEN v_operating_hours->'sunday'
                WHEN 1 THEN v_operating_hours->'monday'
                WHEN 2 THEN v_operating_hours->'tuesday'
                WHEN 3 THEN v_operating_hours->'wednesday'
                WHEN 4 THEN v_operating_hours->'thursday'
                WHEN 5 THEN v_operating_hours->'friday'
                WHEN 6 THEN v_operating_hours->'saturday'
            END;
            
            v_is_open := NOT COALESCE((v_day_config->>'closed')::BOOLEAN, false);
            v_open_time := (v_day_config->>'open')::TIME;
            v_close_time := (v_day_config->>'close')::TIME;
        END IF;
        
        -- 4. Si el día está abierto, generar slots (LÓGICA ANTIGUA SIN CAMBIOS)
        IF v_is_open THEN
            FOR v_table IN 
                SELECT id, name, capacity FROM tables 
                WHERE restaurant_id = p_restaurant_id 
                  AND is_active = true
            LOOP
                v_current_time := v_open_time;
                
                WHILE v_current_time <= v_close_time LOOP
                    v_end_time := v_current_time + (v_reservation_duration || ' minutes')::INTERVAL;
                    
                    IF v_end_time <= v_close_time + INTERVAL '1 minute' THEN
                        INSERT INTO availability_slots (
                            restaurant_id,
                            slot_date,
                            start_time,
                            end_time,
                            table_id,
                            capacity,
                            table_name,
                            status,
                            is_available,
                            duration_minutes,
                            source,
                            created_at,
                            updated_at
                        ) VALUES (
                            p_restaurant_id,
                            v_current_date,
                            v_current_time,
                            v_end_time,
                            v_table.id,
                            v_table.capacity,
                            v_table.name,
                            'free',
                            true,
                            v_reservation_duration,
                            'system',
                            NOW(),
                            NOW()
                        )
                        ON CONFLICT (restaurant_id, slot_date, start_time, table_id) 
                        DO NOTHING;
                        
                        v_slots_created := v_slots_created + 1;
                    END IF;
                    
                    v_current_time := v_current_time + (v_slot_interval || ' minutes')::INTERVAL;
                END LOOP;
            END LOOP;
        END IF;
        
        v_current_date := v_current_date + INTERVAL '1 day';
    END LOOP;
    
    RAISE NOTICE '✅ Slots creados: % | ➕ Slots añadidos a días con reservas: % | 🛡️ Días protegidos: %', 
                 v_slots_created, v_slots_added_to_reserved_days, v_days_protected;
    
    -- 5. 🔥 MARCAR SLOTS OCUPADOS POR RESERVAS (LÓGICA ANTIGUA SIN CAMBIOS)
    UPDATE availability_slots AS als
    SET
        status = 'reserved',
        is_available = FALSE,
        updated_at = NOW()
    FROM reservations AS r
    JOIN reservation_tables AS rt ON r.id = rt.reservation_id
    WHERE
        als.restaurant_id = p_restaurant_id
        AND als.restaurant_id = r.restaurant_id
        AND als.table_id = rt.table_id
        AND als.slot_date = r.reservation_date
        AND als.slot_date BETWEEN p_start_date AND p_end_date
        AND r.status IN ('pending', 'confirmed', 'pending_approval', 'seated')
        AND als.start_time >= r.reservation_time
        AND als.start_time < r.reservation_time + (v_reservation_duration || ' minutes')::INTERVAL;
    
    GET DIAGNOSTICS v_slots_marked = ROW_COUNT;
    RAISE NOTICE '🔴 Slots marcados como reserved: %', v_slots_marked;
    
    -- 6. Retornar resultado
    RETURN jsonb_build_object(
        'success', true,
        'message', format('Regeneración completada: %s slots creados, %s añadidos a días con reservas, %s marcados como ocupados, %s días protegidos', 
                         v_slots_created, v_slots_added_to_reserved_days, v_slots_marked, v_days_protected),
        'slots_created', v_slots_created,
        'slots_added_to_reserved_days', v_slots_added_to_reserved_days,
        'slots_deleted', v_slots_deleted,
        'slots_marked_reserved', v_slots_marked,
        'days_protected', v_days_protected,
        'date_range', jsonb_build_object(
            'start', p_start_date,
            'end', p_end_date
        ),
        'exceptions_respected', true
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'detail', SQLSTATE
        );
END;
$$;

COMMENT ON FUNCTION cleanup_and_regenerate_availability IS 
'Regenera slots protegiendo días con reservas. Si un día tiene reservas, NO SE BORRA NADA, solo se AÑADEN horas nuevas fuera del rango existente.';

-- =====================================================
-- MIGRACIÓN COMPLETADA ✅
-- =====================================================
-- CAMBIOS:
-- 1. Si día SIN reservas: borra y regenera (igual que antes)
-- 2. Si día CON reservas:
--    - NO borra nada (protección total)
--    - SÍ añade slots en horarios nuevos (antes NO existían)
--    - Detecta rango existente (MIN/MAX)
--    - Crea slots ANTES del MIN si el nuevo open es más temprano
--    - Crea slots DESPUÉS del MAX si el nuevo close es más tarde
-- =====================================================

