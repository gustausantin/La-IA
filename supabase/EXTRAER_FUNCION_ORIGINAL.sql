-- =====================================================
-- CONSULTA PARA VER LA FUNCIÓN ORIGINAL EN SUPABASE
-- Ejecuta esto en SQL Editor y copia el resultado
-- =====================================================

-- Ver la definición COMPLETA de la función
SELECT pg_get_functiondef(oid)
FROM pg_proc 
WHERE proname = 'get_unified_dashboard_snapshot';

-- Si no funciona, usa este:
SELECT 
  proname as function_name,
  pg_get_function_identity_arguments(oid) as arguments,
  prosrc as source_code
FROM pg_proc 
WHERE proname = 'get_unified_dashboard_snapshot';

