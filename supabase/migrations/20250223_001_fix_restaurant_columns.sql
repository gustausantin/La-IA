-- =====================================================
-- FIX CRÍTICO: Agregar columnas channels y notifications a businesses
-- Fecha: 23 Febrero 2025
-- Problema: Las funciones RPC esperan estos campos pero no existen
-- =====================================================

-- 1. Agregar columnas si no existen
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS channels JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS notifications JSONB DEFAULT '{}'::jsonb;

-- 2. Agregar índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_businesses_channels ON businesses USING GIN (channels);
CREATE INDEX IF NOT EXISTS idx_businesses_notifications ON businesses USING GIN (notifications);

-- 3. Asegurar que get_user_restaurant_info existe y funciona correctamente
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
        'address', r.address,
        'city', r.city,
        'country', r.country,
        'postal_code', r.postal_code,
        'cuisine_type', r.cuisine_type,
        'plan', r.plan,
        'active', r.active,
        'role', urm.role,
        'channels', r.channels,
        'notifications', r.notifications,
        'settings', r.settings,
        'mapping_created_at', urm.created_at
    )
    INTO restaurant_info
    FROM user_restaurant_mapping urm
    JOIN businesses r ON urm.restaurant_id = r.id
    WHERE urm.auth_user_id = user_id
    AND r.active = true
    LIMIT 1;
    
    -- Si no encuentra nada, retornar estructura vacía
    IF restaurant_info IS NULL THEN
        RETURN jsonb_build_object(
            'restaurant_id', null,
            'message', 'No restaurant found for user'
        );
    END IF;
    
    RETURN restaurant_info;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Dar permisos correctos
GRANT EXECUTE ON FUNCTION get_user_restaurant_info(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION update_restaurant_channels(UUID, JSONB) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION update_restaurant_notifications(UUID, JSONB) TO authenticated, anon;

-- 5. Verificar y crear índices para user_restaurant_mapping
CREATE INDEX IF NOT EXISTS idx_user_restaurant_mapping_auth_user ON user_restaurant_mapping(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_user_restaurant_mapping_restaurant ON user_restaurant_mapping(restaurant_id);

-- 6. Asegurar que la tabla user_restaurant_mapping tiene los campos necesarios
ALTER TABLE user_restaurant_mapping 
ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'owner',
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 7. Crear trigger para updated_at si no existe
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_user_restaurant_mapping_updated_at ON user_restaurant_mapping;
CREATE TRIGGER update_user_restaurant_mapping_updated_at 
BEFORE UPDATE ON user_restaurant_mapping 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 8. Verificar políticas RLS básicas
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_restaurant_mapping ENABLE ROW LEVEL SECURITY;

-- Política para businesses: usuarios pueden ver su propio restaurante
DROP POLICY IF EXISTS "Users can view their own restaurant" ON businesses;
CREATE POLICY "Users can view their own restaurant" ON businesses
    FOR SELECT USING (
        id IN (
            SELECT restaurant_id 
            FROM user_restaurant_mapping 
            WHERE auth_user_id = auth.uid()
        )
    );

-- Política para businesses: usuarios pueden actualizar su propio restaurante
DROP POLICY IF EXISTS "Users can update their own restaurant" ON businesses;
CREATE POLICY "Users can update their own restaurant" ON businesses
    FOR UPDATE USING (
        id IN (
            SELECT restaurant_id 
            FROM user_restaurant_mapping 
            WHERE auth_user_id = auth.uid()
        )
    );

-- Política para user_restaurant_mapping: usuarios pueden ver su propio mapping
DROP POLICY IF EXISTS "Users can view their own mapping" ON user_restaurant_mapping;
CREATE POLICY "Users can view their own mapping" ON user_restaurant_mapping
    FOR SELECT USING (auth_user_id = auth.uid());

-- 9. Insertar datos de prueba si no existen (para testing)
-- NOTA: Comentar estas líneas en producción
/*
DO $$
BEGIN
    -- Solo ejecutar si no hay mappings
    IF NOT EXISTS (SELECT 1 FROM user_restaurant_mapping LIMIT 1) THEN
        -- Obtener el primer usuario y restaurante
        INSERT INTO user_restaurant_mapping (auth_user_id, restaurant_id, role)
        SELECT 
            u.id,
            r.id,
            'owner'
        FROM auth.users u
        CROSS JOIN businesses r
        WHERE NOT EXISTS (
            SELECT 1 FROM user_restaurant_mapping 
            WHERE auth_user_id = u.id
        )
        LIMIT 1;
        
        RAISE NOTICE 'Mapping de prueba creado';
    END IF;
END $$;
*/

-- 10. Función de diagnóstico para verificar el estado
CREATE OR REPLACE FUNCTION diagnose_user_restaurant(p_user_id UUID DEFAULT auth.uid())
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    mapping_count INTEGER;
    restaurant_count INTEGER;
    has_channels BOOLEAN;
    has_notifications BOOLEAN;
BEGIN
    -- Contar mappings
    SELECT COUNT(*) INTO mapping_count
    FROM user_restaurant_mapping
    WHERE auth_user_id = p_user_id;
    
    -- Contar businesses
    SELECT COUNT(*) INTO restaurant_count
    FROM businesses r
    WHERE EXISTS (
        SELECT 1 FROM user_restaurant_mapping m
        WHERE m.restaurant_id = r.id
        AND m.auth_user_id = p_user_id
    );
    
    -- Verificar columnas
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'businesses' 
        AND column_name = 'channels'
    ) INTO has_channels;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'businesses' 
        AND column_name = 'notifications'
    ) INTO has_notifications;
    
    result := jsonb_build_object(
        'user_id', p_user_id,
        'mapping_count', mapping_count,
        'restaurant_count', restaurant_count,
        'has_channels_column', has_channels,
        'has_notifications_column', has_notifications,
        'timestamp', NOW()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION diagnose_user_restaurant(UUID) TO authenticated, anon;

-- Mensaje final
DO $$
BEGIN
    RAISE NOTICE '✅ MIGRACIÓN COMPLETADA: Columnas y funciones verificadas/creadas';
    RAISE NOTICE '📋 Para diagnosticar problemas, ejecuta: SELECT diagnose_user_restaurant();';
END $$;
