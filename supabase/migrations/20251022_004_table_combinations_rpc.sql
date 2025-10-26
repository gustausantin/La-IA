-- =====================================================
-- FUNCIÓN RPC: COMBINACIÓN INTELIGENTE DE MESAS
-- =====================================================
-- Fecha: 22 Octubre 2025
-- Objetivo: Permitir al agente combinar mesas automáticamente
-- Uso: Desde N8N tool "check_availability"
-- =====================================================

-- 1. FUNCIÓN PRINCIPAL: find_table_combinations
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
    v_max_tables INTEGER := 4; -- Máximo 4 mesas a combinar
BEGIN
    RAISE NOTICE '🔍 Buscando disponibilidad para % personas el % a las % en zona: %', 
        p_party_size, p_date, p_time, COALESCE(p_zone, 'cualquiera');

    -- =====================================================
    -- ESTRATEGIA 1: BUSCAR MESA INDIVIDUAL SUFICIENTE
    -- =====================================================
    SELECT json_build_object(
        'available', true,
        'type', 'single',
        'slot_id', s.id,
        'table_id', s.table_id,
        'table_name', s.table_name,
        'capacity', s.capacity,
        'zone', t.zone,
        'start_time', s.start_time,
        'end_time', s.end_time,
        'tables', json_build_array(s.table_name),
        'table_ids', json_build_array(s.table_id),
        'slot_ids', json_build_array(s.id),
        'total_capacity', s.capacity,
        'message', 'Mesa individual disponible'
    )
    INTO v_single_table
    FROM availability_slots s
    INNER JOIN tables t ON t.id = s.table_id
    WHERE s.restaurant_id = p_restaurant_id
        AND s.slot_date = p_date
        AND s.start_time = p_time
        AND s.status = 'free'
        AND s.is_available = true
        AND t.is_active = true
        AND s.capacity >= p_party_size
        AND (p_zone IS NULL OR t.zone = p_zone)
    ORDER BY s.capacity ASC -- Preferir la mesa más pequeña que cumpla
    LIMIT 1;

    -- Si encontramos mesa individual, retornar inmediatamente
    IF v_single_table IS NOT NULL THEN
        RAISE NOTICE '✅ Mesa individual encontrada: %', v_single_table;
        RETURN v_single_table;
    END IF;

    RAISE NOTICE '⚠️ No hay mesa individual suficiente. Buscando combinaciones...';

    -- =====================================================
    -- ESTRATEGIA 2: BUSCAR COMBINACIONES DE MESAS
    -- =====================================================
    
    -- 2.1. Obtener todas las mesas libres en la zona (ordenadas por capacidad DESC)
    FOR v_slots IN (
        SELECT 
            s.id as slot_id,
            s.table_id,
            s.table_name,
            s.capacity,
            t.zone
        FROM availability_slots s
        INNER JOIN tables t ON t.id = s.table_id
        WHERE s.restaurant_id = p_restaurant_id
            AND s.slot_date = p_date
            AND s.start_time = p_time
            AND s.status = 'free'
            AND s.is_available = true
            AND t.is_active = true
            AND (p_zone IS NULL OR t.zone = p_zone)
        ORDER BY s.capacity DESC
    ) LOOP
        -- Inicializar arrays para esta iteración
        v_slot_ids := ARRAY[v_slots.slot_id];
        v_table_names := ARRAY[v_slots.table_name];
        v_total_capacity := v_slots.capacity;

        -- Si esta mesa sola ya es suficiente, añadir como combinación de 1
        IF v_total_capacity >= p_party_size THEN
            v_combinations := array_append(v_combinations, json_build_object(
                'slot_ids', v_slot_ids,
                'table_names', v_table_names,
                'total_capacity', v_total_capacity,
                'num_tables', 1,
                'zone', v_slots.zone
            ));
            CONTINUE;
        END IF;

        -- Buscar mesas adicionales para combinar (hasta v_max_tables)
        FOR v_slots IN (
            SELECT 
                s.id as slot_id,
                s.table_id,
                s.table_name,
                s.capacity,
                t.zone
            FROM availability_slots s
            INNER JOIN tables t ON t.id = s.table_id
            WHERE s.restaurant_id = p_restaurant_id
                AND s.slot_date = p_date
                AND s.start_time = p_time
                AND s.status = 'free'
                AND s.is_available = true
                AND t.is_active = true
                AND (p_zone IS NULL OR t.zone = p_zone)
                AND s.id != ALL(v_slot_ids) -- No repetir mesas
            ORDER BY s.capacity DESC
        ) LOOP
            -- Añadir mesa a la combinación
            v_slot_ids := array_append(v_slot_ids, v_slots.slot_id);
            v_table_names := array_append(v_table_names, v_slots.table_name);
            v_total_capacity := v_total_capacity + v_slots.capacity;

            -- Si ya tenemos capacidad suficiente, guardar combinación
            IF v_total_capacity >= p_party_size THEN
                v_combinations := array_append(v_combinations, json_build_object(
                    'slot_ids', v_slot_ids,
                    'table_names', v_table_names,
                    'total_capacity', v_total_capacity,
                    'num_tables', array_length(v_slot_ids, 1),
                    'zone', v_slots.zone
                ));
                EXIT; -- Salir del loop de mesas adicionales
            END IF;

            -- Si ya llegamos al máximo de mesas, salir
            IF array_length(v_slot_ids, 1) >= v_max_tables THEN
                EXIT;
            END IF;
        END LOOP;
    END LOOP;

    -- =====================================================
    -- ESTRATEGIA 3: SELECCIONAR LA MEJOR COMBINACIÓN
    -- =====================================================
    
    IF v_combinations IS NOT NULL AND array_length(v_combinations, 1) > 0 THEN
        -- Ordenar combinaciones por:
        -- 1. Menos mesas (más eficiente)
        -- 2. Menos capacidad desperdiciada (más ajustada)
        SELECT c
        INTO v_best_combination
        FROM unnest(v_combinations) c
        ORDER BY 
            (c->>'num_tables')::INTEGER ASC,
            (c->>'total_capacity')::INTEGER ASC
        LIMIT 1;

        RAISE NOTICE '✅ Mejor combinación encontrada: % mesas, capacidad total: %',
            v_best_combination->>'num_tables',
            v_best_combination->>'total_capacity';

        -- Construir resultado
        v_result := json_build_object(
            'available', true,
            'type', 'combination',
            'tables', v_best_combination->'table_names',
            'table_names', v_best_combination->'table_names',
            'slot_ids', v_best_combination->'slot_ids',
            'total_capacity', (v_best_combination->>'total_capacity')::INTEGER,
            'num_tables', (v_best_combination->>'num_tables')::INTEGER,
            'zone', v_best_combination->>'zone',
            'message', format('Disponible combinando %s mesas (%s)',
                (v_best_combination->>'num_tables')::TEXT,
                array_to_string(
                    ARRAY(SELECT json_array_elements_text(v_best_combination->'table_names')),
                    ', '
                )
            )
        );

        RETURN v_result;
    END IF;

    -- =====================================================
    -- NO HAY DISPONIBILIDAD
    -- =====================================================
    
    RAISE NOTICE '❌ No hay disponibilidad (ni individual ni combinada)';
    
    RETURN json_build_object(
        'available', false,
        'type', 'none',
        'message', 'No hay disponibilidad para ' || p_party_size || ' personas en la zona solicitada',
        'suggestion', 'Prueba con otra hora o zona'
    );

EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING '❌ Error en find_table_combinations: %', SQLERRM;
        RETURN json_build_object(
            'available', false,
            'type', 'error',
            'message', 'Error al buscar disponibilidad: ' || SQLERRM
        );
END;
$$;

-- =====================================================
-- COMENTARIOS Y PERMISOS
-- =====================================================

COMMENT ON FUNCTION find_table_combinations IS 
'Busca disponibilidad de mesas, intentando primero una mesa individual y luego combinaciones inteligentes. 
Retorna JSON con información de disponibilidad, tipo (single/combination), mesas seleccionadas y capacidad total.';

-- Permitir que el service role y usuarios autenticados llamen a esta función
GRANT EXECUTE ON FUNCTION find_table_combinations TO service_role;
GRANT EXECUTE ON FUNCTION find_table_combinations TO authenticated;

-- =====================================================
-- EJEMPLO DE USO
-- =====================================================

-- Buscar para 5 personas en terraza
-- SELECT * FROM find_table_combinations(
--     'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'::UUID,
--     '2025-10-23'::DATE,
--     '20:00:00'::TIME,
--     5,
--     'terraza'
-- );

-- Buscar para 3 personas en cualquier zona
-- SELECT * FROM find_table_combinations(
--     'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'::UUID,
--     '2025-10-23'::DATE,
--     '20:00:00'::TIME,
--     3,
--     NULL
-- );

-- =====================================================
-- NOTAS TÉCNICAS
-- =====================================================
-- 1. La función prioriza mesas individuales (más eficiente)
-- 2. Si no hay, busca combinaciones de hasta 4 mesas
-- 3. Selecciona la combinación con menos mesas y menos capacidad desperdiciada
-- 4. Respeta el filtro de zona (si se proporciona)
-- 5. Solo considera mesas activas (is_active = true)
-- 6. Solo considera slots libres (status = 'free', is_available = true)
-- 7. Retorna JSON para fácil integración con N8N
-- =====================================================

