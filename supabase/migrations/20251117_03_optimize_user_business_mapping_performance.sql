-- Migration: Optimize user_business_mapping table performance
-- Created: 2025-11-17
-- Purpose: Crear índices profesionales para evitar queries lentas y timeouts

-- =====================================================
-- ÍNDICES PROFESIONALES PARA user_business_mapping
-- =====================================================

-- Índice compuesto para la query más común: auth_user_id + active
-- Este índice es CRÍTICO para el rendimiento de fetchBusinessInfo
CREATE INDEX IF NOT EXISTS idx_user_business_mapping_auth_active 
ON public.user_business_mapping(auth_user_id, active) 
WHERE active = true;

-- Índice para auth_user_id solo (para queries sin filtro active)
CREATE INDEX IF NOT EXISTS idx_user_business_mapping_auth_user_id 
ON public.user_business_mapping(auth_user_id);

-- Índice para business_id (para joins y queries inversas)
CREATE INDEX IF NOT EXISTS idx_user_business_mapping_business_id 
ON public.user_business_mapping(business_id);

-- Índice compuesto para role + active (para queries de permisos)
CREATE INDEX IF NOT EXISTS idx_user_business_mapping_role_active 
ON public.user_business_mapping(role, active) 
WHERE active = true AND role = 'owner';

-- Índice para created_at (para ordenamiento)
CREATE INDEX IF NOT EXISTS idx_user_business_mapping_created_at 
ON public.user_business_mapping(created_at DESC);

-- =====================================================
-- ANÁLISIS DE RENDIMIENTO
-- =====================================================

-- Verificar que los índices se crearon correctamente
DO $$
DECLARE
    index_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO index_count
    FROM pg_indexes
    WHERE schemaname = 'public' 
    AND tablename = 'user_business_mapping';
    
    RAISE NOTICE 'Total de índices en user_business_mapping: %', index_count;
    
    IF index_count < 3 THEN
        RAISE WARNING 'ADVERTENCIA: Pocos índices detectados. Verifica que se crearon correctamente.';
    END IF;
END $$;

-- =====================================================
-- VERIFICACIÓN DE RENDIMIENTO
-- =====================================================

-- Analizar la tabla para que PostgreSQL optimice las queries
ANALYZE public.user_business_mapping;

-- =====================================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- =====================================================

COMMENT ON INDEX idx_user_business_mapping_auth_active IS 
'Índice compuesto crítico para queries de fetchBusinessInfo. Optimiza búsquedas por usuario activo.';

COMMENT ON INDEX idx_user_business_mapping_auth_user_id IS 
'Índice para búsquedas rápidas por auth_user_id sin filtro de active.';

COMMENT ON INDEX idx_user_business_mapping_business_id IS 
'Índice para joins y queries inversas desde business_id.';

