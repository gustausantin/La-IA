-- Migration: Ultimate fix - Bypass RLS completamente para query crítica
-- Created: 2025-11-17
-- Purpose: Crear función SECURITY DEFINER que bypass RLS para obtener business_id

-- =====================================================
-- FUNCIÓN ULTRA-OPTIMIZADA QUE BYPASS RLS
-- =====================================================

-- Eliminar función antigua si existe
DROP FUNCTION IF EXISTS get_user_business_id_fast(UUID);

-- Crear función que bypass RLS completamente
-- Esta función se ejecuta como el propietario de la función (postgres)
-- y por lo tanto bypass todas las políticas RLS
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
    -- No usa ORDER BY para máximo rendimiento
    SELECT ubm.business_id
    INTO business_id_result
    FROM user_business_mapping ubm
    WHERE ubm.auth_user_id = user_id
    AND ubm.active = true
    LIMIT 1;
    
    RETURN business_id_result;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error en get_user_business_id_fast: %', SQLERRM;
        RETURN NULL;
END;
$$;

-- Dar permisos a usuarios autenticados
GRANT EXECUTE ON FUNCTION get_user_business_id_fast(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_business_id_fast(UUID) TO anon;

-- Comentario
COMMENT ON FUNCTION get_user_business_id_fast(UUID) IS 
'Función SECURITY DEFINER que bypass RLS completamente. Usa el contexto del propietario de la función para evitar problemas de rendimiento con políticas RLS.';

-- =====================================================
-- VERIFICAR QUE SE CREÓ CORRECTAMENTE
-- =====================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'get_user_business_id_fast' 
        AND pronamespace = 'public'::regnamespace
        AND prosecdef = true  -- Debe ser SECURITY DEFINER
    ) THEN
        RAISE NOTICE '✅ Función get_user_business_id_fast creada correctamente como SECURITY DEFINER';
    ELSE
        RAISE EXCEPTION '❌ Error: Función no se pudo crear o no es SECURITY DEFINER';
    END IF;
END $$;

-- =====================================================
-- TEST RÁPIDO
-- =====================================================

-- Descomentar para probar:
-- SELECT get_user_business_id_fast('856e76ff-417f-46d0-8191-edbaa4838310'::UUID);

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Función get_user_business_id_fast recreada con bypass RLS completo.';
    RAISE NOTICE '📋 Esta función se ejecuta como el propietario y bypass todas las políticas RLS.';
END $$;

