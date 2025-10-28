-- ===================================
-- RLS POLICIES PARA ONBOARDING
-- ===================================
-- Permite a usuarios autenticados crear su propio negocio

-- 1. HABILITAR RLS en todas las tablas
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_business_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

-- 2. POLICY: Permitir INSERT en businesses (cualquier usuario autenticado)
CREATE POLICY "Users can create their own business"
ON businesses
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 3. POLICY: Permitir SELECT en businesses (solo sus propios negocios)
CREATE POLICY "Users can view their own businesses"
ON businesses
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT business_id 
    FROM user_business_mapping 
    WHERE auth_user_id = auth.uid()
  )
);

-- 4. POLICY: Permitir INSERT en user_business_mapping
CREATE POLICY "Users can create their own mapping"
ON user_business_mapping
FOR INSERT
TO authenticated
WITH CHECK (auth_user_id = auth.uid());

-- 5. POLICY: Permitir SELECT en user_business_mapping
CREATE POLICY "Users can view their own mappings"
ON user_business_mapping
FOR SELECT
TO authenticated
USING (auth_user_id = auth.uid());

-- 6. POLICY: Permitir INSERT en services (solo en sus negocios)
CREATE POLICY "Users can create services in their businesses"
ON services
FOR INSERT
TO authenticated
WITH CHECK (
  business_id IN (
    SELECT business_id 
    FROM user_business_mapping 
    WHERE auth_user_id = auth.uid()
  )
);

-- 7. POLICY: Permitir SELECT en services
CREATE POLICY "Users can view services in their businesses"
ON services
FOR SELECT
TO authenticated
USING (
  business_id IN (
    SELECT business_id 
    FROM user_business_mapping 
    WHERE auth_user_id = auth.uid()
  )
);

-- 8. POLICY: Permitir INSERT en resources
CREATE POLICY "Users can create resources in their businesses"
ON resources
FOR INSERT
TO authenticated
WITH CHECK (
  business_id IN (
    SELECT business_id 
    FROM user_business_mapping 
    WHERE auth_user_id = auth.uid()
  )
);

-- 9. POLICY: Permitir SELECT en resources
CREATE POLICY "Users can view resources in their businesses"
ON resources
FOR SELECT
TO authenticated
USING (
  business_id IN (
    SELECT business_id 
    FROM user_business_mapping 
    WHERE auth_user_id = auth.uid()
  )
);

-- ✅ LISTO! Ahora el wizard funcionará


