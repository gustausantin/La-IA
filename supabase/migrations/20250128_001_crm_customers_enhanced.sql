-- ========================================
-- CRM CUSTOMERS ENHANCED - MIGRATION 001
-- Fecha: 28 Enero 2025
-- Descripción: Migración para mejorar tabla customers con CRM completo
-- ========================================

-- 1. ACTUALIZAR TABLA CUSTOMERS con campos CRM
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS first_name VARCHAR,
ADD COLUMN IF NOT EXISTS last_name1 VARCHAR,
ADD COLUMN IF NOT EXISTS last_name2 VARCHAR,
ADD COLUMN IF NOT EXISTS segment_manual VARCHAR CHECK (segment_manual IN ('nuevo', 'ocasional', 'regular', 'vip', 'inactivo', 'en_riesgo', 'alto_valor')),
ADD COLUMN IF NOT EXISTS segment_auto VARCHAR CHECK (segment_auto IN ('nuevo', 'ocasional', 'regular', 'vip', 'inactivo', 'en_riesgo', 'alto_valor')) DEFAULT 'nuevo',
ADD COLUMN IF NOT EXISTS visits_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_visit_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS avg_ticket NUMERIC DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS preferred_items JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS consent_email BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS consent_sms BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS next_action_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS churn_risk_score INTEGER DEFAULT 0 CHECK (churn_risk_score >= 0 AND churn_risk_score <= 100),
ADD COLUMN IF NOT EXISTS predicted_ltv NUMERIC DEFAULT 0.00;

-- 2. ACTUALIZAR TABLA RESERVATIONS con campos CRM
ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS spend_amount NUMERIC DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS reservation_source VARCHAR DEFAULT 'manual' CHECK (reservation_source IN ('ia', 'manual')),
ADD COLUMN IF NOT EXISTS reservation_channel VARCHAR DEFAULT 'web';

-- 3. MIGRAR DATOS EXISTENTES: separar nombre en campos
UPDATE customers 
SET 
    first_name = CASE 
        WHEN name IS NOT NULL AND TRIM(name) != '' THEN
            CASE 
                WHEN POSITION(' ' IN TRIM(name)) > 0 THEN
                    SPLIT_PART(TRIM(name), ' ', 1)
                ELSE
                    TRIM(name)
            END
        ELSE NULL
    END,
    last_name1 = CASE 
        WHEN name IS NOT NULL AND TRIM(name) != '' AND POSITION(' ' IN TRIM(name)) > 0 THEN
            CASE 
                WHEN array_length(string_to_array(TRIM(name), ' '), 1) >= 2 THEN
                    SPLIT_PART(TRIM(name), ' ', 2)
                ELSE NULL
            END
        ELSE NULL
    END,
    last_name2 = CASE 
        WHEN name IS NOT NULL AND TRIM(name) != '' AND array_length(string_to_array(TRIM(name), ' '), 1) >= 3 THEN
            SPLIT_PART(TRIM(name), ' ', 3)
        ELSE NULL
    END
WHERE name IS NOT NULL AND TRIM(name) != '';

-- 4. MIGRAR DATOS EXISTENTES: recalcular visits_count desde reservations
UPDATE customers c
SET 
    visits_count = COALESCE(r.count_visits, 0),
    last_visit_at = r.last_reservation,
    avg_ticket = CASE 
        WHEN COALESCE(r.count_visits, 0) > 0 THEN (c.total_spent / r.count_visits)
        ELSE 0
    END
FROM (
    SELECT 
        customer_id,
        COUNT(*) as count_visits,
        MAX(created_at) as last_reservation
    FROM reservations 
    WHERE customer_id IS NOT NULL 
    AND status IN ('confirmed', 'completed', 'seated')
    GROUP BY customer_id
) r
WHERE c.id = r.customer_id;

-- 5. CREAR ÍNDICES para optimizar consultas CRM
CREATE INDEX IF NOT EXISTS idx_customers_segment_auto ON customers(segment_auto);
CREATE INDEX IF NOT EXISTS idx_customers_segment_manual ON customers(segment_manual);
CREATE INDEX IF NOT EXISTS idx_customers_visits_count ON customers(visits_count);
CREATE INDEX IF NOT EXISTS idx_customers_last_visit_at ON customers(last_visit_at);
CREATE INDEX IF NOT EXISTS idx_customers_restaurant_segment ON customers(restaurant_id, segment_auto);
CREATE INDEX IF NOT EXISTS idx_customers_consent ON customers(consent_email, consent_sms);
CREATE INDEX IF NOT EXISTS idx_customers_phone_unique ON customers(restaurant_id, phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_email_unique ON customers(restaurant_id, email) WHERE email IS NOT NULL;

-- 6. CREAR ÍNDICES para reservations
CREATE INDEX IF NOT EXISTS idx_reservations_customer_status ON reservations(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_reservations_source_channel ON reservations(reservation_source, reservation_channel);
CREATE INDEX IF NOT EXISTS idx_reservations_created_at ON reservations(created_at);

-- 7. COMENTARIOS para documentación
COMMENT ON COLUMN customers.segment_manual IS 'Segmento asignado manualmente por usuario, prevalece sobre segment_auto';
COMMENT ON COLUMN customers.segment_auto IS 'Segmento calculado automáticamente por reglas de negocio';
COMMENT ON COLUMN customers.visits_count IS 'Contador automático de visitas (reservas completadas)';
COMMENT ON COLUMN customers.avg_ticket IS 'Ticket promedio = total_spent / visits_count';
COMMENT ON COLUMN customers.churn_risk_score IS 'Score 0-100 de riesgo de pérdida del cliente';
COMMENT ON COLUMN customers.predicted_ltv IS 'Valor de vida del cliente predicho por IA';
COMMENT ON COLUMN customers.consent_email IS 'Consentimiento para envío de emails';
COMMENT ON COLUMN customers.consent_sms IS 'Consentimiento para envío de SMS';

-- ========================================
-- MIGRACIÓN COMPLETADA ✅
-- ========================================
