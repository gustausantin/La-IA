-- =====================================================
-- SISTEMA DE CONFIRMACIONES INTELIGENTE
-- =====================================================
-- Fecha: 22 Octubre 2025
-- Objetivo: Evitar duplicados y cubrir todas las reservas
-- =====================================================

-- 1. TABLA: confirmation_messages
CREATE TABLE IF NOT EXISTS confirmation_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    
    -- Tipo de mensaje
    message_type TEXT NOT NULL CHECK (message_type IN ('24h', '4h', '2h', 'immediate')),
    
    -- Información del envío
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending')),
    
    -- Metadatos
    customer_phone TEXT,
    customer_name TEXT,
    reservation_date DATE,
    reservation_time TIME,
    
    -- Detalle del mensaje
    message_content TEXT,
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. ÍNDICES para Performance
CREATE INDEX idx_confirmation_messages_reservation ON confirmation_messages(reservation_id);
CREATE INDEX idx_confirmation_messages_restaurant ON confirmation_messages(restaurant_id);
CREATE INDEX idx_confirmation_messages_type ON confirmation_messages(message_type);
CREATE INDEX idx_confirmation_messages_status ON confirmation_messages(status);
CREATE INDEX idx_confirmation_messages_sent_at ON confirmation_messages(sent_at);

-- Índice compuesto para búsquedas de duplicados
CREATE UNIQUE INDEX idx_confirmation_messages_unique 
ON confirmation_messages(reservation_id, message_type) 
WHERE status = 'sent';

-- 3. RLS (Row Level Security)
ALTER TABLE confirmation_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Los restaurantes solo ven sus propios mensajes
CREATE POLICY "Restaurants can view their own confirmation messages"
ON confirmation_messages
FOR SELECT
USING (restaurant_id = auth.uid() OR restaurant_id IN (
    SELECT id FROM restaurants WHERE owner_id = auth.uid()
));

-- Policy: Sistema puede insertar
CREATE POLICY "System can insert confirmation messages"
ON confirmation_messages
FOR INSERT
WITH CHECK (true);

-- Policy: Sistema puede actualizar
CREATE POLICY "System can update confirmation messages"
ON confirmation_messages
FOR UPDATE
USING (true);

