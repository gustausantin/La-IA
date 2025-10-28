-- =====================================================
-- RPC FUNCTION: create_restaurant_securely
-- Migración: 20250128_007_create_restaurant_rpc.sql
-- Autor: La-IA Security Team
-- Descripción: Función RPC segura para crear restaurantes automáticamente
-- =====================================================

-- Función para crear restaurante de forma segura con validaciones
CREATE OR REPLACE FUNCTION create_restaurant_securely(
    restaurant_data JSONB,
    user_profile JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB AS $$
DECLARE
    new_restaurant_id UUID;
    new_restaurant_name TEXT;
    current_user_id UUID;
    result JSONB;
BEGIN
    -- Obtener ID del usuario autenticado
    current_user_id := auth.uid();
    
    -- Validar que hay un usuario autenticado
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'No authenticated user found'
            USING HINT = 'User must be authenticated to create restaurant';
    END IF;
    
    -- Validar que el usuario no tiene ya un restaurante
    IF EXISTS (
        SELECT 1 FROM user_restaurant_mapping 
        WHERE auth_user_id = current_user_id
    ) THEN
        RAISE EXCEPTION 'User already has a restaurant'
            USING HINT = 'Each user can only have one restaurant';
    END IF;
    
    -- Extraer y validar datos del restaurante
    new_restaurant_name := COALESCE(
        restaurant_data->>'name', 
        'Restaurante de ' || (user_profile->>'email')
    );
    
    -- Validaciones de datos mínimos
    IF LENGTH(new_restaurant_name) < 3 THEN
        RAISE EXCEPTION 'Restaurant name too short'
            USING HINT = 'Restaurant name must be at least 3 characters';
    END IF;
    
    -- Crear el restaurante
    INSERT INTO businesses (
        name,
        email,
        phone,
        address,
        city,
        country,
        postal_code,
        cuisine_type,
        plan,
        active
    ) VALUES (
        new_restaurant_name,
        COALESCE(restaurant_data->>'email', user_profile->>'email', ''),
        NULLIF(restaurant_data->>'phone', ''),
        NULLIF(restaurant_data->>'address', ''),
        NULLIF(restaurant_data->>'city', ''),
        COALESCE(restaurant_data->>'country', 'España'),
        NULLIF(restaurant_data->>'postal_code', ''),
        NULLIF(restaurant_data->>'cuisine_type', ''),
        COALESCE(restaurant_data->>'plan', 'trial'),
        COALESCE((restaurant_data->>'active')::BOOLEAN, true)
    )
    RETURNING id, name INTO new_restaurant_id, new_restaurant_name;
    
    -- Crear el mapping usuario-restaurante
    INSERT INTO user_restaurant_mapping (
        auth_user_id,
        restaurant_id,
        role
    ) VALUES (
        current_user_id,
        new_restaurant_id,
        'owner'
    );
    
    -- Preparar resultado
    result := jsonb_build_object(
        'success', true,
        'restaurant_id', new_restaurant_id,
        'restaurant_name', new_restaurant_name,
        'message', 'Restaurant created successfully'
    );
    
    -- Log de auditoría
    RAISE NOTICE 'Restaurant created: % (ID: %) for user: %', 
        new_restaurant_name, new_restaurant_id, current_user_id;
    
    RETURN result;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log del error
        RAISE NOTICE 'Error creating restaurant: %', SQLERRM;
        
        -- Retornar error estructurado
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'error_code', SQLSTATE,
            'message', 'Failed to create restaurant'
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dar permisos a usuarios autenticados
GRANT EXECUTE ON FUNCTION create_restaurant_securely(JSONB, JSONB) TO authenticated;

-- Comentarios para documentación
COMMENT ON FUNCTION create_restaurant_securely(JSONB, JSONB) IS 'Crea restaurante de forma segura con validaciones y audit trail';

-- =====================================================
-- FUNCIÓN AUXILIAR: get_user_restaurant_info
-- =====================================================

CREATE OR REPLACE FUNCTION get_user_restaurant_info(user_id UUID)
RETURNS JSONB AS $$
DECLARE
    restaurant_info JSONB;
BEGIN
    -- Obtener información completa del restaurante del usuario
    SELECT jsonb_build_object(
        'restaurant_id', r.id,
        'restaurant_name', r.name,
        'email', r.email,
        'phone', r.phone,
        'city', r.city,
        'plan', r.plan,
        'active', r.active,
        'role', urm.role,
        'mapping_created_at', urm.created_at
    )
    INTO restaurant_info
    FROM user_restaurant_mapping urm
    JOIN businesses r ON urm.restaurant_id = r.id
    WHERE urm.auth_user_id = user_id
    AND r.active = true;
    
    -- Si no encuentra nada, retornar null
    IF restaurant_info IS NULL THEN
        RETURN jsonb_build_object(
            'restaurant_id', null,
            'message', 'No restaurant found for user'
        );
    END IF;
    
    RETURN restaurant_info;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dar permisos
GRANT EXECUTE ON FUNCTION get_user_restaurant_info(UUID) TO authenticated;

COMMENT ON FUNCTION get_user_restaurant_info(UUID) IS 'Obtiene información completa del restaurante de un usuario';

-- =====================================================
-- FIN DE MIGRACIÓN RPC FUNCTIONS
-- =====================================================
