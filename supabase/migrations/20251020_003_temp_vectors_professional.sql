-- =====================================
-- SOLUCIÓN PROFESIONAL: TABLA TEMPORAL + FUNCIÓN
-- Para insertar vectores con restaurant_id correctamente
-- =====================================

-- 1️⃣ CREAR TABLA TEMPORAL
CREATE TABLE IF NOT EXISTS temp_knowledge_vectors (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  content text NOT NULL,
  embedding vector(1536) NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Índice para búsqueda vectorial rápida
CREATE INDEX IF NOT EXISTS idx_temp_vectors_embedding 
ON temp_knowledge_vectors USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 2️⃣ FUNCIÓN PARA MOVER VECTORES A TABLA FINAL
CREATE OR REPLACE FUNCTION move_temp_vectors_to_final(
  p_restaurant_id uuid,
  p_file_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_vector_count int;
BEGIN
  -- Insertar en tabla final con restaurant_id
  INSERT INTO restaurant_knowledge_vectors 
    (restaurant_id, content, embedding, metadata)
  SELECT 
    p_restaurant_id,
    content,
    embedding,
    metadata
  FROM temp_knowledge_vectors;
  
  -- Contar vectores insertados
  GET DIAGNOSTICS v_vector_count = ROW_COUNT;
  
  -- Limpiar tabla temporal
  DELETE FROM temp_knowledge_vectors;
  
  -- Actualizar estado del archivo
  UPDATE restaurant_knowledge_files
  SET 
    status = 'completed',
    processed_at = now(),
    vector_count = v_vector_count
  WHERE id = p_file_id;
  
  RAISE NOTICE '✅ Vectores movidos: %', v_vector_count;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Si falla, limpiar tabla temporal y propagar error
    DELETE FROM temp_knowledge_vectors;
    RAISE;
END;
$$;

-- 3️⃣ GRANT PERMISOS
GRANT ALL ON temp_knowledge_vectors TO authenticated;
GRANT ALL ON temp_knowledge_vectors TO service_role;

-- 4️⃣ COMENTARIOS
COMMENT ON TABLE temp_knowledge_vectors IS 'Tabla temporal para recibir vectores de N8N antes de moverlos a la tabla final con restaurant_id';
COMMENT ON FUNCTION move_temp_vectors_to_final IS 'Mueve vectores de tabla temporal a final con restaurant_id y actualiza estado del archivo';

-- =====================================
-- ✅ VENTAJAS DE ESTA SOLUCIÓN:
-- - Profesional: Lógica en BD, no en N8N
-- - Robusta: Transacciones atómicas
-- - Escalable: Performance óptimo
-- - Mantenible: Código centralizado
-- - Segura: SECURITY DEFINER
-- =====================================

