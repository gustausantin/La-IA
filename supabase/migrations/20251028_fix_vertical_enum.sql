-- =====================================================
-- FIX: Añadir los 10 verticales ORIGINALES del proyecto
-- =====================================================

-- Añadir los 10 verticales definidos originalmente
ALTER TYPE vertical_type ADD VALUE IF NOT EXISTS 'fisioterapia';
ALTER TYPE vertical_type ADD VALUE IF NOT EXISTS 'masajes_osteopatia';
ALTER TYPE vertical_type ADD VALUE IF NOT EXISTS 'clinica_dental';
ALTER TYPE vertical_type ADD VALUE IF NOT EXISTS 'psicologia_coaching';
ALTER TYPE vertical_type ADD VALUE IF NOT EXISTS 'centro_estetica';
ALTER TYPE vertical_type ADD VALUE IF NOT EXISTS 'peluqueria_barberia';
ALTER TYPE vertical_type ADD VALUE IF NOT EXISTS 'centro_unas';
ALTER TYPE vertical_type ADD VALUE IF NOT EXISTS 'entrenador_personal';
ALTER TYPE vertical_type ADD VALUE IF NOT EXISTS 'yoga_pilates';
ALTER TYPE vertical_type ADD VALUE IF NOT EXISTS 'veterinario';

-- Verificar que todos existen
SELECT enumlabel 
FROM pg_enum 
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
WHERE pg_type.typname = 'vertical_type'
ORDER BY enumlabel;
