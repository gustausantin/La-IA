-- =====================================================
-- CRM v2 - EVOLUCIÓN INTELIGENTE (SIN DUPLICACIONES)
-- Migración: 20250215_001_crm_v2_evolution.sql
-- Descripción: Evolucionar tablas existentes para CRM v2 con AIVI
-- =====================================================

-- 🎯 ESTRATEGIA: USAR TABLAS EXISTENTES + MEJORAS MÍNIMAS

-- 1. MEJORAR billing_tickets (ya existe) para POS completo
-- =====================================================
-- Agregar campos faltantes para matching automático
ALTER TABLE billing_tickets 
ADD COLUMN IF NOT EXISTS mesa_number VARCHAR(10), -- Para matching con reservations.table_number
ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(3,2) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS auto_matched BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS matching_notes TEXT;

-- Índice para matching automático
CREATE INDEX IF NOT EXISTS idx_billing_tickets_matching 
ON billing_tickets(restaurant_id, mesa_number, ticket_date, auto_matched);

-- Comentario
COMMENT ON COLUMN billing_tickets.mesa_number IS 'Número de mesa para matching automático con reservas';
COMMENT ON COLUMN billing_tickets.confidence_score IS 'Confianza del matching automático (0.0-1.0)';

-- 2. MEJORAR customers (ya existe) con campos AIVI
-- =====================================================
-- Agregar campos específicos para AIVI
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS aivi_days DECIMAL(5,1) DEFAULT 30.0,
ADD COLUMN IF NOT EXISTS recency_days INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS visits_12m INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_spent_12m DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS top_dishes JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS top_categories JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS fav_weekday INTEGER DEFAULT 6, -- 0=domingo, 6=sábado
ADD COLUMN IF NOT EXISTS fav_hour_block INTEGER DEFAULT 20, -- Hora favorita
ADD COLUMN IF NOT EXISTS is_vip_calculated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS segment_auto_v2 VARCHAR(20) DEFAULT 'nuevo',
ADD COLUMN IF NOT EXISTS features_updated_at TIMESTAMPTZ DEFAULT NOW();

-- Índices para segmentación rápida
CREATE INDEX IF NOT EXISTS idx_customers_aivi_recency 
ON customers(restaurant_id, aivi_days, recency_days);

CREATE INDEX IF NOT EXISTS idx_customers_segment_v2 
ON customers(restaurant_id, segment_auto_v2, is_vip_calculated);

-- Comentarios
COMMENT ON COLUMN customers.aivi_days IS 'AIVI: Días promedio entre visitas (ritmo individual)';
COMMENT ON COLUMN customers.recency_days IS 'Días desde la última visita';
COMMENT ON COLUMN customers.segment_auto_v2 IS 'Segmentación AIVI: nuevo, activo, riesgo, inactivo';

-- 3. MEJORAR message_templates (ya existe) con variables AIVI
-- =====================================================
-- Agregar campos para personalización avanzada
ALTER TABLE message_templates 
ADD COLUMN IF NOT EXISTS variables_available JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS segment_target_v2 VARCHAR(20) DEFAULT 'all',
ADD COLUMN IF NOT EXISTS personalization_level VARCHAR(20) DEFAULT 'basic' CHECK (personalization_level IN ('basic', 'advanced', 'aivi')),
ADD COLUMN IF NOT EXISTS optimal_send_time VARCHAR(20) DEFAULT 'any',
ADD COLUMN IF NOT EXISTS success_metrics JSONB DEFAULT '{}'::jsonb;

-- Comentarios
COMMENT ON COLUMN message_templates.variables_available IS 'Variables AIVI disponibles: nombre, fav_weekday, top_dishes, etc.';
COMMENT ON COLUMN message_templates.segment_target_v2 IS 'Segmento objetivo con AIVI';

-- 4. MEJORAR automation_rules (ya existe) con lógica AIVI
-- =====================================================
-- Agregar campos para automatización inteligente
ALTER TABLE automation_rules 
ADD COLUMN IF NOT EXISTS aivi_config JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS trigger_conditions_v2 JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS execution_stats JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS last_optimization_at TIMESTAMPTZ;

