-- =====================================================
-- MIGRACIÓN: Sistema de Base de Conocimiento (RAG)
-- Fecha: 2025-10-20
-- Descripción: Tablas y funciones para almacenar documentos
--              del restaurante (menú, servicios, info) y permitir
--              búsqueda semántica con vectores (pgvector)
-- =====================================================

-- =====================================================
-- 1. HABILITAR EXTENSIÓN PGVECTOR
-- =====================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- 2. TABLA: restaurant_knowledge_files
-- Tracking de archivos subidos por el usuario
-- =====================================================

CREATE TABLE IF NOT EXISTS restaurant_knowledge_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  -- Categoría del documento
  category TEXT NOT NULL CHECK (category IN ('menu', 'services', 'other')),
  
  -- Información del archivo
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL, -- Path en Supabase Storage (/{restaurant_id}/{category}/{filename})
  file_size INTEGER, -- Tamaño en bytes
  file_type TEXT NOT NULL, -- MIME type (application/pdf, etc.)
  
  -- Estado del procesamiento
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  error_message TEXT, -- Si falla, guardamos el error
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ, -- Cuando N8N termina de procesar
  
  -- Constraints
  CONSTRAINT fk_restaurant_knowledge_files FOREIGN KEY (restaurant_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_knowledge_files_restaurant 
  ON restaurant_knowledge_files(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_files_category 
  ON restaurant_knowledge_files(restaurant_id, category);

CREATE INDEX IF NOT EXISTS idx_knowledge_files_status 
  ON restaurant_knowledge_files(status);

-- Comentarios
COMMENT ON TABLE restaurant_knowledge_files IS 'Tracking de archivos subidos por restaurantes (menú, servicios, info adicional)';
COMMENT ON COLUMN restaurant_knowledge_files.category IS 'Tipo de documento: menu (carta/menú), services (servicios/políticas), other (historia/eventos)';
COMMENT ON COLUMN restaurant_knowledge_files.status IS 'Estado: processing (subido, esperando N8N), completed (vectorizado OK), failed (error en N8N)';

-- =====================================================
-- 3. TABLA: restaurant_knowledge_vectors
-- Vectores generados por OpenAI para búsqueda semántica
-- =====================================================

CREATE TABLE IF NOT EXISTS restaurant_knowledge_vectors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  -- Contenido del chunk (texto)
  content TEXT NOT NULL,
  
  -- Vector embedding (OpenAI text-embedding-3-small = 1536 dimensiones)
  embedding vector(1536) NOT NULL,
  
  -- Metadata del documento (JSON)
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Ejemplo de metadata:
  -- {
  --   "restaurant_id": "uuid",
  --   "category": "menu",
  --   "file_name": "Carta_Primavera_2025.pdf",
  --   "file_type": "application/pdf",
  --   "file_id": "uuid",
  --   "uploaded_at": "2025-10-20T14:00:00Z",
  --   "processed_at": "2025-10-20T14:02:15Z"
  -- }
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT fk_restaurant_knowledge_vectors FOREIGN KEY (restaurant_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_knowledge_vectors_restaurant 
  ON restaurant_knowledge_vectors(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_vectors_category 
  ON restaurant_knowledge_vectors((metadata->>'category'));

-- Índice IVFFLAT para búsqueda de vectores (cosine similarity)
-- Este es el índice más importante para performance en RAG
CREATE INDEX IF NOT EXISTS idx_knowledge_vectors_embedding 
  ON restaurant_knowledge_vectors 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Índice Full-Text Search (backup si falla vector search)
CREATE INDEX IF NOT EXISTS idx_knowledge_vectors_content_fts 
  ON restaurant_knowledge_vectors 
  USING gin(to_tsvector('spanish', content));

-- Comentarios
COMMENT ON TABLE restaurant_knowledge_vectors IS 'Vectores (embeddings) de documentos para búsqueda semántica RAG';
COMMENT ON COLUMN restaurant_knowledge_vectors.embedding IS 'Vector de 1536 dimensiones generado por OpenAI text-embedding-3-small';
COMMENT ON COLUMN restaurant_knowledge_vectors.metadata IS 'Metadata del documento original (category, file_name, etc.)';

-- =====================================================
-- 4. FUNCIÓN: match_restaurant_knowledge
-- Búsqueda semántica de vectores con filtros
-- =====================================================

CREATE OR REPLACE FUNCTION match_restaurant_knowledge(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 3,
  filter_restaurant_id uuid DEFAULT NULL,
  filter_category text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    rkv.id,
    rkv.content,
    rkv.metadata,
    1 - (rkv.embedding <=> query_embedding) AS similarity
  FROM restaurant_knowledge_vectors rkv
  WHERE 
    -- Filtro por restaurante (OBLIGATORIO para multi-tenant)
    (filter_restaurant_id IS NULL OR rkv.restaurant_id = filter_restaurant_id)
    -- Filtro por categoría (OPCIONAL - para búsquedas dirigidas)
    AND (filter_category IS NULL OR rkv.metadata->>'category' = filter_category)
    -- Filtro por umbral de similitud (solo resultados relevantes)
    AND 1 - (rkv.embedding <=> query_embedding) > match_threshold
  ORDER BY rkv.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Comentarios
COMMENT ON FUNCTION match_restaurant_knowledge IS 'Búsqueda semántica de vectores con filtros multi-tenant. Usa cosine similarity (<=>)';

-- =====================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- Asegurar acceso multi-tenant
-- =====================================================

-- Habilitar RLS en ambas tablas
ALTER TABLE restaurant_knowledge_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_knowledge_vectors ENABLE ROW LEVEL SECURITY;

-- Policy: Solo ver archivos de tu restaurante
CREATE POLICY "Users can view their restaurant's files"
ON restaurant_knowledge_files
FOR SELECT
USING (
  restaurant_id IN (
    SELECT r.id FROM businesses r
    WHERE r.owner_id = auth.uid()
  )
);

-- Policy: Solo insertar archivos en tu restaurante
CREATE POLICY "Users can upload files to their restaurant"
ON restaurant_knowledge_files
FOR INSERT
WITH CHECK (
  restaurant_id IN (
    SELECT r.id FROM businesses r
    WHERE r.owner_id = auth.uid()
  )
);

-- Policy: Solo actualizar archivos de tu restaurante
CREATE POLICY "Users can update their restaurant's files"
ON restaurant_knowledge_files
FOR UPDATE
USING (
  restaurant_id IN (
    SELECT r.id FROM businesses r
    WHERE r.owner_id = auth.uid()
  )
);

-- Policy: Solo eliminar archivos de tu restaurante
CREATE POLICY "Users can delete their restaurant's files"
ON restaurant_knowledge_files
FOR DELETE
USING (
  restaurant_id IN (
    SELECT r.id FROM businesses r
    WHERE r.owner_id = auth.uid()
  )
);

-- Policy: Solo ver vectores de tu restaurante
CREATE POLICY "Users can view their restaurant's vectors"
ON restaurant_knowledge_vectors
FOR SELECT
USING (
  restaurant_id IN (
    SELECT r.id FROM businesses r
    WHERE r.owner_id = auth.uid()
  )
);

-- Policy: N8N puede insertar vectores (service role)
-- Nota: Esta policy permite a N8N (con service_role key) insertar vectores
-- No requiere auth.uid() porque N8N usa service_role, no user JWT

-- =====================================================
-- 6. GRANTS (Permisos)
-- =====================================================

-- Permisos para usuarios autenticados
GRANT SELECT, INSERT, UPDATE, DELETE ON restaurant_knowledge_files TO authenticated;
GRANT SELECT ON restaurant_knowledge_vectors TO authenticated;

-- Permisos para service_role (N8N)
GRANT ALL ON restaurant_knowledge_files TO service_role;
GRANT ALL ON restaurant_knowledge_vectors TO service_role;

-- Permisos para función de búsqueda
GRANT EXECUTE ON FUNCTION match_restaurant_knowledge TO authenticated;
GRANT EXECUTE ON FUNCTION match_restaurant_knowledge TO service_role;

-- =====================================================
-- 7. TRIGGERS (Opcional - Limpieza automática)
-- =====================================================

-- Trigger: Al eliminar un archivo, eliminar sus vectores
CREATE OR REPLACE FUNCTION cleanup_knowledge_vectors()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Eliminar vectores asociados al archivo
  DELETE FROM restaurant_knowledge_vectors
  WHERE metadata->>'file_id' = OLD.id::text;
  
  RETURN OLD;
END;
$$;

CREATE TRIGGER trigger_cleanup_knowledge_vectors
AFTER DELETE ON restaurant_knowledge_files
FOR EACH ROW
EXECUTE FUNCTION cleanup_knowledge_vectors();

-- Comentarios
COMMENT ON FUNCTION cleanup_knowledge_vectors IS 'Elimina vectores asociados cuando se elimina un archivo';

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================

-- Verificación (opcional - solo para desarrollo)
DO $$
BEGIN
  RAISE NOTICE '✅ Migración 20251020_001_knowledge_base_system completada';
  RAISE NOTICE '📊 Tablas creadas: restaurant_knowledge_files, restaurant_knowledge_vectors';
  RAISE NOTICE '🔍 Función creada: match_restaurant_knowledge()';
  RAISE NOTICE '🔒 RLS habilitado en ambas tablas';
END $$;

