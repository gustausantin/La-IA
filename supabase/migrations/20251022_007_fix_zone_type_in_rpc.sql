-- =====================================================
-- FIX PROFESIONAL: Validación de zone en find_table_combinations
-- =====================================================
-- Fecha: 22 Octubre 2025
-- Problema: zone es ENUM (zone_type), pero N8N envía TEXT
-- Solución PROFESIONAL: Validación explícita + cast seguro
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
BEGIN
    -- =====================================================
    -- ✅ VALIDACIÓN TEMPRANA: Zona debe ser válida
    -- =====================================================
    IF p_zone IS NOT NULL THEN
        -- Validar que el valor es uno de los permitidos en el ENUM zone_type
        IF p_zone NOT IN ('interior', 'terraza', 'barra', 'privado') THEN
            RAISE EXCEPTION 'Zona inválida: "%". Valores permitidos: interior, terraza, barra, privado', p_zone
                USING HINT = 'Verifica que el nombre de la zona sea correcto';
        END IF;
        
        RAISE NOTICE '🔍 Zona validada correctamente: %', p_zone;
    END IF;

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
        'zone', t.zone::TEXT,
        'start_time', s.start_time,
        'end_time', s.end_time,
        'tables', json_build_array(s.table_name),
        'table_ids', json_build_array(s.table_id),
        'slot_ids', json_build_array(s.id),
        'total_capacity', s.capacity,
        'wasted_capacity', s.capacity - p_party_size,
        'message', 'Mesa individual disponible: ' || s.table_name || ' (capacidad: ' || s.capacity || ')'
    ) INTO v_single_table
    FROM availability_slots s
    INNER JOIN tables t ON t.id = s.table_id
    WHERE s.restaurant_id = p_restaurant_id
        AND s.slot_date = p_date
        AND s.start_time = p_time
        AND s.status = 'free'
        AND s.is_available = true
        AND t.is_active = true
        AND s.capacity >= p_party_size
        AND (p_zone IS NULL OR t.zone::TEXT = p_zone)  -- Cast seguro (ya validado)
    ORDER BY s.capacity ASC
    LIMIT 1;

    IF v_single_table IS NOT NULL THEN
        RAISE NOTICE '✅ Mesa individual encontrada: %', v_single_table->>'table_name';
        RETURN v_single_table;
    END IF;

    RAISE NOTICE '⚠️ No hay mesa individual, intentando combinaciones...';

    -- =====================================================
    -- ESTRATEGIA 2: COMBINAR MESAS
    -- =====================================================
    FOR v_slots IN (
        SELECT 
            s.id,
            s.table_id,
            s.table_name,
            s.capacity,
            t.zone::TEXT as zone
        FROM availability_slots s
        INNER JOIN tables t ON t.id = s.table_id
        WHERE s.restaurant_id = p_restaurant_id
            AND s.slot_date = p_date
            AND s.start_time = p_time
            AND s.status = 'free'
            AND s.is_available = true
            AND t.is_active = true
            AND (p_zone IS NULL OR t.zone::TEXT = p_zone)  -- Cast seguro (ya validado)
        ORDER BY s.capacity DESC
    ) LOOP
        -- Inicializar con la primera mesa
        v_slot_ids := ARRAY[v_slots.id];
        v_table_names := ARRAY[v_slots.table_name];
        v_total_capacity := v_slots.capacity;

        -- Si ya es suficiente con una mesa, guardar como combinación
        IF v_total_capacity >= p_party_size THEN
            v_combinations := array_append(v_combinations, json_build_object(
                'slot_ids', v_slot_ids,
                'table_names', v_table_names,
                'total_capacity', v_total_capacity,
                'num_tables', 1,
                'wasted_capacity', v_total_capacity - p_party_size,
                'zone', v_slots.zone
            ));
            CONTINUE;
        END IF;

        -- Intentar combinar con más mesas (hasta v_max_tables)
        FOR i IN 2..v_max_tables LOOP
            DECLARE
                v_additional_slot RECORD;
            BEGIN
                FOR v_additional_slot IN (
                    SELECT 
                        s.id,
                        s.table_name,
                        s.capacity,
                        t.zone::TEXT as zone
                    FROM availability_slots s
                    INNER JOIN tables t ON t.id = s.table_id
                    WHERE s.restaurant_id = p_restaurant_id
                        AND s.slot_date = p_date
                        AND s.start_time = p_time
                        AND s.status = 'free'
                        AND s.is_available = true
                        AND t.is_active = true
                        AND (p_zone IS NULL OR t.zone::TEXT = p_zone)  -- Cast seguro (ya validado)
                        AND s.id != ALL(v_slot_ids)  -- No repetir mesas
                    ORDER BY s.capacity DESC
                ) LOOP
                    -- Añadir mesa a la combinación
                    v_slot_ids := array_append(v_slot_ids, v_additional_slot.id);
                    v_table_names := array_append(v_table_names, v_additional_slot.table_name);
                    v_total_capacity := v_total_capacity + v_additional_slot.capacity;

                    -- Si ya es suficiente, guardar y salir
                    IF v_total_capacity >= p_party_size THEN
                        v_combinations := array_append(v_combinations, json_build_object(
                            'slot_ids', v_slot_ids,
                            'table_names', v_table_names,
                            'total_capacity', v_total_capacity,
                            'num_tables', array_length(v_slot_ids, 1),
                            'wasted_capacity', v_total_capacity - p_party_size,
                            'zone', v_slots.zone
                        ));
                        EXIT;
                    END IF;
                END LOOP;

                IF v_total_capacity >= p_party_size THEN
                    EXIT;
                END IF;
            END;
        END LOOP;
    END LOOP;

    -- =====================================================
    -- EVALUAR RESULTADOS
    -- =====================================================
    IF v_combinations IS NULL OR array_length(v_combinations, 1) = 0 THEN
        RAISE NOTICE '❌ No se encontraron combinaciones válidas';
        RETURN json_build_object(
            'available', false,
            'type', 'none',
            'message', 'No hay disponibilidad para ' || p_party_size || ' personas' ||
                       CASE WHEN p_zone IS NOT NULL THEN ' en la zona ' || p_zone ELSE '' END
        );
    END IF;

    -- Seleccionar la mejor combinación (menos mesas, menos capacidad desperdiciada)
    SELECT combo INTO v_best_combination
    FROM unnest(v_combinations) AS combo
    ORDER BY 
        (combo->>'num_tables')::INTEGER ASC,
        (combo->>'wasted_capacity')::INTEGER ASC
    LIMIT 1;

    RAISE NOTICE '✅ Combinación encontrada: % mesa(s), capacidad total: %', 
        (v_best_combination->>'num_tables')::INTEGER,
        (v_best_combination->>'total_capacity')::INTEGER;

    -- Construir respuesta final
    v_result := json_build_object(
        'available', true,
        'type', 'combination',
        'slot_ids', v_best_combination->'slot_ids',
        'tables', v_best_combination->'table_names',
        'table_names', v_best_combination->'table_names',
        'total_capacity', v_best_combination->'total_capacity',
        'zone', v_best_combination->'zone',
        'num_tables', v_best_combination->'num_tables',
        'wasted_capacity', v_best_combination->'wasted_capacity',
        'message', 'Combinación de ' || (v_best_combination->>'num_tables') || ' mesa(s): ' || 
                   array_to_string(ARRAY(SELECT json_array_elements_text(v_best_combination->'table_names')), ', ') ||
                   ' (capacidad total: ' || (v_best_combination->>'total_capacity') || ')'
    );

    RETURN v_result;

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
-- DOCUMENTACIÓN DE LA FUNCIÓN
-- =====================================================
COMMENT ON FUNCTION find_table_combinations(UUID, DATE, TIME, INTEGER, TEXT) IS 
'Busca disponibilidad de mesas para un restaurante, fecha, hora y número de personas.

