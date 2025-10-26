-- =====================================================
-- MIGRACIÓN: Añadir customer_phone a agent_messages
-- FECHA: 2025-10-15
-- PROPÓSITO: Garantizar aislamiento de conversaciones
--            para cumplir con privacidad (GDPR/LOPD)
-- =====================================================

-- PASO 1: Añadir columna customer_phone
-- =====================================================

ALTER TABLE agent_messages 
ADD COLUMN IF NOT EXISTS customer_phone VARCHAR;

COMMENT ON COLUMN agent_messages.customer_phone IS 'Teléfono del cliente (redundante para seguridad y queries rápidas)';

-- PASO 2: Rellenar datos existentes desde agent_conversations
-- =====================================================

UPDATE agent_messages am
SET customer_phone = ac.customer_phone
FROM agent_conversations ac
WHERE am.conversation_id = ac.id
  AND am.customer_phone IS NULL;

-- PASO 3: Hacer NOT NULL después de rellenar
-- =====================================================

ALTER TABLE agent_messages 
ALTER COLUMN customer_phone SET NOT NULL;

-- PASO 4: Añadir índice para queries rápidas
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_agent_msg_customer_phone 
ON agent_messages(customer_phone);

-- PASO 5: Índice compuesto para queries de seguridad
-- =====================================================

-- Este índice garantiza queries ultra-rápidas con filtro triple:
-- conversation_id + customer_phone + direction

CREATE INDEX IF NOT EXISTS idx_agent_msg_security 
ON agent_messages(conversation_id, customer_phone, direction, timestamp DESC);

COMMENT ON INDEX idx_agent_msg_security IS 'Índice de seguridad para garantizar aislamiento de conversaciones';

-- PASO 6: Validación CHECK (opcional pero recomendado)
-- =====================================================

ALTER TABLE agent_messages 
ADD CONSTRAINT agent_messages_phone_check 
CHECK (customer_phone ~* '^\+?[0-9\s\-\(\)]+$');

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

-- Verificar que todos los mensajes tienen customer_phone
DO $$
DECLARE
  missing_phones INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing_phones
  FROM agent_messages
  WHERE customer_phone IS NULL;
  
  IF missing_phones > 0 THEN
    RAISE EXCEPTION '❌ Hay % mensajes sin customer_phone', missing_phones;
  ELSE
    RAISE NOTICE '✅ Todos los mensajes tienen customer_phone';
  END IF;
END $$;

-- =====================================================
-- NOTAS IMPORTANTES
-- =====================================================

-- 1. Esta columna es REDUNDANTE (también está en agent_conversations)
--    pero es NECESARIA para garantizar aislamiento de conversaciones
-- 
-- 2. El índice idx_agent_msg_security permite queries como:
--    SELECT * FROM agent_messages
--    WHERE conversation_id = 'xxx'
--      AND customer_phone = '+34600000000'
--      AND direction = 'inbound'
--    ORDER BY timestamp DESC;
--
-- 3. NUNCA elimines esta columna o índice sin consultar legal/privacidad

