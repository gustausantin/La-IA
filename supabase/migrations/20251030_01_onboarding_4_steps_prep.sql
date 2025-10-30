-- =====================================================
-- MIGRACIÓN: Preparación para Onboarding de 4 Pasos
-- Fecha: 30 de octubre de 2025
-- Descripción: Añade columnas necesarias para el nuevo flujo
-- =====================================================

-- =====================================================
-- PASO 1: Añadir columnas a businesses
-- =====================================================

-- Columna para el número telefónico asignado del pool
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS assigned_phone TEXT,
ADD COLUMN IF NOT EXISTS phone_operator VARCHAR(50); -- 'movistar', 'vodafone', etc.

-- Columna para el estado del agente IA
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS agent_status TEXT DEFAULT 'OFF' CHECK (agent_status IN ('OFF', 'DEMO', 'ACTIVE'));

-- Columnas para el Copilot (configuración guiada post-onboarding)
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS copilot_step INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS copilot_completed BOOLEAN DEFAULT FALSE;

-- Columna para almacenar el WhatsApp de alertas
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS alert_whatsapp VARCHAR(50);

-- =====================================================
-- PASO 2: Crear tabla demo_sessions
-- =====================================================

CREATE TABLE IF NOT EXISTS demo_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Datos básicos del negocio (temporal, antes de crear el business real)
    business_name TEXT NOT NULL,
    vertical_type TEXT NOT NULL,
    
    -- Datos del asistente IA
    assistant_name TEXT NOT NULL,
    voice_id TEXT NOT NULL, -- ID de ElevenLabs
    
    -- Configuración de la demo
    demo_slots JSONB NOT NULL DEFAULT '{}', -- { "10:00": "libre", "10:45": "ocupado", ... }
    demo_service_name TEXT, -- Ej: "Corte y Peinado"
    demo_service_duration INTEGER, -- Ej: 30
    
    -- Contacto para enviar confirmación
    whatsapp_for_demo VARCHAR(50) NOT NULL,
    
    -- Número de teléfono usado para la demo (del pool de demos)
    demo_phone TEXT,
    
    -- Estado de la demo
    completed BOOLEAN DEFAULT FALSE,
    reservation_created BOOLEAN DEFAULT FALSE,
    whatsapp_sent BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    user_agent TEXT,
    ip_address INET,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '15 minutes',
    completed_at TIMESTAMPTZ
);

-- Índices para demo_sessions
CREATE INDEX IF NOT EXISTS idx_demo_sessions_expires ON demo_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_demo_sessions_demo_phone ON demo_sessions(demo_phone);
CREATE INDEX IF NOT EXISTS idx_demo_sessions_completed ON demo_sessions(completed) WHERE completed = false;

-- RLS para demo_sessions (solo lectura pública para la demo)
ALTER TABLE demo_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir inserción pública de demos" ON demo_sessions
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

CREATE POLICY "Permitir lectura de demos propias" ON demo_sessions
    FOR SELECT
    TO anon, authenticated
    USING (created_at > NOW() - INTERVAL '1 hour'); -- Solo demos de la última hora

CREATE POLICY "Service role puede todo en demos" ON demo_sessions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- PASO 3: Crear índices adicionales en businesses
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_businesses_assigned_phone ON businesses(assigned_phone);
CREATE INDEX IF NOT EXISTS idx_businesses_agent_status ON businesses(agent_status);
CREATE INDEX IF NOT EXISTS idx_businesses_onboarding ON businesses(onboarding_completed, onboarding_step);
CREATE INDEX IF NOT EXISTS idx_businesses_copilot ON businesses(copilot_completed, copilot_step);

-- =====================================================
-- PASO 4: Función para limpiar demos expiradas (opcional)
-- =====================================================

CREATE OR REPLACE FUNCTION cleanup_expired_demos()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Eliminar demos que expiraron hace más de 1 hora
    DELETE FROM demo_sessions
    WHERE expires_at < NOW() - INTERVAL '1 hour';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RAISE NOTICE 'Demos expiradas eliminadas: %', deleted_count;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Programar limpieza automática cada hora (requiere pg_cron)
-- SELECT cron.schedule(
--     'cleanup-expired-demos',
--     '0 * * * *', -- Cada hora
--     'SELECT cleanup_expired_demos();'
-- );

-- =====================================================
-- PASO 5: Comentarios para documentación
-- =====================================================

COMMENT ON COLUMN businesses.assigned_phone IS 'Número telefónico asignado del pool de LA-IA';
COMMENT ON COLUMN businesses.agent_status IS 'Estado del agente IA: OFF (apagado), DEMO (en prueba), ACTIVE (funcionando)';
COMMENT ON COLUMN businesses.copilot_step IS 'Paso actual del Copilot (configuración guiada post-onboarding)';
COMMENT ON COLUMN businesses.copilot_completed IS 'Si el usuario completó la configuración guiada del Copilot';
COMMENT ON COLUMN businesses.phone_operator IS 'Operador telefónico del negocio (para códigos de desvío)';
COMMENT ON COLUMN businesses.alert_whatsapp IS 'Número de WhatsApp para recibir alertas urgentes';

COMMENT ON TABLE demo_sessions IS 'Sesiones de demo interactiva del onboarding (temporal, 15 min TTL)';
COMMENT ON COLUMN demo_sessions.demo_slots IS 'Slots de disponibilidad configurados para la demo (formato: {"10:00": "libre", "10:45": "ocupado"})';
COMMENT ON COLUMN demo_sessions.expires_at IS 'Fecha de expiración (15 minutos después de creación)';
COMMENT ON COLUMN demo_sessions.demo_phone IS 'Número de teléfono usado para esta demo (del pool de demos)';

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

-- Verificar que las columnas se añadieron correctamente
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'businesses'
    AND column_name IN ('assigned_phone', 'agent_status', 'copilot_step', 'copilot_completed', 'phone_operator', 'alert_whatsapp')
ORDER BY column_name;

-- Verificar que la tabla demo_sessions existe
SELECT 
    table_name,
    table_type
FROM information_schema.tables
WHERE table_name = 'demo_sessions';

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================

