-- =====================================================
-- SISTEMA DE CONFIRMACIONES CON CÓDIGO CORTO
-- Independiente de proveedor (Twilio, WhatsApp Business, etc.)
-- =====================================================

-- =====================================================
-- 1. FUNCIÓN PARA GENERAR CÓDIGO ÚNICO
-- =====================================================
CREATE OR REPLACE FUNCTION generate_reservation_code()
RETURNS TEXT AS $$
DECLARE
    v_code TEXT;
    v_exists BOOLEAN;
    v_attempts INTEGER := 0;
BEGIN
    LOOP
        -- Generar código de 4 caracteres (ej: AB3F)
        -- Usa letras mayúsculas y números (excluyendo O,0,I,1 para evitar confusión)
        v_code := upper(
            translate(
                substring(md5(random()::text || clock_timestamp()::text) from 1 for 4),
                '01io',
                '2345'
            )
        );
        
        -- Verificar que no exista en los últimos 30 días
        SELECT EXISTS(
            SELECT 1 FROM reservations 
            WHERE short_code = v_code 
            AND created_at > NOW() - INTERVAL '30 days'
        ) INTO v_exists;
        
        EXIT WHEN NOT v_exists;
        
        v_attempts := v_attempts + 1;
        IF v_attempts > 10 THEN
            RAISE EXCEPTION 'No se pudo generar código único después de 10 intentos';
        END IF;
    END LOOP;
    
    RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 2. AÑADIR COLUMNA short_code A reservations
-- =====================================================
ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS short_code TEXT;

-- Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_reservations_short_code 
ON reservations(short_code) 
WHERE short_code IS NOT NULL;

-- Generar códigos para reservas existentes (futuras y activas)
DO $$
DECLARE
    reservation RECORD;
BEGIN
    FOR reservation IN 
        SELECT id 
        FROM reservations 
        WHERE short_code IS NULL 
          AND status IN ('pending', 'confirmed')
          AND reservation_date >= CURRENT_DATE
    LOOP
        UPDATE reservations 
        SET short_code = generate_reservation_code()
        WHERE id = reservation.id;
    END LOOP;
    
    RAISE NOTICE 'Códigos generados para reservas existentes';
END $$;

-- =====================================================
-- 3. AÑADIR COLUMNAS A confirmation_messages
-- =====================================================
ALTER TABLE confirmation_messages
ADD COLUMN IF NOT EXISTS provider_message_id TEXT,  -- SID de Twilio, ID de WhatsApp Business, etc.
ADD COLUMN IF NOT EXISTS message_body TEXT,         -- Cuerpo del mensaje enviado
ADD COLUMN IF NOT EXISTS customer_response TEXT,    -- Respuesta del cliente
ADD COLUMN IF NOT EXISTS detection_method TEXT;     -- 'code', 'recent', 'context'

-- Índice para búsquedas por provider_message_id
CREATE INDEX IF NOT EXISTS idx_confirmation_messages_provider_id
ON confirmation_messages(provider_message_id)
WHERE provider_message_id IS NOT NULL;

-- =====================================================
-- 4. RPC: REGISTRAR CONFIRMACIÓN DEL CLIENTE
-- =====================================================
CREATE OR REPLACE FUNCTION register_customer_confirmation(
    p_reservation_id UUID,
    p_response_type TEXT,  -- 'confirm' o 'cancel'
    p_customer_response TEXT DEFAULT NULL,
    p_detection_method TEXT DEFAULT 'recent'
)
RETURNS JSON AS $$
DECLARE
    v_customer_name TEXT;
    v_short_code TEXT;
    v_party_size INTEGER;
    v_reservation_time TIME;
    v_reservation_date DATE;
