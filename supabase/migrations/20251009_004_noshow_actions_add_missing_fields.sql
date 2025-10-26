-- ========================================
-- NOSHOW ACTIONS - Añadir campos faltantes
-- Fecha: 10 Octubre 2025
-- Descripción: Adaptar tabla existente para compatibilidad con frontend
-- ========================================

-- 1. Añadir columna action_description si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'noshow_actions' AND column_name = 'action_description'
    ) THEN
        ALTER TABLE noshow_actions ADD COLUMN action_description TEXT;
    END IF;
END $$;

-- 2. Añadir columna success si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'noshow_actions' AND column_name = 'success'
    ) THEN
        ALTER TABLE noshow_actions ADD COLUMN success BOOLEAN DEFAULT NULL;
    END IF;
END $$;

-- 3. Añadir columna notes si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'noshow_actions' AND column_name = 'notes'
    ) THEN
        ALTER TABLE noshow_actions ADD COLUMN notes TEXT;
    END IF;
END $$;

-- 4. Añadir columna metadata si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'noshow_actions' AND column_name = 'metadata'
    ) THEN
        ALTER TABLE noshow_actions ADD COLUMN metadata JSONB DEFAULT '{}'::JSONB;
    END IF;
END $$;

-- 5. Crear vista compatible con action_date (usando created_at)
CREATE OR REPLACE VIEW noshow_actions_with_date AS
SELECT 
    *,
    created_at::DATE as action_date
FROM noshow_actions;

-- 6. COMENTARIOS
COMMENT ON VIEW noshow_actions_with_date IS 'Vista de noshow_actions con action_date calculado desde created_at para compatibilidad';

-- ========================================
-- FIN DE MIGRACIÓN
-- ========================================


