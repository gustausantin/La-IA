-- ========================================
-- SOLUCIÓN DEFINITIVA: NO CREAR SLOTS OCUPADOS
-- ========================================
-- Las reservas mandan: Si hay reserva, NO se crea el slot
-- ========================================

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
    v_table RECORD;
    v_has_exception BOOLEAN;
    v_exception_is_open BOOLEAN;
    v_exception_open_time TIME;
    v_exception_close_time TIME;
    v_has_reservations BOOLEAN;
    v_slot_is_occupied BOOLEAN;
    v_is_day_open BOOLEAN;
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
        
        -- 🛡️ PROTECCIÓN 2: Si el día tiene reservas activas, NO TOCAR NADA
        SELECT EXISTS(
            SELECT 1 FROM reservations
            WHERE restaurant_id = p_restaurant_id
              AND reservation_date = v_current_date
              AND status IN ('pending', 'confirmed', 'pending_approval', 'seated')
        ) INTO v_has_reservations;
        
        IF v_has_reservations THEN
            RAISE NOTICE '🛡️ Día % tiene reservas - INTOCABLE (se mantiene exactamente como está)', v_current_date;
            
            -- 🔥 CREAR EXCEPCIÓN para que el calendario frontend lo muestre correctamente
            -- Obtener el horario actual del día para preservarlo
            DECLARE
                v_current_open_time TIME;
                v_current_close_time TIME;
            BEGIN
                -- Intentar obtener horario de slots existentes
                SELECT MIN(start_time), MAX(end_time)
                INTO v_current_open_time, v_current_close_time
                FROM availability_slots
                WHERE restaurant_id = p_restaurant_id
                  AND slot_date = v_current_date
                  AND status IN ('free', 'reserved');
                
                -- Si no hay slots, usar horario del día de la semana
                IF v_current_open_time IS NULL THEN
                    v_day_of_week := EXTRACT(DOW FROM v_current_date);
                    v_day_config := CASE v_day_of_week
                        WHEN 0 THEN v_operating_hours->'sunday'
                        WHEN 1 THEN v_operating_hours->'monday'
                        WHEN 2 THEN v_operating_hours->'tuesday'
                        WHEN 3 THEN v_operating_hours->'wednesday'
                        WHEN 4 THEN v_operating_hours->'thursday'
                        WHEN 5 THEN v_operating_hours->'friday'
                        WHEN 6 THEN v_operating_hours->'saturday'
                    END;
                    v_current_open_time := (v_day_config->>'open')::TIME;
                    v_current_close_time := (v_day_config->>'close')::TIME;
                END IF;
                
                -- Crear/actualizar excepción
                INSERT INTO calendar_exceptions (
                    restaurant_id,
                    exception_date,
                    is_open,
                    open_time,
                    close_time,
                    reason,
                    created_by
                ) VALUES (
                    p_restaurant_id,
                    v_current_date,
                    TRUE,  -- Mantener abierto
                    v_current_open_time,
                    v_current_close_time,
                    'Día protegido automáticamente (tiene reservas activas)',
                    'system'
                )
                ON CONFLICT (restaurant_id, exception_date)
                DO UPDATE SET
                    is_open = TRUE,
                    open_time = EXCLUDED.open_time,
                    close_time = EXCLUDED.close_time,
                    reason = EXCLUDED.reason,
                    updated_at = NOW();
                
                RAISE NOTICE '🛡️ Excepción creada para % (horario: % - %)', v_current_date, v_current_open_time, v_current_close_time;
            END;
            
            -- NO borrar, NO crear, NO modificar NADA en slots
            -- Simplemente pasar al siguiente día
            v_days_protected := v_days_protected + 1;
            v_current_date := v_current_date + INTERVAL '1 day';
            CONTINUE;
        END IF;
        
        -- 3. Si NO hay reservas, borrar slots 'free' de este día
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
        
        -- 4. Si el día está abierto, generar slots
        IF v_is_open THEN
            FOR v_table IN 
                SELECT id, name FROM tables 
                WHERE restaurant_id = p_restaurant_id 
                  AND is_active = true
            LOOP
                v_current_time := v_open_time;
                
                WHILE v_current_time <= v_close_time LOOP
                    v_end_time := v_current_time + (v_reservation_duration || ' minutes')::INTERVAL;
                    
                    IF v_end_time <= v_close_time + INTERVAL '1 minute' THEN
                        -- Crear el slot (ya verificamos que el día NO tiene reservas)
                        INSERT INTO availability_slots (
                            restaurant_id,
                            slot_date,
                            start_time,
                            end_time,
                            table_id,
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
    
    RAISE NOTICE '✅ Slots creados: % | 🛡️ Días protegidos: %', v_slots_created, v_days_protected;
    
    -- 4. 🔥 MARCAR SLOTS OCUPADOS POR RESERVAS
    -- Ahora que creamos los slots, marcar como 'reserved' los que tienen reservas
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
        -- Marcar slots que empiezan dentro del rango de la reserva
        AND als.start_time >= r.reservation_time
        AND als.start_time < r.reservation_time + (v_reservation_duration || ' minutes')::INTERVAL;
    
    GET DIAGNOSTICS v_slots_marked = ROW_COUNT;
    RAISE NOTICE '🔴 Slots marcados como reserved: %', v_slots_marked;
    
    -- 5. Retornar resultado
    RETURN jsonb_build_object(
        'success', true,
        'message', format('Regeneración completada: %s slots creados, %s marcados como ocupados, %s días protegidos', 
                         v_slots_created, v_slots_marked, v_days_protected),
        'slots_created', v_slots_created,
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
'Regenera slots protegiendo días completos con reservas. Si un día tiene reservas, NO SE TOCA NADA: se mantiene exactamente como está.';

-- ========================================
-- MIGRACIÓN COMPLETADA ✅
-- Ahora NO se crean slots ocupados
-- ========================================
