-- =====================================================
-- CONFIGURACIÓN: Bucket público para voice-demos
-- =====================================================
-- Fecha: 2025-10-29
-- Propósito: Hacer el bucket voice-demos accesible públicamente
-- =====================================================

-- 1. Actualizar el bucket para que sea público
UPDATE storage.buckets
SET public = true
WHERE id = 'voice-demos';

-- 2. Crear política de lectura pública
CREATE POLICY IF NOT EXISTS "Public read access to voice demos"
ON storage.objects FOR SELECT
USING (bucket_id = 'voice-demos');

-- 3. Verificar configuración
SELECT 
  id,
  name,
  public,
  created_at
FROM storage.buckets
WHERE id = 'voice-demos';



