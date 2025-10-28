-- =====================================================
-- CRM MESSAGING SYSTEM - ENTERPRISE ARCHITECTURE
-- Migración: 20250128_005_crm_messaging_system.sql
-- Autor: La-IA CRM Team
-- Descripción: Sistema completo de mensajería automática CRM
-- =====================================================

-- 1. AGREGAR CAMPOS DE CONSENTIMIENTO A CUSTOMERS
-- =====================================================

ALTER TABLE customers ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT true;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS preferred_channel TEXT DEFAULT 'whatsapp' CHECK (preferred_channel IN ('whatsapp', 'email', 'none'));
ALTER TABLE customers ADD COLUMN IF NOT EXISTS consent_whatsapp BOOLEAN DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS consent_email BOOLEAN DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_interaction_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS interaction_count INTEGER DEFAULT 0;

-- Comentarios para documentación
COMMENT ON COLUMN customers.notifications_enabled IS 'Master switch - si false, cliente nunca recibe mensajes automáticos';
COMMENT ON COLUMN customers.preferred_channel IS 'Canal preferido: whatsapp, email, none';
COMMENT ON COLUMN customers.consent_whatsapp IS 'Consentimiento explícito para WhatsApp';
COMMENT ON COLUMN customers.consent_email IS 'Consentimiento explícito para Email';
COMMENT ON COLUMN customers.last_interaction_at IS 'Última interacción de marketing';
COMMENT ON COLUMN customers.interaction_count IS 'Total de interacciones de marketing enviadas';

-- 2. TABLA: message_templates
-- =====================================================

CREATE TABLE IF NOT EXISTS message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    
    -- Identificación y categorización
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- 'bienvenida', 'reactivacion', 'vip_upgrade', 'cumpleanos', etc.
    segment TEXT NOT NULL CHECK (segment IN ('nuevo', 'ocasional', 'regular', 'vip', 'inactivo', 'en_riesgo', 'alto_valor', 'all')),
    event_trigger TEXT NOT NULL, -- 'reservation_completed', 'segment_changed', 'birthday', 'manual'
    
    -- Contenido de la plantilla
    subject TEXT, -- Para emails
    content_markdown TEXT NOT NULL, -- Contenido con variables Mustache {{variable}}
    variables TEXT[] DEFAULT ARRAY[]::TEXT[], -- Variables requeridas ['first_name', 'last_visit_at']
    
    -- Configuración de canales
    channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email', 'both')),
    provider_template_name TEXT, -- Nombre de la plantilla en Twilio/SendGrid para templates aprobados
    
    -- Configuración de automatización
    is_active BOOLEAN DEFAULT true,
    send_delay_hours INTEGER DEFAULT 0, -- Retraso antes del envío (ej: 24h después del trigger)
    priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10), -- 1 = más alta
    
    -- Metadatos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    created_by UUID REFERENCES auth.users(id),
    
    -- Índices únicos
    UNIQUE(restaurant_id, name)
);

-- RLS para message_templates
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "message_templates_tenant_isolation" ON message_templates
    FOR ALL USING (
        restaurant_id IN (
            SELECT restaurant_id 
            FROM user_restaurant_mapping 
            WHERE auth_user_id = auth.uid()
        )
    );

-- 3. TABLA: automation_rules
-- =====================================================

CREATE TABLE IF NOT EXISTS automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    
    -- Identificación
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    
    -- Trigger configuration
    trigger_event TEXT NOT NULL CHECK (trigger_event IN ('reservation_completed', 'segment_changed', 'daily_check', 'birthday', 'manual')),
    trigger_conditions JSONB DEFAULT '{}', -- Condiciones adicionales JSON
    
    -- Target configuration
    target_segment TEXT CHECK (target_segment IN ('nuevo', 'ocasional', 'regular', 'vip', 'inactivo', 'en_riesgo', 'alto_valor', 'all')),
    template_id UUID REFERENCES message_templates(id) ON DELETE SET NULL,
    
    -- Execution limits
    cooldown_days INTEGER DEFAULT 30, -- Días mínimos entre ejecuciones para el mismo cliente
    max_executions_per_customer INTEGER DEFAULT 5, -- Máximo de ejecuciones por cliente
    max_daily_executions INTEGER DEFAULT 50, -- Máximo diario por tenant
    
    -- Time windows
    execution_hours_start TIME DEFAULT '09:00',
    execution_hours_end TIME DEFAULT '21:00',
    execution_days_of_week INTEGER[] DEFAULT ARRAY[1,2,3,4,5,6,7], -- 1=Lunes, 7=Domingo
    
    -- Action configuration
    action_config JSONB DEFAULT '{}', -- Configuración específica de la acción
    
    -- Metadatos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    last_executed_at TIMESTAMP WITH TIME ZONE,
    execution_count INTEGER DEFAULT 0,
    
    UNIQUE(restaurant_id, name)
);

