-- ========================================
-- CRM AUTOMATION RULES - MIGRATION 003
-- Fecha: 28 Enero 2025
-- Descripción: Sistema de reglas de automatización para CRM
-- ========================================

-- 1. CREAR TABLA automation_rules
CREATE TABLE IF NOT EXISTS automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    
    -- Configuración de la regla
    name VARCHAR NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    
    -- Tipo y condiciones
    rule_type VARCHAR NOT NULL CHECK (rule_type IN ('inactivo', 'vip_upgrade', 'recordatorio', 'bienvenida', 'alto_valor', 'en_riesgo', 'ocasional_to_regular')),
    trigger_condition JSONB NOT NULL DEFAULT '{}', -- Condiciones que activan la regla
    
    -- Configuración de acción
    action_type VARCHAR NOT NULL CHECK (action_type IN ('send_email', 'send_sms', 'send_whatsapp', 'create_notification', 'assign_segment', 'schedule_follow_up')),
    action_config JSONB NOT NULL DEFAULT '{}', -- Configuración de la acción
    
    -- Configuración de cooldown y frecuencia
    cooldown_days INTEGER DEFAULT 30,
    max_executions_per_customer INTEGER DEFAULT 3,
    execution_window_days INTEGER DEFAULT 90, -- Ventana para max_executions
    
    -- Configuración de horarios
    execution_hours_start TIME DEFAULT '09:00',
    execution_hours_end TIME DEFAULT '21:00',
    execution_days_of_week INTEGER[] DEFAULT ARRAY[1,2,3,4,5,6,7], -- 1=Lunes, 7=Domingo
    
    -- Metadatos y auditoría
    created_by UUID, -- ID del usuario que creó la regla
    last_executed_at TIMESTAMPTZ,
    total_executions INTEGER DEFAULT 0,
    successful_executions INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- 2. CREAR TABLA automation_rule_executions (auditoría)
CREATE TABLE IF NOT EXISTS automation_rule_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    rule_id UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    
    -- Resultado de la ejecución
    executed_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    status VARCHAR NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'failed', 'skipped')),
    result_data JSONB DEFAULT '{}',
    error_message TEXT,
    
    -- Referencia a la interacción creada (si aplica)
    interaction_id UUID REFERENCES customer_interactions(id),
    
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- 3. CREAR ÍNDICES para automation_rules
CREATE INDEX idx_automation_rules_restaurant ON automation_rules(restaurant_id);
CREATE INDEX idx_automation_rules_type ON automation_rules(rule_type);
CREATE INDEX idx_automation_rules_active ON automation_rules(is_active);
CREATE INDEX idx_automation_rules_execution ON automation_rules(last_executed_at);

-- 4. CREAR ÍNDICES para automation_rule_executions
CREATE INDEX idx_rule_executions_restaurant ON automation_rule_executions(restaurant_id);
CREATE INDEX idx_rule_executions_rule ON automation_rule_executions(rule_id);
CREATE INDEX idx_rule_executions_customer ON automation_rule_executions(customer_id);
CREATE INDEX idx_rule_executions_date ON automation_rule_executions(executed_at);
CREATE INDEX idx_rule_executions_status ON automation_rule_executions(status);

-- 5. RLS para automation_rules
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY automation_rules_restaurant_access ON automation_rules
    FOR ALL 
    USING (
        restaurant_id IN (
            SELECT urm.restaurant_id 
            FROM user_restaurant_mapping urm 
            WHERE urm.auth_user_id = auth.uid() 
            AND urm.active = true
        )
    );

-- 6. RLS para automation_rule_executions  
ALTER TABLE automation_rule_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY automation_rule_executions_restaurant_access ON automation_rule_executions
    FOR ALL 
    USING (
        restaurant_id IN (
            SELECT urm.restaurant_id 
            FROM user_restaurant_mapping urm 
            WHERE urm.auth_user_id = auth.uid() 
            AND urm.active = true
        )
    );

-- 7. TRIGGERS para updated_at
CREATE OR REPLACE FUNCTION handle_automation_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER automation_rules_updated_at
    BEFORE UPDATE ON automation_rules
    FOR EACH ROW
    EXECUTE FUNCTION handle_automation_rules_updated_at();

-- 8. INSERTAR REGLAS POR DEFECTO
INSERT INTO automation_rules (restaurant_id, name, description, rule_type, trigger_condition, action_type, action_config, cooldown_days)
SELECT 
    r.id,
    'Reactivación de Clientes Inactivos',
    'Envía email de reactivación a clientes que no han visitado en 60+ días',
    'inactivo',
    '{"days_since_last_visit": 60, "segment_required": "inactivo"}'::jsonb,
    'send_email',
    '{"template_type": "reactivation", "subject": "¡Te echamos de menos! Vuelve y disfruta", "priority": "normal"}'::jsonb,
    30
FROM restaurants r
ON CONFLICT DO NOTHING;

INSERT INTO automation_rules (restaurant_id, name, description, rule_type, trigger_condition, action_type, action_config, cooldown_days)
SELECT 
    r.id,
    'Bienvenida VIP',
    'Envía WhatsApp de bienvenida cuando un cliente se convierte en VIP',
    'vip_upgrade',
    '{"segment_change_to": "vip", "first_time_vip": true}'::jsonb,
    'send_whatsapp',
    '{"template_type": "vip_welcome", "message": "¡Felicidades! Eres cliente VIP. Disfruta de beneficios exclusivos.", "priority": "high"}'::jsonb,
    90
FROM restaurants r
ON CONFLICT DO NOTHING;

-- 9. COMENTARIOS
COMMENT ON TABLE automation_rules IS 'Reglas de automatización para CRM (reactivación, bienvenida VIP, etc.)';
COMMENT ON COLUMN automation_rules.trigger_condition IS 'Condiciones JSON que activan la regla';
COMMENT ON COLUMN automation_rules.action_config IS 'Configuración JSON de la acción a ejecutar';
COMMENT ON COLUMN automation_rules.cooldown_days IS 'Días mínimos entre ejecuciones para el mismo cliente';
COMMENT ON COLUMN automation_rules.execution_window_days IS 'Ventana de días para contar max_executions_per_customer';

COMMENT ON TABLE automation_rule_executions IS 'Auditoría de ejecuciones de reglas de automatización';

-- ========================================
-- SISTEMA AUTOMATION_RULES CREADO ✅
-- ========================================
