-- =====================================================
-- ⚠️ DESHABILITAR RLS TEMPORALMENTE PARA DEBUGGING
-- =====================================================
-- ADVERTENCIA: Esto es SOLO para debugging.
-- Una vez que funcione la app, volveremos a activar RLS.
-- =====================================================

-- 1. Deshabilitar RLS en las tablas problemáticas
ALTER TABLE businesses DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_business_mapping DISABLE ROW LEVEL SECURITY;

-- 2. Verificar que se deshabilitó
SELECT 
    tablename,
    rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('businesses', 'user_business_mapping');

-- Debería mostrar rowsecurity = FALSE

-- =====================================================
-- ✅ AHORA LA APP DEBERÍA FUNCIONAR
-- =====================================================

-- La RPC ahora podrá consultar las tablas sin problemas
-- Una vez que confirmes que funciona, ejecutaremos:
-- ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_business_mapping ENABLE ROW LEVEL SECURITY;


