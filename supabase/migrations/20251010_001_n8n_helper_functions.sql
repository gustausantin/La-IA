-- =====================================================
-- FUNCIONES HELPER PARA N8N WORKFLOWS
-- Fecha: 10 Octubre 2025
-- =====================================================

-- Función 1: Obtener reservas del día siguiente
CREATE OR REPLACE FUNCTION get_reservations_tomorrow(p_restaurant_id UUID)
RETURNS TABLE(
    id UUID,
    customer_name VARCHAR,
    customer_phone VARCHAR,
    customer_email VARCHAR,
    reservation_date DATE,
    reservation_time TIME,
    party_size INTEGER,
    status VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        r.customer_name,
        r.customer_phone,
        r.customer_email,
        r.reservation_date,
        r.reservation_time,
        r.party_size,
        r.status
    FROM reservations r
    WHERE r.restaurant_id = p_restaurant_id
      AND r.reservation_date = CURRENT_DATE + INTERVAL '1 day'
      AND r.status IN ('pending', 'confirmada')
      AND r.customer_phone IS NOT NULL
      AND r.customer_phone != ''
    ORDER BY r.reservation_time ASC;
END;
$$;

-- Función 2: Obtener reservas en ventana 4-5 horas
CREATE OR REPLACE FUNCTION get_reservations_4h_window(p_restaurant_id UUID)
RETURNS TABLE(
    id UUID,
    customer_name VARCHAR,
    customer_phone VARCHAR,
    reservation_date DATE,
    reservation_time TIME,
    party_size INTEGER,
    already_sent_4h BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        r.customer_name,
        r.customer_phone,
        r.reservation_date,
        r.reservation_time,
        r.party_size,
        EXISTS(
            SELECT 1 FROM customer_confirmations cc
            WHERE cc.reservation_id = r.id
            AND cc.message_type = 'Recordatorio 4h antes'
        ) as already_sent_4h
    FROM reservations r
    WHERE r.restaurant_id = p_restaurant_id
      AND r.reservation_date = CURRENT_DATE
      AND r.status IN ('pending', 'confirmada')
      AND r.customer_phone IS NOT NULL
      -- Ventana: entre 4 y 5 horas desde ahora
      AND (
          EXTRACT(EPOCH FROM (
              (r.reservation_date || ' ' || r.reservation_time)::TIMESTAMP - NOW()
          )) / 3600
      ) BETWEEN 4 AND 5
    ORDER BY r.reservation_time ASC;
END;
$$;

-- Función 3: Obtener reservas de riesgo alto sin confirmar (<2h)
CREATE OR REPLACE FUNCTION get_high_risk_reservations_2h(p_restaurant_id UUID)
RETURNS TABLE(
    id UUID,
    customer_name VARCHAR,
    customer_phone VARCHAR,
    reservation_date DATE,
    reservation_time TIME,
    party_size INTEGER,
    risk_score INTEGER,
    risk_level VARCHAR,
    hours_until_reservation NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH risk_calc AS (
        SELECT 
            r.id,
            r.customer_name,
            r.customer_phone,
            r.reservation_date,
            r.reservation_time,
            r.party_size,
            (risk.risk_score) as risk_score,
            (risk.risk_level) as risk_level,
            ROUND(
                EXTRACT(EPOCH FROM (
                    (r.reservation_date || ' ' || r.reservation_time)::TIMESTAMP - NOW()
                )) / 3600,
                2
            ) as hours_until
        FROM reservations r
        CROSS JOIN LATERAL calculate_dynamic_risk_score(r.id) as risk
        WHERE r.restaurant_id = p_restaurant_id
          AND r.reservation_date = CURRENT_DATE
          AND r.status IN ('pending', 'confirmada')
          AND r.customer_phone IS NOT NULL
    )
    SELECT 
        rc.id,
        rc.customer_name,
        rc.customer_phone,
        rc.reservation_date,
        rc.reservation_time,
        rc.party_size,
        rc.risk_score,
        rc.risk_level,
        rc.hours_until
    FROM risk_calc rc
    WHERE rc.risk_score > 60  -- Riesgo alto
      AND rc.hours_until BETWEEN 2 AND 3  -- Ventana 2-3h
      -- No existe alerta pendiente
      AND NOT EXISTS (
          SELECT 1 FROM noshow_alerts na
          WHERE na.reservation_id = rc.id
          AND na.status = 'pending'
      )
    ORDER BY rc.risk_score DESC, rc.hours_until ASC;
END;
$$;

-- Función 4: Auto-liberar reservas sin confirmar <2h
CREATE OR REPLACE FUNCTION auto_release_expired_reservations(p_restaurant_id UUID)
RETURNS TABLE(
    reservation_id UUID,
    customer_name VARCHAR,
    released BOOLEAN,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reservation RECORD;
    v_released_count INT := 0;
BEGIN
    FOR v_reservation IN
        WITH risk_calc AS (
            SELECT 
                r.id,
                r.customer_name,
                r.table_id,
                r.slot_date,
                r.start_time,
                (risk.risk_score) as risk_score,
                ROUND(
                    EXTRACT(EPOCH FROM (
                        (r.reservation_date || ' ' || r.reservation_time)::TIMESTAMP - NOW()
                    )) / 3600,
                    2
                ) as hours_until
            FROM reservations r
            CROSS JOIN LATERAL calculate_dynamic_risk_score(r.id) as risk
            WHERE r.restaurant_id = p_restaurant_id
              AND r.reservation_date = CURRENT_DATE
              AND r.status IN ('pending', 'confirmada')
              AND r.customer_phone IS NOT NULL
        )
        SELECT * FROM risk_calc
        WHERE risk_score > 60
          AND hours_until < 2
    LOOP
        -- Cambiar status a noshow
        UPDATE reservations
        SET status = 'noshow',
            updated_at = NOW()
        WHERE id = v_reservation.id;
        
        -- Liberar slot
        UPDATE availability_slots
        SET status = 'free',
            is_available = TRUE
        WHERE table_id = v_reservation.table_id
          AND slot_date = v_reservation.slot_date
          AND start_time = v_reservation.start_time;
        
        -- Registrar acción
        INSERT INTO noshow_actions (
            reservation_id,
            restaurant_id,
            action_type,
            action_description,
            created_at
        ) VALUES (
            v_reservation.id,
            p_restaurant_id,
            'auto_release',
            'Auto-liberación automática por sistema (>60pts, <2h sin confirmar)',
            NOW()
        );
        
        v_released_count := v_released_count + 1;
        
        RETURN QUERY SELECT 
            v_reservation.id,
            v_reservation.customer_name,
            TRUE,
            'Liberada automáticamente';
    END LOOP;
    
    -- Si no hubo liberaciones, devolver mensaje
    IF v_released_count = 0 THEN
        RETURN QUERY SELECT 
            NULL::UUID,
            'N/A'::VARCHAR,
            FALSE,
            'No hay reservas que liberar';
    END IF;
END;
$$;

-- Comentarios
COMMENT ON FUNCTION get_reservations_tomorrow IS 'Obtiene reservas del día siguiente para recordatorio 24h';
COMMENT ON FUNCTION get_reservations_4h_window IS 'Obtiene reservas en ventana 4-5h que no han recibido recordatorio';
COMMENT ON FUNCTION get_high_risk_reservations_2h IS 'Obtiene reservas de riesgo alto en ventana 2-3h para alertar';
COMMENT ON FUNCTION auto_release_expired_reservations IS 'Auto-libera reservas >60pts sin confirmar <2h antes';

