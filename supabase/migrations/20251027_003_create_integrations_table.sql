-- =====================================================
-- TABLA: integrations
-- Migración: 20251027_003_create_integrations_table.sql
-- Autor: La-IA Development Team
-- Ticket: B-001
-- Descripción: Almacena tokens OAuth y configuración de integraciones externas
-- =====================================================

-- Crear tabla integrations
CREATE TABLE IF NOT EXISTS integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('google_calendar', 'whatsapp', 'outlook', 'apple_calendar')),
    
    -- Credenciales cifradas (usar pgcrypto para cifrar refresh_token)
    credentials JSONB NOT NULL, -- { refresh_token_encrypted, access_token, etc }
    
    -- Estado de la integración
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'error')),
    
    -- Permisos OAuth concedidos
    scopes TEXT[], -- ['calendar.events', 'calendar.readonly']
    
    -- Metadata adicional
    metadata JSONB DEFAULT '{}'::JSONB, -- { email, calendar_id, last_sync, etc }
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ, -- Expiración del access_token
    
    -- Constraint: Un negocio solo puede tener una integración por proveedor
    UNIQUE(business_id, provider)
);

-- Índices para consultas frecuentes
CREATE INDEX idx_integrations_business ON integrations(business_id);
CREATE INDEX idx_integrations_status ON integrations(status) WHERE status = 'active';
CREATE INDEX idx_integrations_expires ON integrations(expires_at) WHERE expires_at IS NOT NULL;

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER integrations_updated_at
    BEFORE UPDATE ON integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_integrations_updated_at();

-- =====================================================
-- RLS POLICIES: integrations
-- =====================================================

ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

-- Policy: Los usuarios pueden ver sus propias integraciones
DROP POLICY IF EXISTS "Users can view their own integrations" ON integrations;
CREATE POLICY "Users can view their own integrations"
ON integrations
FOR SELECT
TO authenticated
USING (
    business_id IN (
        SELECT business_id FROM user_business_mapping
        WHERE auth_user_id = auth.uid()
        AND active = true
    )
);

-- Policy: Los usuarios pueden crear integraciones para su negocio
DROP POLICY IF EXISTS "Users can create integrations for their business" ON integrations;
CREATE POLICY "Users can create integrations for their business"
ON integrations
FOR INSERT
TO authenticated
WITH CHECK (
    business_id IN (
        SELECT business_id FROM user_business_mapping
        WHERE auth_user_id = auth.uid()
        AND active = true
    )
);

-- Policy: Los usuarios pueden actualizar sus integraciones
DROP POLICY IF EXISTS "Users can update their own integrations" ON integrations;
CREATE POLICY "Users can update their own integrations"
ON integrations
FOR UPDATE
TO authenticated
USING (
    business_id IN (
        SELECT business_id FROM user_business_mapping
        WHERE auth_user_id = auth.uid()
        AND active = true
    )
)
WITH CHECK (
    business_id IN (
        SELECT business_id FROM user_business_mapping
        WHERE auth_user_id = auth.uid()
        AND active = true
    )
);

-- Policy: Los usuarios pueden eliminar sus integraciones
DROP POLICY IF EXISTS "Users can delete their own integrations" ON integrations;
CREATE POLICY "Users can delete their own integrations"
ON integrations
FOR DELETE
TO authenticated
USING (
    business_id IN (
        SELECT business_id FROM user_business_mapping
        WHERE auth_user_id = auth.uid()
        AND active = true
    )
);

-- =====================================================
-- FUNCIÓN AUXILIAR: get_active_integration
-- =====================================================

CREATE OR REPLACE FUNCTION get_active_integration(
    p_business_id UUID,
    p_provider TEXT
)
RETURNS JSONB AS $$
DECLARE
    integration_info JSONB;
