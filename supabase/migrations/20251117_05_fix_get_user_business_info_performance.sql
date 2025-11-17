-- Migration: Fix get_user_business_info function performance
-- Created: 2025-11-17
-- Purpose: Optimizar la función para evitar timeouts y mejorar rendimiento

-- =====================================================
-- OPTIMIZAR FUNCIÓN get_user_business_info
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

-- Verificar que se creó correctamente
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