-- Comentarios
COMMENT ON COLUMN automation_rules.aivi_config IS 'Configuración específica AIVI para la regla';
COMMENT ON COLUMN automation_rules.trigger_conditions_v2 IS 'Condiciones avanzadas basadas en AIVI';

-- 5. FUNCIÓN: Calcular AIVI para un cliente
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_customer_aivi(p_customer_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    visit_intervals INTEGER[];
    aivi_result DECIMAL(5,1);
    recency_result INTEGER;
    visits_12m_result INTEGER;
    last_visit_date DATE;
    total_spent_result DECIMAL(10,2);
    customer_record RECORD;
BEGIN
    -- Obtener datos del cliente
    SELECT * INTO customer_record FROM customers WHERE id = p_customer_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Customer not found');
    END IF;

    -- Calcular intervalos entre visitas (reservas completadas)
    WITH visit_dates AS (
        SELECT reservation_date,
               LAG(reservation_date) OVER (ORDER BY reservation_date) as prev_date
        FROM reservations 
        WHERE customer_id = p_customer_id 
            AND status IN ('completed', 'seated')
            AND reservation_date IS NOT NULL
        ORDER BY reservation_date
    )
    SELECT ARRAY_AGG(EXTRACT(DAYS FROM reservation_date - prev_date)::INTEGER)
    INTO visit_intervals
    FROM visit_dates 
    WHERE prev_date IS NOT NULL;

    -- Calcular AIVI (mediana de intervalos)
    IF array_length(visit_intervals, 1) > 0 THEN
        -- Calcular mediana
        WITH sorted_intervals AS (
            SELECT unnest(visit_intervals) as interval_days
            ORDER BY interval_days
        )
        SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY interval_days)
        INTO aivi_result
        FROM sorted_intervals;
    ELSE
        aivi_result := 30.0; -- Fallback para clientes nuevos
    END IF;

    -- Calcular recencia (días desde última visita)
    SELECT MAX(reservation_date) INTO last_visit_date
    FROM reservations 
    WHERE customer_id = p_customer_id 
        AND status IN ('completed', 'seated');

    IF last_visit_date IS NOT NULL THEN
        recency_result := EXTRACT(DAYS FROM NOW() - last_visit_date)::INTEGER;
    ELSE
        recency_result := 999; -- Sin visitas
    END IF;

    -- Calcular visitas últimos 12 meses
    SELECT COUNT(*) INTO visits_12m_result
    FROM reservations 
    WHERE customer_id = p_customer_id 
        AND status IN ('completed', 'seated')
        AND reservation_date >= (NOW() - INTERVAL '12 months')::DATE;

    -- Calcular gasto total (desde billing_tickets vinculados)
    SELECT COALESCE(SUM(bt.total_amount), 0) INTO total_spent_result
    FROM billing_tickets bt
    JOIN reservations r ON r.id = bt.reservation_id
    WHERE r.customer_id = p_customer_id
        AND bt.ticket_date >= NOW() - INTERVAL '12 months';

    -- Actualizar campos en customers
    UPDATE customers 
    SET 
        aivi_days = aivi_result,
        recency_days = recency_result,
        visits_12m = visits_12m_result,
        total_spent_12m = total_spent_result,
        last_visit_at = last_visit_date,
        features_updated_at = NOW()
    WHERE id = p_customer_id;

    RETURN jsonb_build_object(
        'success', true,
        'customer_id', p_customer_id,
        'aivi_days', aivi_result,
        'recency_days', recency_result,
        'visits_12m', visits_12m_result,
        'total_spent_12m', total_spent_result
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;

-- 6. FUNCIÓN: Calcular segmento AIVI
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_customer_segment_v2(p_customer_id UUID)
RETURNS VARCHAR(20)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    customer_record RECORD;
    settings_record RECORD;
    calculated_segment VARCHAR(20);
    days_since_created INTEGER;
BEGIN
    -- Obtener datos del cliente
    SELECT * INTO customer_record 
    FROM customers 
    WHERE id = p_customer_id;
    
    IF NOT FOUND THEN
        RETURN 'nuevo';
    END IF;

    -- Obtener configuración (usar valores por defecto si no existe)
    SELECT * INTO settings_record 
    FROM crm_settings 
    WHERE restaurant_id = customer_record.restaurant_id;
    
    IF NOT FOUND THEN
        -- Valores por defecto
        settings_record := ROW(
            1, customer_record.restaurant_id, 
            0.8, 1.5, 90, 14, 90,
            '22:00'::time, '10:00'::time, 2, 7,
            NOW()
        );
    END IF;

    -- Calcular días desde creación
    days_since_created := EXTRACT(DAYS FROM NOW() - customer_record.created_at)::INTEGER;

    -- Lógica de segmentación AIVI
    IF customer_record.visits_count <= 2 AND days_since_created <= settings_record.dias_nuevo THEN
        calculated_segment := 'nuevo';
    ELSIF customer_record.recency_days <= (settings_record.factor_activo * customer_record.aivi_days) THEN
        calculated_segment := 'activo';
    ELSIF customer_record.recency_days <= (settings_record.factor_riesgo * customer_record.aivi_days) THEN
        calculated_segment := 'riesgo';
    ELSIF customer_record.recency_days >= settings_record.dias_inactivo_min THEN
        calculated_segment := 'inactivo';
    ELSE
        calculated_segment := 'inactivo';
    END IF;

    -- Actualizar segmento en la tabla
    UPDATE customers 
    SET segment_auto_v2 = calculated_segment
    WHERE id = p_customer_id;

    RETURN calculated_segment;

EXCEPTION WHEN OTHERS THEN
    RETURN 'nuevo'; -- Fallback seguro
END;
$$;

-- 7. FUNCIÓN: Matching automático usando billing_tickets existente
-- =====================================================
CREATE OR REPLACE FUNCTION crm_v2_auto_match_existing_tickets(p_restaurant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    matches_created INTEGER := 0;
    reservation_record RECORD;
    ticket_record RECORD;
    best_confidence DECIMAL(3,2);
    best_ticket_id UUID;
BEGIN
    -- Para cada reserva sin ticket vinculado
    FOR reservation_record IN
        SELECT r.* 
        FROM reservations r
        WHERE r.restaurant_id = p_restaurant_id
            AND r.reservation_id IS NULL -- Sin ticket vinculado
            AND r.status IN ('completed', 'seated')
            AND r.reservation_date >= (NOW() - INTERVAL '30 days')::DATE
    LOOP
        best_confidence := 0;
        best_ticket_id := NULL;

        -- Buscar mejor ticket candidato
        FOR ticket_record IN
            SELECT bt.*
            FROM billing_tickets bt
            WHERE bt.restaurant_id = p_restaurant_id
                AND bt.reservation_id IS NULL -- Sin reserva vinculada
                AND bt.ticket_date::DATE = reservation_record.reservation_date
                AND ABS(EXTRACT(EPOCH FROM (
                    bt.ticket_date - 
                    (reservation_record.reservation_date + reservation_record.reservation_time::time)::timestamptz
                ))) <= 7200 -- Dentro de 2 horas
        LOOP
            -- Calcular confianza del matching
            DECLARE
                time_diff_seconds INTEGER;
                mesa_match BOOLEAN;
                confidence DECIMAL(3,2);
            BEGIN
                time_diff_seconds := ABS(EXTRACT(EPOCH FROM (
                    ticket_record.ticket_date - 
                    (reservation_record.reservation_date + reservation_record.reservation_time::time)::timestamptz
                )));

                mesa_match := (reservation_record.table_number = ticket_record.mesa_number);

                -- Score: 1.0 - (diferencia_tiempo / 7200) + bonus por mesa
                confidence := GREATEST(0, 1.0 - (time_diff_seconds / 7200.0));
                IF mesa_match THEN
                    confidence := LEAST(1.0, confidence + 0.3); -- Bonus por mesa exacta
                END IF;

                IF confidence > best_confidence THEN
                    best_confidence := confidence;
                    best_ticket_id := ticket_record.id;
                END IF;
            END;
        END LOOP;

        -- Si encontramos un buen match (>60% confianza), vincularlo
        IF best_confidence >= 0.6 THEN
            -- Vincular reserva con ticket
            UPDATE reservations 
            SET reservation_id = best_ticket_id 
            WHERE id = reservation_record.id;

            UPDATE billing_tickets 
            SET 
                reservation_id = reservation_record.id,
                confidence_score = best_confidence,
                auto_matched = true,
                matching_notes = 'Auto-matched con ' || ROUND(best_confidence * 100) || '% confianza'
            WHERE id = best_ticket_id;

            matches_created := matches_created + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'matches_created', matches_created
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;

-- 8. FUNCIÓN: Actualizar todos los clientes con AIVI
-- =====================================================
CREATE OR REPLACE FUNCTION crm_v2_update_all_customers(p_restaurant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    customer_record RECORD;
    updated_count INTEGER := 0;
    aivi_result JSONB;
BEGIN
    -- Procesar cada cliente
    FOR customer_record IN
        SELECT id FROM customers WHERE restaurant_id = p_restaurant_id
    LOOP
        -- Calcular AIVI y métricas
        SELECT calculate_customer_aivi(customer_record.id) INTO aivi_result;
        
        -- Calcular segmento
        PERFORM calculate_customer_segment_v2(customer_record.id);
        
        updated_count := updated_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'customers_updated', updated_count
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;

-- 9. VISTA: Resumen CRM v2 usando tablas existentes
-- =====================================================
CREATE OR REPLACE VIEW crm_v2_dashboard AS
SELECT 
    c.restaurant_id,
    
    -- Conteos por segmento
    COUNT(*) FILTER (WHERE c.segment_auto_v2 = 'nuevo') as nuevos,
    COUNT(*) FILTER (WHERE c.segment_auto_v2 = 'activo') as activos,
    COUNT(*) FILTER (WHERE c.segment_auto_v2 = 'riesgo') as en_riesgo,
    COUNT(*) FILTER (WHERE c.segment_auto_v2 = 'inactivo') as inactivos,
    COUNT(*) FILTER (WHERE c.is_vip_calculated = true) as vips,
    
    -- Métricas promedio
    ROUND(AVG(c.aivi_days), 1) as aivi_promedio,
    ROUND(AVG(c.recency_days), 1) as recencia_promedio,
    ROUND(AVG(c.total_spent_12m), 2) as gasto_promedio_12m,
    ROUND(AVG(c.visits_12m), 1) as visitas_promedio_12m,
    
    -- Estadísticas de matching
    COUNT(bt.id) as tickets_vinculados,
    ROUND(AVG(bt.confidence_score), 2) as confianza_promedio_matching,
    
    -- Última actualización
    MAX(c.features_updated_at) as ultima_actualizacion

FROM customers c
LEFT JOIN billing_tickets bt ON bt.customer_id = c.id AND bt.auto_matched = true
WHERE c.restaurant_id IS NOT NULL
GROUP BY c.restaurant_id;

-- Comentario
COMMENT ON VIEW crm_v2_dashboard IS 'Dashboard CRM v2 usando tablas existentes optimizadas';

-- =====================================================
-- FIN MIGRACIÓN CRM v2 - EVOLUCIÓN INTELIGENTE
-- =====================================================

-- 🎯 VENTAJAS DE ESTA APROXIMACIÓN:
-- ✅ NO duplica tablas existentes
-- ✅ USA la infraestructura actual
-- ✅ EVOLUCIONA sin romper nada
-- ✅ MANTIENE compatibilidad total
-- ✅ AGREGA funcionalidad AIVI sin conflictos
