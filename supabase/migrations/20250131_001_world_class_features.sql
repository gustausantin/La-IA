-- ====================================
-- WORLD CLASS FEATURES - MIGRATION FINAL
-- Fecha: 31 Enero 2025
-- Descripción: Funcionalidades avanzadas para la mejor app del mundo
-- ====================================

-- 1. ASEGURAR QUE TABLA CUSTOMERS TIENE TODOS LOS CAMPOS CRM AVANZADOS
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS segment_manual VARCHAR,
ADD COLUMN IF NOT EXISTS segment_auto VARCHAR DEFAULT 'nuevo',
ADD COLUMN IF NOT EXISTS visits_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_visit_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS churn_risk_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS predicted_ltv NUMERIC DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS first_name VARCHAR,
ADD COLUMN IF NOT EXISTS last_name1 VARCHAR,
ADD COLUMN IF NOT EXISTS last_name2 VARCHAR,
ADD COLUMN IF NOT EXISTS consent_email BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS consent_sms BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS consent_whatsapp BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS avg_ticket NUMERIC DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS preferred_items JSONB DEFAULT '[]';

-- 2. ASEGURAR QUE TABLA RESTAURANTS TIENE CONFIGURACIÓN CRM
ALTER TABLE restaurants 
ADD COLUMN IF NOT EXISTS crm_config JSONB DEFAULT '{}';

