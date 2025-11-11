-- =====================================================
-- TABLA: business_services (servicios del negocio específico)
-- Cada negocio elige QUÉ servicios ofrece de las plantillas
-- =====================================================

CREATE TABLE IF NOT EXISTS business_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    template_id UUID REFERENCES service_templates(id) ON DELETE SET NULL,
    
    -- Info del servicio (copiada de template, pero editable)
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    description TEXT,
    duration_minutes INTEGER NOT NULL,
    suggested_price DECIMAL(10,2),
    
    -- Estado
    is_active BOOLEAN DEFAULT true,
    position_order INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Constraints
    CONSTRAINT duration_positive CHECK (duration_minutes > 0),
    CONSTRAINT price_positive CHECK (suggested_price IS NULL OR suggested_price >= 0)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_business_services_business ON business_services(business_id);
CREATE INDEX IF NOT EXISTS idx_business_services_active ON business_services(business_id, is_active);

-- RLS
ALTER TABLE business_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their business services" ON business_services;
CREATE POLICY "Users can view their business services"
    ON business_services FOR SELECT
    USING (business_id IN (SELECT business_id FROM user_business_mapping WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage their business services" ON business_services;
CREATE POLICY "Users can manage their business services"
    ON business_services FOR ALL
    USING (business_id IN (SELECT business_id FROM user_business_mapping WHERE auth_user_id = auth.uid()));

-- Trigger: updated_at
CREATE OR REPLACE FUNCTION update_business_services_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS business_services_updated_at ON business_services;
CREATE TRIGGER business_services_updated_at
    BEFORE UPDATE ON business_services
    FOR EACH ROW
    EXECUTE FUNCTION update_business_services_updated_at();



