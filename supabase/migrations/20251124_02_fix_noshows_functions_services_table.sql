-- =====================================================
-- MIGRACIÓN: Corregir funciones no-shows (AUDITORÍA COMPLETA)
-- Fecha: 2025-11-24
-- Problemas identificados:
--   1. get_risk_appointments_today usa tabla "services" eliminada
--   2. calculate_simple_risk_level usa valores incorrectos de message_type
-- Solución: 
--   1. Actualizar JOIN para usar business_services
--   2. Corregir valores de message_type ('24h', '4h' en lugar de textos largos)
-- =====================================================

-- =====================================================
-- FUNCIÓN: Obtener citas con riesgo HOY (CORREGIDA)
-- =====================================================
CREATE OR REPLACE FUNCTION get_risk_appointments_today(p_business_id UUID)
RETURNS TABLE (
    appointment_id UUID,
    customer_name VARCHAR(255),
    customer_phone VARCHAR(50),
    appointment_date DATE,
    appointment_time TIME,
    service_name VARCHAR(255),
    duration_minutes INTEGER,
    risk_level TEXT,
    risk_color TEXT,
    risk_emoji TEXT,
    why_risk TEXT,
    what_to_do TEXT,
    confirmed_24h BOOLEAN,
    confirmed_4h BOOLEAN,
    hours_until NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        a.customer_name,
        a.customer_phone,
        a.appointment_date,
        a.appointment_time,
        COALESCE(bs.name, 'Servicio') AS service_name,
        a.duration_minutes,
        r.risk_level,
        r.risk_color,
        r.risk_emoji,
        r.why_risk,
        r.what_to_do,
        r.confirmed_24h,
        r.confirmed_4h,
        r.hours_until_appointment
    FROM appointments a
    LEFT JOIN business_services bs ON a.service_id = bs.id
    CROSS JOIN LATERAL calculate_simple_risk_level(a.id) r
    WHERE a.business_id = p_business_id
      AND a.appointment_date = CURRENT_DATE
      AND a.status IN ('confirmed', 'pending')
    ORDER BY 
        CASE r.risk_level
            WHEN 'high' THEN 1
            WHEN 'medium' THEN 2
            WHEN 'low' THEN 3
        END,
        a.appointment_time ASC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCIÓN: Calcular riesgo SIMPLIFICADO (CORREGIDA)
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_simple_risk_level(p_appointment_id UUID)
RETURNS TABLE (
    risk_level TEXT,          -- 'low', 'medium', 'high'
    risk_color TEXT,          -- 'green', 'yellow', 'red'
    risk_emoji TEXT,          -- '🟢', '🟡', '🔴'
    why_risk TEXT,            -- Explicación en lenguaje humano
    what_to_do TEXT,          -- Acción recomendada clara
    confirmed_24h BOOLEAN,    -- ¿Confirmó a las 24h?
    confirmed_4h BOOLEAN,     -- ¿Confirmó a las 4h?
    has_previous_noshows BOOLEAN,
    booking_advance_days INTEGER,
    hours_until_appointment NUMERIC
) AS $$
DECLARE
    v_appointment RECORD;
    v_customer RECORD;
    v_confirmations RECORD;
    v_hours_until NUMERIC;
    v_confirmed_24h BOOLEAN := false;
    v_confirmed_4h BOOLEAN := false;
    v_has_noshows BOOLEAN := false;
    v_booking_days INTEGER := 0;
    v_risk TEXT := 'low';
    v_color TEXT := 'green';
    v_emoji TEXT := '🟢';
    v_why TEXT := '';
    v_what TEXT := '';
BEGIN
    -- 1. Obtener datos de la cita
    SELECT a.*, 
           EXTRACT(EPOCH FROM (
               (a.appointment_date + a.appointment_time) - now()
           )) / 3600.0 AS hours_until
    INTO v_appointment
    FROM appointments a
    WHERE a.id = p_appointment_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    v_hours_until := v_appointment.hours_until;

    -- 2. Obtener datos del cliente
    SELECT 
        c.*,
        COALESCE(
            (SELECT COUNT(*) FROM appointments 
             WHERE customer_id = c.id 
             AND status = 'no_show'
            ), 0
        ) AS noshow_count,
        EXTRACT(DAY FROM now() - c.created_at) AS booking_days_ago
    INTO v_customer
    FROM customers c
    WHERE c.id = v_appointment.customer_id;

    IF FOUND THEN
        v_has_noshows := v_customer.noshow_count > 0;
        v_booking_days := COALESCE(v_customer.booking_days_ago, 0);
    END IF;

    -- 3. Obtener confirmaciones (CORREGIDO: usar valores correctos de message_type)
    SELECT 
        COALESCE(
            (SELECT COUNT(*) > 0 FROM customer_confirmations 
             WHERE appointment_id = p_appointment_id 
             AND message_type = '24h'  -- ✅ CORREGIDO: era 'Confirmación 24h antes'
             AND confirmed = true
            ), false
        ) AS conf_24h,
        COALESCE(
            (SELECT COUNT(*) > 0 FROM customer_confirmations 
             WHERE appointment_id = p_appointment_id 
             AND message_type = '4h'  -- ✅ CORREGIDO: era 'Recordatorio 4h antes'
             AND confirmed = true
            ), false
        ) AS conf_4h
    INTO v_confirmed_24h, v_confirmed_4h;

    -- =====================================================
    -- LÓGICA SIMPLIFICADA (Árbol de Decisión)
    -- =====================================================

    -- REGLA 1: Si confirmó → BAJO RIESGO (siempre)
    IF v_confirmed_24h OR v_confirmed_4h THEN
        v_risk := 'low';
        v_color := 'green';
        v_emoji := '🟢';
        v_why := 'Ha confirmado su asistencia';
        v_what := 'Todo correcto - esperar al cliente';
        
    -- REGLA 2: Faltan menos de 2h y NO confirmó → ALTO RIESGO
    ELSIF v_hours_until < 2 AND v_hours_until > 0 THEN
        v_risk := 'high';
        v_color := 'red';
        v_emoji := '🔴';
        v_why := 'Faltan menos de 2 horas y no ha confirmado';
        v_what := 'LLAMAR AHORA para confirmar o cancelar';
        
    -- REGLA 3: Tiene no-shows previos → ALTO RIESGO
    ELSIF v_has_noshows THEN
        v_risk := 'high';
        v_color := 'red';
        v_emoji := '🔴';
        v_why := 'Tiene no-shows previos y no ha confirmado';
        v_what := 'Enviar WhatsApp recordatorio urgente';
        
    -- REGLA 4: Reservó con menos de 24h → MEDIO RIESGO
    ELSIF v_booking_days < 1 THEN
        v_risk := 'medium';
        v_color := 'yellow';
        v_emoji := '🟡';
        v_why := 'Reservó con poca antelación (menos de 24h)';
        v_what := 'Enviar confirmación y hacer seguimiento';
        
    -- REGLA 5: No ha confirmado pero sin banderas rojas → MEDIO RIESGO
    ELSIF NOT v_confirmed_24h AND v_hours_until < 24 THEN
        v_risk := 'medium';
        v_color := 'yellow';
        v_emoji := '🟡';
        v_why := 'Aún no ha confirmado su cita';
        v_what := 'Enviar recordatorio por WhatsApp';
        
    -- REGLA 6: Todo OK → BAJO RIESGO
    ELSE
        v_risk := 'low';
        v_color := 'green';
        v_emoji := '🟢';
        v_why := 'Cliente confiable sin señales de riesgo';
        v_what := 'Seguir proceso normal de confirmación';
    END IF;

    -- Retornar resultado
    RETURN QUERY SELECT 
        v_risk,
        v_color,
        v_emoji,
        v_why,
        v_what,
        v_confirmed_24h,
        v_confirmed_4h,
        v_has_noshows,
        v_booking_days,
        v_hours_until;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMENTARIOS
-- =====================================================
COMMENT ON FUNCTION get_risk_appointments_today IS 'Lista citas de HOY con riesgo, ordenadas por prioridad. CORREGIDA: usa business_services en lugar de services';
COMMENT ON FUNCTION calculate_simple_risk_level IS 'Calcula riesgo con solo 3 niveles (bajo/medio/alto). CORREGIDA: usa valores correctos de message_type (24h, 4h)';

