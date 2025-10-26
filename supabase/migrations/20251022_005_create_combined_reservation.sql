-- =====================================================
-- FUNCIÓN RPC: CREAR RESERVA CON COMBINACIÓN DE MESAS
-- =====================================================
-- Fecha: 22 Octubre 2025
-- Objetivo: Crear reserva y marcar múltiples slots como reservados (para combinaciones)
-- Uso: Desde N8N tool "create_reservation"
-- =====================================================

-- 1. FUNCIÓN: create_combined_reservation
CREATE OR REPLACE FUNCTION create_combined_reservation(
    p_restaurant_id UUID,
    p_customer_id UUID,
    p_customer_phone TEXT,
    p_customer_name TEXT,
    p_reservation_date DATE,
    p_reservation_time TIME,
    p_party_size INTEGER,
    p_slot_ids UUID[],  -- Array de slot IDs a reservar
    p_special_requests TEXT DEFAULT NULL,
    p_source TEXT DEFAULT 'agent_whatsapp'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reservation_id UUID;
    v_slot_id UUID;
    v_slots_updated INTEGER := 0;
    v_table_names TEXT[];
    v_zone TEXT;
    v_result JSON;
BEGIN
    RAISE NOTICE '🎯 Creando reserva combinada para % personas', p_party_size;
    RAISE NOTICE '📋 Slots a reservar: %', p_slot_ids;

    -- =====================================================
    -- VALIDACIONES
    -- =====================================================
    
    IF p_slot_ids IS NULL OR array_length(p_slot_ids, 1) = 0 THEN
        RAISE EXCEPTION 'Se requiere al menos un slot_id';
    END IF;

    -- Verificar que todos los slots existen y están disponibles
    IF EXISTS (
        SELECT 1 FROM availability_slots
        WHERE id = ANY(p_slot_ids)
          AND (status != 'free' OR is_available = false)
    ) THEN
        RAISE EXCEPTION 'Uno o más slots ya no están disponibles';
    END IF;

    -- =====================================================
    -- CREAR RESERVA
    -- =====================================================
    
    -- Obtener información de las mesas y zona
    SELECT 
        array_agg(DISTINCT table_name ORDER BY table_name),
        MAX(zone)  -- Asumimos que todas están en la misma zona
    INTO v_table_names, v_zone
    FROM availability_slots
    WHERE id = ANY(p_slot_ids);

    RAISE NOTICE '🪑 Mesas: %, Zona: %', v_table_names, v_zone;

    -- Crear la reserva
    -- NOTA: table_id se guarda como el primer slot (para compatibilidad), 
    -- pero la info real está en las notas/special_requests
    INSERT INTO reservations (
        restaurant_id,
        customer_id,
        customer_phone,
        customer_name,
        reservation_date,
        reservation_time,
        party_size,
        table_id,  -- Guardamos el table_id del primer slot
        status,
        source,
        special_requests,
        created_at
    )
    SELECT
        p_restaurant_id,
        p_customer_id,
        p_customer_phone,
        p_customer_name,
        p_reservation_date,
        p_reservation_time,
        p_party_size,
        table_id,  -- Del primer slot
        'confirmed',
        p_source,
        CASE 
            WHEN array_length(p_slot_ids, 1) > 1 THEN
                format('Mesa combinada: %s | %s', 
                    array_to_string(v_table_names, ', '),
                    COALESCE(p_special_requests, '')
                )
            ELSE
                p_special_requests
        END,
        NOW()
    FROM availability_slots
    WHERE id = p_slot_ids[1]  -- Tomar el primer slot
    RETURNING id INTO v_reservation_id;

    RAISE NOTICE '✅ Reserva creada: %', v_reservation_id;

    -- =====================================================
    -- MARCAR SLOTS COMO RESERVADOS
    -- =====================================================
    
    FOREACH v_slot_id IN ARRAY p_slot_ids LOOP
        UPDATE availability_slots
        SET 
            status = 'reserved',
            is_available = false,
            updated_at = NOW()
        WHERE id = v_slot_id;
        
        -- Incrementar contador
        v_slots_updated := v_slots_updated + 1;
        
        RAISE NOTICE '🔒 Slot % marcado como reservado', v_slot_id;
    END LOOP;

    RAISE NOTICE '✅ Total slots actualizados: %', v_slots_updated;

    -- =====================================================
    -- CONSTRUIR RESPUESTA
    -- =====================================================
    
    v_result := json_build_object(
        'success', true,
        'reservation_id', v_reservation_id,
        'customer_name', p_customer_name,
        'reservation_date', p_reservation_date,
        'reservation_time', p_reservation_time,
        'party_size', p_party_size,
        'tables', v_table_names,
        'zone', v_zone,
        'num_tables', array_length(p_slot_ids, 1),
        'slots_reserved', v_slots_updated,
        'is_combined', array_length(p_slot_ids, 1) > 1,
        'message', format(
            '¡Listo, %s! Tu reserva está confirmada para el %s a las %s para %s persona%s. %s',
            p_customer_name,
            p_reservation_date,
            p_reservation_time,
            p_party_size,
            CASE WHEN p_party_size > 1 THEN 's' ELSE '' END,
            CASE 
                WHEN array_length(p_slot_ids, 1) > 1 THEN
                    format('Hemos preparado una zona uniendo %s mesas (%s) en %s.',
                        array_length(p_slot_ids, 1),
                        array_to_string(v_table_names, ', '),
                        v_zone
                    )
                ELSE
                    format('Mesa: %s (%s).',
                        v_table_names[1],
                        v_zone
                    )
            END
        )
    );

    RETURN v_result;

EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING '❌ Error en create_combined_reservation: %', SQLERRM;
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM,
            'message', 'Error al crear la reserva: ' || SQLERRM
        );
