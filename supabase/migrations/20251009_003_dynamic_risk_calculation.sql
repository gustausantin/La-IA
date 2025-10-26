-- ========================================
-- DYNAMIC RISK CALCULATION - Cálculo de Riesgo Dinámico de No-Shows
-- Fecha: 09 Octubre 2025
-- Descripción: Extiende el sistema de riesgo para ajustarse dinámicamente según confirmaciones
-- ========================================

-- 1. FUNCIÓN: Calcular riesgo dinámico para una reserva específica
CREATE OR REPLACE FUNCTION calculate_dynamic_risk_score(p_reservation_id UUID)
RETURNS TABLE(
    risk_score INT,
    risk_level TEXT,
    risk_factors JSONB,
    recommended_action TEXT,
    confirmation_history JSONB
) AS $$
DECLARE
    v_base_score INT := 0;
    v_dynamic_adjustment INT := 0;
    v_final_score INT;
    v_reservation RECORD;
    v_customer_history RECORD;
    v_confirmations JSONB;
    v_factors JSONB := '[]'::JSONB;
    v_hours_until_reservation NUMERIC;
    v_has_any_confirmation BOOLEAN;
BEGIN
    -- Obtener datos de la reserva
    SELECT 
        r.id,
        r.customer_id,
        r.customer_name,
        r.reservation_date,
        r.reservation_time,
        r.party_size,
        r.reservation_channel
    INTO v_reservation
    FROM reservations r
    WHERE r.id = p_reservation_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reservation not found: %', p_reservation_id;
    END IF;
    
    -- Obtener historial del cliente
    SELECT 
        COUNT(*) as total_visits,
        COUNT(*) FILTER (WHERE status = 'noshow') as total_noshows,
        CASE 
            WHEN COUNT(*) > 0 THEN 
                COUNT(*) FILTER (WHERE status = 'noshow')::NUMERIC / COUNT(*)::NUMERIC
            ELSE 0
        END as noshow_rate,
        CURRENT_DATE - MAX(reservation_date) as days_since_last
    INTO v_customer_history
    FROM reservations
    WHERE customer_id = v_reservation.customer_id
    AND id != p_reservation_id;
    
    -- ========================================
    -- CÁLCULO BASE (7 FACTORES ESTÁTICOS)
    -- ========================================
    
    -- Factor 1: Historial del cliente (0-40 pts)
    IF v_customer_history.noshow_rate > 0.3 THEN
        v_base_score := v_base_score + 40;
        v_factors := v_factors || jsonb_build_object(
            'factor', 'Historial alto de no-shows',
            'points', 40,
            'value', ROUND(v_customer_history.noshow_rate * 100) || '%'
        );
    ELSIF v_customer_history.noshow_rate > 0.1 THEN
        v_base_score := v_base_score + 20;
        v_factors := v_factors || jsonb_build_object(
            'factor', 'Historial moderado de no-shows',
            'points', 20,
            'value', ROUND(v_customer_history.noshow_rate * 100) || '%'
        );
    END IF;
    
    -- Factor 2: Inactividad (0-25 pts)
    IF v_customer_history.days_since_last > 180 THEN
        v_base_score := v_base_score + 25;
        v_factors := v_factors || jsonb_build_object(
            'factor', 'Cliente inactivo >6 meses',
            'points', 25,
            'value', v_customer_history.days_since_last || ' días'
        );
    ELSIF v_customer_history.days_since_last > 90 THEN
        v_base_score := v_base_score + 15;
        v_factors := v_factors || jsonb_build_object(
            'factor', 'Cliente poco frecuente',
            'points', 15,
            'value', v_customer_history.days_since_last || ' días'
        );
    END IF;
    
    -- Factor 3: Horario de riesgo (0-15 pts)
    IF EXTRACT(HOUR FROM v_reservation.reservation_time) >= 21 THEN
        v_base_score := v_base_score + 15;
        v_factors := v_factors || jsonb_build_object(
            'factor', 'Horario de alto riesgo',
            'points', 15,
            'value', to_char(v_reservation.reservation_time, 'HH24:MI')
        );
    END IF;
    
    -- Factor 4: Tamaño de grupo (0-10 pts)
    IF v_reservation.party_size >= 6 THEN
        v_base_score := v_base_score + 10;
        v_factors := v_factors || jsonb_build_object(
            'factor', 'Grupo grande',
            'points', 10,
            'value', v_reservation.party_size || ' personas'
        );
    END IF;
    
    -- Factor 5: Canal de reserva (0-10 pts)
    IF v_reservation.reservation_channel IN ('phone', 'walk-in', 'manual') THEN
        v_base_score := v_base_score + 10;
        v_factors := v_factors || jsonb_build_object(
            'factor', 'Canal menos comprometido',
            'points', 10,
            'value', v_reservation.reservation_channel
        );
    END IF;
    
    -- Factor 6: Antelación (0-20 pts)
    IF (v_reservation.reservation_date - CURRENT_DATE) < 1 THEN
        v_base_score := v_base_score + 20;
        v_factors := v_factors || jsonb_build_object(
            'factor', 'Reserva muy reciente',
            'points', 20,
            'value', 'Menos de 24h'
        );
    END IF;
    
    -- ========================================
    -- ⚠️ FACTOR 7: URGENCIA TEMPORAL (CRÍTICO)
    -- Este factor se dispara cuando la reserva está MUY cerca
    -- y no hay confirmación → Eleva el riesgo dramáticamente
    -- ========================================
    
    -- Calcular horas hasta la reserva (CORREGIDO CON ZONA HORARIA EUROPA/MADRID)
    v_hours_until_reservation := EXTRACT(EPOCH FROM (
        (v_reservation.reservation_date::TIMESTAMP + v_reservation.reservation_time) - (NOW() AT TIME ZONE 'Europe/Madrid')
    )) / 3600;
    
    -- Verificar si hay alguna confirmación previa
    SELECT EXISTS (
        SELECT 1 FROM customer_confirmations
        WHERE reservation_id = p_reservation_id
        AND confirmed = TRUE
    ) INTO v_has_any_confirmation;
    
    -- Si está MUY cerca y NO confirmó → RIESGO CRÍTICO (GARANTIZAR ≥80 pts)
    IF v_hours_until_reservation < 2.25 AND NOT v_has_any_confirmation THEN
        -- Menos de 2h 15min → LLAMADA URGENTE
        -- GARANTIZAR que llegue a mínimo 80 puntos (score base mínimo de 55 + 25 = 80)
        v_base_score := GREATEST(v_base_score + 50, 80);
        v_factors := v_factors || jsonb_build_object(
            'factor', '🔴 URGENTE: Menos de 2h 15min sin confirmar',
            'points', 50,
            'value', ROUND(v_hours_until_reservation, 1) || ' horas',
            'critical', true
        );
    ELSIF v_hours_until_reservation < 4 AND NOT v_has_any_confirmation THEN
        -- Menos de 4h → ALTO RIESGO
        v_base_score := v_base_score + 35;
        v_factors := v_factors || jsonb_build_object(
            'factor', '⚠️ Menos de 4h sin confirmar',
            'points', 35,
            'value', ROUND(v_hours_until_reservation, 1) || ' horas',
            'critical', true
        );
    ELSIF v_hours_until_reservation < 24 AND NOT v_has_any_confirmation THEN
        -- Menos de 24h → RIESGO MODERADO
        v_base_score := v_base_score + 15;
        v_factors := v_factors || jsonb_build_object(
            'factor', 'Menos de 24h sin confirmar',
            'points', 15,
            'value', ROUND(v_hours_until_reservation, 1) || ' horas'
        );
    END IF;
    
    -- ========================================
    -- AJUSTES DINÁMICOS (SEGÚN CONFIRMACIONES)
    -- ========================================
    
    -- Obtener confirmaciones de esta reserva
    WITH confirmation_summary AS (
        SELECT 
            COUNT(*) as total_sent,
            COUNT(responded_at) as total_responded,
            COUNT(*) FILTER (WHERE message_type = 'Confirmación 24h antes' AND confirmed = TRUE) as confirmed_24h,
            COUNT(*) FILTER (WHERE message_type = 'Confirmación 24h antes' AND responded_at IS NULL) as no_response_24h,
            MIN(response_time_minutes) FILTER (WHERE message_type = 'Confirmación 24h antes') as response_time_24h,
            COUNT(*) FILTER (WHERE message_type = 'Recordatorio 4h antes' AND confirmed = TRUE) as confirmed_4h,
            COUNT(*) FILTER (WHERE message_type = 'Recordatorio 4h antes' AND responded_at IS NULL) as no_response_4h,
            jsonb_agg(
                jsonb_build_object(
                    'type', message_type,
                    'sent_at', sent_at,
                    'responded_at', responded_at,
                    'response_time_minutes', response_time_minutes,
                    'confirmed', confirmed
                ) ORDER BY sent_at DESC
            ) as history
        FROM customer_confirmations
        WHERE reservation_id = p_reservation_id
    )
    SELECT 
        COALESCE(
            jsonb_build_object(
                'total_sent', COALESCE(total_sent, 0),
                'total_responded', COALESCE(total_responded, 0),
                'confirmed_24h', COALESCE(confirmed_24h, 0),
                'no_response_24h', COALESCE(no_response_24h, 0),
                'response_time_24h', COALESCE(response_time_24h, 0),
                'confirmed_4h', COALESCE(confirmed_4h, 0),
                'no_response_4h', COALESCE(no_response_4h, 0),
                'history', COALESCE(history, '[]'::JSONB)
            ),
            jsonb_build_object(
                'total_sent', 0,
                'total_responded', 0,
                'confirmed_24h', 0,
                'no_response_24h', 0,
                'response_time_24h', 0,
                'confirmed_4h', 0,
                'no_response_4h', 0,
                'history', '[]'::JSONB
            )
        )
    INTO v_confirmations
    FROM confirmation_summary;
    
    -- AJUSTE DINÁMICO 1: Confirmó rápido a T-24h
    IF (v_confirmations->>'confirmed_24h')::INT > 0 THEN
        IF (v_confirmations->>'response_time_24h')::INT < 60 THEN
            -- Respondió en menos de 1 hora → GRAN reducción
            v_dynamic_adjustment := v_dynamic_adjustment - 30;
            v_factors := v_factors || jsonb_build_object(
                'factor', 'Confirmó rápido (<1h) a 24h antes',
                'points', -30,
                'value', 'Responsivo',
                'type', 'dynamic'
            );
        ELSIF (v_confirmations->>'response_time_24h')::INT < 360 THEN
            -- Respondió en menos de 6 horas → Reducción moderada
            v_dynamic_adjustment := v_dynamic_adjustment - 20;
            v_factors := v_factors || jsonb_build_object(
                'factor', 'Confirmó a tiempo a 24h antes',
                'points', -20,
                'value', 'Fiable',
                'type', 'dynamic'
            );
        ELSE
            -- Respondió tarde (>6h) → Reducción mínima
            v_dynamic_adjustment := v_dynamic_adjustment - 10;
            v_factors := v_factors || jsonb_build_object(
                'factor', 'Confirmó tarde a 24h antes',
                'points', -10,
                'value', 'Lento',
                'type', 'dynamic'
            );
        END IF;
    END IF;
    
    -- AJUSTE DINÁMICO 2: NO respondió a T-24h
    IF (v_confirmations->>'no_response_24h')::INT > 0 THEN
        v_dynamic_adjustment := v_dynamic_adjustment + 20;
        v_factors := v_factors || jsonb_build_object(
            'factor', 'No respondió a 24h antes',
            'points', 20,
            'value', 'Sin respuesta',
            'type', 'dynamic'
        );
    END IF;
    
    -- AJUSTE DINÁMICO 3: Confirmó a T-4h (segunda confirmación)
    IF (v_confirmations->>'confirmed_4h')::INT > 0 THEN
        v_dynamic_adjustment := v_dynamic_adjustment - 20;
        v_factors := v_factors || jsonb_build_object(
            'factor', 'Confirmó también a 4h antes',
            'points', -20,
            'value', 'Doble confirmación',
            'type', 'dynamic'
        );
    END IF;
    
    -- AJUSTE DINÁMICO 4: NO respondió a T-4h
    IF (v_confirmations->>'no_response_4h')::INT > 0 THEN
        v_dynamic_adjustment := v_dynamic_adjustment + 30;
        v_factors := v_factors || jsonb_build_object(
            'factor', 'No respondió a 4h antes',
            'points', 30,
            'value', 'Riesgo aumentado',
            'type', 'dynamic'
        );
    END IF;
    
    -- ========================================
    -- CÁLCULO FINAL
    -- ========================================
    
    v_final_score := GREATEST(0, LEAST(100, v_base_score + v_dynamic_adjustment));
    
    -- Clasificar nivel de riesgo (ACTUALIZADO: >80 = HIGH)
    RETURN QUERY SELECT
        v_final_score as risk_score,
        CASE 
            WHEN v_final_score >= 80 THEN 'high'
            WHEN v_final_score >= 40 THEN 'medium'
            ELSE 'low'
        END as risk_level,
        jsonb_build_object(
            'base_score', v_base_score,
            'dynamic_adjustment', v_dynamic_adjustment,
            'final_score', v_final_score,
            'factors', v_factors
        ) as risk_factors,
        CASE 
            WHEN v_final_score > 60 THEN 'Llamada obligatoria (T-2h 15min)'
            WHEN v_final_score > 30 THEN 'WhatsApp reforzado (T-4h)'
            ELSE 'Recordatorio estándar (T-24h)'
        END as recommended_action,
        v_confirmations as confirmation_history;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. FUNCIÓN: Versión mejorada de predict_upcoming_noshows CON riesgo dinámico
