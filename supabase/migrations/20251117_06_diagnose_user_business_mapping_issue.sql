-- Migration: Diagnose user_business_mapping performance issue
-- Created: 2025-11-17
-- Purpose: Diagnosticar por qué las queries a user_business_mapping se cuelgan

-- =====================================================
-- VERIFICACIÓN DE ÍNDICES
-- =====================================================

DO $$
DECLARE
    index_count INTEGER;
    index_names TEXT[];
BEGIN
    -- Contar índices en user_business_mapping
    SELECT COUNT(*), array_agg(indexname)
    INTO index_count, index_names
    FROM pg_indexes
    WHERE schemaname = 'public' 
    AND tablename = 'user_business_mapping';
    
    RAISE NOTICE '📊 Total de índices en user_business_mapping: %', index_count;
    RAISE NOTICE '📋 Índices encontrados: %', array_to_string(index_names, ', ');
    
    -- Verificar índice crítico
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'user_business_mapping'
        AND indexname = 'idx_user_business_mapping_auth_active'
    ) THEN
        RAISE WARNING '⚠️ ÍNDICE CRÍTICO FALTANTE: idx_user_business_mapping_auth_active';
        RAISE NOTICE '🔧 Creando índice crítico...';
        CREATE INDEX IF NOT EXISTS idx_user_business_mapping_auth_active 
        ON public.user_business_mapping(auth_user_id, active) 
        WHERE active = true;
    ELSE
        RAISE NOTICE '✅ Índice crítico existe: idx_user_business_mapping_auth_active';
    END IF;
END $$;

-- =====================================================
-- VERIFICACIÓN DE POLÍTICAS RLS
-- =====================================================

DO $$
DECLARE
    policy_count INTEGER;
    policy_names TEXT[];
BEGIN
    -- Contar políticas RLS
    SELECT COUNT(*), array_agg(policyname)
    INTO policy_count, policy_names
    FROM pg_policies
    WHERE schemaname = 'public' 
    AND tablename = 'user_business_mapping';
    
    RAISE NOTICE '📊 Total de políticas RLS en user_business_mapping: %', policy_count;
    RAISE NOTICE '📋 Políticas encontradas: %', array_to_string(policy_names, ', ');
    
    -- Verificar que existe la política de SELECT
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'user_business_mapping'
        AND policyname LIKE '%view%'
        AND cmd = 'SELECT'
    ) THEN
        RAISE WARNING '⚠️ POLÍTICA RLS DE SELECT FALTANTE';
    ELSE
        RAISE NOTICE '✅ Política RLS de SELECT existe';
    END IF;
END $$;

-- =====================================================
-- VERIFICACIÓN DE ESTADÍSTICAS
-- =====================================================

-- Actualizar estadísticas para optimización
ANALYZE public.user_business_mapping;

-- Verificar estadísticas
DO $$
DECLARE
    row_count BIGINT;
    table_size TEXT;
BEGIN
    SELECT COUNT(*), pg_size_pretty(pg_total_relation_size('public.user_business_mapping'))
    INTO row_count, table_size
    FROM public.user_business_mapping;
    
    RAISE NOTICE '📊 Filas en user_business_mapping: %', row_count;
    RAISE NOTICE '📊 Tamaño de tabla: %', table_size;
    
    IF row_count = 0 THEN
        RAISE WARNING '⚠️ TABLA VACÍA: No hay datos en user_business_mapping';
    ELSIF row_count > 10000 THEN
        RAISE WARNING '⚠️ TABLA GRANDE: Más de 10,000 filas. Puede necesitar particionamiento.';
    END IF;
END $$;

-- =====================================================
-- VERIFICACIÓN DE BLOQUEOS
-- =====================================================

-- Función para verificar bloqueos (solo para diagnóstico)
CREATE OR REPLACE FUNCTION check_user_business_mapping_locks()
RETURNS TABLE (
    lock_type TEXT,
    relation_name TEXT,
    mode TEXT,
    granted BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE 
            WHEN l.locktype = 'relation' THEN 'Table/Relation'
            WHEN l.locktype = 'tuple' THEN 'Row'
            ELSE l.locktype::TEXT
        END as lock_type,
        COALESCE(c.relname::TEXT, 'N/A') as relation_name,
        l.mode::TEXT,
        l.granted
    FROM pg_locks l
    LEFT JOIN pg_class c ON l.relation = c.oid
    WHERE c.relname = 'user_business_mapping'
    OR l.relation = 'public.user_business_mapping'::regclass;
END;
$$;

GRANT EXECUTE ON FUNCTION check_user_business_mapping_locks() TO authenticated;

COMMENT ON FUNCTION check_user_business_mapping_locks() IS 
'Función de diagnóstico para verificar bloqueos en user_business_mapping. Usar solo para debugging.';

-- =====================================================
-- OPTIMIZACIÓN ADICIONAL: Índice para ORDER BY
-- =====================================================

-- Crear índice compuesto que incluya created_at para ORDER BY
CREATE INDEX IF NOT EXISTS idx_user_business_mapping_auth_active_created 
ON public.user_business_mapping(auth_user_id, active, created_at DESC) 
WHERE active = true;

COMMENT ON INDEX idx_user_business_mapping_auth_active_created IS 
'Índice compuesto optimizado para queries con ORDER BY created_at DESC. Crítico para fetchBusinessInfo.';

-- =====================================================
-- FIN DE DIAGNÓSTICO
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Diagnóstico completado. Revisa los mensajes arriba para verificar índices, políticas y estadísticas.';
END $$;

