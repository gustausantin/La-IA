-- =====================================================
-- 🔧 ACTUALIZAR find_table_combinations
-- =====================================================
-- Añadir table_ids al output para que el workflow pueda
-- crear los registros en reservation_tables
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
    v_slots_info JSON;
    v_reservation_datetime TIMESTAMP;
    v_now TIMESTAMP;
    v_minutes_until INTEGER;
    v_min_advance_minutes INTEGER;
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
    FROM businesses
    WHERE id = p_restaurant_id;
    
    IF v_min_advance_minutes IS NULL THEN
        v_min_advance_minutes := 0;
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
    
    RAISE NOTICE '✅ Validación tiempo OK: % minutos hasta la reserva', ROUND(v_minutes_until);

    -- =====================================================
    -- ✅ VALIDACIÓN 2: ZONA DEBE SER VÁLIDA
    -- =====================================================
    IF p_zone IS NOT NULL AND p_zone != '' THEN
        IF NOT (p_zone = ANY(ARRAY['interior', 'terraza', 'barra', 'privado'])) THEN
            RAISE EXCEPTION 'Zona no válida: %. Las zonas permitidas son: interior, terraza, barra, privado', p_zone
                USING HINT = 'Verifica que el nombre de la zona sea uno de los valores permitidos';
        END IF;
        RAISE NOTICE '✅ Zona válida: %', p_zone;
    ELSE
        RAISE NOTICE '🔍 Buscando en todas las zonas';
    END IF;

    -- =====================================================
    -- BUSCAR MESA INDIVIDUAL
    -- =====================================================
    RAISE NOTICE '🔍 Buscando mesa individual para % personas...', p_party_size;

    SELECT json_build_object(
        'available', true,
        'type', 'single',
        'slot_id', s.id,
        'table_id', s.table_id,  -- ✅ NUEVO
        'table_name', t.name,
        'capacity', t.capacity,
        'zone', t.zone::TEXT
    )
    INTO v_slots_info
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

    IF v_slots_info IS NOT NULL THEN
        RAISE NOTICE '✅ Mesa individual encontrada';
        RETURN v_slots_info;
    END IF;

    -- =====================================================
    -- BUSCAR COMBINACIÓN DE MESAS
    -- =====================================================
    RAISE NOTICE '🔍 No hay mesa individual. Buscando combinación...';

    WITH available_tables AS (
        SELECT DISTINCT
            s.table_id,
            t.name as table_name,
            t.capacity,
            t.zone,
            s.id as slot_id
        FROM availability_slots s
        INNER JOIN tables t ON s.table_id = t.id
        WHERE s.restaurant_id = p_restaurant_id
          AND s.slot_date = p_date
          AND s.start_time = p_time
          AND s.status = 'free'
          AND s.is_available = true
          AND t.is_active = true
          AND (p_zone IS NULL OR t.zone::TEXT = p_zone)
    ),
    combinations AS (
        SELECT 
            array_agg(table_id ORDER BY table_name) as table_ids,  -- ✅ NUEVO
            array_agg(table_name ORDER BY table_name) as table_names,
            array_agg(slot_id) as slot_ids,
            SUM(capacity) as total_capacity,
            COUNT(*) as num_tables,
            MAX(zone::TEXT) as zone
        FROM available_tables
        GROUP BY zone
        HAVING SUM(capacity) >= p_party_size
    )
    SELECT json_build_object(
        'available', true,
        'type', 'combination',
        'slot_ids', c.slot_ids,
        'table_ids', c.table_ids,  -- ✅ NUEVO
        'tables', c.table_names,
        'total_capacity', c.total_capacity,
        'num_tables', c.num_tables,
        'zone', c.zone,
        'message', format('Combinación de %s mesas para %s personas', c.num_tables, p_party_size)
    )
    INTO v_slots_info
    FROM combinations c
    ORDER BY 
        c.num_tables ASC,
        c.total_capacity ASC
    LIMIT 1;

    IF v_slots_info IS NOT NULL THEN
        RAISE NOTICE '✅ Combinación de mesas encontrada';
        RETURN v_slots_info;
    END IF;

    -- =====================================================
    -- NO HAY DISPONIBILIDAD
    -- =====================================================
    RAISE NOTICE '❌ No hay disponibilidad';

    RETURN json_build_object(
        'available', false,
        'type', 'unavailable',
        'message', format('No hay disponibilidad para %s personas el %s a las %s', 
            p_party_size, p_date, p_time)
    );
END;
$$;

-- =====================================================
-- ✅ COMENTARIO
-- =====================================================

COMMENT ON FUNCTION find_table_combinations IS 
'Busca mesas disponibles (individual o combinación) con validación de tiempo mínimo. Devuelve table_ids para crear reservation_tables.';