CREATE OR REPLACE FUNCTION predict_upcoming_noshows_v2(
    p_restaurant_id UUID,
    p_days_ahead INT DEFAULT 2
)
RETURNS TABLE(
    reservation_id UUID,
    customer_name VARCHAR,
    customer_phone VARCHAR,
    reservation_date DATE,
    reservation_time TIME,
    party_size INT,
    risk_score INT,
    risk_level TEXT,
    base_score INT,
    dynamic_adjustment INT,
    risk_factors JSONB,
    confirmation_status TEXT,
    recommended_action TEXT,
    noshow_probability INT
) AS $$
BEGIN
    RETURN QUERY
    WITH upcoming_reservations AS (
        SELECT 
            r.id,
            r.customer_name,
            r.customer_phone,
            r.reservation_date,
            r.reservation_time,
            r.party_size
        FROM reservations r
        WHERE r.restaurant_id = p_restaurant_id
        AND r.status IN ('confirmed', 'pending', 'confirmada', 'pendiente')
        AND r.reservation_date >= CURRENT_DATE
        AND r.reservation_date <= CURRENT_DATE + INTERVAL '1 day' * p_days_ahead
    ),
    risk_calculations AS (
        SELECT 
            ur.id as reservation_id,
            ur.customer_name,
            ur.customer_phone,
            ur.reservation_date,
            ur.reservation_time,
            ur.party_size,
            dr.risk_score,
            dr.risk_level,
            (dr.risk_factors->>'base_score')::INT as base_score,
            (dr.risk_factors->>'dynamic_adjustment')::INT as dynamic_adjustment,
            dr.risk_factors,
            dr.confirmation_history,
            dr.recommended_action
        FROM upcoming_reservations ur
        CROSS JOIN LATERAL calculate_dynamic_risk_score(ur.id) dr
    )
    SELECT 
        rc.reservation_id,
        rc.customer_name,
        rc.customer_phone,
        rc.reservation_date,
        rc.reservation_time,
        rc.party_size,
        rc.risk_score,
        rc.risk_level,
        rc.base_score,
        rc.dynamic_adjustment,
        rc.risk_factors,
        CASE 
            WHEN (rc.confirmation_history->>'confirmed_24h')::INT > 0 AND (rc.confirmation_history->>'confirmed_4h')::INT > 0 THEN 'Doble confirmación'
            WHEN (rc.confirmation_history->>'confirmed_24h')::INT > 0 THEN 'Confirmado 24h antes'
            WHEN (rc.confirmation_history->>'no_response_24h')::INT > 0 THEN 'Sin respuesta'
            ELSE 'Pendiente confirmación'
        END as confirmation_status,
        rc.recommended_action,
        LEAST(100, GREATEST(0, ROUND(rc.risk_score * 0.85)))::INT as noshow_probability
    FROM risk_calculations rc
    WHERE rc.risk_score > 15 -- Solo mostrar con riesgo mínimo
    ORDER BY rc.risk_score DESC, rc.reservation_date ASC, rc.reservation_time ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. FUNCIÓN: Obtener métricas dinámicas del restaurante
