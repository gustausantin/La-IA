-- =====================================================
-- FIX: COMPATIBILIDAD DE OPERATING_HOURS
-- Fecha: 17 Octubre 2025
-- Problema: Función SQL espera "isOpen" pero frontend usa "closed"
-- Solución: Función robusta que acepta AMBOS formatos
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
    v_table RECORD;
    v_has_reservations BOOLEAN;
    v_is_day_open BOOLEAN;
BEGIN
    -- 1. Obtener configuración del restaurante
    SELECT settings INTO v_settings
    FROM restaurants
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
            v_days_protected := v_days_protected + 1;
            v_current_date := v_current_date + 1;
            CONTINUE;
        END IF;
        
        -- 3. BORRAR slots LIBRES del día si vamos a regenerar
        DELETE FROM availability_slots
        WHERE restaurant_id = p_restaurant_id
          AND slot_date = v_current_date
          AND status = 'free';
        
        GET DIAGNOSTICS v_deleted_today = ROW_COUNT;
        v_slots_deleted := v_slots_deleted + v_deleted_today;
        
        IF v_deleted_today > 0 THEN
            RAISE NOTICE '🧹 Eliminados % slots libres del día %', v_deleted_today, v_current_date;
        END IF;
        
        -- 4. Obtener configuración del día de la semana
        v_day_of_week := EXTRACT(DOW FROM v_current_date); -- 0=domingo, 6=sábado
        
        -- Mapeo de días: domingo=0, lunes=1, ..., sábado=6
        -- Pero operating_hours usa: monday, tuesday, ..., sunday
        DECLARE
            v_day_name TEXT;
            v_is_open_field BOOLEAN;
            v_closed_field BOOLEAN;
        BEGIN
            v_day_name := CASE v_day_of_week
                WHEN 0 THEN 'sunday'
                WHEN 1 THEN 'monday'
                WHEN 2 THEN 'tuesday'
                WHEN 3 THEN 'wednesday'
                WHEN 4 THEN 'thursday'
                WHEN 5 THEN 'friday'
                WHEN 6 THEN 'saturday'
            END;
            
            v_day_config := v_operating_hours->v_day_name;
            
            -- ✅ LÓGICA ROBUSTA: Verificar si el día está abierto
            -- Soporta AMBOS formatos:
            -- FORMATO 1: {"isOpen": true/false, ...}
            -- FORMATO 2: {"closed": true/false, ...}
            
            v_is_open_field := (v_day_config->>'isOpen')::BOOLEAN;
            v_closed_field := (v_day_config->>'closed')::BOOLEAN;
            
            -- Si existe "isOpen" → usarlo
            IF v_day_config ? 'isOpen' THEN
                v_is_open := COALESCE(v_is_open_field, false);
            -- Si existe "closed" → invertir lógica
            ELSIF v_day_config ? 'closed' THEN
                v_is_open := NOT COALESCE(v_closed_field, true);
            -- Si no existe ninguno → cerrado por defecto
            ELSE
                v_is_open := false;
            END IF;
            
            IF NOT v_is_open THEN
                RAISE NOTICE '🚫 Día % (%) está cerrado según configuración', v_current_date, v_day_name;
                v_current_date := v_current_date + 1;
                CONTINUE;
            END IF;
            
            -- Obtener horarios
            v_open_time := (v_day_config->>'open')::TIME;
            v_close_time := (v_day_config->>'close')::TIME;
            
            IF v_open_time IS NULL OR v_close_time IS NULL THEN
                RAISE NOTICE '⚠️ Día % sin horarios configurados, saltando', v_current_date;
                v_current_date := v_current_date + 1;
                CONTINUE;
            END IF;
            
            RAISE NOTICE '✅ Día % (%) abierto: % - %', v_current_date, v_day_name, v_open_time, v_close_time;
        END;
        
        -- 5. GENERAR SLOTS para el día
        FOR v_table IN 
            SELECT id, name, zone, capacity
            FROM tables 
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
                        zone,
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
                        v_table.zone,
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
        
        v_current_date := v_current_date + 1;
    END LOOP;
    
    RAISE NOTICE '✅ Slots creados: % | 🛡️ Días protegidos: %', v_slots_created, v_days_protected;
    
    -- 6. MARCAR SLOTS OCUPADOS POR RESERVAS
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
    
    -- 7. Retornar resultado
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
            'message', 'Error durante la regeneración de disponibilidades'
        );
END;
$$;

COMMENT ON FUNCTION cleanup_and_regenerate_availability IS 
'Regenera slots de disponibilidad con lógica robusta.
ACTUALIZADO: 17-Oct-2025 - Soporta múltiples formatos de operating_hours:
- Formato 1: {"isOpen": true/false}
- Formato 2: {"closed": true/false}
Incluye zona dinámica copiada desde tables.';

-- =====================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '✅ MIGRACIÓN COMPLETADA';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE 'Función actualizada para soportar:';
    RAISE NOTICE '  1. Formato "isOpen": true/false';
    RAISE NOTICE '  2. Formato "closed": true/false';
    RAISE NOTICE '  3. Zona dinámica desde tables';
    RAISE NOTICE '';
    RAISE NOTICE 'Próximo paso: Probar regeneración';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END $$;

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================

