-- =====================================================
-- VALIDACIÓN DE TIEMPO MÍNIMO DE ANTELACIÓN (30 MIN)
-- =====================================================
-- Fecha: 22 Octubre 2025
-- Problema: No se valida que la reserva sea con al menos 30 min de antelación
-- Solución PROFESIONAL: Validación en ambas RPCs (doble seguridad)
-- =====================================================

-- =====================================================
-- 1. ACTUALIZAR find_table_combinations
-- =====================================================

CREATE OR REPLACE FUNCTION find_table_combinations(
    p_restaurant_id UUID,
    p_date DATE,
    p_time TIME,
    p_party_size INTEGER,
    p_zone TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_slots RECORD;
    v_single_table JSON;
    v_combinations JSON[];
    v_best_combination JSON;
    v_result JSON;
    v_slot_ids UUID[];
    v_table_names TEXT[];
    v_total_capacity INTEGER;
    v_min_capacity INTEGER;
    v_max_tables INTEGER := 4;
    v_reservation_datetime TIMESTAMP;
    v_now TIMESTAMP;
    v_minutes_until INTEGER;
    v_min_advance_minutes INTEGER; -- Se obtiene de la configuración del restaurante
BEGIN
    -- =====================================================
    -- ✅ VALIDACIÓN 0: OBTENER CONFIGURACIÓN DEL RESTAURANTE
    -- =====================================================
    -- Intentar primero min_advance_minutes (nuevo nombre), luego min_advance_hours (legacy)
    SELECT COALESCE(
        (settings->>'min_advance_minutes')::INTEGER,
        (settings->>'min_advance_hours')::INTEGER,
        0
    )
    INTO v_min_advance_minutes
    FROM businesses
    WHERE id = p_restaurant_id;
    
    IF v_min_advance_minutes IS NULL THEN
        v_min_advance_minutes := 0; -- Si no está configurado, no validar
    END IF;
    
    RAISE NOTICE '⚙️ Configuración: mínimo % minutos de antelación', v_min_advance_minutes;

    -- =====================================================
    -- ✅ VALIDACIÓN 1: TIEMPO MÍNIMO DE ANTELACIÓN
    -- =====================================================
    v_now := NOW();
    v_reservation_datetime := (p_date || ' ' || p_time)::TIMESTAMP;
    v_minutes_until := EXTRACT(EPOCH FROM (v_reservation_datetime - v_now)) / 60;
    
    IF v_min_advance_minutes > 0 AND v_minutes_until < v_min_advance_minutes THEN
        RAISE NOTICE '❌ Reserva rechazada: Solo quedan % minutos (mínimo: % min)', 
            ROUND(v_minutes_until), v_min_advance_minutes;
        
        RETURN json_build_object(
            'available', false,
            'type', 'error',
            'message', format(
                'Lo sentimos, necesitamos al menos %s minutos de antelación para preparar tu mesa. La reserva sería en %s minutos.',
                v_min_advance_minutes,
                ROUND(v_minutes_until)
            ),
            'minutes_until', ROUND(v_minutes_until),
            'min_required', v_min_advance_minutes
        );
    END IF;
    
    RAISE NOTICE '✅ Validación tiempo OK: % minutos hasta la reserva (mínimo: %)', 
        ROUND(v_minutes_until), v_min_advance_minutes;

    -- =====================================================
    -- ✅ VALIDACIÓN 2: ZONA DEBE SER VÁLIDA
    -- =====================================================
    IF p_zone IS NOT NULL THEN
        IF p_zone NOT IN ('interior', 'terraza', 'barra', 'privado') THEN
            RAISE EXCEPTION 'Zona inválida: "%". Valores permitidos: interior, terraza, barra, privado', p_zone
                USING HINT = 'Verifica que el nombre de la zona sea correcto';
        END IF;
        
        RAISE NOTICE '✅ Zona validada correctamente: %', p_zone;
    END IF;

    RAISE NOTICE '🔍 Buscando disponibilidad para % personas el % a las % en zona: %', 
        p_party_size, p_date, p_time, COALESCE(p_zone, 'cualquiera');

    -- =====================================================
    -- ESTRATEGIA 1: BUSCAR MESA INDIVIDUAL SUFICIENTE
    -- =====================================================
    SELECT
        s.id as slot_id,
        s.table_id,
        t.name as table_name,
        t.capacity,
        t.zone,
        s.start_time,
        s.end_time
    INTO v_slots
    FROM availability_slots s
    INNER JOIN tables t ON s.table_id = t.id
    WHERE s.restaurant_id = p_restaurant_id
      AND s.slot_date = p_date
      AND s.start_time = p_time
      AND s.status = 'free'
      AND s.is_available = true
      AND t.is_active = true
      AND t.capacity >= p_party_size
      AND (p_zone IS NULL OR t.zone::TEXT = p_zone)
    ORDER BY 
      t.capacity ASC,
      t.name ASC
    LIMIT 1;

    IF FOUND THEN
        v_single_table := json_build_object(
            'available', true,
            'type', 'single',
            'slot_id', v_slots.slot_id,
            'table_id', v_slots.table_id,
            'table_name', v_slots.table_name,
            'capacity', v_slots.capacity,
            'zone', v_slots.zone,
            'message', format('Mesa individual disponible: %s (capacidad: %s)', v_slots.table_name, v_slots.capacity)
        );
        
        RAISE NOTICE '✅ Mesa individual encontrada: % (capacidad: %)', v_slots.table_name, v_slots.capacity;
        RETURN v_single_table;
    END IF;

    RAISE NOTICE '⚠️ No hay mesa individual suficiente. Buscando combinaciones...';

    -- =====================================================
    -- ESTRATEGIA 2: BUSCAR COMBINACIÓN DE MESAS
    -- =====================================================
    WITH available_tables AS (
        SELECT
            s.id as slot_id,
            s.table_id,
            t.name as table_name,
            t.capacity,
            t.zone,
            s.start_time,
            s.end_time
        FROM availability_slots s
        INNER JOIN tables t ON s.table_id = t.id
        WHERE s.restaurant_id = p_restaurant_id
          AND s.slot_date = p_date
          AND s.start_time = p_time
          AND s.status = 'free'
          AND s.is_available = true
          AND t.is_active = true
          AND (p_zone IS NULL OR t.zone::TEXT = p_zone)
        ORDER BY t.zone, t.capacity DESC, t.name
    ),
    combinations AS (
        SELECT
            array_agg(slot_id) as slot_ids,
            array_agg(table_name) as table_names,
            SUM(capacity) as total_capacity,
            COUNT(*) as num_tables,
            zone
        FROM available_tables
        GROUP BY zone
        HAVING SUM(capacity) >= p_party_size
           AND COUNT(*) <= v_max_tables
    )
    SELECT 
        json_build_object(
            'slot_ids', slot_ids,
            'table_names', table_names,
            'total_capacity', total_capacity,
            'num_tables', num_tables,
            'zone', zone
        )
    INTO v_best_combination
    FROM combinations
    ORDER BY 
        num_tables ASC,
        total_capacity ASC
    LIMIT 1;

    IF v_best_combination IS NOT NULL THEN
        v_result := json_build_object(
            'available', true,
            'type', 'combination',
            'slot_ids', v_best_combination->'slot_ids',
            'table_names', v_best_combination->'table_names',
            'total_capacity', v_best_combination->'total_capacity',
            'num_tables', v_best_combination->'num_tables',
            'zone', v_best_combination->'zone',
            'message', format('Combinación de %s mesas disponibles en zona %s', 
                v_best_combination->>'num_tables', v_best_combination->>'zone')
        );
        
        RAISE NOTICE '✅ Combinación encontrada: % mesas en zona %', 
            v_best_combination->>'num_tables', v_best_combination->>'zone';
        RETURN v_result;
    END IF;

    -- =====================================================
    -- NO HAY DISPONIBILIDAD
    -- =====================================================
    RAISE NOTICE '❌ No hay disponibilidad (ni individual ni combinación)';
    
    RETURN json_build_object(
        'available', false,
        'type', 'unavailable',
        'message', format('No hay disponibilidad para %s personas el %s a las %s', 
            p_party_size, p_date, p_time)
    );
END;
$$;

-- =====================================================
-- 2. ACTUALIZAR create_combined_reservation
-- =====================================================

-- ✅ ELIMINAR FUNCIÓN ANTERIOR (con firma antigua)
DROP FUNCTION IF EXISTS create_combined_reservation(
    UUID, UUID, TEXT, TEXT, DATE, TIME, INTEGER, UUID[], TEXT, TEXT
);

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
    v_min_advance_minutes INTEGER; -- Se obtiene de la configuración del restaurante
BEGIN
    -- =====================================================
    -- ✅ VALIDACIÓN 0: OBTENER CONFIGURACIÓN DEL RESTAURANTE
    -- =====================================================
    -- Intentar primero min_advance_minutes (nuevo nombre), luego min_advance_hours (legacy)
    SELECT COALESCE(
        (settings->>'min_advance_minutes')::INTEGER,
        (settings->>'min_advance_hours')::INTEGER,
        0
    )
    INTO v_min_advance_minutes
    FROM businesses
    WHERE id = p_restaurant_id;
    
    IF v_min_advance_minutes IS NULL THEN
        v_min_advance_minutes := 0; -- Si no está configurado, no validar
    END IF;
    
    RAISE NOTICE '⚙️ Configuración create: mínimo % minutos de antelación', v_min_advance_minutes;

    -- =====================================================
    -- ✅ VALIDACIÓN 1: TIEMPO MÍNIMO DE ANTELACIÓN
    -- =====================================================
    v_now := NOW();
    v_reservation_datetime := (p_reservation_date || ' ' || p_reservation_time)::TIMESTAMP;
    v_minutes_until := EXTRACT(EPOCH FROM (v_reservation_datetime - v_now)) / 60;
    
    IF v_min_advance_minutes > 0 AND v_minutes_until < v_min_advance_minutes THEN
        RAISE NOTICE '❌ Reserva rechazada en create: Solo quedan % minutos (mínimo: % min)', 
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
    
    RAISE NOTICE '✅ Validación tiempo OK en create: % minutos hasta la reserva', ROUND(v_minutes_until);

    -- =====================================================
    -- ✅ VALIDACIÓN 2: VERIFICAR QUE LOS SLOTS EXISTEN Y ESTÁN LIBRES
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
    -- OBTENER INFORMACIÓN DE LAS MESAS
    -- =====================================================
    SELECT 
        array_agg(DISTINCT t.name ORDER BY t.name),
        MAX(t.zone::TEXT),
        COUNT(DISTINCT s.table_id)
    INTO v_table_names, v_zone, v_num_tables
    FROM availability_slots s
    INNER JOIN tables t ON s.table_id = t.id
    WHERE s.id = ANY(p_slot_ids);

    v_is_combined := (v_num_tables > 1);

    RAISE NOTICE '📋 Mesas: %, Zona: %, Combinación: %', v_table_names, v_zone, v_is_combined;

    -- =====================================================
    -- CREAR RESERVA
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
    -- MARCAR SLOTS COMO RESERVADOS
    -- =====================================================
    UPDATE availability_slots
    SET 
        status = 'reserved',
        is_available = false,
        reservation_id = v_reservation_id
    WHERE id = ANY(p_slot_ids);

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RAISE NOTICE '✅ % slots marcados como ocupados', v_updated_count;

    -- =====================================================
    -- RETORNAR RESULTADO
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
-- ✅ COMENTARIOS Y PERMISOS
-- =====================================================

COMMENT ON FUNCTION find_table_combinations IS 
'Busca mesas disponibles (individual o combinación) con validación de tiempo mínimo de antelación (30 min)';

COMMENT ON FUNCTION create_combined_reservation IS 
'Crea una reserva (simple o combinada) con doble validación de tiempo mínimo';

-- =====================================================
-- ✅ FIN DE LA MIGRACIÓN
-- =====================================================

