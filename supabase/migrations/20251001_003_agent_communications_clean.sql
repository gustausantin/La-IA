-- ====================================
-- SISTEMA DE COMUNICACIONES DEL AGENTE IA - LIMPIO
-- Fecha: 1 Octubre 2025
-- Descripción: Borra tablas antiguas y crea nuevas desde cero
-- ====================================

-- ====================================
-- PASO 1: ELIMINAR TABLAS ANTIGUAS (CASCADE)
-- ====================================

-- Esto borrará agent_conversations y agent_messages si existen
-- También borra conversations y messages obsoletas
-- CASCADE elimina también índices, triggers, políticas, etc.

DROP TABLE IF EXISTS agent_messages CASCADE;
DROP TABLE IF EXISTS agent_conversations CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS message_batches_demo CASCADE;

-- ====================================
-- PASO 2: CREAR agent_conversations (NUEVA)
-- ====================================

CREATE TABLE agent_conversations (
    -- Identificadores
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    
    -- Datos del cliente
    customer_phone VARCHAR NOT NULL,
    customer_name VARCHAR,
    customer_email VARCHAR,
    
    -- Canal y clasificación
    source_channel VARCHAR NOT NULL CHECK (source_channel IN 
        ('whatsapp', 'phone', 'instagram', 'facebook', 'webchat')
    ),
    interaction_type VARCHAR NOT NULL CHECK (interaction_type IN 
        ('reservation', 'modification', 'cancellation', 'inquiry', 'complaint', 'other')
    ),
    
    -- Estado
    status VARCHAR NOT NULL DEFAULT 'active' CHECK (status IN 
        ('active', 'resolved', 'abandoned')
    ),
    
    -- Resultado
    outcome VARCHAR CHECK (outcome IN 
        ('reservation_created', 'reservation_modified', 'reservation_cancelled', 
         'inquiry_answered', 'no_action', 'escalated')
    ),
    reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
    
    -- Métricas de tiempo
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolution_time_seconds INTEGER GENERATED ALWAYS AS (
        CASE 
            WHEN resolved_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (resolved_at - created_at))::INTEGER
            ELSE NULL
        END
    ) STORED,
    
    -- Análisis
    sentiment VARCHAR CHECK (sentiment IN ('positive', 'neutral', 'negative')),
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Validación
    CONSTRAINT agent_conversations_phone_check 
        CHECK (customer_phone ~* '^\+?[0-9\s\-\(\)]+$')
);

-- ====================================
-- PASO 3: CREAR agent_messages (NUEVA)
-- ====================================

CREATE TABLE agent_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    
    -- Dirección
    direction VARCHAR NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    sender VARCHAR NOT NULL CHECK (sender IN ('customer', 'agent', 'system')),
    
    -- Contenido
    message_text TEXT NOT NULL,
    
    -- Metadatos
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Análisis
    tokens_used INTEGER,
    confidence_score DECIMAL(3,2)
);

-- ====================================
-- PASO 4: ÍNDICES PARA PERFORMANCE
-- ====================================

-- Índices para agent_conversations
CREATE INDEX idx_agent_conv_restaurant ON agent_conversations(restaurant_id);
CREATE INDEX idx_agent_conv_customer ON agent_conversations(customer_id);
CREATE INDEX idx_agent_conv_phone ON agent_conversations(customer_phone);
CREATE INDEX idx_agent_conv_channel ON agent_conversations(source_channel);
CREATE INDEX idx_agent_conv_status ON agent_conversations(status);
CREATE INDEX idx_agent_conv_type ON agent_conversations(interaction_type);
CREATE INDEX idx_agent_conv_outcome ON agent_conversations(outcome);
CREATE INDEX idx_agent_conv_created ON agent_conversations(created_at DESC);
CREATE INDEX idx_agent_conv_resolved ON agent_conversations(resolved_at DESC) WHERE resolved_at IS NOT NULL;

-- Índices para agent_messages
CREATE INDEX idx_agent_msg_conversation ON agent_messages(conversation_id);
CREATE INDEX idx_agent_msg_restaurant ON agent_messages(restaurant_id);
CREATE INDEX idx_agent_msg_timestamp ON agent_messages(timestamp DESC);
CREATE INDEX idx_agent_msg_direction ON agent_messages(direction);

-- ====================================
-- PASO 5: ROW LEVEL SECURITY (RLS)
-- ====================================

ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;

-- Políticas para agent_conversations
CREATE POLICY "agent_conversations_select" ON agent_conversations 
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "agent_conversations_insert" ON agent_conversations 
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "agent_conversations_update" ON agent_conversations 
    FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "agent_conversations_delete" ON agent_conversations 
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- Políticas para agent_messages
CREATE POLICY "agent_messages_select" ON agent_messages 
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "agent_messages_insert" ON agent_messages 
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "agent_messages_update" ON agent_messages 
    FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "agent_messages_delete" ON agent_messages 
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- ====================================
-- PASO 6: TRIGGERS AUTOMÁTICOS
-- ====================================

-- Trigger para actualizar resolved_at automáticamente
CREATE OR REPLACE FUNCTION update_conversation_resolved_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'resolved' AND (OLD.status IS NULL OR OLD.status != 'resolved') THEN
        NEW.resolved_at = NOW();
    ELSIF NEW.status != 'resolved' THEN
        NEW.resolved_at = NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_conversation_resolved
    BEFORE UPDATE ON agent_conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_resolved_at();

