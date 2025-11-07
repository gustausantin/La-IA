-- =====================================================
-- FIX: create_business_securely - Eliminar validación circular
-- Migración: 20251107_01_fix_create_business_rpc.sql
-- Problema: La función se cuelga al validar si el usuario ya tiene negocio
-- Solución: Eliminar la validación previa, dejar que RLS lo maneje
-- =====================================================

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
    
    -- ❌ ELIMINADA: Validación de negocio existente (causaba deadlock)
    -- La RLS policy ya lo maneja
    
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
        owner_id,
        onboarding_completed,
        onboarding_step,
        agent_status,
        copilot_step,
        copilot_completed,
        agent_config,
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
        current_user_id, -- owner_id
        COALESCE((business_data->>'onboarding_completed')::BOOLEAN, false),
        COALESCE((business_data->>'onboarding_step')::INTEGER, 0),
        COALESCE(business_data->>'agent_status', 'OFF'),
        COALESCE((business_data->>'copilot_step')::INTEGER, 0),
        COALESCE((business_data->>'copilot_completed')::BOOLEAN, false),
        COALESCE((business_data->'agent_config')::JSONB, '{}'::JSONB),
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
    WHEN unique_violation THEN
        -- El usuario ya tiene un negocio
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User already has a business',
            'error_code', 'UNIQUE_VIOLATION',
            'message', 'Each user can only have one active business'
        );
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
COMMENT ON FUNCTION create_business_securely(JSONB, JSONB) IS 'Crea negocio de forma segura con validaciones y audit trail (v2 - sin deadlock)';

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================

-- Log
DO $$
BEGIN
    RAISE NOTICE '✅ Función create_business_securely actualizada (v2 - sin deadlock)';
END $$;

