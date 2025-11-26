-- =====================================================
-- MIGRACIÓN: Sistema No-Shows - Risk Intelligence (CORREGIDA)
-- Fecha: 2025-11-23
-- Descripción: Sistema de scoring inteligente para evaluar 
--              el riesgo de no-show de cada cliente
-- =====================================================

-- =====================================================
-- 1. FUNCIÓN: calculate_smart_risk_score()
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_smart_risk_score(p_customer_id UUID)
RETURNS TABLE (
    risk_score INTEGER,
    risk_level TEXT,
    should_auto_cancel BOOLEAN,
    reasons JSONB
) AS $$
DECLARE
    v_total_appointments INTEGER;
    v_no_shows INTEGER;
    v_completed INTEGER;
    v_confirmations_sent INTEGER;
    v_confirmations_responded INTEGER;
    v_customer_age_days INTEGER;
    v_last_noshow_days INTEGER;
    
    v_score INTEGER := 0;
    v_level TEXT;
    v_auto_cancel BOOLEAN;
    v_reasons JSONB := '{}'::JSONB;
BEGIN
    -- 1. Obtener métricas del cliente
    SELECT 
        COALESCE(c.no_show_count, 0),
        EXTRACT(DAY FROM NOW() - c.created_at)::INTEGER
    INTO v_no_shows, v_customer_age_days
    FROM customers c
    WHERE c.id = p_customer_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cliente % no encontrado', p_customer_id;
    END IF;
    
    -- Total de appointments completados/no-shows
    SELECT 
        COUNT(*) FILTER (WHERE status IN ('completed', 'no_show')),
        COUNT(*) FILTER (WHERE status = 'completed')
    INTO v_total_appointments, v_completed
    FROM appointments
    WHERE customer_id = p_customer_id;
    
    -- Confirmaciones
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE confirmed = TRUE)
    INTO v_confirmations_sent, v_confirmations_responded
    FROM customer_confirmations
    WHERE customer_id = p_customer_id;
    
    -- Último no-show
    SELECT EXTRACT(DAY FROM NOW() - MAX(appointment_date))::INTEGER
    INTO v_last_noshow_days
    FROM appointments
    WHERE customer_id = p_customer_id
    AND status = 'no_show';
    
    -- =====================================================
    -- 2. ALGORITMO DE SCORING (0-100)
    -- =====================================================
    
    -- Factor 1: Tasa de no-shows histórica (0-40 puntos)
    IF v_total_appointments > 0 THEN
        v_score := v_score + LEAST(40, ROUND((v_no_shows::DECIMAL / v_total_appointments) * 100));
        v_reasons := v_reasons || jsonb_build_object(
            'noshow_rate', ROUND((v_no_shows::DECIMAL / v_total_appointments) * 100, 2)
        );
    END IF;
    
    -- Factor 2: No-shows recientes (0-25 puntos)
    IF v_no_shows > 0 THEN
        IF v_last_noshow_days IS NULL OR v_last_noshow_days < 30 THEN
            v_score := v_score + 25;
            v_reasons := v_reasons || jsonb_build_object('recent_noshow', true);
        ELSIF v_last_noshow_days < 90 THEN
            v_score := v_score + 15;
            v_reasons := v_reasons || jsonb_build_object('recent_noshow', 'medium');
        END IF;
    END IF;
    
    -- Factor 3: Tasa de confirmación (0-20 puntos)
    IF v_confirmations_sent > 0 THEN
        DECLARE
            v_confirmation_rate DECIMAL;
        BEGIN
            v_confirmation_rate := (v_confirmations_responded::DECIMAL / v_confirmations_sent);
            
            IF v_confirmation_rate < 0.3 THEN
                v_score := v_score + 20;
            ELSIF v_confirmation_rate < 0.5 THEN
                v_score := v_score + 10;
            ELSIF v_confirmation_rate > 0.8 THEN
                v_score := v_score - 10;
            END IF;
            
            v_reasons := v_reasons || jsonb_build_object(
                'confirmation_rate', ROUND(v_confirmation_rate * 100, 2)
            );
        END;
    END IF;
    
    -- Factor 4: Cliente nuevo vs antiguo (0-15 puntos)
    IF v_customer_age_days < 30 AND v_total_appointments < 3 THEN
        v_score := v_score + 15;
        v_reasons := v_reasons || jsonb_build_object('new_customer', true);
    ELSIF v_customer_age_days > 180 AND v_completed > 10 THEN
        v_score := v_score - 10;
        v_reasons := v_reasons || jsonb_build_object('loyal_customer', true);
    END IF;
    
    -- Normalizar score (0-100)
    v_score := LEAST(100, GREATEST(0, v_score));
    
    -- =====================================================
    -- 3. CLASIFICACIÓN DE RIESGO
    -- =====================================================
    
    IF v_score >= 70 THEN
        v_level := 'CRITICAL';
        v_auto_cancel := TRUE;
    ELSIF v_score >= 50 THEN
        v_level := 'HIGH';
        v_auto_cancel := FALSE;
    ELSIF v_score >= 30 THEN
        v_level := 'MEDIUM';
        v_auto_cancel := FALSE;
    ELSE
        v_level := 'LOW';
        v_auto_cancel := FALSE;
    END IF;
    
    -- Añadir métricas al resultado
    v_reasons := v_reasons || jsonb_build_object(
        'total_appointments', v_total_appointments,
        'total_noshows', v_no_shows,
        'confirmations_sent', v_confirmations_sent,
        'confirmations_responded', v_confirmations_responded,
        'customer_age_days', v_customer_age_days
    );
    
    RETURN QUERY SELECT v_score, v_level, v_auto_cancel, v_reasons;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_smart_risk_score IS 
