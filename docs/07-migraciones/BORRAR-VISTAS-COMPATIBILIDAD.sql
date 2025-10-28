-- =====================================================
-- 🗑️ BORRAR VISTAS DE COMPATIBILIDAD
-- =====================================================
-- Este script elimina las vistas temporales que creamos
-- para compatibilidad. Ahora migraremos TODO el código
-- para usar directamente las tablas nuevas (businesses, etc)
-- =====================================================

-- 1. Borrar RULES de las vistas
DROP RULE IF EXISTS businesses_insert ON businesses;
DROP RULE IF EXISTS businesses_update ON businesses;
DROP RULE IF EXISTS user_restaurant_mapping_insert ON user_restaurant_mapping;
DROP RULE IF EXISTS user_restaurant_mapping_update ON user_restaurant_mapping;

-- 2. Borrar las VISTAS
DROP VIEW IF EXISTS businesses;
DROP VIEW IF EXISTS user_restaurant_mapping;

-- =====================================================
-- ✅ VERIFICACIÓN
-- =====================================================
-- Ejecuta esto para verificar que se borraron:
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('businesses', 'user_restaurant_mapping');

-- Debería devolver 0 resultados