-- RLS para automation_rules
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automation_rules_tenant_isolation" ON automation_rules
    FOR ALL USING (
        restaurant_id IN (
            SELECT restaurant_id 
            FROM user_restaurant_mapping 
            WHERE auth_user_id = auth.uid()
        )
    );

-- 4. TABLA: scheduled_messages
-- =====================================================

CREATE TABLE IF NOT EXISTS scheduled_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    
    -- Referencias
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    automation_rule_id UUID REFERENCES automation_rules(id) ON DELETE SET NULL,
    template_id UUID REFERENCES message_templates(id) ON DELETE SET NULL,
    
    -- Scheduling
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    
    -- Channel planning
    channel_planned TEXT NOT NULL CHECK (channel_planned IN ('whatsapp', 'email')),
    channel_final TEXT CHECK (channel_final IN ('whatsapp', 'email', 'skipped')),
    
    -- Message content (rendered)
    subject_rendered TEXT,
    content_rendered TEXT NOT NULL,
    variables_used JSONB DEFAULT '{}',
    
    -- Status tracking
    status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'processing', 'sent', 'delivered', 'failed', 'skipped')),
    
    -- Provider tracking
    provider_message_id TEXT, -- ID del mensaje en Twilio/SendGrid
    provider_response JSONB, -- Respuesta completa del provider
    
    -- Error handling
    retry_count INTEGER DEFAULT 0,
    last_error TEXT,
    last_attempted_at TIMESTAMP WITH TIME ZONE,
    
    -- Delivery tracking
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_restaurant_id ON scheduled_messages(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_customer_id ON scheduled_messages(customer_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_scheduled_for ON scheduled_messages(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_status ON scheduled_messages(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_channel_planned ON scheduled_messages(channel_planned);

-- RLS para scheduled_messages
ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scheduled_messages_tenant_isolation" ON scheduled_messages
    FOR ALL USING (
        restaurant_id IN (
            SELECT restaurant_id 
            FROM user_restaurant_mapping 
            WHERE auth_user_id = auth.uid()
        )
    );

-- 5. TABLA: interaction_logs (Audit Trail)
-- =====================================================

CREATE TABLE IF NOT EXISTS interaction_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    
    -- Referencias
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    scheduled_message_id UUID REFERENCES scheduled_messages(id) ON DELETE SET NULL,
    
    -- Interaction details
    interaction_type TEXT NOT NULL CHECK (interaction_type IN ('message_sent', 'message_delivered', 'message_failed', 'message_clicked', 'opt_out', 'opt_in')),
    channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email', 'sms')),
    
    -- Content summary
    subject TEXT,
    content_preview TEXT, -- Primeros 100 caracteres
    
    -- Tracking
    provider_message_id TEXT,
    provider_response JSONB,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    
    -- User context
    created_by_user UUID REFERENCES auth.users(id),
    ip_address INET,
    user_agent TEXT
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_interaction_logs_restaurant_id ON interaction_logs(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_interaction_logs_customer_id ON interaction_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_interaction_logs_created_at ON interaction_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_interaction_logs_interaction_type ON interaction_logs(interaction_type);

-- RLS para interaction_logs
ALTER TABLE interaction_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "interaction_logs_tenant_isolation" ON interaction_logs
    FOR ALL USING (
        restaurant_id IN (
            SELECT restaurant_id 
            FROM user_restaurant_mapping 
            WHERE auth_user_id = auth.uid()
        )
    );

-- 6. TABLA: channel_credentials (Credenciales por tenant)
-- =====================================================

CREATE TABLE IF NOT EXISTS channel_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    
    -- Channel identification
    channel TEXT NOT NULL CHECK (channel IN ('twilio_whatsapp', 'sendgrid_email', 'resend_email', 'n8n_webhook')),
    is_active BOOLEAN DEFAULT false,
    
    -- Encrypted credentials (usar Supabase Vault en producción)
    credentials JSONB NOT NULL DEFAULT '{}', -- Encriptado: api_keys, tokens, etc.
    
    -- Configuration
    config JSONB DEFAULT '{}', -- Configuración específica del canal
    
    -- Testing
    last_test_at TIMESTAMP WITH TIME ZONE,
    last_test_success BOOLEAN,
    last_test_error TEXT,
    
    -- Metadatos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    
    UNIQUE(restaurant_id, channel)
);

-- RLS para channel_credentials
ALTER TABLE channel_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "channel_credentials_tenant_isolation" ON channel_credentials
    FOR ALL USING (
        restaurant_id IN (
            SELECT restaurant_id 
            FROM user_restaurant_mapping 
            WHERE auth_user_id = auth.uid()
        )
    );

-- 7. FUNCIONES HELPER
-- =====================================================

-- Función para renderizar plantillas con variables
CREATE OR REPLACE FUNCTION render_message_template(
    template_content TEXT,
    customer_data JSONB,
    restaurant_data JSONB DEFAULT '{}'
) RETURNS TEXT AS $$
DECLARE
    rendered_content TEXT;
BEGIN
    rendered_content := template_content;
    
    -- Reemplazar variables del cliente
    rendered_content := REPLACE(rendered_content, '{{first_name}}', COALESCE(customer_data->>'first_name', customer_data->>'name', 'Cliente'));
    rendered_content := REPLACE(rendered_content, '{{name}}', COALESCE(customer_data->>'name', 'Cliente'));
    rendered_content := REPLACE(rendered_content, '{{email}}', COALESCE(customer_data->>'email', ''));
    rendered_content := REPLACE(rendered_content, '{{phone}}', COALESCE(customer_data->>'phone', ''));
    rendered_content := REPLACE(rendered_content, '{{visits_count}}', COALESCE((customer_data->>'total_visits')::TEXT, '0'));
    rendered_content := REPLACE(rendered_content, '{{total_spent}}', COALESCE((customer_data->>'total_spent')::TEXT, '0'));
    rendered_content := REPLACE(rendered_content, '{{last_visit_at}}', COALESCE(customer_data->>'last_visit', 'nunca'));
    
    -- Reemplazar variables del restaurante
    rendered_content := REPLACE(rendered_content, '{{restaurant_name}}', COALESCE(restaurant_data->>'name', 'Nuestro Restaurante'));
    rendered_content := REPLACE(rendered_content, '{{restaurant_phone}}', COALESCE(restaurant_data->>'phone', ''));
    rendered_content := REPLACE(rendered_content, '{{restaurant_email}}', COALESCE(restaurant_data->>'email', ''));
    
    -- Variables calculadas
    IF customer_data->>'last_visit' IS NOT NULL THEN
        rendered_content := REPLACE(
            rendered_content, 
            '{{days_since_last_visit}}', 
            EXTRACT(days FROM (NOW() - (customer_data->>'last_visit')::TIMESTAMP))::TEXT
        );
    ELSE
        rendered_content := REPLACE(rendered_content, '{{days_since_last_visit}}', 'muchos');
    END IF;
    
    RETURN rendered_content;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para verificar elegibilidad de envío
CREATE OR REPLACE FUNCTION check_message_eligibility(
    p_customer_id UUID,
    p_restaurant_id UUID,
    p_automation_rule_id UUID
) RETURNS JSONB AS $$
DECLARE
    customer_record RECORD;
    rule_record RECORD;
    last_interaction TIMESTAMP WITH TIME ZONE;
    daily_count INTEGER;
    result JSONB;
BEGIN
    -- Obtener datos del cliente
    SELECT * INTO customer_record 
    FROM customers 
    WHERE id = p_customer_id AND restaurant_id = p_restaurant_id;
    
    -- Obtener regla de automatización
    SELECT * INTO rule_record 
    FROM automation_rules 
    WHERE id = p_automation_rule_id AND restaurant_id = p_restaurant_id;
    
    -- Verificaciones de elegibilidad
    result := jsonb_build_object('eligible', true, 'reasons', '[]'::jsonb);
    
    -- 1. Notificaciones deshabilitadas
    IF NOT COALESCE(customer_record.notifications_enabled, true) THEN
        result := jsonb_set(result, '{eligible}', 'false');
        result := jsonb_set(result, '{reasons}', result->'reasons' || '["notifications_disabled"]');
    END IF;
    
    -- 2. Sin consentimiento
    IF rule_record.action_config->>'channel' = 'whatsapp' AND NOT COALESCE(customer_record.consent_whatsapp, false) THEN
        result := jsonb_set(result, '{eligible}', 'false');
        result := jsonb_set(result, '{reasons}', result->'reasons' || '["no_whatsapp_consent"]');
    END IF;
    
    IF rule_record.action_config->>'channel' = 'email' AND NOT COALESCE(customer_record.consent_email, false) THEN
        result := jsonb_set(result, '{eligible}', 'false');
        result := jsonb_set(result, '{reasons}', result->'reasons' || '["no_email_consent"]');
    END IF;
    
    -- 3. Cooldown period
    SELECT MAX(created_at) INTO last_interaction
    FROM scheduled_messages 
    WHERE customer_id = p_customer_id 
      AND automation_rule_id = p_automation_rule_id 
      AND status IN ('sent', 'delivered');
      
    IF last_interaction IS NOT NULL AND 
       last_interaction + (rule_record.cooldown_days || ' days')::INTERVAL > NOW() THEN
        result := jsonb_set(result, '{eligible}', 'false');
        result := jsonb_set(result, '{reasons}', result->'reasons' || '["cooldown_active"]');
    END IF;
    
    -- 4. Límite diario
    SELECT COUNT(*) INTO daily_count
    FROM scheduled_messages 
    WHERE restaurant_id = p_restaurant_id 
      AND DATE(created_at) = CURRENT_DATE 
      AND status IN ('planned', 'processing', 'sent');
      
    IF daily_count >= rule_record.max_daily_executions THEN
        result := jsonb_set(result, '{eligible}', 'false');
        result := jsonb_set(result, '{reasons}', result->'reasons' || '["daily_limit_reached"]');
    END IF;
    
    -- 5. Ventana horaria
    IF CURRENT_TIME NOT BETWEEN rule_record.execution_hours_start AND rule_record.execution_hours_end THEN
        result := jsonb_set(result, '{eligible}', 'false');
        result := jsonb_set(result, '{reasons}', result->'reasons' || '["outside_time_window"]');
    END IF;
    
    -- 6. Día de la semana
    IF NOT (EXTRACT(ISODOW FROM NOW())::INTEGER = ANY(rule_record.execution_days_of_week)) THEN
        result := jsonb_set(result, '{eligible}', 'false');
        result := jsonb_set(result, '{reasons}', result->'reasons' || '["outside_allowed_days"]');
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. TRIGGERS PARA UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a todas las tablas relevantes
DROP TRIGGER IF EXISTS update_message_templates_updated_at ON message_templates;
CREATE TRIGGER update_message_templates_updated_at
    BEFORE UPDATE ON message_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_automation_rules_updated_at ON automation_rules;
CREATE TRIGGER update_automation_rules_updated_at
    BEFORE UPDATE ON automation_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_channel_credentials_updated_at ON channel_credentials;
CREATE TRIGGER update_channel_credentials_updated_at
    BEFORE UPDATE ON channel_credentials
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 9. COMENTARIOS FINALES
-- =====================================================

COMMENT ON TABLE message_templates IS 'Plantillas de mensajes para automatizaciones CRM';
COMMENT ON TABLE automation_rules IS 'Reglas de automatización con triggers y condiciones';
COMMENT ON TABLE scheduled_messages IS 'Cola de mensajes programados para envío';
COMMENT ON TABLE interaction_logs IS 'Audit trail de todas las interacciones de marketing';
COMMENT ON TABLE channel_credentials IS 'Credenciales encriptadas por tenant para cada canal';

-- =====================================================
-- FIN DE MIGRACIÓN CRM MESSAGING SYSTEM
-- =====================================================
