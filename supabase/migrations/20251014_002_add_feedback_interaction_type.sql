-- =====================================
-- MIGRACIÓN: AGREGAR TIPO 'feedback'
-- =====================================
-- Fecha: 2025-10-14
-- Propósito: Agregar tipo de interacción 'feedback' para respuestas a solicitudes de satisfacción

-- 1. Eliminar constraint existente
ALTER TABLE agent_conversations 
DROP CONSTRAINT IF EXISTS agent_conversations_interaction_type_check;

-- 2. Agregar constraint con el nuevo tipo 'feedback'
ALTER TABLE agent_conversations 
ADD CONSTRAINT agent_conversations_interaction_type_check 
CHECK (interaction_type IN (
  'reservation',      -- Cliente quiere reservar
  'modification',     -- Cliente quiere cambiar una reserva
  'cancellation',     -- Cliente cancela una reserva
  'inquiry',          -- Consultas generales (horarios, menú, etc.)
  'complaint',        -- Quejas espontáneas del cliente (requieren acción inmediata)
  'feedback',         -- Respuestas a solicitudes de satisfacción post-visita (CRM)
  'other'             -- Casos raros o no clasificables
));

-- 3. Comentarios para documentación
COMMENT ON COLUMN agent_conversations.interaction_type IS 
'Tipo de interacción: reservation, modification, cancellation, inquiry, complaint, feedback, other. 
El sentiment (positive/neutral/negative) se almacena en metadata->classification->sentiment';

-- =====================================
-- ÍNDICES PARA OPTIMIZAR QUERIES
-- =====================================

-- Índice para queries de feedback
CREATE INDEX IF NOT EXISTS idx_agent_conversations_feedback 
ON agent_conversations(restaurant_id, interaction_type, created_at)
WHERE interaction_type = 'feedback';

-- Índice para queries de sentiment (usando índice GIN en JSONB)
CREATE INDEX IF NOT EXISTS idx_agent_conversations_metadata_gin 
ON agent_conversations USING GIN (metadata);

-- =====================================
-- VERIFICACIÓN
-- =====================================

-- Ver distribución actual de tipos
SELECT 
  interaction_type,
  COUNT(*) as total
FROM agent_conversations
GROUP BY interaction_type
ORDER BY total DESC;

-- RESULTADO ESPERADO:
-- Debería ejecutarse sin errores y mostrar los tipos existentes