-- 3. FUNCIÓN PARA RECOMPUTAR ESTADÍSTICAS DE CLIENTE (CRM AUTOMÁTICO)
CREATE OR REPLACE FUNCTION recompute_customer_stats(
    p_customer_id UUID,
    p_restaurant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_stats JSONB;
    v_visits_count INTEGER;
    v_total_spent NUMERIC;
    v_avg_ticket NUMERIC;
    v_last_visit TIMESTAMPTZ;
    v_churn_risk INTEGER;
    v_predicted_ltv NUMERIC;
BEGIN
    -- Calcular estadísticas desde reservas completadas
    SELECT 
        COUNT(*),
        COALESCE(SUM(spend_amount), 0),
        MAX(reservation_date)
    INTO 
        v_visits_count,
        v_total_spent, 
        v_last_visit
    FROM reservations 
    WHERE customer_id = p_customer_id 
      AND restaurant_id = p_restaurant_id
      AND status IN ('completed', 'confirmed');
    
    -- Calcular ticket promedio
    v_avg_ticket := CASE 
        WHEN v_visits_count > 0 THEN v_total_spent / v_visits_count 
        ELSE 0 
    END;
    
    -- Calcular churn risk (simplificado)
    v_churn_risk := CASE
        WHEN v_last_visit IS NULL THEN 0
        WHEN EXTRACT(DAYS FROM NOW() - v_last_visit) > 90 THEN 80
        WHEN EXTRACT(DAYS FROM NOW() - v_last_visit) > 60 THEN 60
        WHEN EXTRACT(DAYS FROM NOW() - v_last_visit) > 30 THEN 30
        ELSE 10
    END;
    
    -- Calcular LTV predicho (simplificado)
    v_predicted_ltv := v_avg_ticket * 12; -- Estimación anual
    
    -- Actualizar cliente con nuevas estadísticas
    UPDATE customers 
    SET 
        visits_count = v_visits_count,
        total_spent = v_total_spent,
        avg_ticket = v_avg_ticket,
        last_visit_at = v_last_visit,
        churn_risk_score = v_churn_risk,
        predicted_ltv = v_predicted_ltv,
        updated_at = NOW()
    WHERE id = p_customer_id AND restaurant_id = p_restaurant_id;
    
    -- Retornar estadísticas calculadas
    v_stats := jsonb_build_object(
        'visits_count', v_visits_count,
        'total_spent', v_total_spent,
        'avg_ticket', v_avg_ticket,
        'last_visit_at', v_last_visit,
        'churn_risk_score', v_churn_risk,
        'predicted_ltv', v_predicted_ltv
    );
    
    RETURN v_stats;
END;
$$;

-- 4. FUNCIÓN PARA RECOMPUTAR SEGMENTO AUTOMÁTICO
CREATE OR REPLACE FUNCTION recompute_customer_segment(
    p_customer_id UUID,
    p_restaurant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_customer RECORD;
    v_new_segment VARCHAR;
    v_old_segment VARCHAR;
    v_days_since_last_visit INTEGER;
BEGIN
    -- Obtener datos actuales del cliente
    SELECT * INTO v_customer
    FROM customers 
    WHERE id = p_customer_id AND restaurant_id = p_restaurant_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Cliente no encontrado');
    END IF;
    
    v_old_segment := v_customer.segment_auto;
    
    -- Calcular días desde última visita
    v_days_since_last_visit := CASE
        WHEN v_customer.last_visit_at IS NULL THEN 999
        ELSE EXTRACT(DAYS FROM NOW() - v_customer.last_visit_at)
    END;
    
    -- Aplicar reglas de segmentación (orden de prioridad)
    IF v_customer.total_spent >= 1000 THEN
        v_new_segment := 'alto_valor';
    ELSIF v_customer.visits_count >= 5 OR v_customer.total_spent >= 500 THEN
        v_new_segment := 'vip';
    ELSIF v_days_since_last_visit >= 60 AND v_customer.visits_count > 0 THEN
        v_new_segment := 'inactivo';
    ELSIF v_customer.visits_count >= 3 AND v_customer.visits_count <= 4 THEN
        v_new_segment := 'regular';
    ELSIF v_customer.visits_count >= 1 AND v_customer.visits_count <= 2 THEN
        v_new_segment := 'ocasional';
    ELSE
        v_new_segment := 'nuevo';
    END IF;
    
    -- Actualizar segmento si cambió
    IF v_new_segment != v_old_segment THEN
        UPDATE customers 
        SET 
            segment_auto = v_new_segment,
            updated_at = NOW()
        WHERE id = p_customer_id AND restaurant_id = p_restaurant_id;
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'old_segment', v_old_segment,
        'new_segment', v_new_segment,
        'segment_changed', v_new_segment != v_old_segment,
        'days_since_last_visit', v_days_since_last_visit
    );
END;
$$;

-- 5. FUNCIÓN PARA PROCESAR COMPLETADO DE RESERVA (TRIGGER CRM)
CREATE OR REPLACE FUNCTION process_reservation_completion(
    p_reservation_id UUID,
    p_restaurant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reservation RECORD;
    v_customer_id UUID;
    v_stats_result JSONB;
    v_segment_result JSONB;
BEGIN
    -- Obtener datos de la reserva
    SELECT * INTO v_reservation
    FROM reservations 
    WHERE id = p_reservation_id AND restaurant_id = p_restaurant_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Reserva no encontrada');
    END IF;
    
    v_customer_id := v_reservation.customer_id;
    
    -- Si no hay customer_id, buscar por teléfono/email
    IF v_customer_id IS NULL THEN
        SELECT id INTO v_customer_id
        FROM customers 
        WHERE restaurant_id = p_restaurant_id
          AND (phone = v_reservation.customer_phone OR email = v_reservation.customer_email)
        LIMIT 1;
    END IF;
    
    -- Si aún no hay cliente, crear uno nuevo
    IF v_customer_id IS NULL THEN
        INSERT INTO customers (
            restaurant_id,
            name,
            phone,
            email,
            visits_count,
            segment_auto
        ) VALUES (
            p_restaurant_id,
            v_reservation.customer_name,
            v_reservation.customer_phone,
            v_reservation.customer_email,
            0,
            'nuevo'
        ) RETURNING id INTO v_customer_id;
        
        -- Actualizar reserva con customer_id
        UPDATE reservations 
        SET customer_id = v_customer_id
        WHERE id = p_reservation_id;
    END IF;
    
    -- Recomputar estadísticas del cliente
    v_stats_result := recompute_customer_stats(v_customer_id, p_restaurant_id);
    
    -- Recomputar segmento
    v_segment_result := recompute_customer_segment(v_customer_id, p_restaurant_id);
    
    RETURN jsonb_build_object(
        'success', true,
        'customer_id', v_customer_id,
        'stats', v_stats_result,
        'segment', v_segment_result
    );
END;
$$;

-- 6. FUNCIÓN PARA OBTENER ESTADÍSTICAS CRM DEL DASHBOARD
CREATE OR REPLACE FUNCTION get_crm_dashboard_stats(p_restaurant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_customers INTEGER;
    v_new_customers INTEGER;
    v_vip_customers INTEGER;
    v_at_risk_customers INTEGER;
    v_inactive_customers INTEGER;
    v_total_ltv NUMERIC;
    v_avg_churn_risk NUMERIC;
    v_automations_sent_today INTEGER;
BEGIN
    -- Contar clientes por segmento
    SELECT COUNT(*) INTO v_total_customers
    FROM customers WHERE restaurant_id = p_restaurant_id;
    
    SELECT COUNT(*) INTO v_new_customers
    FROM customers 
    WHERE restaurant_id = p_restaurant_id 
      AND segment_auto = 'nuevo';
    
    SELECT COUNT(*) INTO v_vip_customers
    FROM customers 
    WHERE restaurant_id = p_restaurant_id 
      AND segment_auto = 'vip';
    
    SELECT COUNT(*) INTO v_at_risk_customers
    FROM customers 
    WHERE restaurant_id = p_restaurant_id 
      AND segment_auto = 'en_riesgo';
    
    SELECT COUNT(*) INTO v_inactive_customers
    FROM customers 
    WHERE restaurant_id = p_restaurant_id 
      AND segment_auto = 'inactivo';
    
    -- Calcular métricas avanzadas
    SELECT 
        COALESCE(SUM(predicted_ltv), 0),
        COALESCE(AVG(churn_risk_score), 0)
    INTO v_total_ltv, v_avg_churn_risk
    FROM customers 
    WHERE restaurant_id = p_restaurant_id;
    
    -- Contar automatizaciones enviadas hoy
    SELECT COUNT(*) INTO v_automations_sent_today
    FROM customer_interactions 
    WHERE restaurant_id = p_restaurant_id 
      AND DATE(created_at) = CURRENT_DATE
      AND status = 'sent';
    
    RETURN jsonb_build_object(
        'total_customers', v_total_customers,
        'new_customers', v_new_customers,
        'vip_customers', v_vip_customers,
        'at_risk_customers', v_at_risk_customers,
        'inactive_customers', v_inactive_customers,
        'total_ltv', v_total_ltv,
        'avg_churn_risk', v_avg_churn_risk,
        'automations_sent_today', v_automations_sent_today,
        'segments_distribution', jsonb_build_object(
            'nuevo', v_new_customers,
            'vip', v_vip_customers,
            'en_riesgo', v_at_risk_customers,
            'inactivo', v_inactive_customers
        )
    );
END;
$$;

-- 7. RLS POLICIES PARA NUEVAS TABLAS
ALTER TABLE message_batches_demo ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversation_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_feedback ENABLE ROW LEVEL SECURITY;

-- Políticas para message_batches_demo
CREATE POLICY "Users can view own restaurant message batches" ON message_batches_demo
    FOR SELECT USING (
        restaurant_id IN (
            SELECT restaurant_id FROM user_restaurant_mapping 
            WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own restaurant message batches" ON message_batches_demo
    FOR INSERT WITH CHECK (
        restaurant_id IN (
            SELECT restaurant_id FROM user_restaurant_mapping 
            WHERE auth_user_id = auth.uid()
        )
    );

-- Políticas para ai_conversation_insights
CREATE POLICY "Users can view own restaurant ai insights" ON ai_conversation_insights
    FOR SELECT USING (
        restaurant_id IN (
            SELECT restaurant_id FROM user_restaurant_mapping 
            WHERE auth_user_id = auth.uid()
        )
    );

-- Políticas para customer_feedback
CREATE POLICY "Users can view own restaurant feedback" ON customer_feedback
    FOR SELECT USING (
        restaurant_id IN (
            SELECT restaurant_id FROM user_restaurant_mapping 
            WHERE auth_user_id = auth.uid()
        )
    );

-- 8. TRIGGER PARA ACTUALIZACIÓN AUTOMÁTICA DE CUSTOMER STATS
CREATE OR REPLACE FUNCTION trigger_update_customer_stats_on_reservation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Solo procesar cuando el estado cambia a 'completed'
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        -- Llamar función de procesamiento CRM
        PERFORM process_reservation_completion(NEW.id, NEW.restaurant_id);
    END IF;
    
    RETURN NEW;
END;
$$;

-- Crear trigger si no existe
DROP TRIGGER IF EXISTS trigger_auto_update_customer_stats ON reservations;
CREATE TRIGGER trigger_auto_update_customer_stats
    AFTER UPDATE ON reservations
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_customer_stats_on_reservation();

-- 9. ÍNDICES PARA PERFORMANCE CRM
CREATE INDEX IF NOT EXISTS idx_customers_segment_auto ON customers(restaurant_id, segment_auto);
CREATE INDEX IF NOT EXISTS idx_customers_last_visit ON customers(restaurant_id, last_visit_at);
CREATE INDEX IF NOT EXISTS idx_customers_churn_risk ON customers(restaurant_id, churn_risk_score);
CREATE INDEX IF NOT EXISTS idx_automation_rules_active ON automation_rules(restaurant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_customer_interactions_date ON customer_interactions(restaurant_id, created_at);

-- 10. COMENTARIOS PARA DOCUMENTACIÓN
COMMENT ON TABLE automation_rules IS 'Reglas de automatización CRM con cooldown y consent management';
COMMENT ON TABLE customer_interactions IS 'Registro de todas las interacciones automáticas con clientes';
COMMENT ON TABLE automation_rule_executions IS 'Auditoría completa de ejecuciones de automatizaciones';
COMMENT ON FUNCTION recompute_customer_stats IS 'Recalcula automáticamente las estadísticas de un cliente';
COMMENT ON FUNCTION recompute_customer_segment IS 'Recalcula el segmento automático de un cliente según reglas IA';
COMMENT ON FUNCTION process_reservation_completion IS 'Procesa automáticamente la finalización de una reserva para CRM';

-- ====================================
-- MIGRATION COMPLETADA - WORLD CLASS FEATURES
-- ====================================
