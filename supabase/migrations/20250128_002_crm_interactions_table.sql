-- ========================================
-- CRM CUSTOMER INTERACTIONS - MIGRATION 002
-- Fecha: 28 Enero 2025
-- Descripción: Tabla para registrar todas las interacciones con clientes
-- ========================================

-- 1. CREAR TABLA customer_interactions
CREATE TABLE IF NOT EXISTS customer_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    
    -- Datos de la interacción
    channel VARCHAR NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp', 'llamada', 'web_chat', 'instagram', 'facebook')),
    template_id UUID, -- Referencia a message_templates
    interaction_type VARCHAR NOT NULL CHECK (interaction_type IN ('bienvenida', 'reactivacion', 'vip_upgrade', 'recordatorio', 'marketing', 'feedback', 'manual')),
    
    -- Contenido y payload
    subject TEXT,
    content TEXT NOT NULL,
    payload JSONB DEFAULT '{}', -- Variables usadas en la plantilla
    
    -- Estado y resultado
    status VARCHAR NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'replied', 'failed', 'bounced')),
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    replied_at TIMESTAMPTZ,
    
    -- Datos técnicos
    external_id VARCHAR, -- ID del proveedor (SendGrid, Twilio, etc.)
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Metadatos
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- 2. CREAR ÍNDICES para customer_interactions
CREATE INDEX idx_customer_interactions_restaurant ON customer_interactions(restaurant_id);
CREATE INDEX idx_customer_interactions_customer ON customer_interactions(customer_id);
CREATE INDEX idx_customer_interactions_channel ON customer_interactions(channel);
CREATE INDEX idx_customer_interactions_status ON customer_interactions(status);
CREATE INDEX idx_customer_interactions_type ON customer_interactions(interaction_type);
CREATE INDEX idx_customer_interactions_sent_at ON customer_interactions(sent_at);
CREATE INDEX idx_customer_interactions_customer_date ON customer_interactions(customer_id, sent_at DESC);

-- 3. RLS para customer_interactions
ALTER TABLE customer_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY customer_interactions_restaurant_access ON customer_interactions
    FOR ALL 
    USING (
        restaurant_id IN (
            SELECT urm.restaurant_id 
            FROM user_restaurant_mapping urm 
            WHERE urm.auth_user_id = auth.uid() 
            AND urm.active = true
        )
    );

-- 4. TRIGGER para updated_at
CREATE OR REPLACE FUNCTION handle_customer_interactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER customer_interactions_updated_at
    BEFORE UPDATE ON customer_interactions
    FOR EACH ROW
    EXECUTE FUNCTION handle_customer_interactions_updated_at();

-- 5. COMENTARIOS
COMMENT ON TABLE customer_interactions IS 'Registro de todas las interacciones con clientes (emails, SMS, WhatsApp, etc.)';
COMMENT ON COLUMN customer_interactions.channel IS 'Canal de comunicación utilizado';
COMMENT ON COLUMN customer_interactions.template_id IS 'ID de la plantilla utilizada (opcional)';
COMMENT ON COLUMN customer_interactions.payload IS 'Variables utilizadas en la plantilla (nombre, fecha, etc.)';
COMMENT ON COLUMN customer_interactions.status IS 'Estado de la interacción: pending->sent->delivered->opened->clicked';
COMMENT ON COLUMN customer_interactions.external_id IS 'ID del proveedor externo (SendGrid, Twilio, etc.)';

-- ========================================
-- TABLA customer_interactions CREADA ✅
-- ========================================
