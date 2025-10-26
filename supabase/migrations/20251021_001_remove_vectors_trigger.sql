-- ============================================================================
-- ELIMINACIÓN COMPLETA DEL SISTEMA DE VECTORES
-- Fecha: 2025-10-21
-- Motivo: Simplificación del RAG - No usamos vectorización
-- ============================================================================

-- 1. Eliminar trigger de sincronización
DROP TRIGGER IF EXISTS trg_sync_restaurant_id ON restaurant_knowledge_vectors;
DROP FUNCTION IF EXISTS sync_restaurant_id_from_metadata();

-- 2. Eliminar trigger de limpieza automática de vectores
DROP TRIGGER IF EXISTS trg_cleanup_knowledge_vectors ON restaurant_knowledge_files;
DROP FUNCTION IF EXISTS cleanup_knowledge_vectors();

-- 3. Eliminar función de búsqueda semántica
DROP FUNCTION IF EXISTS match_restaurant_knowledge(uuid, vector, integer, float);

-- 4. Eliminar función de migración temporal
DROP FUNCTION IF EXISTS move_temp_vectors_to_final();

-- 5. Eliminar tabla temporal si existe
DROP TABLE IF EXISTS temp_knowledge_vectors;

-- 6. Eliminar tabla de vectores
DROP TABLE IF EXISTS restaurant_knowledge_vectors;

-- ✅ CONFIRMACIÓN
DO $$
BEGIN
  RAISE NOTICE '✅ SISTEMA DE VECTORES ELIMINADO COMPLETAMENTE';
  RAISE NOTICE '✅ Triggers eliminados';
  RAISE NOTICE '✅ Funciones eliminadas';
  RAISE NOTICE '✅ Tabla restaurant_knowledge_vectors eliminada';
  RAISE NOTICE '📋 Solo queda: restaurant_knowledge_files (para tracking de archivos)';
END $$;


