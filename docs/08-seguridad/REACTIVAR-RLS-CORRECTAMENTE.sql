-- =====================================================
-- ✅ REACTIVAR RLS CON POLÍTICAS QUE FUNCIONAN
-- =====================================================

-- 1. REACTIVAR RLS
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_business_mapping ENABLE ROW LEVEL SECURITY;

-- 2. BORRAR TODAS LAS POLÍTICAS ANTERIORES
DROP POLICY IF EXISTS "Users can view their own businesses" ON businesses;
DROP POLICY IF EXISTS "Users can update their own businesses" ON businesses;
DROP POLICY IF EXISTS "Users can insert their own businesses" ON businesses;
DROP POLICY IF EXISTS "Users can view their own mappings" ON user_business_mapping;
DROP POLICY IF EXISTS "Owners can invite users" ON user_business_mapping;
DROP POLICY IF EXISTS "Owners can update roles" ON user_business_mapping;

-- 3. CREAR POLÍTICAS SUPER PERMISIVAS (temporal para que funcione)

-- businesses: Permitir todo a usuarios autenticados
CREATE POLICY "Allow all for authenticated users" 
ON businesses 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- user_business_mapping: Permitir todo a usuarios autenticados
CREATE POLICY "Allow all for authenticated users" 
ON user_business_mapping 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- services: Permitir todo
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON services;
CREATE POLICY "Allow all for authenticated users" 
ON services 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- resources: Permitir todo
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON resources;
CREATE POLICY "Allow all for authenticated users" 
ON resources 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- =====================================================
-- ✅ VERIFICAR
-- =====================================================

SELECT 
    schemaname,
    tablename,
    rowsecurity,
    (SELECT COUNT(*) 
     FROM pg_policies 
     WHERE schemaname = 'public' 
       AND tablename = pg_tables.tablename) as policy_count
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('businesses', 'user_business_mapping', 'services', 'resources')
ORDER BY tablename;

-- Debería mostrar rowsecurity = TRUE y policy_count > 0


