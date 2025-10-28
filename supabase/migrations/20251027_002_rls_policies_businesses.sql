-- =====================================================
-- RLS POLICIES: businesses & user_business_mapping
-- Migración: 20251027_002_rls_policies_businesses.sql
-- Autor: La-IA Development Team
-- Descripción: Políticas RLS para permitir onboarding y operaciones seguras
-- =====================================================

-- Habilitar RLS en las tablas principales
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_business_mapping ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLICIES: businesses
-- =====================================================

-- Policy: Los usuarios autenticados pueden CREAR su primer negocio
DROP POLICY IF EXISTS "Users can create their first business" ON businesses;
CREATE POLICY "Users can create their first business"
ON businesses
FOR INSERT
TO authenticated
WITH CHECK (
    -- Solo permitir si el usuario no tiene ya un negocio activo
    NOT EXISTS (
        SELECT 1 FROM user_business_mapping
        WHERE auth_user_id = auth.uid()
        AND active = true
    )
);

-- Policy: Los usuarios pueden VER sus propios negocios
DROP POLICY IF EXISTS "Users can view their own businesses" ON businesses;
CREATE POLICY "Users can view their own businesses"
ON businesses
FOR SELECT
TO authenticated
USING (
    id IN (
        SELECT business_id FROM user_business_mapping
        WHERE auth_user_id = auth.uid()
        AND active = true
    )
);

-- Policy: Los usuarios OWNER pueden ACTUALIZAR su negocio
DROP POLICY IF EXISTS "Owners can update their business" ON businesses;
CREATE POLICY "Owners can update their business"
ON businesses
FOR UPDATE
TO authenticated
USING (
    id IN (
        SELECT business_id FROM user_business_mapping
        WHERE auth_user_id = auth.uid()
        AND role = 'owner'
        AND active = true
    )
)
WITH CHECK (
    id IN (
        SELECT business_id FROM user_business_mapping
        WHERE auth_user_id = auth.uid()
        AND role = 'owner'
        AND active = true
    )
);

-- Policy: Los usuarios NO pueden BORRAR negocios (solo desactivar)
-- No creamos policy de DELETE para forzar soft-delete

-- =====================================================
-- POLICIES: user_business_mapping
-- =====================================================

-- Policy: Los usuarios autenticados pueden CREAR su propio mapping
DROP POLICY IF EXISTS "Users can create their own mapping" ON user_business_mapping;
CREATE POLICY "Users can create their own mapping"
ON user_business_mapping
FOR INSERT
TO authenticated
WITH CHECK (
    auth_user_id = auth.uid()
);

-- Policy: Los usuarios pueden VER sus propios mappings
DROP POLICY IF EXISTS "Users can view their own mappings" ON user_business_mapping;
CREATE POLICY "Users can view their own mappings"
ON user_business_mapping
FOR SELECT
TO authenticated
USING (
    auth_user_id = auth.uid()
);

-- Policy: Los usuarios OWNER pueden ACTUALIZAR su mapping
DROP POLICY IF EXISTS "Owners can update their mapping" ON user_business_mapping;
CREATE POLICY "Owners can update their mapping"
ON user_business_mapping
FOR UPDATE
TO authenticated
USING (
    auth_user_id = auth.uid()
    AND role = 'owner'
)
WITH CHECK (
    auth_user_id = auth.uid()
    AND role = 'owner'
);

-- =====================================================
-- POLÍTICAS PARA OTRAS TABLAS RELACIONADAS
-- =====================================================

-- Asegurar que appointments, services, resources permiten acceso basado en business_id

-- APPOINTMENTS (citas)
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view appointments of their business" ON appointments;
CREATE POLICY "Users can view appointments of their business"
ON appointments
FOR SELECT
TO authenticated
USING (
    business_id IN (
        SELECT business_id FROM user_business_mapping
        WHERE auth_user_id = auth.uid()
        AND active = true
    )
);

DROP POLICY IF EXISTS "Users can insert appointments in their business" ON appointments;
CREATE POLICY "Users can insert appointments in their business"
ON appointments
FOR INSERT
TO authenticated
WITH CHECK (
    business_id IN (
        SELECT business_id FROM user_business_mapping
        WHERE auth_user_id = auth.uid()
        AND active = true
    )
);

DROP POLICY IF EXISTS "Users can update appointments of their business" ON appointments;
CREATE POLICY "Users can update appointments of their business"
ON appointments
FOR UPDATE
TO authenticated
USING (
    business_id IN (
        SELECT business_id FROM user_business_mapping
        WHERE auth_user_id = auth.uid()
        AND active = true
    )
)
WITH CHECK (
    business_id IN (
        SELECT business_id FROM user_business_mapping
        WHERE auth_user_id = auth.uid()
        AND active = true
    )
);

-- SERVICES (servicios del negocio)
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage services of their business" ON services;
CREATE POLICY "Users can manage services of their business"
ON services
FOR ALL
TO authenticated
USING (
    business_id IN (
        SELECT business_id FROM user_business_mapping
        WHERE auth_user_id = auth.uid()
        AND active = true
    )
)
WITH CHECK (
    business_id IN (
        SELECT business_id FROM user_business_mapping
        WHERE auth_user_id = auth.uid()
        AND active = true
    )
);

-- RESOURCES (recursos/camillas/sillas/etc)
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage resources of their business" ON resources;
CREATE POLICY "Users can manage resources of their business"
ON resources
FOR ALL
TO authenticated
USING (
    business_id IN (
        SELECT business_id FROM user_business_mapping
        WHERE auth_user_id = auth.uid()
        AND active = true
    )
)
WITH CHECK (
    business_id IN (
        SELECT business_id FROM user_business_mapping
        WHERE auth_user_id = auth.uid()
        AND active = true
    )
);

-- CUSTOMERS (clientes)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage customers of their business" ON customers;
CREATE POLICY "Users can manage customers of their business"
ON customers
FOR ALL
TO authenticated
USING (
    business_id IN (
        SELECT business_id FROM user_business_mapping
        WHERE auth_user_id = auth.uid()
        AND active = true
    )
)
WITH CHECK (
    business_id IN (
        SELECT business_id FROM user_business_mapping
        WHERE auth_user_id = auth.uid()
        AND active = true
    )
);

-- =====================================================
-- FIN DE MIGRACIÓN RLS POLICIES
-- =====================================================

-- Log de auditoría
DO $$
BEGIN
    RAISE NOTICE 'RLS policies actualizadas para businesses, appointments, services, resources, customers';
END $$;

