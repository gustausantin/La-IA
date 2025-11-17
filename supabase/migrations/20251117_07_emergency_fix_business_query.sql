-- Migration: EMERGENCY FIX - Bypass RLS para query crítica
-- Created: 2025-11-17
-- Purpose: Crear función SECURITY DEFINER que bypass RLS para obtener business_id rápidamente

-- =====================================================
-- FUNCIÓN DE EMERGENCIA: get_user_business_id_fast
-- =====================================================

-- Esta función bypass RLS usando SECURITY DEFINER
-- Solo retorna el business_id, no datos sensibles
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
    -- Solo obtener el business_id más reciente
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
        -- En caso de error, retornar null
        RETURN NULL;
END;
$$;

-- Dar permisos
GRANT EXECUTE ON FUNCTION get_user_business_id_fast(UUID) TO authenticated;

COMMENT ON FUNCTION get_user_business_id_fast(UUID) IS 
'Función de emergencia que bypass RLS para obtener business_id rápidamente. Usa SECURITY DEFINER para evitar problemas de rendimiento con políticas RLS.';

-- =====================================================
-- VERIFICAR QUE SE CREÓ CORRECTAMENTE
-- =====================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'get_user_business_id_fast' 
        AND pronamespace = 'public'::regnamespace
    ) THEN
        RAISE NOTICE '✅ Función get_user_business_id_fast creada correctamente';
    ELSE
        RAISE EXCEPTION '❌ Error: Función no se pudo crear';
    END IF;
END $$;

-- =====================================================
-- TEST RÁPIDO (opcional, comentar en producción)
-- =====================================================

-- Descomentar para probar con un usuario específico:
-- SELECT get_user_business_id_fast('856e76ff-417f-46d0-8191-edbaa4838310'::UUID);