'Calcula un risk_score inteligente (0-100) para un cliente.
- CRITICAL (70+): Auto-cancelar si no confirma
- HIGH (50-69): Alertar al staff, NO auto-cancelar
- MEDIUM (30-49): Seguimiento normal
- LOW (0-29): Cliente confiable

Uso: SELECT * FROM calculate_smart_risk_score(customer_id)';

-- =====================================================
-- 2. FUNCIÓN: get_high_risk_appointments()
-- =====================================================

CREATE OR REPLACE FUNCTION get_high_risk_appointments(
    p_business_id UUID,
    p_hours_ahead INTEGER DEFAULT 2
) RETURNS TABLE (
    appointment_id UUID,
    customer_id UUID,
    customer_name TEXT,
    appointment_date DATE,
    appointment_time TIME,
    risk_score INTEGER,
    risk_level TEXT,
    should_auto_cancel BOOLEAN,
    confirmed BOOLEAN,
    reasons JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        a.customer_id,
        COALESCE(c.name, a.customer_name) AS customer_name,
        a.appointment_date,
        a.appointment_time,
        risk.risk_score,
        risk.risk_level,
        risk.should_auto_cancel,
        COALESCE(
            (SELECT cc.confirmed 
             FROM customer_confirmations cc
             WHERE cc.appointment_id = a.id
             AND cc.message_type = '2h'
             ORDER BY cc.sent_at DESC
             LIMIT 1),
            FALSE
        ) AS confirmed,
        risk.reasons
    FROM appointments a
    LEFT JOIN customers c ON a.customer_id = c.id
    CROSS JOIN LATERAL calculate_smart_risk_score(a.customer_id) AS risk
    WHERE a.business_id = p_business_id
    AND a.status IN ('pending', 'confirmed')
    AND a.appointment_date = CURRENT_DATE
    AND a.appointment_time BETWEEN 
        CURRENT_TIME 
        AND (CURRENT_TIME + (p_hours_ahead || ' hours')::INTERVAL)
    AND risk.risk_score >= 50
    ORDER BY risk.risk_score DESC, a.appointment_time ASC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_high_risk_appointments IS 
'Lista appointments de alto riesgo en las próximas N horas.
Uso: SELECT * FROM get_high_risk_appointments(business_id, 2)';

-- =====================================================
-- 3. VISTA: appointments_with_risk
-- =====================================================

CREATE OR REPLACE VIEW appointments_with_risk AS
SELECT 
    a.id AS appointment_id,
    a.business_id,
    a.customer_id,
    COALESCE(c.name, a.customer_name) AS customer_name,
    COALESCE(c.phone, a.customer_phone) AS customer_phone,
    a.appointment_date,
    a.appointment_time,
    a.status,
    a.service_id,
    a.employee_id,
    a.resource_id,
    risk.risk_score,
    risk.risk_level,
    risk.should_auto_cancel,
    risk.reasons,
    (SELECT cc.confirmed 
     FROM customer_confirmations cc 
     WHERE cc.appointment_id = a.id 
     ORDER BY cc.sent_at DESC 
     LIMIT 1) AS last_confirmation_status,
    (SELECT cc.sent_at 
     FROM customer_confirmations cc 
     WHERE cc.appointment_id = a.id 
     ORDER BY cc.sent_at DESC 
     LIMIT 1) AS last_confirmation_sent_at
FROM appointments a
LEFT JOIN customers c ON a.customer_id = c.id
CROSS JOIN LATERAL calculate_smart_risk_score(a.customer_id) AS risk
WHERE a.status NOT IN ('cancelled', 'no_show', 'completed');

COMMENT ON VIEW appointments_with_risk IS 
'Vista que muestra todos los appointments activos con su risk_score calculado en tiempo real.
Uso: SELECT * FROM appointments_with_risk WHERE risk_level = ''CRITICAL''';

-- =====================================================
-- 4. FUNCIÓN: get_noshow_stats()
-- =====================================================

CREATE OR REPLACE FUNCTION get_noshow_stats(
    p_business_id UUID,
    p_date_from DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    p_date_to DATE DEFAULT CURRENT_DATE
) RETURNS TABLE (
    total_appointments INTEGER,
    total_noshows INTEGER,
    noshow_rate DECIMAL,
    total_confirmations_sent INTEGER,
    confirmations_responded INTEGER,
    confirmation_response_rate DECIMAL,
    prevented_noshows INTEGER,
    avg_risk_score DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT a.id)::INTEGER,
        COUNT(DISTINCT CASE WHEN a.status = 'no_show' THEN a.id END)::INTEGER,
        ROUND(
            COUNT(DISTINCT CASE WHEN a.status = 'no_show' THEN a.id END)::DECIMAL / 
            NULLIF(COUNT(DISTINCT a.id), 0) * 100, 
            2
        ),
        COUNT(DISTINCT cc.id)::INTEGER,
        COUNT(DISTINCT CASE WHEN cc.confirmed THEN cc.id END)::INTEGER,
        ROUND(
            COUNT(DISTINCT CASE WHEN cc.confirmed THEN cc.id END)::DECIMAL / 
            NULLIF(COUNT(DISTINCT cc.id), 0) * 100, 
            2
        ),
        COUNT(DISTINCT CASE 
            WHEN a.status = 'completed' 
            AND EXISTS (
                SELECT 1 FROM customer_confirmations cc2 
                WHERE cc2.appointment_id = a.id 
                AND cc2.confirmed = TRUE
            ) THEN a.id 
        END)::INTEGER,
        ROUND(AVG(risk.risk_score), 2)
    FROM appointments a
    LEFT JOIN customer_confirmations cc ON cc.appointment_id = a.id
    LEFT JOIN LATERAL calculate_smart_risk_score(a.customer_id) AS risk ON TRUE
    WHERE a.business_id = p_business_id
    AND a.appointment_date BETWEEN p_date_from AND p_date_to;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_noshow_stats IS 
'Estadísticas agregadas de no-shows y confirmaciones en un periodo.
Uso: SELECT * FROM get_noshow_stats(business_id, ''2025-01-01'', ''2025-01-31'')';

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================

SELECT 'Migración 20251123_03_noshows_risk_intelligence_FIXED completada exitosamente' AS status;








