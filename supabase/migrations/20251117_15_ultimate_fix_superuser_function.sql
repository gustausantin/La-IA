-- Migration: Ultimate fix - Función SECURITY DEFINER como superuser
-- Created: 2025-11-17
-- Purpose: Crear función que se ejecute como superuser para bypass completo de RLS y bloqueos

-- =====================================================
-- ELIMINAR FUNCIÓN ANTERIOR
-- =====================================================

DROP FUNCTION IF EXISTS get_user_business_id_fast(UUID);

-- =====================================================
-- CREAR FUNCIÓN COMO SUPERUSER (BYPASS COMPLETO)
-- =====================================================

-- Esta función se ejecuta como el usuario que la crea (postgres/superuser)
-- Bypass completo de RLS y bloqueos
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
    -- Query directa SIN RLS, SIN bloqueos
    -- Usa FOR UPDATE SKIP LOCKED para evitar bloqueos
    SELECT ubm.business_id
    INTO business_id_result
    FROM user_business_mapping ubm
    WHERE ubm.auth_user_id = user_id
    AND ubm.active = true
    ORDER BY ubm.created_at DESC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;
    
    -- Si no encuentra con active=true, buscar sin filtro
    IF business_id_result IS NULL THEN
        SELECT ubm.business_id
        INTO business_id_result
        FROM user_business_mapping ubm
        WHERE ubm.auth_user_id = user_id
        LIMIT 1
        FOR UPDATE SKIP LOCKED;
    END IF;
    
    RETURN business_id_result;
EXCEPTION
    WHEN OTHERS THEN
        -- En caso de error, retornar null
        RETURN NULL;
END;
$$;

-- Dar permisos
GRANT EXECUTE ON FUNCTION get_user_business_id_fast(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_business_id_fast(UUID) TO anon;

-- Comentario
COMMENT ON FUNCTION get_user_business_id_fast(UUID) IS 
'Función SECURITY DEFINER que bypass RLS completamente. Usa FOR UPDATE SKIP LOCKED para evitar bloqueos.';

-- =====================================================
-- VERIFICAR QUE SE CREÓ CORRECTAMENTE
-- =====================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'get_user_business_id_fast' 
        AND pronamespace = 'public'::regnamespace
        AND prosecdef = true
    ) THEN
        RAISE NOTICE '✅ Función get_user_business_id_fast creada como SECURITY DEFINER';
    ELSE
        RAISE EXCEPTION '❌ Error: Función no se pudo crear';
    END IF;
END $$;

