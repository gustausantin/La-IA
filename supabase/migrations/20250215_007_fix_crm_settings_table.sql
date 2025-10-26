-- =====================================================
-- CORREGIR TABLA CRM_SETTINGS FALTANTE
-- =====================================================
-- Error: tabla crm_settings no existe pero se usa en la aplicación

DO $$
BEGIN
    RAISE NOTICE '🔧 CREANDO TABLA crm_settings FALTANTE...';
    
    -- 1. CREAR TABLA CRM_SETTINGS
    CREATE TABLE IF NOT EXISTS crm_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
        
        -- Factores AIVI v2
        aivi_factor_recency DECIMAL(3,2) DEFAULT 0.8, -- Factor de recencia (0.0-1.0)
        aivi_factor_frequency DECIMAL(3,2) DEFAULT 1.5, -- Factor de frecuencia
        aivi_reference_days INTEGER DEFAULT 90, -- Días de referencia para AIVI
        
        -- Criterios VIP
        vip_min_visits INTEGER DEFAULT 8, -- Mínimo visitas para VIP
        vip_min_spent DECIMAL(10,2) DEFAULT 300.00, -- Mínimo gastado para VIP
        
        -- Límites de contacto
        max_weekly_contacts INTEGER DEFAULT 3, -- Máximo contactos por semana
        
        -- Reglas de segmentación (días)
        days_new_customer INTEGER DEFAULT 7,
        days_active_customer INTEGER DEFAULT 30,
        days_inactive_customer INTEGER DEFAULT 60,
        days_risk_customer INTEGER DEFAULT 45,
        visits_vip_customer INTEGER DEFAULT 10,
        
        -- Frecuencia de mensajes automáticos
        frequency_reactivation INTEGER DEFAULT 90,
        frequency_welcome INTEGER DEFAULT 1,
        frequency_vip_promotion INTEGER DEFAULT 180,
        
        -- Configuración general
        auto_suggestions BOOLEAN DEFAULT true,
        auto_segmentation BOOLEAN DEFAULT true,
        auto_messaging BOOLEAN DEFAULT false, -- Mensajes automáticos activados
        
        -- Timestamps
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        
        -- Constraint: solo una configuración por restaurante
        UNIQUE(restaurant_id)
    );
    
    -- 2. ÍNDICES
    CREATE INDEX IF NOT EXISTS idx_crm_settings_restaurant ON crm_settings(restaurant_id);
    
    -- 3. RLS (Row Level Security)
    ALTER TABLE crm_settings ENABLE ROW LEVEL SECURITY;
    
    -- Crear políticas solo si no existen
    DO $policy$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'crm_settings' 
            AND policyname = 'Users can view their restaurant''s CRM settings'
        ) THEN
            CREATE POLICY "Users can view their restaurant's CRM settings" ON crm_settings
                FOR SELECT USING (
                    restaurant_id IN (
                        SELECT r.id FROM restaurants r 
                        WHERE r.owner_id = auth.uid()
                    )
                );
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'crm_settings' 
            AND policyname = 'Users can manage their restaurant''s CRM settings'
        ) THEN
            CREATE POLICY "Users can manage their restaurant's CRM settings" ON crm_settings
                FOR ALL USING (
                    restaurant_id IN (
                        SELECT r.id FROM restaurants r 
                        WHERE r.owner_id = auth.uid()
                    )
                );
        END IF;
    END;
    $policy$;
    
    -- 4. CONFIGURACIÓN INICIAL PARA RESTAURANTES EXISTENTES
    INSERT INTO crm_settings (restaurant_id)
    SELECT r.id
    FROM restaurants r
    WHERE NOT EXISTS (
        SELECT 1 FROM crm_settings cs 
        WHERE cs.restaurant_id = r.id
    );
    
    -- 5. TRIGGER PARA ACTUALIZAR updated_at (sin función separada)
    -- Se creará después del bloque DO
    
    RAISE NOTICE '✅ Tabla crm_settings creada correctamente';
    
    -- 6. VERIFICAR CREACIÓN
    RAISE NOTICE 'ℹ️ Configuraciones CRM creadas: %', (SELECT COUNT(*) FROM crm_settings);
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error creando tabla crm_settings: %', SQLERRM;
END;
$$;

-- 5. FUNCIÓN Y TRIGGER PARA ACTUALIZAR updated_at (fuera del bloque DO)
CREATE OR REPLACE FUNCTION update_crm_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger solo si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_crm_settings_updated_at'
    ) THEN
        CREATE TRIGGER update_crm_settings_updated_at
            BEFORE UPDATE ON crm_settings
            FOR EACH ROW
            EXECUTE FUNCTION update_crm_settings_updated_at();
    END IF;
END;
$$;
