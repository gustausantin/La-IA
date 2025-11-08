-- =====================================================
-- SISTEMA NO-SHOWS SIMPLIFICADO - Versión 3.0
-- Fecha: 8 de Noviembre 2025
-- Cambios: Adaptado para peluquerías, fisios, spas (NO restaurantes)
-- =====================================================

-- =====================================================
-- LIMPIAR FUNCIONES ANTERIORES (con CASCADE para eliminar dependencias)
-- =====================================================
DROP FUNCTION IF EXISTS calculate_simple_risk_level(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_risk_appointments_today(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_simple_noshow_metrics(UUID) CASCADE;

-- =====================================================
-- FUNCIÓN: Calcular riesgo SIMPLIFICADO (solo 3 niveles)
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

    -- 3. Obtener confirmaciones
    SELECT 
        COALESCE(
            (SELECT COUNT(*) > 0 FROM customer_confirmations 
             WHERE appointment_id = p_appointment_id 
             AND message_type = 'Confirmación 24h antes' 
             AND confirmed = true
            ), false
        ) AS conf_24h,
        COALESCE(
            (SELECT COUNT(*) > 0 FROM customer_confirmations 
             WHERE appointment_id = p_appointment_id 
             AND message_type = 'Recordatorio 4h antes' 
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
-- FUNCIÓN: Obtener citas con riesgo HOY (simplificada)
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
        s.name AS service_name,
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
    LEFT JOIN services s ON a.service_id = s.id
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
-- FUNCIÓN: Métricas simplificadas
-- =====================================================
CREATE OR REPLACE FUNCTION get_simple_noshow_metrics(p_business_id UUID)
RETURNS TABLE (
    today_confirmed INTEGER,
    today_pending INTEGER,
    today_high_risk INTEGER,
    this_month_prevented INTEGER,
    this_month_occurred INTEGER,
    success_rate NUMERIC,
    estimated_savings NUMERIC
) AS $$
DECLARE
    v_today_confirmed INTEGER := 0;
    v_today_pending INTEGER := 0;
    v_today_high_risk INTEGER := 0;
    v_prevented INTEGER := 0;
    v_occurred INTEGER := 0;
    v_success_rate NUMERIC := 0;
    v_avg_ticket NUMERIC := 45.00; -- Ticket promedio, ajustable
BEGIN
    -- Citas de HOY por estado de confirmación
    SELECT 
        COUNT(*) FILTER (WHERE r.confirmed_24h OR r.confirmed_4h),
        COUNT(*) FILTER (WHERE NOT (r.confirmed_24h OR r.confirmed_4h)),
        COUNT(*) FILTER (WHERE r.risk_level = 'high')
    INTO v_today_confirmed, v_today_pending, v_today_high_risk
    FROM appointments a
    CROSS JOIN LATERAL calculate_simple_risk_level(a.id) r
    WHERE a.business_id = p_business_id
      AND a.appointment_date = CURRENT_DATE
      AND a.status IN ('confirmed', 'pending');

    -- No-shows evitados y ocurridos este mes
    -- Evitados = citas completadas que tenían riesgo
    -- Ocurridos = citas marcadas como no_show
    SELECT 
        COUNT(*) FILTER (WHERE a.status = 'completed' AND EXISTS (
            SELECT 1 FROM customer_confirmations cc 
            WHERE cc.appointment_id = a.id AND cc.confirmed = true
        )),
        COUNT(*) FILTER (WHERE a.status = 'no_show')
    INTO v_prevented, v_occurred
    FROM appointments a
    WHERE a.business_id = p_business_id
      AND a.appointment_date >= date_trunc('month', CURRENT_DATE)
      AND a.appointment_date < date_trunc('month', CURRENT_DATE) + interval '1 month';

    -- Calcular tasa de éxito
    IF (v_prevented + v_occurred) > 0 THEN
        v_success_rate := ROUND((v_prevented::NUMERIC / (v_prevented + v_occurred)) * 100, 1);
    END IF;

    RETURN QUERY SELECT 
        v_today_confirmed,
        v_today_pending,
        v_today_high_risk,
        v_prevented,
        v_occurred,
        v_success_rate,
        v_prevented * v_avg_ticket;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMENTARIOS
-- =====================================================
COMMENT ON FUNCTION calculate_simple_risk_level IS 'Calcula riesgo con solo 3 niveles (bajo/medio/alto) en lenguaje humano';
COMMENT ON FUNCTION get_risk_appointments_today IS 'Lista citas de HOY con riesgo, ordenadas por prioridad';
COMMENT ON FUNCTION get_simple_noshow_metrics IS 'Métricas simples sin complejidad técnica';

-- =====================================================
-- TESTING
-- =====================================================
-- Para probar:
-- SELECT * FROM calculate_simple_risk_level('appointment-id'::UUID);
-- SELECT * FROM get_risk_appointments_today('business-id'::UUID);
-- SELECT * FROM get_simple_noshow_metrics('business-id'::UUID);

