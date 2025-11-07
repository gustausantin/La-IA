-- =====================================================
-- FIX COMPLETO: Todas las RLS policies para onboarding
-- Migración: 20251107_03_fix_all_rls_onboarding.sql
-- Problema: Múltiples policies causando deadlocks
-- Solución: Simplificar TODAS las policies para onboarding
-- =====================================================

-- =====================================================
-- 1. BUSINESSES
-- =====================================================

-- Eliminar policies antiguas
DROP POLICY IF EXISTS "Users can create their first business" ON businesses;
DROP POLICY IF EXISTS "Users can view their own businesses" ON businesses;
DROP POLICY IF EXISTS "Owners can update their business" ON businesses;

-- Policy SIMPLE para INSERT
CREATE POLICY "Users can insert business"
ON businesses
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

-- Policy SIMPLE para SELECT
CREATE POLICY "Users can select their business"
ON businesses
FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

-- Policy SIMPLE para UPDATE
CREATE POLICY "Users can update their business"
ON businesses
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

-- =====================================================
-- 2. USER_BUSINESS_MAPPING
-- =====================================================

-- Eliminar policies antiguas
DROP POLICY IF EXISTS "Users can create their own mapping" ON user_business_mapping;
DROP POLICY IF EXISTS "Users can view their own mappings" ON user_business_mapping;
DROP POLICY IF EXISTS "Owners can update their mapping" ON user_business_mapping;

-- Policy SIMPLE para INSERT
CREATE POLICY "Users can insert mapping"
ON user_business_mapping
FOR INSERT
TO authenticated
WITH CHECK (auth_user_id = auth.uid());

-- Policy SIMPLE para SELECT
CREATE POLICY "Users can select their mapping"
ON user_business_mapping
FOR SELECT
TO authenticated
USING (auth_user_id = auth.uid());

-- Policy SIMPLE para UPDATE
CREATE POLICY "Users can update their mapping"
ON user_business_mapping
FOR UPDATE
TO authenticated
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());

-- =====================================================
-- 3. SERVICES (simplificar)
-- =====================================================

DROP POLICY IF EXISTS "Users can manage services of their business" ON services;

CREATE POLICY "Users can manage services"
ON services
FOR ALL
TO authenticated
USING (
    business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
)
WITH CHECK (
    business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
);

-- =====================================================
-- 4. RESOURCES (simplificar)
-- =====================================================

DROP POLICY IF EXISTS "Users can manage resources of their business" ON resources;

CREATE POLICY "Users can manage resources"
ON resources
FOR ALL
TO authenticated
USING (
    business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
)
WITH CHECK (
    business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
);

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================

-- Log
DO $$
BEGIN
    RAISE NOTICE '✅ TODAS las RLS policies simplificadas para onboarding sin deadlocks';
END $$;

