-- =====================================================
-- SCRIPT: APLICAR FIX ÚLTIMO SLOT (MULTI-TENANT)
-- Fecha: 17 Octubre 2025
-- Para ejecutar en: Supabase SQL Editor
-- =====================================================

-- 🎯 ESTE SCRIPT:
-- 1. Aplica la función corregida
-- 2. Regenera slots para TODOS los restaurantes activos
-- 3. Muestra resultados por restaurante

-- =====================================================
-- PASO 1: APLICAR FUNCIÓN CORREGIDA
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
    v_is_day_closed BOOLEAN;
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
    
    RAISE NOTICE 'Configuración: interval=% min, duration=% min', v_slot_interval, v_reservation_duration;
    
    -- 2. Iterar por cada día
    v_current_date := p_start_date;
    
    WHILE v_current_date <= p_end_date LOOP
        -- Protección 1: Si el día está CERRADO en special_events
        SELECT EXISTS(
            SELECT 1 FROM special_events
            WHERE restaurant_id = p_restaurant_id
              AND event_date = v_current_date
              AND is_closed = true
        ) INTO v_is_day_closed;
        
        IF v_is_day_closed THEN
            RAISE NOTICE 'Día % está CERRADO por evento especial', v_current_date;
            
            DELETE FROM availability_slots
            WHERE restaurant_id = p_restaurant_id
              AND slot_date = v_current_date
              AND status = 'free';
            
            GET DIAGNOSTICS v_deleted_today = ROW_COUNT;
            v_slots_deleted := v_slots_deleted + v_deleted_today;
            
            v_days_protected := v_days_protected + 1;
            v_current_date := v_current_date + 1;
            CONTINUE;
        END IF;
        
        -- Protección 2: Si el día tiene reservas activas
        SELECT EXISTS(
            SELECT 1 FROM reservations
            WHERE restaurant_id = p_restaurant_id
              AND reservation_date = v_current_date
              AND status IN ('pending', 'confirmed', 'pending_approval', 'seated')
        ) INTO v_has_reservations;
        
        IF v_has_reservations THEN
            RAISE NOTICE 'Día % tiene reservas - INTOCABLE', v_current_date;
            v_days_protected := v_days_protected + 1;
            v_current_date := v_current_date + 1;
            CONTINUE;
        END IF;
        
        -- 3. Borrar slots libres del día
        DELETE FROM availability_slots
        WHERE restaurant_id = p_restaurant_id
          AND slot_date = v_current_date
          AND status = 'free';
        
        GET DIAGNOSTICS v_deleted_today = ROW_COUNT;
        v_slots_deleted := v_slots_deleted + v_deleted_today;
        
        -- 4. Obtener configuración del día de la semana
        v_day_of_week := EXTRACT(DOW FROM v_current_date);
        
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
            
            v_is_open_field := (v_day_config->>'isOpen')::BOOLEAN;
            v_closed_field := (v_day_config->>'closed')::BOOLEAN;
            
            IF v_day_config ? 'isOpen' THEN
                v_is_open := COALESCE(v_is_open_field, false);
            ELSIF v_day_config ? 'closed' THEN
                v_is_open := NOT COALESCE(v_closed_field, true);
            ELSE
                v_is_open := false;
            END IF;
            
            IF NOT v_is_open THEN
                RAISE NOTICE 'Día % (%) está cerrado según horario semanal', v_current_date, v_day_name;
                v_current_date := v_current_date + 1;
                CONTINUE;
            END IF;
            
            v_open_time := (v_day_config->>'open')::TIME;
            v_close_time := (v_day_config->>'close')::TIME;
            
            IF v_open_time IS NULL OR v_close_time IS NULL THEN
                RAISE NOTICE 'Día % sin horarios configurados', v_current_date;
                v_current_date := v_current_date + 1;
                CONTINUE;
            END IF;
            
            RAISE NOTICE 'Día % (%) abierto: % - % (última hora INCLUIDA)', 
                         v_current_date, v_day_name, v_open_time, v_close_time;
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
                
                -- ✅ FIX: La última hora del horario INCLUIDA como último pase
                IF v_current_time <= v_close_time THEN
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
    
    RAISE NOTICE 'Regeneración completada: % slots creados, % eliminados, % días protegidos', 
                 v_slots_created, v_slots_deleted, v_days_protected;
    
    RETURN jsonb_build_object(
        'success', true,
        'slots_created', v_slots_created,
        'slots_deleted', v_slots_deleted,
        'days_protected', v_days_protected,
        'start_date', p_start_date,
        'end_date', p_end_date
    );
END;
$$;

-- =====================================================
-- PASO 2: REGENERAR PARA TODOS LOS RESTAURANTES
-- =====================================================

DO $$
DECLARE
    v_restaurant RECORD;
    v_result JSONB;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'REGENERANDO SLOTS PARA TODOS LOS RESTAURANTES';
    RAISE NOTICE '========================================';
    
    FOR v_restaurant IN 
        SELECT id, name 
        FROM businesses 
        WHERE active = true
    LOOP
        RAISE NOTICE '';
        RAISE NOTICE '🏪 Procesando: % (ID: %)', v_restaurant.name, v_restaurant.id;
        
        -- Regenerar para el 22/10/2025
        SELECT cleanup_and_regenerate_availability(
            v_restaurant.id,
            '2025-10-22'::DATE,
            '2025-10-22'::DATE
        ) INTO v_result;
        
        RAISE NOTICE '📊 Resultado: %', v_result;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ REGENERACIÓN COMPLETADA';
    RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- PASO 3: VERIFICAR SLOTS PARA CADA RESTAURANTE
-- =====================================================

SELECT 
    r.name as restaurante,
    r.id as restaurant_id,
    COUNT(*) as total_slots,
    MIN(a.start_time) as primer_slot,
    MAX(a.start_time) as ultimo_slot,
    STRING_AGG(DISTINCT a.zone::text, ', ' ORDER BY a.zone::text) as zonas
FROM businesses r
LEFT JOIN availability_slots a ON r.id = a.restaurant_id
    AND a.slot_date = '2025-10-22'
    AND a.status = 'free'
WHERE r.active = true
GROUP BY r.id, r.name
ORDER BY r.name;

-- =====================================================
-- PASO 4: VER DETALLE DEL ÚLTIMO SLOT POR RESTAURANTE
-- =====================================================

WITH ultimo_slot AS (
    SELECT 
        restaurant_id,
        MAX(start_time) as max_start_time
    FROM availability_slots
    WHERE slot_date = '2025-10-22'
      AND status = 'free'
    GROUP BY restaurant_id
)
SELECT 
    r.name as restaurante,
    a.start_time,
    a.end_time,
    COUNT(*) as mesas_disponibles
FROM ultimo_slot u
JOIN businesses r ON u.restaurant_id = r.id
JOIN availability_slots a ON a.restaurant_id = u.restaurant_id
    AND a.start_time = u.max_start_time
    AND a.slot_date = '2025-10-22'
    AND a.status = 'free'
WHERE r.active = true
GROUP BY r.name, a.start_time, a.end_time
ORDER BY r.name;

-- =====================================================
-- ✅ VERIFICACIÓN:
-- El último_slot debe coincidir con la hora de cierre
-- configurada en el horario del restaurante
-- =====================================================