CREATE OR REPLACE FUNCTION get_dynamic_noshow_metrics(
    p_restaurant_id UUID,
    p_days_back INT DEFAULT 30
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_total_confirmations INT;
    v_avg_response_time INT;
    v_fast_responders INT;
    v_never_responded INT;
BEGIN
    -- Obtener métricas de confirmaciones
    SELECT 
        COUNT(*),
        COALESCE(ROUND(AVG(response_time_minutes))::INT, 0),
        COUNT(*) FILTER (WHERE response_time_minutes < 60),
        COUNT(*) FILTER (WHERE responded_at IS NULL)
    INTO 
        v_total_confirmations,
        v_avg_response_time,
        v_fast_responders,
        v_never_responded
    FROM customer_confirmations
    WHERE restaurant_id = p_restaurant_id
    AND sent_at >= CURRENT_DATE - INTERVAL '1 day' * p_days_back;
    
    -- Construir resultado
    v_result := jsonb_build_object(
        'period_days', p_days_back,
        'total_confirmations_sent', v_total_confirmations,
        'avg_response_time_minutes', v_avg_response_time,
        'fast_responders', v_fast_responders,
        'fast_response_rate', 
            CASE WHEN v_total_confirmations > 0 
            THEN ROUND((v_fast_responders::NUMERIC / v_total_confirmations::NUMERIC) * 100, 1)
            ELSE 0 END,
        'never_responded', v_never_responded,
        'non_response_rate',
            CASE WHEN v_total_confirmations > 0
            THEN ROUND((v_never_responded::NUMERIC / v_total_confirmations::NUMERIC) * 100, 1)
            ELSE 0 END,
        'generated_at', NOW()
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. COMENTARIOS
COMMENT ON FUNCTION calculate_dynamic_risk_score IS 'Calcula el score de riesgo dinámico ajustado según confirmaciones del cliente';
COMMENT ON FUNCTION predict_upcoming_noshows_v2 IS 'Versión mejorada con cálculo dinámico de riesgo basado en confirmaciones';
COMMENT ON FUNCTION get_dynamic_noshow_metrics IS 'Métricas de comportamiento de confirmaciones del restaurante';

-- ========================================
-- FIN DE MIGRACIÓN
-- ========================================

