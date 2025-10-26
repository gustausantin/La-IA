-- =====================================
-- MIGRACIÓN: CREAR TABLA crm_interactions
-- =====================================
-- Fecha: 2025-10-14
-- Propósito: Tabla para registrar todas las interacciones del CRM con clientes
--            (campañas de feedback, recordatorios, reactivación, etc.)

CREATE TABLE IF NOT EXISTS crm_interactions (
  -- Identificadores
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Tipo de interacción CRM
  interaction_type VARCHAR NOT NULL CHECK (interaction_type IN (
    'feedback',           -- Solicitud de feedback post-visita
    'bienvenida',         -- Mensaje de bienvenida a nuevo cliente
    'reactivacion',       -- Campaña de reactivación de cliente inactivo
    'vip_upgrade',        -- Notificación de upgrade a VIP
    'recordatorio',       -- Recordatorio de reserva (24h, 4h antes)
    'marketing',          -- Campaña de marketing/promoción
    'manual'              -- Mensaje manual del equipo
  )),
  
  -- Detalles de la campaña
  campaign_id VARCHAR,                          -- ID de la campaña (ej: 'feedback_post_visit_day1')
  campaign_name VARCHAR,                        -- Nombre descriptivo (ej: 'Feedback Post-Visita Día +1')
  
  -- Canal de comunicación
  channel VARCHAR NOT NULL CHECK (channel IN (
    'whatsapp',
    'email',
    'sms',
    'phone',
    'push'
  )),
  
  -- Mensaje enviado
  message_text TEXT NOT NULL,
  message_template_id VARCHAR,                  -- ID de plantilla usada (si aplica)
  
  -- Estado de la interacción
  status VARCHAR NOT NULL DEFAULT 'sent' CHECK (status IN (
    'sent',               -- Mensaje enviado
    'delivered',          -- Mensaje entregado
    'read',               -- Mensaje leído
    'responded',          -- Cliente respondió
    'bounced',            -- No se pudo entregar
    'failed'              -- Error en envío
  )),
  
  -- Respuesta del cliente
  customer_responded BOOLEAN DEFAULT FALSE,
  response_received_at TIMESTAMPTZ,
  response_conversation_id UUID REFERENCES agent_conversations(id),
  
  -- Metadata adicional
  metadata JSONB DEFAULT '{}'::jsonb,           -- Datos extras (ej: reservation_id relacionada)
  
  -- Auditoría
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ
);

-- =====================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- =====================================

-- Índice principal para queries por restaurante y tipo
CREATE INDEX idx_crm_interactions_restaurant_type 
ON crm_interactions(restaurant_id, interaction_type, created_at DESC);

-- Índice para queries por cliente
CREATE INDEX idx_crm_interactions_customer 
ON crm_interactions(customer_id, created_at DESC);

-- Índice para queries por campaña
CREATE INDEX idx_crm_interactions_campaign 
ON crm_interactions(campaign_id, created_at DESC) 
WHERE campaign_id IS NOT NULL;

-- Índice para queries por estado
CREATE INDEX idx_crm_interactions_status 
ON crm_interactions(restaurant_id, status, created_at DESC);

-- Índice para queries de respuesta
CREATE INDEX idx_crm_interactions_response 
ON crm_interactions(restaurant_id, customer_responded, created_at DESC);

-- Índice GIN para metadata (búsquedas en JSON)
CREATE INDEX idx_crm_interactions_metadata 
ON crm_interactions USING GIN (metadata);

-- =====================================
-- TRIGGER PARA updated_at
-- =====================================

CREATE OR REPLACE FUNCTION update_crm_interactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_crm_interactions_updated_at
BEFORE UPDATE ON crm_interactions
FOR EACH ROW
EXECUTE FUNCTION update_crm_interactions_updated_at();

-- =====================================
-- COMENTARIOS
-- =====================================

COMMENT ON TABLE crm_interactions IS 
'Registro de todas las interacciones del CRM con clientes (campañas, recordatorios, feedback)';

COMMENT ON COLUMN crm_interactions.interaction_type IS 
'Tipo de interacción: feedback, bienvenida, reactivacion, vip_upgrade, recordatorio, marketing, manual';

COMMENT ON COLUMN crm_interactions.campaign_id IS 
'ID único de la campaña (ej: feedback_post_visit_day1, reactivacion_30days)';

COMMENT ON COLUMN crm_interactions.customer_responded IS 
'TRUE si el cliente respondió a esta interacción';

COMMENT ON COLUMN crm_interactions.response_conversation_id IS 
'Referencia a la conversación en agent_conversations si el cliente respondió';

COMMENT ON COLUMN crm_interactions.metadata IS 
'Datos adicionales en JSON (ej: reservation_id, discount_code, etc.)';

-- =====================================
-- POLÍTICAS RLS (Row Level Security)
-- =====================================

ALTER TABLE crm_interactions ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios solo ven interacciones de su restaurante
CREATE POLICY crm_interactions_tenant_isolation 
ON crm_interactions
FOR ALL
USING (
  restaurant_id IN (
    SELECT id FROM restaurants 
    WHERE id = restaurant_id
  )
);

-- =====================================
-- FUNCIÓN HELPER: Registrar interacción CRM
-- =====================================

CREATE OR REPLACE FUNCTION log_crm_interaction(
  p_restaurant_id UUID,
  p_customer_id UUID,
  p_interaction_type VARCHAR,
  p_campaign_id VARCHAR,
  p_channel VARCHAR,
  p_message_text TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_interaction_id UUID;
BEGIN
  INSERT INTO crm_interactions (
    restaurant_id,
    customer_id,
    interaction_type,
    campaign_id,
    channel,
    message_text,
    metadata,
    sent_at
  ) VALUES (
    p_restaurant_id,
    p_customer_id,
    p_interaction_type,
    p_campaign_id,
    p_channel,
    p_message_text,
    p_metadata,
    NOW()
  )
  RETURNING id INTO v_interaction_id;
  
  RETURN v_interaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION log_crm_interaction IS 
'Helper function para registrar interacciones CRM fácilmente desde workflows';

-- =====================================
-- VERIFICACIÓN
-- =====================================

-- Verificar que la tabla se creó correctamente
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'crm_interactions'
ORDER BY ordinal_position;

-- RESULTADO ESPERADO: Lista de columnas de la tabla

