-- ========================================
-- CUSTOMER CONFIRMATIONS - Sistema de Tracking de Confirmaciones
-- Fecha: 09 Octubre 2025
-- Descripción: Tabla para trackear todas las confirmaciones/respuestas de clientes en tiempo real
-- Objetivo: Calcular riesgo dinámico basado en comportamiento de respuesta
-- ========================================

-- 1. CREAR TABLA customer_confirmations
CREATE TABLE IF NOT EXISTS customer_confirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    restaurant_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    
    -- Mensaje enviado
    sent_at TIMESTAMPTZ NOT NULL,
    message_type VARCHAR NOT NULL CHECK (message_type IN ('Confirmación 24h antes', 'Recordatorio 4h antes', 'Llamada urgente', 'Mensaje manual')),
    message_channel VARCHAR NOT NULL DEFAULT 'whatsapp' CHECK (message_channel IN ('whatsapp', 'sms', 'email', 'phone')),
    message_content TEXT,
    
    -- Respuesta del cliente
    responded_at TIMESTAMPTZ,
    response_time_minutes INT, -- Calculado automáticamente: (responded_at - sent_at) en minutos
    response_content TEXT,
    confirmed BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- 2. ÍNDICES para rendimiento
CREATE INDEX idx_customer_confirmations_customer 
    ON customer_confirmations(customer_id, sent_at DESC);

CREATE INDEX idx_customer_confirmations_reservation 
    ON customer_confirmations(reservation_id, sent_at DESC);

CREATE INDEX idx_customer_confirmations_restaurant_date 
    ON customer_confirmations(restaurant_id, sent_at DESC);

CREATE INDEX idx_customer_confirmations_pending 
    ON customer_confirmations(sent_at) 
    WHERE responded_at IS NULL;

-- 3. TRIGGER para calcular response_time_minutes automáticamente
CREATE OR REPLACE FUNCTION calculate_response_time()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.responded_at IS NOT NULL AND OLD.responded_at IS NULL THEN
        NEW.response_time_minutes := EXTRACT(EPOCH FROM (NEW.responded_at - NEW.sent_at)) / 60;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_response_time
    BEFORE UPDATE ON customer_confirmations
    FOR EACH ROW
    EXECUTE FUNCTION calculate_response_time();

-- 4. TRIGGER para updated_at
CREATE OR REPLACE FUNCTION update_customer_confirmations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_customer_confirmations_updated_at
    BEFORE UPDATE ON customer_confirmations
    FOR EACH ROW
    EXECUTE FUNCTION update_customer_confirmations_updated_at();

-- 5. RLS (Row Level Security)
ALTER TABLE customer_confirmations ENABLE ROW LEVEL SECURITY;

-- Policy: SELECT filtrado por restaurant_id
CREATE POLICY "Users see own restaurant confirmations"
    ON customer_confirmations FOR SELECT
    TO authenticated
    USING (true);

-- Policy: INSERT permitido
CREATE POLICY "Users insert confirmations"
    ON customer_confirmations FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Policy: UPDATE permitido
CREATE POLICY "Users update confirmations"
    ON customer_confirmations FOR UPDATE
    TO authenticated
    USING (true);

-- 6. FUNCIÓN: Registrar confirmación de cliente
CREATE OR REPLACE FUNCTION record_customer_confirmation(
    p_reservation_id UUID,
    p_message_type VARCHAR,
    p_message_channel VARCHAR DEFAULT 'whatsapp',
    p_message_content TEXT DEFAULT NULL,
    p_response_content TEXT DEFAULT NULL,
    p_confirmed BOOLEAN DEFAULT FALSE
)
RETURNS UUID AS $$
DECLARE
    v_confirmation_id UUID;
    v_customer_id UUID;
    v_restaurant_id UUID;
    v_current_time TIMESTAMPTZ := timezone('utc', now());