END;
$$;

-- =====================================================
-- COMENTARIOS Y PERMISOS
-- =====================================================

COMMENT ON FUNCTION create_combined_reservation IS 
'Crea una reserva y marca múltiples slots como reservados (para combinaciones de mesas).
Retorna JSON con información de la reserva creada y mensaje de confirmación.';

-- Permitir que el service role y usuarios autenticados llamen a esta función
GRANT EXECUTE ON FUNCTION create_combined_reservation TO service_role;
GRANT EXECUTE ON FUNCTION create_combined_reservation TO authenticated;

-- =====================================================
-- EJEMPLO DE USO
-- =====================================================

-- Reserva con mesa individual (1 slot)
-- SELECT * FROM create_combined_reservation(
--     'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'::UUID,  -- restaurant_id
--     'customer-uuid'::UUID,                           -- customer_id
--     '+34123456789',                                  -- customer_phone
--     'Juan Pérez',                                    -- customer_name
--     '2025-10-23'::DATE,                              -- reservation_date
--     '20:00:00'::TIME,                                -- reservation_time
--     4,                                               -- party_size
--     ARRAY['slot-uuid-1']::UUID[],                    -- slot_ids (1 mesa)
--     'Ventana por favor',                             -- special_requests
--     'agent_whatsapp'                                 -- source
-- );

-- Reserva con combinación de mesas (3 slots)
-- SELECT * FROM create_combined_reservation(
--     'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'::UUID,
--     'customer-uuid'::UUID,
--     '+34123456789',
--     'María García',
--     '2025-10-23'::DATE,
--     '20:00:00'::TIME,
--     5,
--     ARRAY['slot-uuid-1', 'slot-uuid-2', 'slot-uuid-3']::UUID[],  -- 3 mesas
--     NULL,
--     'agent_whatsapp'
-- );

-- =====================================================
-- NOTAS TÉCNICAS
-- =====================================================
-- 1. Acepta array de slot_ids (1 o más)
-- 2. Verifica que todos los slots estén disponibles antes de crear la reserva
-- 3. Crea UNA sola reserva en la tabla reservations
-- 4. Marca TODOS los slots como reservados (status = 'reserved', is_available = false)
-- 5. En special_requests guarda la info de las mesas combinadas
-- 6. Retorna JSON con toda la info de la reserva y mensaje de confirmación
-- 7. TRANSACTION: Si algo falla, se hace rollback automático (gracias a plpgsql)
-- =====================================================