-- 4. FUNCIÓN: Verificar si ya se envió mensaje
CREATE OR REPLACE FUNCTION check_confirmation_sent(
    p_reservation_id UUID,
    p_message_type TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS(
        SELECT 1 
        FROM confirmation_messages
        WHERE reservation_id = p_reservation_id
          AND message_type = p_message_type
          AND status = 'sent'
    );
END;
$$;

-- 5. FUNCIÓN: Registrar envío de confirmación
CREATE OR REPLACE FUNCTION register_confirmation_message(
    p_reservation_id UUID,
    p_restaurant_id UUID,
    p_message_type TEXT,
    p_status TEXT DEFAULT 'sent',
    p_customer_phone TEXT DEFAULT NULL,
    p_customer_name TEXT DEFAULT NULL,
    p_reservation_date DATE DEFAULT NULL,
    p_reservation_time TIME DEFAULT NULL,
    p_message_content TEXT DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_message_id UUID;
BEGIN
    -- Verificar si ya existe un mensaje exitoso del mismo tipo
    IF check_confirmation_sent(p_reservation_id, p_message_type) THEN
        RAISE NOTICE 'Ya existe un mensaje % exitoso para esta reserva', p_message_type;
        RETURN NULL;
    END IF;
    
    -- Insertar nuevo mensaje
    INSERT INTO confirmation_messages (
        reservation_id,
        restaurant_id,
        message_type,
        status,
        customer_phone,
        customer_name,
        reservation_date,
        reservation_time,
        message_content,
        error_message
    ) VALUES (
        p_reservation_id,
        p_restaurant_id,
        p_message_type,
        p_status,
        p_customer_phone,
        p_customer_name,
        p_reservation_date,
        p_reservation_time,
        p_message_content,
        p_error_message
    )
    RETURNING id INTO v_message_id;
    
    RAISE NOTICE 'Mensaje % registrado con ID: %', p_message_type, v_message_id;
    
    RETURN v_message_id;
END;
$$;

-- 6. FUNCIÓN: Obtener estadísticas de confirmaciones
CREATE OR REPLACE FUNCTION get_confirmation_stats(
    p_restaurant_id UUID,
    p_days_ago INTEGER DEFAULT 30
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_build_object(
        'total_sent', COUNT(*) FILTER (WHERE status = 'sent'),
        'total_failed', COUNT(*) FILTER (WHERE status = 'failed'),
        'by_type', json_build_object(
            '24h', COUNT(*) FILTER (WHERE message_type = '24h' AND status = 'sent'),
            '4h', COUNT(*) FILTER (WHERE message_type = '4h' AND status = 'sent'),
            '2h', COUNT(*) FILTER (WHERE message_type = '2h' AND status = 'sent'),
            'immediate', COUNT(*) FILTER (WHERE message_type = 'immediate' AND status = 'sent')
        ),
        'success_rate', ROUND(
            (COUNT(*) FILTER (WHERE status = 'sent')::NUMERIC / 
             NULLIF(COUNT(*), 0) * 100), 
            2
        )
    )
    INTO v_result
    FROM confirmation_messages
    WHERE restaurant_id = p_restaurant_id
      AND sent_at >= NOW() - (p_days_ago || ' days')::INTERVAL;
    
    RETURN v_result;
END;
$$;

-- 7. TRIGGER: Actualizar updated_at
CREATE OR REPLACE FUNCTION update_confirmation_messages_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_confirmation_messages_updated_at
    BEFORE UPDATE ON confirmation_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_confirmation_messages_updated_at();

-- 8. COMENTARIOS
COMMENT ON TABLE confirmation_messages IS 
'Registro de todos los mensajes de confirmación enviados para evitar duplicados y hacer seguimiento';

COMMENT ON COLUMN confirmation_messages.message_type IS 
'Tipo de recordatorio: 24h (día anterior), 4h (4 horas antes), 2h (2 horas antes), immediate (al crear reserva)';

COMMENT ON FUNCTION check_confirmation_sent IS 
'Verifica si ya se envió un mensaje de confirmación de un tipo específico para una reserva';

COMMENT ON FUNCTION register_confirmation_message IS 
'Registra el envío de un mensaje de confirmación, evitando duplicados';

COMMENT ON FUNCTION get_confirmation_stats IS 
'Obtiene estadísticas de mensajes de confirmación enviados por un restaurante';

-- 9. PERMISOS
GRANT EXECUTE ON FUNCTION check_confirmation_sent TO service_role;
GRANT EXECUTE ON FUNCTION check_confirmation_sent TO authenticated;
GRANT EXECUTE ON FUNCTION register_confirmation_message TO service_role;
GRANT EXECUTE ON FUNCTION register_confirmation_message TO authenticated;
GRANT EXECUTE ON FUNCTION get_confirmation_stats TO service_role;
GRANT EXECUTE ON FUNCTION get_confirmation_stats TO authenticated;

-- =====================================================
-- EJEMPLO DE USO
-- =====================================================

-- Verificar si ya se envió un mensaje de 24h
-- SELECT check_confirmation_sent('reservation-uuid'::UUID, '24h');

-- Registrar envío de mensaje
-- SELECT register_confirmation_message(
--     'reservation-uuid'::UUID,
--     'restaurant-uuid'::UUID,
--     'immediate',
--     'sent',
--     '+34612345678',
--     'Juan Pérez',
--     '2025-10-22'::DATE,
--     '20:00:00'::TIME,
--     'Hola Juan, tu reserva para esta noche a las 20:00 está confirmada!'
-- );

-- Ver estadísticas
-- SELECT get_confirmation_stats('restaurant-uuid'::UUID, 30);

-- =====================================================
-- NOTAS TÉCNICAS
-- =====================================================
-- 1. El índice único previene duplicados a nivel de BD
-- 2. La función check_confirmation_sent es rápida (usa índice)
-- 3. RLS protege datos sensibles por restaurante
-- 4. Las estadísticas ayudan a monitorear el sistema
-- 5. ON DELETE CASCADE limpia mensajes al borrar reserva
-- =====================================================

