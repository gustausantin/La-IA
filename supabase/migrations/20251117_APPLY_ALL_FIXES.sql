-- =====================================================
-- MIGRACIÓN COMBINADA: Aplicar todas las correcciones
-- Fecha: 2025-11-17
-- Propósito: Optimizar función RPC y diagnosticar problemas de rendimiento
-- =====================================================

-- =====================================================
-- PARTE 1: OPTIMIZAR FUNCIÓN get_user_business_info
-- =====================================================

-- Eliminar función antigua si existe
DROP FUNCTION IF EXISTS get_user_business_info(UUID);

-- Crear función optimizada con mejor rendimiento
CREATE OR REPLACE FUNCTION get_user_business_info(user_id UUID)
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER
STABLE
AS $$
DECLARE
    business_info JSONB;
    mapping_record RECORD;
BEGIN
    -- Query optimizada: Solo obtener business_id primero (sin JOIN)
    -- Esto evita problemas de rendimiento con JOINs complejos
    SELECT business_id, role, created_at
    INTO mapping_record
    FROM user_business_mapping
    WHERE auth_user_id = user_id
    AND active = true
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Si no hay mapping, retornar null
    IF mapping_record.business_id IS NULL THEN
        RETURN jsonb_build_object(
            'business_id', null,
            'message', 'No business found for user'
        );
    END IF;
    
    -- Ahora obtener datos del negocio (query separada es más eficiente)
    SELECT jsonb_build_object(
        'business_id', b.id,
        'business_name', b.name,
        'vertical_type', b.vertical_type,
        'email', b.email,
        'phone', b.phone,
        'city', b.city,
        'active', b.active,
        'role', mapping_record.role,
        'mapping_created_at', mapping_record.created_at,
        'settings', b.settings
    )
    INTO business_info
    FROM businesses b
    WHERE b.id = mapping_record.business_id
    LIMIT 1;
    
    -- Si no encuentra negocio, retornar solo el business_id
    IF business_info IS NULL THEN
        RETURN jsonb_build_object(
            'business_id', mapping_record.business_id,
            'message', 'Business ID found but business data not available'
        );
    END IF;
    
    RETURN business_info;
EXCEPTION
    WHEN OTHERS THEN
        -- En caso de error, retornar información del error
        RETURN jsonb_build_object(
            'business_id', null,
            'error', SQLERRM,
            'message', 'Error retrieving business info'
        );
END;
$$;

-- Dar permisos
GRANT EXECUTE ON FUNCTION get_user_business_info(UUID) TO authenticated;

-- Comentario
COMMENT ON FUNCTION get_user_business_info(UUID) IS 
'Función optimizada para obtener información del negocio de un usuario. Usa queries separadas para mejor rendimiento.';

-- =====================================================
-- PARTE 2: DIAGNÓSTICO Y OPTIMIZACIÓN
-- =====================================================

-- Verificar índices
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

-- Verificar políticas RLS
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

-- Crear índice compuesto adicional para ORDER BY
CREATE INDEX IF NOT EXISTS idx_user_business_mapping_auth_active_created 
ON public.user_business_mapping(auth_user_id, active, created_at DESC) 
WHERE active = true;

COMMENT ON INDEX idx_user_business_mapping_auth_active_created IS 
'Índice compuesto optimizado para queries con ORDER BY created_at DESC. Crítico para fetchBusinessInfo.';

-- Verificar que la función se creó correctamente
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'get_user_business_info' 
        AND pronamespace = 'public'::regnamespace
    ) THEN
        RAISE NOTICE '✅ Función get_user_business_info creada/actualizada correctamente';
    ELSE
        RAISE EXCEPTION '❌ Error: Función no se pudo crear';
    END IF;
END $$;

-- =====================================================
-- PARTE 3: FUNCIÓN DE EMERGENCIA (BYPASS RLS)
-- =====================================================

-- Función SECURITY DEFINER que bypass RLS para obtener business_id rápidamente
CREATE OR REPLACE FUNCTION get_user_business_id_fast(user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    business_id_result UUID;
BEGIN
    -- Query directa SIN RLS (porque es SECURITY DEFINER)
    SELECT ubm.business_id
    INTO business_id_result
    FROM user_business_mapping ubm
    WHERE ubm.auth_user_id = user_id
    AND ubm.active = true
    ORDER BY ubm.created_at DESC
    LIMIT 1;
    
    RETURN business_id_result;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_business_id_fast(UUID) TO authenticated;

COMMENT ON FUNCTION get_user_business_id_fast(UUID) IS 
'Función de emergencia que bypass RLS para obtener business_id rápidamente. Usa SECURITY DEFINER para evitar problemas de rendimiento con políticas RLS.';

-- Verificar que la función de emergencia se creó correctamente
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'get_user_business_id_fast' 
        AND pronamespace = 'public'::regnamespace
    ) THEN
        RAISE NOTICE '✅ Función get_user_business_id_fast creada correctamente';
    ELSE
        RAISE EXCEPTION '❌ Error: Función de emergencia no se pudo crear';
    END IF;
END $$;

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Todas las correcciones aplicadas exitosamente.';
    RAISE NOTICE '📋 Revisa los mensajes arriba para verificar índices, políticas y estadísticas.';
    RAISE NOTICE '🚀 Función de emergencia get_user_business_id_fast creada para bypass RLS.';
END $$;

