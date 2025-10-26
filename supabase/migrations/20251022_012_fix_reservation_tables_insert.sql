-- =====================================================
-- 🔧 FIX: Crear registros en reservation_tables
-- =====================================================
-- Problema: create_combined_reservation no crea registros en reservation_tables
-- Solución: Añadir INSERT después de crear la reserva
-- =====================================================

CREATE OR REPLACE FUNCTION create_combined_reservation(
    p_restaurant_id UUID,
    p_customer_phone TEXT,
    p_customer_name TEXT,
    p_reservation_date DATE,
    p_reservation_time TIME,
    p_party_size INTEGER,
    p_slot_ids UUID[],
    p_customer_id UUID DEFAULT NULL,
    p_special_requests TEXT DEFAULT NULL,
    p_source TEXT DEFAULT 'agent_whatsapp'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reservation_id UUID;
    v_slots_info JSON;
    v_updated_count INTEGER;
    v_table_names TEXT[];
    v_zone TEXT;
    v_num_tables INTEGER;
    v_is_combined BOOLEAN;
    v_reservation_datetime TIMESTAMP;
    v_now TIMESTAMP;
    v_minutes_until INTEGER;
    v_min_advance_minutes INTEGER;
    v_table_ids UUID[]; -- ✅ NUEVO: Para guardar los table_ids
BEGIN
    -- =====================================================
    -- ✅ VALIDACIÓN 0: OBTENER CONFIGURACIÓN
    -- =====================================================
    SELECT COALESCE(
        (settings->>'min_advance_minutes')::INTEGER,
        (settings->>'min_advance_hours')::INTEGER,
        0
    )
    INTO v_min_advance_minutes
    FROM restaurants
    WHERE id = p_restaurant_id;
    
    IF v_min_advance_minutes IS NULL THEN
        v_min_advance_minutes := 0;
    END IF;
    
    RAISE NOTICE '⚙️ Configuración: mínimo % minutos de antelación', v_min_advance_minutes;

    -- =====================================================
    -- ✅ VALIDACIÓN 1: TIEMPO MÍNIMO DE ANTELACIÓN
    -- =====================================================
    v_now := NOW();
    v_reservation_datetime := (p_reservation_date || ' ' || p_reservation_time)::TIMESTAMP;
    v_minutes_until := EXTRACT(EPOCH FROM (v_reservation_datetime - v_now)) / 60;
    
    IF v_min_advance_minutes > 0 AND v_minutes_until < v_min_advance_minutes THEN
        RAISE NOTICE '❌ Reserva rechazada: Solo quedan % minutos (mínimo: % min)', 
            ROUND(v_minutes_until), v_min_advance_minutes;
        
        RETURN json_build_object(
            'success', false,
            'error', 'INSUFFICIENT_ADVANCE_TIME',
            'message', format(
                'Lo sentimos, necesitamos al menos %s minutos de antelación para preparar tu mesa. La reserva sería en %s minutos.',
                v_min_advance_minutes,
                ROUND(v_minutes_until)
            ),
            'minutes_until', ROUND(v_minutes_until),
            'min_required', v_min_advance_minutes
        );
    END IF;

    RAISE NOTICE '✅ Validación tiempo OK: % minutos hasta la reserva', ROUND(v_minutes_until);

    -- =====================================================
    -- ✅ VALIDACIÓN 2: VERIFICAR SLOTS DISPONIBLES
    -- =====================================================
    RAISE NOTICE '🔍 Verificando % slots...', array_length(p_slot_ids, 1);
    
    SELECT COUNT(*) INTO v_updated_count
    FROM availability_slots
    WHERE id = ANY(p_slot_ids)
      AND restaurant_id = p_restaurant_id
      AND slot_date = p_reservation_date
      AND start_time = p_reservation_time
      AND status = 'free'
      AND is_available = true;

    IF v_updated_count != array_length(p_slot_ids, 1) THEN
        RAISE NOTICE '❌ Error: Solo % de % slots están disponibles', v_updated_count, array_length(p_slot_ids, 1);
        RETURN json_build_object(
            'success', false,
            'error', 'SLOTS_NOT_AVAILABLE',
            'message', 'Uno o más slots ya no están disponibles'
        );
    END IF;

    RAISE NOTICE '✅ Todos los slots están disponibles';

    -- =====================================================
    -- ✅ OBTENER INFORMACIÓN DE LAS MESAS
    -- =====================================================
    SELECT 
        array_agg(DISTINCT t.name ORDER BY t.name),
        array_agg(DISTINCT s.table_id), -- ✅ NUEVO: Guardar table_ids
        MAX(t.zone::TEXT),
        COUNT(DISTINCT s.table_id)
    INTO v_table_names, v_table_ids, v_zone, v_num_tables
    FROM availability_slots s
    INNER JOIN tables t ON s.table_id = t.id
    WHERE s.id = ANY(p_slot_ids);

    v_is_combined := (v_num_tables > 1);

    RAISE NOTICE '📋 Mesas: %, IDs: %, Zona: %, Combinación: %', 
        v_table_names, v_table_ids, v_zone, v_is_combined;

    -- =====================================================
    -- ✅ CREAR RESERVA
    -- =====================================================
    INSERT INTO reservations (
        restaurant_id,
        customer_id,
        customer_phone,
        customer_name,
        reservation_date,
        reservation_time,
        party_size,
        status,
        special_requests,
        source
    )
    VALUES (
        p_restaurant_id,
        p_customer_id,
        p_customer_phone,
        p_customer_name,
        p_reservation_date,
        p_reservation_time,
        p_party_size,
        'pending',
        p_special_requests,
        p_source
    )
    RETURNING id INTO v_reservation_id;

    RAISE NOTICE '✅ Reserva creada con ID: %', v_reservation_id;

    -- =====================================================
    -- ✅ NUEVO: CREAR REGISTROS EN reservation_tables
    -- =====================================================
    INSERT INTO reservation_tables (reservation_id, table_id)
    SELECT v_reservation_id, unnest(v_table_ids);

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RAISE NOTICE '✅ % registros creados en reservation_tables', v_updated_count;

    -- =====================================================
    -- ✅ MARCAR SLOTS COMO RESERVADOS
    -- =====================================================
    UPDATE availability_slots
    SET 
        status = 'reserved',
        is_available = false,
        reservation_id = v_reservation_id
    WHERE id = ANY(p_slot_ids);

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RAISE NOTICE '✅ % slots marcados como reservados', v_updated_count;

    -- =====================================================
    -- ✅ RETORNAR RESULTADO
    -- =====================================================
    RETURN json_build_object(
        'success', true,
        'reservation_id', v_reservation_id,
        'customer_name', p_customer_name,
        'reservation_date', p_reservation_date,
        'reservation_time', p_reservation_time,
        'party_size', p_party_size,
        'tables', v_table_names,
        'zone', v_zone,
        'num_tables', v_num_tables,
        'is_combined', v_is_combined,
        'slots_reserved', v_updated_count,
        'message', format(
            'Reserva creada exitosamente para %s personas el %s a las %s en %s',
            p_party_size, p_reservation_date, p_reservation_time, v_zone
        )
    );
END;
$$;

-- =====================================================
-- ✅ COMENTARIO
-- =====================================================

COMMENT ON FUNCTION create_combined_reservation IS 
'Crea una reserva (simple o combinada) con validación de tiempo mínimo y registros en reservation_tables';

