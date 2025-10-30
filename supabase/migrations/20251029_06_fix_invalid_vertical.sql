-- =====================================================
-- Migración: Corregir negocios con vertical_type inválido
-- Fecha: 2025-10-29
-- Descripción: Reemplaza 'otros' con 'fisioterapia' como default
-- =====================================================

-- 1. Actualizar negocios con vertical_type inválido
UPDATE businesses
SET 
    vertical_type = 'fisioterapia',
    updated_at = NOW()
WHERE vertical_type::text = 'otros'
   OR vertical_type IS NULL;

-- 2. Log de cambios
DO $$
BEGIN
    RAISE NOTICE 'Negocios actualizados con vertical_type inválido';
END $$;