-- ====================================
-- PASO 7: FUNCIONES RPC PARA DASHBOARD
-- ====================================

-- Función 1: Estadísticas por canal
CREATE OR REPLACE FUNCTION get_agent_communication_stats(
    p_restaurant_id UUID,
    p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
    source_channel VARCHAR,
    total_conversations BIGINT,
    active_conversations BIGINT,
    resolved_conversations BIGINT,
    reservations_created BIGINT,
    avg_resolution_minutes NUMERIC,
    conversion_rate NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ac.source_channel,
        COUNT(ac.id) as total_conversations,
        COUNT(ac.id) FILTER (WHERE ac.status = 'active') as active_conversations,
        COUNT(ac.id) FILTER (WHERE ac.status = 'resolved') as resolved_conversations,
        COUNT(ac.id) FILTER (WHERE ac.outcome = 'reservation_created') as reservations_created,
        ROUND(AVG(ac.resolution_time_seconds) FILTER (WHERE ac.resolution_time_seconds IS NOT NULL) / 60.0, 2) as avg_resolution_minutes,
        ROUND(
            (COUNT(ac.id) FILTER (WHERE ac.outcome = 'reservation_created') * 100.0) / 
            NULLIF(COUNT(ac.id) FILTER (WHERE ac.interaction_type = 'reservation'), 0),
            2
        ) as conversion_rate
    FROM agent_conversations ac
    WHERE ac.restaurant_id = p_restaurant_id
      AND ac.created_at >= NOW() - (p_days || ' days')::INTERVAL
    GROUP BY ac.source_channel
    ORDER BY total_conversations DESC;
END;
$$;

-- Función 2: Resumen general
CREATE OR REPLACE FUNCTION get_agent_communication_summary(
    p_restaurant_id UUID,
    p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
    total_conversations BIGINT,
    active_conversations BIGINT,
    resolved_conversations BIGINT,
    abandoned_conversations BIGINT,
    reservations_created BIGINT,
    avg_resolution_minutes NUMERIC,
    overall_conversion_rate NUMERIC,
    total_messages BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(ac.id) as total_conversations,
        COUNT(ac.id) FILTER (WHERE ac.status = 'active') as active_conversations,
        COUNT(ac.id) FILTER (WHERE ac.status = 'resolved') as resolved_conversations,
        COUNT(ac.id) FILTER (WHERE ac.status = 'abandoned') as abandoned_conversations,
        COUNT(ac.id) FILTER (WHERE ac.outcome = 'reservation_created') as reservations_created,
        ROUND(AVG(ac.resolution_time_seconds) FILTER (WHERE ac.resolution_time_seconds IS NOT NULL) / 60.0, 2) as avg_resolution_minutes,
        ROUND(
            (COUNT(ac.id) FILTER (WHERE ac.outcome = 'reservation_created') * 100.0) / 
            NULLIF(COUNT(ac.id) FILTER (WHERE ac.interaction_type = 'reservation'), 0),
            2
        ) as overall_conversion_rate,
        (SELECT COUNT(*) FROM agent_messages am 
         WHERE am.restaurant_id = p_restaurant_id 
         AND am.timestamp >= NOW() - (p_days || ' days')::INTERVAL
        ) as total_messages
    FROM agent_conversations ac
    WHERE ac.restaurant_id = p_restaurant_id
      AND ac.created_at >= NOW() - (p_days || ' days')::INTERVAL;
END;
$$;

-- Función 3: Cleanup automático (30 días)
CREATE OR REPLACE FUNCTION cleanup_old_agent_conversations()
RETURNS TABLE (
    deleted_conversations INTEGER,
    deleted_messages INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted_conversations INTEGER;
    v_deleted_messages INTEGER;
BEGIN
    -- Contar mensajes que se borrarán
    SELECT COUNT(*)
    INTO v_deleted_messages
    FROM agent_messages am
    WHERE am.conversation_id IN (
        SELECT id FROM agent_conversations
        WHERE created_at < NOW() - INTERVAL '30 days'
    );
    
    -- Borrar conversaciones (borrará mensajes por CASCADE)
    DELETE FROM agent_conversations
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    GET DIAGNOSTICS v_deleted_conversations = ROW_COUNT;
    
    RETURN QUERY SELECT v_deleted_conversations, v_deleted_messages;
END;
$$;

-- ====================================
-- CONFIRMACIÓN DE MIGRACIÓN
-- ====================================

DO $$
BEGIN
    RAISE NOTICE '✅ Migración 20251001_003_agent_communications_clean.sql completada';
    RAISE NOTICE '🗑️  Tablas antiguas eliminadas: conversations, messages, message_batches_demo, agent_* (si existían)';
    RAISE NOTICE '🆕 Tablas nuevas creadas: agent_conversations, agent_messages';
    RAISE NOTICE '📊 Índices optimizados: 13 índices creados';
    RAISE NOTICE '🔒 RLS habilitado con políticas de seguridad';
    RAISE NOTICE '⚡ Trigger automático: resolved_at configurado';
    RAISE NOTICE '📈 Funciones RPC: 3 funciones para dashboard';
    RAISE NOTICE '🧹 Cleanup automático: función lista para ejecutar';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 SIGUIENTE PASO: Configurar n8n workflow para insertar datos';
END $$;