BEGIN
    SELECT jsonb_build_object(
        'id', id,
        'provider', provider,
        'status', status,
        'scopes', scopes,
        'metadata', metadata,
        'created_at', created_at,
        'expires_at', expires_at
    )
    INTO integration_info
    FROM integrations
    WHERE business_id = p_business_id
    AND provider = p_provider
    AND status = 'active';
    
    IF integration_info IS NULL THEN
        RETURN jsonb_build_object(
            'connected', false,
            'message', 'No active integration found'
        );
    END IF;
    
    RETURN jsonb_build_object(
        'connected', true,
        'integration', integration_info
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_active_integration(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION get_active_integration(UUID, TEXT) IS 'Obtiene información de una integración activa por negocio y proveedor';

-- =====================================================
-- FUNCIÓN: refresh_integration_token (para Edge Functions)
-- =====================================================

CREATE OR REPLACE FUNCTION refresh_integration_token(
    p_integration_id UUID,
    p_new_access_token TEXT,
    p_expires_in INTEGER DEFAULT 3600
)
RETURNS JSONB AS $$
BEGIN
    UPDATE integrations
    SET 
        credentials = jsonb_set(
            credentials,
            '{access_token}',
            to_jsonb(p_new_access_token)
        ),
        expires_at = NOW() + (p_expires_in || ' seconds')::INTERVAL,
        updated_at = NOW()
    WHERE id = p_integration_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Integration not found'
        );
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Token refreshed successfully',
        'expires_at', (SELECT expires_at FROM integrations WHERE id = p_integration_id)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION refresh_integration_token(UUID, TEXT, INTEGER) TO authenticated;

COMMENT ON FUNCTION refresh_integration_token(UUID, TEXT, INTEGER) IS 'Actualiza el access_token de una integración (llamado por Edge Functions)';

-- =====================================================
-- TABLA COMPLEMENTARIA: google_calendar_events
-- (Caché local de eventos de Google Calendar)
-- =====================================================

CREATE TABLE IF NOT EXISTS google_calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    
    -- ID del evento en Google Calendar
    gcal_event_id TEXT NOT NULL,
    
    -- Relación con appointment local (si existe)
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    
    -- Datos del evento
    summary TEXT,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'confirmed', -- 'confirmed', 'cancelled', 'tentative'
    
    -- Datos adicionales
    attendees JSONB, -- [ { email, response_status } ]
    location TEXT,
    raw_data JSONB, -- Evento completo de la API de Google
    
    -- Control de sincronización
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    sync_status TEXT DEFAULT 'synced', -- 'synced', 'pending', 'error'
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraint: No duplicar eventos del mismo calendar
    UNIQUE(business_id, gcal_event_id)
);

-- Índices
CREATE INDEX idx_gcal_events_business ON google_calendar_events(business_id, start_time DESC);
CREATE INDEX idx_gcal_events_appointment ON google_calendar_events(appointment_id) WHERE appointment_id IS NOT NULL;
CREATE INDEX idx_gcal_events_sync ON google_calendar_events(sync_status) WHERE sync_status != 'synced';
CREATE INDEX idx_gcal_events_time_range ON google_calendar_events(business_id, start_time, end_time);

-- Trigger para updated_at
CREATE TRIGGER gcal_events_updated_at
    BEFORE UPDATE ON google_calendar_events
    FOR EACH ROW
    EXECUTE FUNCTION update_integrations_updated_at();

-- RLS Policies
ALTER TABLE google_calendar_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their gcal events" ON google_calendar_events;
CREATE POLICY "Users can manage their gcal events"
ON google_calendar_events
FOR ALL
TO authenticated
USING (
    business_id IN (
        SELECT business_id FROM user_business_mapping
        WHERE auth_user_id = auth.uid()
        AND active = true
    )
)
WITH CHECK (
    business_id IN (
        SELECT business_id FROM user_business_mapping
        WHERE auth_user_id = auth.uid()
        AND active = true
    )
);

-- =====================================================
-- LOG DE AUDITORÍA
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Tabla integrations creada exitosamente';
    RAISE NOTICE '✅ Tabla google_calendar_events creada exitosamente';
    RAISE NOTICE '✅ RLS policies aplicadas';
    RAISE NOTICE '✅ Funciones auxiliares creadas';
    RAISE NOTICE '🎯 SIGUIENTE PASO: Crear Edge Function /api/integrations/google/oauth';
END $$;

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================



