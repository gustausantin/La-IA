-- =====================================================
-- FIX: ÚLTIMO SLOT DEBE SER A LA HORA DE CIERRE
-- =====================================================
-- Problema: Si cierre es 22:00, el último slot es 21:00
-- Solución: Si cierre es 22:00, el último slot es 22:00
-- =====================================================
-- Fecha: 2025-10-23
-- Autor: Gustau
-- =====================================================

CREATE OR REPLACE FUNCTION generate_availability_slots(
    p_restaurant_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_table RECORD;
    v_date DATE;
    v_current_time TIME;
    v_close_time TIME;
    v_slot_duration INTEGER;
    v_reservation_duration INTEGER;
    v_calendar_schedule JSONB;
    v_day_name TEXT;
    v_day_schedule JSONB;
BEGIN
    -- Obtener configuración del restaurante
    SELECT 
        COALESCE((settings->>'slot_duration')::INTEGER, 30) as slot_duration,
        COALESCE((settings->>'reservation_duration')::INTEGER, 90) as reservation_duration,
        settings->'calendar_schedule' as calendar_schedule
    INTO v_slot_duration, v_reservation_duration, v_calendar_schedule
    FROM businesses
    WHERE id = p_restaurant_id;

    -- Para cada mesa activa
    FOR v_table IN 
        SELECT id, name, capacity, zone
        FROM tables 
        WHERE restaurant_id = p_restaurant_id 
          AND is_active = true
    LOOP
        -- Para cada fecha en el rango
        v_date := p_start_date;
        WHILE v_date <= p_end_date LOOP
            
            -- Obtener nombre del día (sunday, monday, etc.)
            v_day_name := LOWER(TO_CHAR(v_date, 'Day'));
            v_day_name := TRIM(v_day_name);
            
            -- Buscar horario para este día en calendar_schedule
            SELECT jsonb_array_elements
            INTO v_day_schedule
            FROM jsonb_array_elements(v_calendar_schedule)
            WHERE jsonb_array_elements->>'day_of_week' = v_day_name
            LIMIT 1;

            -- Si el restaurante está abierto ese día
            IF v_day_schedule IS NOT NULL AND (v_day_schedule->>'is_open')::BOOLEAN THEN
                v_current_time := (v_day_schedule->>'open_time')::TIME;
                v_close_time := (v_day_schedule->>'close_time')::TIME;

                -- 🔥 CAMBIO CRÍTICO: Generar slots HASTA la hora de cierre (inclusive)
                -- ANTES: v_current_time < v_close_time (excluía el último slot)
                -- AHORA: v_current_time <= v_close_time (incluye el último slot)
                WHILE v_current_time <= v_close_time LOOP
                    
                    -- Insertar slot (si no existe ya)
                    INSERT INTO availability_slots (
                        restaurant_id,
                        table_id,
                        slot_date,
                        start_time,
                        end_time,
                        status,
                        is_available,
                        capacity,
                        table_name,
                        zone,
                        duration_minutes
                    )
                    VALUES (
                        p_restaurant_id,
                        v_table.id,
                        v_date,
                        v_current_time,
                        (v_current_time + (v_reservation_duration || ' minutes')::INTERVAL)::TIME,
                        'free',
                        true,
                        v_table.capacity,
                        v_table.name,
                        v_table.zone,
                        v_reservation_duration
                    )
                    ON CONFLICT (restaurant_id, table_id, slot_date, start_time) 
                    DO NOTHING;

                    -- Avanzar al siguiente slot
                    v_current_time := v_current_time + (v_slot_duration || ' minutes')::INTERVAL;
                    
                END LOOP;
            END IF;

            v_date := v_date + INTERVAL '1 day';
        END LOOP;
    END LOOP;

    RAISE NOTICE 'Slots generados correctamente para % mesas desde % hasta %', 
        (SELECT COUNT(*) FROM tables WHERE restaurant_id = p_restaurant_id AND is_active = true),
        p_start_date, 
        p_end_date;
END;
$$;

-- =====================================================
-- PROBAR LA CORRECCIÓN
-- =====================================================
-- Ejecutar para regenerar slots del 23/10/2025:
-- 
-- 1. Borrar slots existentes:
-- DELETE FROM availability_slots WHERE slot_date = '2025-10-23';
--
-- 2. Regenerar:
-- SELECT generate_availability_slots(
--     'd6b63130-1ebf-4284-98fc-a3b31a85d9d1',
--     '2025-10-23',
--     '2025-10-23'
-- );
--
-- 3. Verificar que ahora hay slots hasta las 22:00:
-- SELECT DISTINCT start_time 
-- FROM availability_slots 
-- WHERE slot_date = '2025-10-23' 
-- ORDER BY start_time DESC 
-- LIMIT 3;
-- 
-- Deberías ver: 22:00, 21:30, 21:00
-- =====================================================

