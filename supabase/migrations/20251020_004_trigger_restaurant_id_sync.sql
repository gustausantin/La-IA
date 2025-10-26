-- =====================================
-- SOLUCIÓN PROFESIONAL: TRIGGER AUTOMÁTICO
-- Sincroniza restaurant_id desde metadata a columna
-- =====================================

-- 1️⃣ FUNCIÓN DEL TRIGGER
CREATE OR REPLACE FUNCTION sync_restaurant_id_from_metadata()
RETURNS TRIGGER AS $$
BEGIN
  -- Si restaurant_id está vacío pero existe en metadata, copiarlo automáticamente
  IF NEW.restaurant_id IS NULL AND NEW.metadata->>'restaurant_id' IS NOT NULL THEN
    NEW.restaurant_id := (NEW.metadata->>'restaurant_id')::uuid;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2️⃣ CREAR TRIGGER
DROP TRIGGER IF EXISTS trg_sync_restaurant_id ON restaurant_knowledge_vectors;

CREATE TRIGGER trg_sync_restaurant_id
BEFORE INSERT OR UPDATE ON restaurant_knowledge_vectors
FOR EACH ROW
EXECUTE FUNCTION sync_restaurant_id_from_metadata();

-- 3️⃣ ACTUALIZAR REGISTROS EXISTENTES (si hay alguno sin restaurant_id)
UPDATE restaurant_knowledge_vectors
SET restaurant_id = (metadata->>'restaurant_id')::uuid
WHERE restaurant_id IS NULL 
  AND metadata->>'restaurant_id' IS NOT NULL;

-- 4️⃣ COMENTARIOS
COMMENT ON FUNCTION sync_restaurant_id_from_metadata IS 'Trigger que copia automáticamente restaurant_id desde metadata (JSONB) a la columna restaurant_id (UUID)';
COMMENT ON TRIGGER trg_sync_restaurant_id ON restaurant_knowledge_vectors IS 'Sincroniza restaurant_id automáticamente antes de INSERT/UPDATE';

-- =====================================
-- ✅ VENTAJAS DE ESTA SOLUCIÓN:
-- - Restaurant_id queda en columna (performance óptimo)
-- - Foreign Key funciona correctamente
-- - RLS (Row Level Security) funciona
-- - Índices funcionan de forma eficiente
-- - N8N no necesita cambios
-- - Lógica centralizada en base de datos
-- - Escalable y mantenible
-- =====================================

