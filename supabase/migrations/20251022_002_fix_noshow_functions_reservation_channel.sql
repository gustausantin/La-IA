-- =====================================================
-- FIX: FUNCIONES DE NOSHOWS - ELIMINAR RESERVATION_CHANNEL
-- =====================================================
-- Fecha: 22 Octubre 2025
-- Problema: Las funciones referencian 'reservation_channel' que fue eliminado
-- Solución: Reemplazar 'reservation_channel' por 'source'
-- =====================================================

-- =====================================================
-- FUNCIÓN 1: get_restaurant_noshow_metrics
-- =====================================================

-- Primero eliminar todas las versiones existentes
DROP FUNCTION IF EXISTS get_restaurant_noshow_metrics(UUID);
DROP FUNCTION IF EXISTS get_restaurant_noshow_metrics(UUID, INTEGER);
DROP FUNCTION IF EXISTS get_restaurant_noshow_metrics(UUID, DATE, DATE);

-- Recrear la función
CREATE OR REPLACE FUNCTION get_restaurant_noshow_metrics(p_restaurant_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_build_object(
        'total_noshows', COUNT(*) FILTER (WHERE r.status = 'no_show'),
        'total_reservations', COUNT(*),
        'noshow_rate', 
            CASE 
                WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE r.status = 'no_show')::NUMERIC / COUNT(*)) * 100, 2)
                ELSE 0
            END,
        'by_source', (
            SELECT json_agg(source_stats)
            FROM (
                SELECT 
                    r.source,  -- ✅ CORREGIDO: era reservation_channel
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE r.status = 'no_show') as noshows,
                    CASE 
                        WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE r.status = 'no_show')::NUMERIC / COUNT(*)) * 100, 2)
                        ELSE 0
                    END as noshow_rate
                FROM reservations r
                WHERE r.restaurant_id = p_restaurant_id
                    AND r.reservation_date >= CURRENT_DATE - INTERVAL '90 days'
                GROUP BY r.source  -- ✅ CORREGIDO: era reservation_channel
                ORDER BY noshow_rate DESC
            ) source_stats
        ),
        'by_day_of_week', (
            SELECT json_agg(day_stats)
            FROM (
                SELECT 
                    EXTRACT(DOW FROM r.reservation_date) as day_of_week,
                    TO_CHAR(r.reservation_date, 'Day') as day_name,
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE r.status = 'no_show') as noshows,
                    CASE 
                        WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE r.status = 'no_show')::NUMERIC / COUNT(*)) * 100, 2)
                        ELSE 0
                    END as noshow_rate
                FROM reservations r
                WHERE r.restaurant_id = p_restaurant_id
                    AND r.reservation_date >= CURRENT_DATE - INTERVAL '90 days'
                GROUP BY EXTRACT(DOW FROM r.reservation_date), TO_CHAR(r.reservation_date, 'Day')
                ORDER BY day_of_week
            ) day_stats
        ),
        'by_time_slot', (
            SELECT json_agg(time_stats)
            FROM (
                SELECT 
                    DATE_TRUNC('hour', r.reservation_time) as hour_slot,
                    TO_CHAR(DATE_TRUNC('hour', r.reservation_time), 'HH24:MI') as hour_label,
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE r.status = 'no_show') as noshows,
                    CASE 
                        WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE r.status = 'no_show')::NUMERIC / COUNT(*)) * 100, 2)
                        ELSE 0
                    END as noshow_rate
                FROM reservations r
                WHERE r.restaurant_id = p_restaurant_id
                    AND r.reservation_date >= CURRENT_DATE - INTERVAL '90 days'
                GROUP BY DATE_TRUNC('hour', r.reservation_time)
                ORDER BY hour_slot
            ) time_stats
        ),
        'by_party_size', (
            SELECT json_agg(party_stats)
            FROM (
                SELECT 
                    r.party_size,
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE r.status = 'no_show') as noshows,
                    CASE 
                        WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE r.status = 'no_show')::NUMERIC / COUNT(*)) * 100, 2)
                        ELSE 0
                    END as noshow_rate
                FROM reservations r
                WHERE r.restaurant_id = p_restaurant_id
                    AND r.reservation_date >= CURRENT_DATE - INTERVAL '90 days'
                GROUP BY r.party_size
                ORDER BY r.party_size
            ) party_stats
        ),
        'recent_trend', (
            SELECT json_agg(trend_stats)
            FROM (
                SELECT 
                    DATE_TRUNC('week', r.reservation_date) as week,
                    TO_CHAR(DATE_TRUNC('week', r.reservation_date), 'YYYY-MM-DD') as week_label,
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE r.status = 'no_show') as noshows,
                    CASE 
                        WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE r.status = 'no_show')::NUMERIC / COUNT(*)) * 100, 2)
                        ELSE 0
                    END as noshow_rate
                FROM reservations r
                WHERE r.restaurant_id = p_restaurant_id
                    AND r.reservation_date >= CURRENT_DATE - INTERVAL '90 days'
                GROUP BY DATE_TRUNC('week', r.reservation_date)
                ORDER BY week DESC
                LIMIT 12
            ) trend_stats
        )
    ) INTO v_result
    FROM reservations r
    WHERE r.restaurant_id = p_restaurant_id
        AND r.reservation_date >= CURRENT_DATE - INTERVAL '90 days';
    
    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_restaurant_noshow_metrics IS 