BEGIN
    -- Obtener datos de la reserva
    SELECT 
        customer_name,
        short_code,
        party_size,
        reservation_time,
        reservation_date
    INTO 
        v_customer_name,
        v_short_code,
        v_party_size,
        v_reservation_time,
        v_reservation_date
    FROM reservations
    WHERE id = p_reservation_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'reservation_not_found',
            'message', 'No se encontró la reserva'
        );
    END IF;
    
    IF p_response_type = 'confirm' THEN
        -- ✅ CONFIRMAR
        UPDATE confirmation_messages
        SET 
            status = 'confirmed',
            confirmed_at = NOW(),
            customer_response = p_customer_response,
            detection_method = p_detection_method
        WHERE reservation_id = p_reservation_id
          AND status = 'sent'
          AND message_type IN ('24h', '4h', '2h');
        
        UPDATE reservations
        SET 
            status = 'confirmed',
            updated_at = NOW()
        WHERE id = p_reservation_id;
        
        RAISE NOTICE '✅ Reserva % (código: %) confirmada por el cliente', 
            p_reservation_id, v_short_code;
        
        RETURN json_build_object(
            'success', true,
            'action', 'confirmed',
            'customer_name', v_customer_name,
            'short_code', v_short_code,
            'party_size', v_party_size,
            'reservation_time', v_reservation_time::TEXT,
            'reservation_date', v_reservation_date::TEXT,
            'message', format(
                '¡Perfecto, %s! Tu reserva #R-%s está confirmada para %s personas el %s a las %s. ¡Te esperamos! 🎉',
                v_customer_name,
                v_short_code,
                v_party_size,
                to_char(v_reservation_date, 'DD/MM/YYYY'),
                v_reservation_time::TEXT
            )
        );
        
    ELSIF p_response_type = 'cancel' THEN
        -- ❌ MARCAR COMO DECLINADO (la cancelación la hace cancel_reservation)
        UPDATE confirmation_messages
        SET 
            status = 'declined',
            confirmed_at = NOW(),
            customer_response = p_customer_response,
            detection_method = p_detection_method
        WHERE reservation_id = p_reservation_id
          AND status = 'sent'
          AND message_type IN ('24h', '4h', '2h');
        
        RAISE NOTICE '❌ Cliente declinó confirmación para reserva % (código: %)', 
            p_reservation_id, v_short_code;
        
        RETURN json_build_object(
            'success', true,
            'action', 'to_cancel',
            'reservation_id', p_reservation_id,
            'customer_name', v_customer_name,
            'short_code', v_short_code,
            'message', format(
                'Entendido, %s. Voy a cancelar tu reserva #R-%s. Gracias por avisarnos. ¡Hasta pronto!',
                v_customer_name,
                v_short_code
            )
        );
    ELSE
        RETURN json_build_object(
            'success', false,
            'error', 'invalid_response_type',
            'message', 'Tipo de respuesta inválido. Debe ser "confirm" o "cancel"'
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. RPC: BUSCAR RESERVA POR CÓDIGO
-- =====================================================
CREATE OR REPLACE FUNCTION find_reservation_by_code(
    p_short_code TEXT,
    p_customer_phone TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_reservation RECORD;
BEGIN
    -- Normalizar código (mayúsculas, sin prefijo)
    p_short_code := upper(regexp_replace(p_short_code, '^[#rR-]*', ''));
    
    -- Buscar reserva
    SELECT 
        r.*,
        cm.sent_at as last_reminder_sent
    INTO v_reservation
    FROM reservations r
    LEFT JOIN confirmation_messages cm ON cm.reservation_id = r.id
    WHERE r.short_code = p_short_code
      AND r.status IN ('pending', 'confirmed')
      AND r.reservation_date >= CURRENT_DATE
      AND (p_customer_phone IS NULL OR r.customer_phone = p_customer_phone)
    ORDER BY cm.sent_at DESC NULLS LAST
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'found', false,
            'error', 'not_found',
            'message', format('No se encontró reserva activa con código %s', p_short_code)
        );
    END IF;
    
    RETURN json_build_object(
        'found', true,
        'reservation', row_to_json(v_reservation)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. RPC: BUSCAR ÚLTIMA CONFIRMACIÓN ENVIADA
-- =====================================================
CREATE OR REPLACE FUNCTION find_recent_confirmation(
    p_customer_phone TEXT,
    p_hours_back INTEGER DEFAULT 4
)
RETURNS JSON AS $$
DECLARE
    v_result RECORD;
BEGIN
    -- Buscar último mensaje de confirmación enviado
    SELECT 
        cm.reservation_id,
        cm.sent_at,
        cm.message_type,
        r.*
    INTO v_result
    FROM confirmation_messages cm
    INNER JOIN reservations r ON r.id = cm.reservation_id
    WHERE r.customer_phone = p_customer_phone
      AND cm.status = 'sent'
      AND cm.sent_at >= NOW() - (p_hours_back || ' hours')::INTERVAL
      AND r.status = 'pending'
      AND r.reservation_date >= CURRENT_DATE
    ORDER BY cm.sent_at DESC
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'found', false,
            'message', 'No se encontró confirmación reciente'
        );
    END IF;
    
    RETURN json_build_object(
        'found', true,
        'reservation', row_to_json(v_result),
        'minutes_ago', EXTRACT(EPOCH FROM (NOW() - v_result.sent_at)) / 60
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. TRIGGER: ASIGNAR CÓDIGO AL CREAR RESERVA
-- =====================================================
CREATE OR REPLACE FUNCTION assign_reservation_code()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo asignar si no tiene código
    IF NEW.short_code IS NULL THEN
        NEW.short_code := generate_reservation_code();
        RAISE NOTICE 'Código asignado a reserva: %', NEW.short_code;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assign_reservation_code ON reservations;
CREATE TRIGGER trg_assign_reservation_code
    BEFORE INSERT ON reservations
    FOR EACH ROW
    EXECUTE FUNCTION assign_reservation_code();

-- =====================================================
-- 8. COMENTARIOS Y DOCUMENTACIÓN
-- =====================================================
COMMENT ON COLUMN reservations.short_code IS 'Código corto de 4 caracteres para identificar la reserva (ej: AB3F). Independiente de proveedor.';
COMMENT ON COLUMN confirmation_messages.provider_message_id IS 'ID del mensaje del proveedor (Twilio SID, WhatsApp Business ID, etc.)';
COMMENT ON COLUMN confirmation_messages.detection_method IS 'Método de detección: code (código en mensaje), recent (búsqueda temporal), context (contextual)';

COMMENT ON FUNCTION generate_reservation_code() IS 'Genera código único de 4 caracteres para reserva (evita caracteres ambiguos como O,0,I,1)';
COMMENT ON FUNCTION find_reservation_by_code(TEXT, TEXT) IS 'Busca reserva por código corto, opcionalmente filtrado por teléfono del cliente';
COMMENT ON FUNCTION find_recent_confirmation(TEXT, INTEGER) IS 'Busca la última confirmación enviada a un cliente en las últimas N horas';
COMMENT ON FUNCTION register_customer_confirmation(UUID, TEXT, TEXT, TEXT) IS 'Registra la confirmación o cancelación del cliente';

-- =====================================================
-- ✅ MIGRACIÓN COMPLETADA
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Sistema de confirmaciones con código corto instalado correctamente';
    RAISE NOTICE '📝 Códigos generados automáticamente para nuevas reservas';
    RAISE NOTICE '🔍 3 niveles de detección: código, temporal, contextual';
    RAISE NOTICE '🌐 Independiente de proveedor (Twilio, WhatsApp Business, etc.)';
END $$;

