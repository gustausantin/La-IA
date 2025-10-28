-- =====================================================
-- ACTUALIZACIÓN: create_restaurant_securely -> create_business_securely
-- Migración: 20251027_001_update_create_business_function.sql
-- Autor: La-IA Development Team
-- Descripción: Actualiza la función RPC para usar businesses y user_business_mapping
-- =====================================================

-- Eliminar la función antigua si existe
DROP FUNCTION IF EXISTS create_restaurant_securely(JSONB, JSONB);

-- Crear la nueva función con el nombre correcto
CREATE OR REPLACE FUNCTION create_business_securely(
    business_data JSONB,
    user_profile JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB AS $$
DECLARE
    new_business_id UUID;
    new_business_name TEXT;
    current_user_id UUID;
    result JSONB;
BEGIN
    -- Obtener ID del usuario autenticado
    current_user_id := auth.uid();
    
    -- Validar que hay un usuario autenticado
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'No authenticated user found'
            USING HINT = 'User must be authenticated to create business';
    END IF;
    
    -- Validar que el usuario no tiene ya un negocio activo
    IF EXISTS (
        SELECT 1 FROM user_business_mapping 
        WHERE auth_user_id = current_user_id
        AND active = true
    ) THEN
        RAISE EXCEPTION 'User already has an active business'
            USING HINT = 'Each user can only have one active business';
    END IF;
    
    -- Extraer y validar datos del negocio
    new_business_name := COALESCE(
        business_data->>'name', 
        'Negocio de ' || (user_profile->>'email')
    );
    
    -- Validaciones de datos mínimos
    IF LENGTH(new_business_name) < 3 THEN
        RAISE EXCEPTION 'Business name too short'
            USING HINT = 'Business name must be at least 3 characters';
    END IF;
    
    -- Crear el negocio
    INSERT INTO businesses (
        name,
        vertical_type,
        email,
        phone,
        address,
        city,
        country,
        postal_code,
        settings,
        active
    ) VALUES (
        new_business_name,
        COALESCE(business_data->>'vertical_type', 'otros')::vertical_type,
        COALESCE(business_data->>'email', user_profile->>'email', ''),
        NULLIF(business_data->>'phone', ''),
        NULLIF(business_data->>'address', ''),
        NULLIF(business_data->>'city', ''),
        COALESCE(business_data->>'country', 'España'),
        NULLIF(business_data->>'postal_code', ''),
        COALESCE((business_data->'settings')::JSONB, '{}'::JSONB),
        COALESCE((business_data->>'active')::BOOLEAN, true)
    )
    RETURNING id, name INTO new_business_id, new_business_name;
    
    -- Crear el mapping usuario-negocio
    INSERT INTO user_business_mapping (
        auth_user_id,
        business_id,
        role,
        active
    ) VALUES (
        current_user_id,
        new_business_id,
        'owner',
        true
    );
    
    -- Preparar resultado
    result := jsonb_build_object(
        'success', true,
        'business_id', new_business_id,
        'business_name', new_business_name,
        'message', 'Business created successfully'
    );
    
    -- Log de auditoría
    RAISE NOTICE 'Business created: % (ID: %) for user: %', 
        new_business_name, new_business_id, current_user_id;
    
    RETURN result;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log del error
        RAISE NOTICE 'Error creating business: %', SQLERRM;
        
        -- Retornar error estructurado
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'error_code', SQLSTATE,
            'message', 'Failed to create business'
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dar permisos a usuarios autenticados
GRANT EXECUTE ON FUNCTION create_business_securely(JSONB, JSONB) TO authenticated;

-- Comentarios para documentación
COMMENT ON FUNCTION create_business_securely(JSONB, JSONB) IS 'Crea negocio de forma segura con validaciones y audit trail';

-- =====================================================
-- FUNCIÓN AUXILIAR: get_user_business_info
-- =====================================================

CREATE OR REPLACE FUNCTION get_user_business_info(user_id UUID)
RETURNS JSONB AS $$
DECLARE
    business_info JSONB;
BEGIN
    -- Obtener información completa del negocio del usuario
    SELECT jsonb_build_object(
        'business_id', b.id,
        'business_name', b.name,
        'vertical_type', b.vertical_type,
        'email', b.email,
        'phone', b.phone,
        'city', b.city,
        'active', b.active,
        'role', ubm.role,
        'mapping_created_at', ubm.created_at
    )
    INTO business_info
    FROM user_business_mapping ubm
    JOIN businesses b ON ubm.business_id = b.id
    WHERE ubm.auth_user_id = user_id
    AND ubm.active = true
    AND b.active = true;
    
    -- Si no encuentra nada, retornar null
    IF business_info IS NULL THEN
        RETURN jsonb_build_object(
            'business_id', null,
            'message', 'No business found for user'
        );
    END IF;
    
    RETURN business_info;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dar permisos
GRANT EXECUTE ON FUNCTION get_user_business_info(UUID) TO authenticated;

COMMENT ON FUNCTION get_user_business_info(UUID) IS 'Obtiene información completa del negocio de un usuario';

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================