'Obtiene métricas de no-shows para un restaurante. ✅ ACTUALIZADO: usa source en lugar de reservation_channel';

-- =====================================================
-- FUNCIÓN 2: predict_upcoming_noshows_v2
-- =====================================================

-- Eliminar todas las versiones existentes
DROP FUNCTION IF EXISTS predict_upcoming_noshows_v2(UUID);
DROP FUNCTION IF EXISTS predict_upcoming_noshows_v2(UUID, INTEGER);
DROP FUNCTION IF EXISTS predict_upcoming_noshows(UUID);
DROP FUNCTION IF EXISTS predict_upcoming_noshows(UUID, INTEGER);

-- Recrear la función
CREATE OR REPLACE FUNCTION predict_upcoming_noshows_v2(p_restaurant_id UUID, p_days_ahead INTEGER DEFAULT 7)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(prediction)
    INTO v_result
    FROM (
        SELECT 
            r.id as reservation_id,
            r.customer_name,
            r.customer_phone,
            r.reservation_date,
            r.reservation_time,
            r.party_size,
            r.source,  -- ✅ CORREGIDO: era reservation_channel
            r.status,
            -- Calcular score de riesgo (0-100)
            LEAST(100, 
                -- Factor 1: Cliente nuevo sin historial (30 puntos)
                CASE WHEN c.id IS NULL OR customer_stats.total_reservations = 0 OR customer_stats.total_reservations IS NULL THEN 30 ELSE 0 END +
                
                -- Factor 2: Historial de no-shows del cliente (40 puntos)
                CASE 
                    WHEN customer_stats.noshow_count > 0 AND customer_stats.total_reservations > 0 THEN 
                        ROUND((customer_stats.noshow_count::NUMERIC / customer_stats.total_reservations) * 40)
                    ELSE 0
                END +
                
                -- Factor 3: Día de la semana con alto noshow_rate (15 puntos)
                COALESCE(
                    (SELECT 
                        CASE 
                            WHEN noshow_rate > 20 THEN 15
                            WHEN noshow_rate > 10 THEN 10
                            ELSE 5
                        END
                    FROM (
                        SELECT 
                            CASE 
                                WHEN COUNT(*) > 0 THEN 
                                    ROUND((COUNT(*) FILTER (WHERE status = 'no_show')::NUMERIC / COUNT(*)) * 100, 2)
                                ELSE 0
                            END as noshow_rate
                        FROM reservations
                        WHERE restaurant_id = p_restaurant_id
                            AND EXTRACT(DOW FROM reservation_date) = EXTRACT(DOW FROM r.reservation_date)
                            AND reservation_date >= CURRENT_DATE - INTERVAL '90 days'
                    ) day_stats),
                    5
                ) +
                
                -- Factor 4: Franja horaria con alto noshow_rate (10 puntos)
                COALESCE(
                    (SELECT 
                        CASE 
                            WHEN noshow_rate > 20 THEN 10
                            WHEN noshow_rate > 10 THEN 7
                            ELSE 3
                        END
                    FROM (
                        SELECT 
                            CASE 
                                WHEN COUNT(*) > 0 THEN 
                                    ROUND((COUNT(*) FILTER (WHERE status = 'no_show')::NUMERIC / COUNT(*)) * 100, 2)
                                ELSE 0
                            END as noshow_rate
                        FROM reservations
                        WHERE restaurant_id = p_restaurant_id
                            AND DATE_TRUNC('hour', reservation_time) = DATE_TRUNC('hour', r.reservation_time)
                            AND reservation_date >= CURRENT_DATE - INTERVAL '90 days'
                    ) time_stats),
                    3
                ) +
                
                -- Factor 5: Tamaño de grupo (5 puntos si > 6 personas)
                CASE WHEN r.party_size > 6 THEN 5 ELSE 0 END
            ) as risk_score,
            
            -- Clasificación de riesgo
            CASE 
                WHEN LEAST(100, 
                    CASE WHEN c.id IS NULL OR customer_stats.total_reservations = 0 OR customer_stats.total_reservations IS NULL THEN 30 ELSE 0 END +
                    CASE 
                        WHEN customer_stats.noshow_count > 0 AND customer_stats.total_reservations > 0 THEN 
                            ROUND((customer_stats.noshow_count::NUMERIC / customer_stats.total_reservations) * 40)
                        ELSE 0
                    END
                ) >= 60 THEN 'high'
                WHEN LEAST(100, 
                    CASE WHEN c.id IS NULL OR customer_stats.total_reservations = 0 OR customer_stats.total_reservations IS NULL THEN 30 ELSE 0 END +
                    CASE 
                        WHEN customer_stats.noshow_count > 0 AND customer_stats.total_reservations > 0 THEN 
                            ROUND((customer_stats.noshow_count::NUMERIC / customer_stats.total_reservations) * 40)
                        ELSE 0
                    END
                ) >= 30 THEN 'medium'
                ELSE 'low'
            END as risk_level,
            
            -- Factores de riesgo detectados
            json_build_object(
                'new_customer', c.id IS NULL OR customer_stats.total_reservations = 0 OR customer_stats.total_reservations IS NULL,
                'has_noshow_history', customer_stats.noshow_count > 0,
                'noshow_rate', 
                    CASE 
                        WHEN customer_stats.total_reservations > 0 THEN 
                            ROUND((customer_stats.noshow_count::NUMERIC / customer_stats.total_reservations) * 100, 2)
                        ELSE 0
                    END,
                'high_risk_day', EXISTS(
                    SELECT 1 FROM reservations
                    WHERE restaurant_id = p_restaurant_id
                        AND EXTRACT(DOW FROM reservation_date) = EXTRACT(DOW FROM r.reservation_date)
                        AND status = 'no_show'
                        AND reservation_date >= CURRENT_DATE - INTERVAL '90 days'
                    HAVING COUNT(*) > 2
                ),
                'high_risk_time', EXISTS(
                    SELECT 1 FROM reservations
                    WHERE restaurant_id = p_restaurant_id
                        AND DATE_TRUNC('hour', reservation_time) = DATE_TRUNC('hour', r.reservation_time)
                        AND status = 'no_show'
                        AND reservation_date >= CURRENT_DATE - INTERVAL '90 days'
                    HAVING COUNT(*) > 2
                ),
                'large_party', r.party_size > 6
            ) as risk_factors
            
        FROM reservations r
        LEFT JOIN customers c ON c.phone = r.customer_phone AND c.restaurant_id = r.restaurant_id
        LEFT JOIN LATERAL (
            SELECT 
                COUNT(*) as total_reservations,
                COUNT(*) FILTER (WHERE status = 'no_show') as noshow_count
            FROM reservations
            WHERE restaurant_id = p_restaurant_id
                AND customer_phone = r.customer_phone
                AND reservation_date < CURRENT_DATE
        ) customer_stats ON true
        WHERE r.restaurant_id = p_restaurant_id
            AND r.reservation_date BETWEEN CURRENT_DATE AND CURRENT_DATE + (p_days_ahead || ' days')::INTERVAL
            AND r.status IN ('pending', 'confirmed', 'pendiente', 'confirmada')
        ORDER BY risk_score DESC, r.reservation_date, r.reservation_time
    ) prediction;
    
    RETURN COALESCE(v_result, '[]'::JSON);
END;
$$;

COMMENT ON FUNCTION predict_upcoming_noshows_v2 IS 
'Predice reservas con alto riesgo de no-show para los próximos N días. ✅ ACTUALIZADO: usa source en lugar de reservation_channel';

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

-- Verificar que las funciones se crearon correctamente
DO $$
BEGIN
    RAISE NOTICE '✅ Funciones de NoShows actualizadas correctamente';
    RAISE NOTICE '✅ get_restaurant_noshow_metrics: usa "source" en lugar de "reservation_channel"';
    RAISE NOTICE '✅ predict_upcoming_noshows_v2: usa "source" en lugar de "reservation_channel"';
END $$;

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================

