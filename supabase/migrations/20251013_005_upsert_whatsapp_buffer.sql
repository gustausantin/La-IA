-- =====================================================
-- FUNCIÓN: upsert_whatsapp_buffer
-- =====================================================
-- Inserta o actualiza un mensaje en el buffer de WhatsApp
-- de forma atómica, evitando race conditions.
-- 
-- Si el buffer_key no existe: CREA el buffer
-- Si el buffer_key ya existe: CONCATENA el nuevo mensaje
-- =====================================================

CREATE OR REPLACE FUNCTION upsert_whatsapp_buffer(
    p_buffer_key TEXT,
    p_restaurant_id UUID,
    p_customer_phone TEXT,
    p_customer_name TEXT,
    p_message_text TEXT,
    p_timestamp TIMESTAMPTZ
)
RETURNS TABLE (
    buffer_key TEXT,
    restaurant_id UUID,
    customer_phone TEXT,
    customer_name TEXT,
    messages TEXT,
    message_count INTEGER,
    first_message_at TIMESTAMPTZ,
    last_message_at TIMESTAMPTZ,
    is_new BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_existing_buffer RECORD;
    v_is_new BOOLEAN;
BEGIN
    -- Intentar obtener el buffer existente (con lock para evitar race condition)
    SELECT * INTO v_existing_buffer
    FROM whatsapp_message_buffer
    WHERE whatsapp_message_buffer.buffer_key = p_buffer_key
    FOR UPDATE;  -- Lock la fila para evitar concurrent updates

    IF v_existing_buffer IS NULL THEN
        -- Buffer NO existe → CREAR
        v_is_new := TRUE;
        
        INSERT INTO whatsapp_message_buffer (
            buffer_key,
            restaurant_id,
            customer_phone,
            customer_name,
            messages,
            message_count,
            first_message_at,
            last_message_at
        ) VALUES (
            p_buffer_key,
            p_restaurant_id,
            p_customer_phone,
            p_customer_name,
            p_message_text,
            1,
            p_timestamp,
            p_timestamp
        );

        RAISE NOTICE '✅ Buffer creado: %', p_buffer_key;
    ELSE
        -- Buffer SÍ existe → ACTUALIZAR (concatenar mensaje)
        v_is_new := FALSE;
        
        UPDATE whatsapp_message_buffer
        SET
            messages = whatsapp_message_buffer.messages || E'\n' || p_message_text,
            message_count = whatsapp_message_buffer.message_count + 1,
            last_message_at = p_timestamp,
            updated_at = NOW()
        WHERE whatsapp_message_buffer.buffer_key = p_buffer_key;

        RAISE NOTICE '✅ Buffer actualizado: % (mensaje #%)', p_buffer_key, v_existing_buffer.message_count + 1;
    END IF;

    -- Retornar el buffer actualizado
    RETURN QUERY
    SELECT
        b.buffer_key,
        b.restaurant_id,
        b.customer_phone,
        b.customer_name,
        b.messages,
        b.message_count,
        b.first_message_at,
        b.last_message_at,
        v_is_new AS is_new
    FROM whatsapp_message_buffer b
    WHERE b.buffer_key = p_buffer_key;
END;
$$;

-- Permisos
GRANT EXECUTE ON FUNCTION upsert_whatsapp_buffer(TEXT, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ) 
TO authenticated, service_role, anon;

-- Comentario
COMMENT ON FUNCTION upsert_whatsapp_buffer IS 
'Función atómica para insertar o actualizar mensajes en el buffer de WhatsApp. 
Evita race conditions usando FOR UPDATE lock. 
Retorna is_new=TRUE si creó el buffer, FALSE si lo actualizó.';


