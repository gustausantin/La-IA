-- =====================================================
-- CREAR TABLA SPECIAL_EVENTS para eventos especiales del calendario
-- Fecha: 27 Septiembre 2025
-- Propósito: Almacenar días festivos, vacaciones y eventos especiales
-- =====================================================

-- Eliminar tabla si existe para recrearla correctamente
DROP TABLE IF EXISTS special_events CASCADE;

-- Crear tabla special_events con estructura correcta
CREATE TABLE special_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    event_date DATE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) DEFAULT 'evento' CHECK (type IN ('evento', 'festivo', 'vacaciones', 'cierre')),
    start_time TIME,
    end_time TIME,
    is_closed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_special_events_restaurant_date ON special_events(restaurant_id, event_date);
CREATE INDEX IF NOT EXISTS idx_special_events_date ON special_events(event_date);

-- Crear trigger para updated_at
CREATE OR REPLACE FUNCTION update_special_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_special_events_updated_at ON special_events;
CREATE TRIGGER update_special_events_updated_at
    BEFORE UPDATE ON special_events
    FOR EACH ROW
    EXECUTE FUNCTION update_special_events_updated_at();

-- Habilitar RLS
ALTER TABLE special_events ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para special_events
DROP POLICY IF EXISTS "special_events_select_policy" ON special_events;
CREATE POLICY "special_events_select_policy" ON special_events
    FOR SELECT USING (
        restaurant_id IN (
            SELECT restaurant_id 
            FROM user_restaurant_mapping 
            WHERE auth_user_id = auth.uid()
        )
        OR
        auth.role() = 'service_role'
    );

DROP POLICY IF EXISTS "special_events_insert_policy" ON special_events;
CREATE POLICY "special_events_insert_policy" ON special_events
    FOR INSERT WITH CHECK (
        restaurant_id IN (
            SELECT restaurant_id 
            FROM user_restaurant_mapping 
            WHERE auth_user_id = auth.uid()
        )
        OR
        auth.role() = 'service_role'
    );

DROP POLICY IF EXISTS "special_events_update_policy" ON special_events;
CREATE POLICY "special_events_update_policy" ON special_events
    FOR UPDATE USING (
        restaurant_id IN (
            SELECT restaurant_id 
            FROM user_restaurant_mapping 
            WHERE auth_user_id = auth.uid()
        )
        OR
        auth.role() = 'service_role'
    );

DROP POLICY IF EXISTS "special_events_delete_policy" ON special_events;
CREATE POLICY "special_events_delete_policy" ON special_events
    FOR DELETE USING (
        restaurant_id IN (
            SELECT restaurant_id 
            FROM user_restaurant_mapping 
            WHERE auth_user_id = auth.uid()
        )
        OR
        auth.role() = 'service_role'
    );

-- Otorgar permisos
GRANT SELECT, INSERT, UPDATE, DELETE ON special_events TO authenticated, anon;

-- Verificar que la tabla se creó correctamente
DO $$
DECLARE
    table_exists BOOLEAN;
    column_count INTEGER;
BEGIN
    -- Verificar si la tabla existe
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'special_events'
    ) INTO table_exists;
    
    IF table_exists THEN
        -- Contar columnas
        SELECT COUNT(*) INTO column_count
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'special_events';
        
        RAISE NOTICE '✅ TABLA SPECIAL_EVENTS CREADA CORRECTAMENTE';
        RAISE NOTICE '📊 Columnas creadas: %', column_count;
        RAISE NOTICE '📅 Eventos especiales del calendario listos';
        RAISE NOTICE '🛡️ RLS y políticas configuradas';
    ELSE
        RAISE EXCEPTION '❌ ERROR: La tabla special_events no se pudo crear';
    END IF;
END $$;