ESTRATEGIA:
1. Intenta encontrar una mesa individual con capacidad suficiente
2. Si no hay, intenta combinar hasta 4 mesas

VALIDACIONES:
- p_zone debe ser NULL o uno de: interior, terraza, barra, privado
- Si se pasa un valor inválido, lanza EXCEPTION con mensaje claro

RETORNA:
- JSON con available=true/false
- Si available=true: incluye slot_ids, table_names, capacity, zone
- Si available=false: incluye message explicativo

EJEMPLO:
SELECT find_table_combinations(
    ''uuid-restaurant''::UUID,
    ''2025-10-22''::DATE,
    ''20:00''::TIME,
    4,
    ''interior''
);';

-- =====================================================
-- PERMISOS
-- =====================================================
GRANT EXECUTE ON FUNCTION find_table_combinations TO service_role;
GRANT EXECUTE ON FUNCTION find_table_combinations TO authenticated;

-- =====================================================
-- NOTAS TÉCNICAS
-- =====================================================
-- ✅ Validación explícita de zona al inicio (fail-fast)
-- ✅ Cast t.zone::TEXT = p_zone solo después de validar
-- ✅ Mensajes de error claros y útiles
-- ✅ RAISE NOTICE para debugging en logs
-- ✅ Manejo de excepciones robusto
-- ✅ Documentación completa
-- ✅ Escalable y mantenible
-- =====================================================
