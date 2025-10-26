-- Migración para sincronizar el sentiment desde metadata->classification->sentiment
-- hacia el campo sentiment de la tabla agent_conversations

-- Paso 1: Actualizar registros existentes que tengan sentiment en metadata
UPDATE agent_conversations
SET sentiment = (metadata->'classification'->>'sentiment')::VARCHAR
WHERE metadata->'classification'->>'sentiment' IS NOT NULL
  AND sentiment IS NULL;

-- Paso 2: Crear función para auto-sincronizar sentiment
CREATE OR REPLACE FUNCTION sync_sentiment_from_metadata()
RETURNS TRIGGER AS $$
BEGIN
  -- Si metadata contiene classification.sentiment, copiarlo al campo sentiment
  IF NEW.metadata->'classification'->>'sentiment' IS NOT NULL THEN
    NEW.sentiment := (NEW.metadata->'classification'->>'sentiment')::VARCHAR;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Paso 3: Crear trigger para ejecutar la función en INSERT y UPDATE
DROP TRIGGER IF EXISTS trigger_sync_sentiment ON agent_conversations;

CREATE TRIGGER trigger_sync_sentiment
BEFORE INSERT OR UPDATE OF metadata ON agent_conversations
FOR EACH ROW
EXECUTE FUNCTION sync_sentiment_from_metadata();

-- Verificación: Mostrar registros actualizados
SELECT 
  id,
  interaction_type,
  sentiment,
  metadata->'classification'->>'sentiment' as sentiment_in_metadata,
  created_at
FROM agent_conversations
WHERE sentiment IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

