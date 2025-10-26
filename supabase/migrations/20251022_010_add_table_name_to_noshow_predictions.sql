-- =====================================================
-- AÑADIR table_name A predict_upcoming_noshows_v2
-- =====================================================
-- Fecha: 22 Octubre 2025
-- Cambio: Incluir el nombre de la mesa en las predicciones de no-shows
-- =====================================================

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
            r.source,
            r.status,
            -- ✅ AÑADIDO: Obtener nombres de mesas desde reservation_tables
            (
                SELECT string_agg(t.name, ', ' ORDER BY t.name)
                FROM reservation_tables rt
                INNER JOIN tables t ON rt.table_id = t.id
                WHERE rt.reservation_id = r.id
            ) as table_names,
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
                ) >= 50 THEN 'high'
                WHEN LEAST(100, 
                    CASE WHEN c.id IS NULL OR customer_stats.total_reservations = 0 OR customer_stats.total_reservations IS NULL THEN 30 ELSE 0 END +
                    CASE 
                        WHEN customer_stats.noshow_count > 0 AND customer_stats.total_reservations > 0 THEN 
                            ROUND((customer_stats.noshow_count::NUMERIC / customer_stats.total_reservations) * 40)
                        ELSE 0
                    END
                ) >= 30 THEN 'medium'
                ELSE 'low'
            END as risk_level
            
        FROM reservations r
        LEFT JOIN customers c ON r.customer_phone = c.phone AND c.restaurant_id = p_restaurant_id
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
            AND r.status IN ('pending', 'confirmed', 'pending_approval')
            AND r.reservation_date BETWEEN CURRENT_DATE AND CURRENT_DATE + p_days_ahead
        ORDER BY r.reservation_date, r.reservation_time
    ) AS prediction;
    
    RETURN COALESCE(v_result, '[]'::json);
END;
$$;

COMMENT ON FUNCTION predict_upcoming_noshows_v2 IS 
'Predice reservas con riesgo de no-show. ✅ ACTUALIZADO: incluye table_names desde reservation_tables';

-- =====================================================
-- ✅ FIN DE LA MIGRACIÓN
-- =====================================================