BEGIN
    -- Obtener customer_id y restaurant_id de la reserva
    SELECT customer_id, restaurant_id
    INTO v_customer_id, v_restaurant_id
    FROM reservations
    WHERE id = p_reservation_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reservation not found: %', p_reservation_id;
    END IF;
    
    -- Insertar confirmación
    INSERT INTO customer_confirmations (
        customer_id,
        reservation_id,
        restaurant_id,
        sent_at,
        message_type,
        message_channel,
        message_content,
        responded_at,
        response_content,
        confirmed
    ) VALUES (
        v_customer_id,
        p_reservation_id,
        v_restaurant_id,
        v_current_time,
        p_message_type,
        p_message_channel,
        p_message_content,
        CASE WHEN p_response_content IS NOT NULL THEN v_current_time ELSE NULL END,
        p_response_content,
        p_confirmed
    )
    RETURNING id INTO v_confirmation_id;
    
    -- Si confirmó, actualizar timestamp en reservas
    IF p_confirmed THEN
        UPDATE reservations
        SET updated_at = v_current_time
        WHERE id = p_reservation_id;
    END IF;
    
    RETURN v_confirmation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. FUNCIÓN: Actualizar respuesta de cliente
CREATE OR REPLACE FUNCTION update_confirmation_response(
    p_confirmation_id UUID,
    p_response_content TEXT,
    p_confirmed BOOLEAN DEFAULT TRUE
)
RETURNS BOOLEAN AS $$
DECLARE
    v_reservation_id UUID;
BEGIN
    -- Actualizar confirmación
    UPDATE customer_confirmations
    SET 
        responded_at = timezone('utc', now()),
        response_content = p_response_content,
        confirmed = p_confirmed
    WHERE id = p_confirmation_id
    RETURNING reservation_id INTO v_reservation_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Si confirmó, actualizar reserva
    IF p_confirmed THEN
        UPDATE reservations
        SET updated_at = timezone('utc', now())
        WHERE id = v_reservation_id;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. FUNCIÓN: Calcular métricas de respuesta del cliente
CREATE OR REPLACE FUNCTION get_customer_response_metrics(p_customer_id UUID)
RETURNS TABLE(
    total_messages INT,
    total_responses INT,
    response_rate NUMERIC,
    avg_response_time_minutes INT,
    fast_responses INT,
    slow_responses INT,
    never_responded INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INT as total_messages,
        COUNT(responded_at)::INT as total_responses,
        CASE 
            WHEN COUNT(*) > 0 THEN 
                ROUND(COUNT(responded_at)::NUMERIC / COUNT(*)::NUMERIC, 3)
            ELSE 0
        END as response_rate,
        COALESCE(ROUND(AVG(response_time_minutes))::INT, 0) as avg_response_time_minutes,
        COUNT(*) FILTER (WHERE response_time_minutes < 60)::INT as fast_responses,
        COUNT(*) FILTER (WHERE response_time_minutes >= 360)::INT as slow_responses,
        COUNT(*) FILTER (WHERE responded_at IS NULL)::INT as never_responded
    FROM customer_confirmations
    WHERE customer_id = p_customer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. COMENTARIOS
COMMENT ON TABLE customer_confirmations IS 'Tracking de confirmaciones y respuestas de clientes para cálculo de riesgo dinámico';
COMMENT ON COLUMN customer_confirmations.message_type IS 'Confirmación 24h antes: Primera confirmación | Recordatorio 4h antes: Recordatorio | Llamada urgente: Llamada T-2h15m | Mensaje manual: Enviado manualmente';
COMMENT ON COLUMN customer_confirmations.response_time_minutes IS 'Tiempo de respuesta en minutos (calculado automáticamente)';
COMMENT ON FUNCTION record_customer_confirmation IS 'Registra envío de mensaje de confirmación y opcionalmente la respuesta';
COMMENT ON FUNCTION update_confirmation_response IS 'Actualiza la respuesta del cliente a una confirmación enviada';
COMMENT ON FUNCTION get_customer_response_metrics IS 'Obtiene métricas de comportamiento de respuesta del cliente';

-- ========================================
-- FIN DE MIGRACIÓN
-- ========================================

