-- =====================================================
-- MIGRACIÓN: Renombrar demo_vertical_context a vertical_context y adaptarla para producción
-- Descripción: Renombra la tabla y la extiende para que sirva tanto para demos como producción
-- =====================================================

-- 1. Renombrar la tabla de demo_vertical_context a vertical_context
ALTER TABLE IF EXISTS demo_vertical_context 
    RENAME TO vertical_context;

-- 2. Renombrar índices relacionados
DO $$ 
BEGIN
    -- Renombrar índice primario si existe
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'demo_vertical_context_pkey') THEN
        ALTER INDEX demo_vertical_context_pkey RENAME TO vertical_context_pkey;
    END IF;
    
    -- Renombrar índice de vertical_id si existe
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'demo_vertical_context_vertical_id_key') THEN
        ALTER INDEX demo_vertical_context_vertical_id_key RENAME TO vertical_context_vertical_id_key;
    END IF;
    
    -- Renombrar índice idx_demo_vertical_context_vertical_id si existe
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_demo_vertical_context_vertical_id') THEN
        ALTER INDEX idx_demo_vertical_context_vertical_id RENAME TO idx_vertical_context_vertical_id;
    END IF;
END $$;

-- 3. Renombrar funciones y triggers relacionados
DROP TRIGGER IF EXISTS trigger_sync_demo_vertical_context_codes ON vertical_context;
DROP TRIGGER IF EXISTS trigger_update_demo_vertical_context_updated_at ON vertical_context;
DROP FUNCTION IF EXISTS sync_demo_vertical_context_codes();
DROP FUNCTION IF EXISTS update_demo_vertical_context_updated_at();

-- Renombrar función de updated_at si existe
CREATE OR REPLACE FUNCTION update_vertical_context_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_vertical_context_updated_at
    BEFORE UPDATE ON vertical_context
    FOR EACH ROW
    EXECUTE FUNCTION update_vertical_context_updated_at();

-- 4. Agregar campo tone_instructions si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vertical_context' 
        AND column_name = 'tone_instructions'
    ) THEN
        ALTER TABLE vertical_context 
        ADD COLUMN tone_instructions TEXT;
        
        COMMENT ON COLUMN vertical_context.tone_instructions IS 
            'Instrucciones de tono específicas del vertical (útil para producción)';
    END IF;
END $$;

-- 5. Hacer services_list nullable (no se usa en producción, solo en demos)
ALTER TABLE vertical_context 
    ALTER COLUMN services_list DROP NOT NULL;

-- 6. Hacer assistant_voice_id nullable (solo para demos)
ALTER TABLE vertical_context 
    ALTER COLUMN assistant_voice_id DROP NOT NULL;

-- 7. Agregar campo vertical_code como alias de vertical_id para consistencia
-- (Mantener vertical_id para compatibilidad con código existente)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vertical_context' 
        AND column_name = 'vertical_code'
    ) THEN
        ALTER TABLE vertical_context 
        ADD COLUMN vertical_code TEXT;
        
        -- Copiar datos de vertical_id a vertical_code
        UPDATE vertical_context 
        SET vertical_code = vertical_id 
        WHERE vertical_code IS NULL;
        
        -- Crear índice único en vertical_code
        CREATE UNIQUE INDEX IF NOT EXISTS vertical_context_vertical_code_key 
            ON vertical_context(vertical_code);
        
        COMMENT ON COLUMN vertical_context.vertical_code IS 
            'Código del vertical (alias de vertical_id, para consistencia con business_verticals.code)';
    END IF;
END $$;

-- 8. Actualizar comentarios de la tabla
COMMENT ON TABLE vertical_context IS 
    'Contexto y prompts personalizados por vertical. Usado tanto para demos como para producción. 
     Campos específicos de demo: services_list (JSONB), assistant_voice_id. 
     Campos para producción: base_prompt, context_info, tone_instructions.';

-- 9. Crear trigger para mantener vertical_code sincronizado con vertical_id
CREATE OR REPLACE FUNCTION sync_vertical_context_codes()
RETURNS TRIGGER AS $$
BEGIN
    -- Si se actualiza vertical_id, actualizar vertical_code
    IF NEW.vertical_id IS NOT NULL AND (OLD.vertical_id IS NULL OR OLD.vertical_id != NEW.vertical_id) THEN
        NEW.vertical_code = NEW.vertical_id;
    END IF;
    
    -- Si se actualiza vertical_code, actualizar vertical_id (para compatibilidad)
    IF NEW.vertical_code IS NOT NULL AND (OLD.vertical_code IS NULL OR OLD.vertical_code != NEW.vertical_code) THEN
        NEW.vertical_id = NEW.vertical_code;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_vertical_context_codes
    BEFORE INSERT OR UPDATE ON vertical_context
    FOR EACH ROW
    EXECUTE FUNCTION sync_vertical_context_codes();

-- 10. Actualizar RLS - Eliminar políticas antiguas y crear nuevas
DROP POLICY IF EXISTS "Service role can read demo_vertical_context" ON vertical_context;
DROP POLICY IF EXISTS "Admins pueden ver vertical context" ON vertical_context;
DROP POLICY IF EXISTS "Service role puede modificar vertical context" ON vertical_context;

-- Crear nuevas políticas con el nombre correcto
CREATE POLICY "Service role can read vertical_context"
    ON vertical_context
    FOR SELECT
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage vertical_context"
    ON vertical_context
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- 11. Asegurar que todos los registros tengan vertical_code
UPDATE vertical_context 
SET vertical_code = vertical_id 
WHERE vertical_code IS NULL;

