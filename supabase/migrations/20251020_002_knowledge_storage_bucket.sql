-- =====================================================
-- MIGRACIÓN: Configuración de Storage Bucket
-- Fecha: 2025-10-20
-- Descripción: Crear bucket para archivos de conocimiento
--              y configurar políticas de acceso
-- =====================================================

-- =====================================================
-- 1. CREAR BUCKET (si no existe)
-- =====================================================

-- Nota: En Supabase, los buckets se crean desde el Dashboard
-- Esta migración solo documenta y configura las políticas

-- Comando manual en Supabase Dashboard > Storage:
-- Nombre: restaurant-knowledge
-- Public: YES (para que N8N pueda descargar sin auth)

-- =====================================================
-- 2. POLÍTICAS DE ACCESO AL BUCKET
-- =====================================================

-- Policy: Los usuarios pueden subir archivos a su carpeta de restaurante
CREATE POLICY "Users can upload to their restaurant folder"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'restaurant-knowledge'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT r.id::text FROM businesses r
    WHERE r.owner_id = auth.uid()
  )
);

-- Policy: Los usuarios pueden ver archivos de su restaurante
CREATE POLICY "Users can view their restaurant files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'restaurant-knowledge'
  AND (
    -- Acceso público (para N8N y preview)
    TRUE
    OR
    -- O es su restaurante
    (storage.foldername(name))[1] IN (
      SELECT r.id::text FROM businesses r
      WHERE r.owner_id = auth.uid()
    )
  )
);

-- Policy: Los usuarios pueden actualizar archivos de su restaurante
CREATE POLICY "Users can update their restaurant files"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'restaurant-knowledge'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT r.id::text FROM businesses r
    WHERE r.owner_id = auth.uid()
  )
);

-- Policy: Los usuarios pueden eliminar archivos de su restaurante
CREATE POLICY "Users can delete their restaurant files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'restaurant-knowledge'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT r.id::text FROM businesses r
    WHERE r.owner_id = auth.uid()
  )
);

-- =====================================================
-- 3. CONFIGURACIÓN DEL BUCKET
-- =====================================================

-- Configurar tamaño máximo de archivos (5MB)
-- Nota: Esto se configura en Supabase Dashboard > Storage > Bucket Settings
-- file_size_limit: 5242880 (5MB en bytes)

-- Configurar tipos de archivo permitidos
-- Nota: Validación se hace en frontend, aquí solo documentamos
-- Tipos permitidos:
-- - application/pdf
-- - application/vnd.openxmlformats-officedocument.wordprocessingml.document (DOCX)
-- - application/msword (DOC)
-- - text/plain (TXT)

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migración 20251020_002_knowledge_storage_bucket completada';
  RAISE NOTICE '📦 Bucket: restaurant-knowledge (crear manualmente en Dashboard)';
  RAISE NOTICE '🔒 Políticas de acceso configuradas';
  RAISE NOTICE '📏 Límite: 5MB por archivo';
END $$;

