-- =====================================================
-- PASO 1: MODIFICAR ESTRUCTURA DE service_templates
-- =====================================================
-- Eliminar restricciones NOT NULL de duration_minutes y suggested_price
-- Ya que cada usuario definirá sus propios valores
-- =====================================================

-- 1. Hacer que duration_minutes y suggested_price sean opcionales (nullable)
ALTER TABLE service_templates 
  ALTER COLUMN duration_minutes DROP NOT NULL,
  ALTER COLUMN suggested_price DROP NOT NULL;

-- 2. Verificar la estructura
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'service_templates'
ORDER BY ordinal_position;



