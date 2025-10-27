-- =====================================================
-- 🔐 ROW LEVEL SECURITY (RLS) - IMPLEMENTACIÓN COMPLETA
-- =====================================================
-- Este script activa RLS en todas las tablas críticas
-- y crea políticas de seguridad para multi-tenancy
-- =====================================================
-- EJECUTA ESTE SCRIPT EN SUPABASE SQL EDITOR
-- =====================================================

-- =====================================================
-- 1. ACTIVAR RLS EN TABLAS CRÍTICAS
-- =====================================================

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_business_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_operating_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_verticals ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_templates ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 2. POLÍTICAS PARA: businesses
-- =====================================================

-- Los usuarios pueden ver sus propios negocios
CREATE POLICY "Users can view their own businesses"
ON businesses FOR SELECT
USING (
  id IN (
    SELECT business_id 
    FROM user_business_mapping 
    WHERE auth_user_id = auth.uid()
  )
);

-- Los usuarios pueden actualizar sus propios negocios
CREATE POLICY "Users can update their own businesses"
ON businesses FOR UPDATE
USING (
  id IN (
    SELECT business_id 
    FROM user_business_mapping 
    WHERE auth_user_id = auth.uid()
      AND role IN ('owner', 'admin')
  )
);

-- Los usuarios pueden insertar negocios (registro)
CREATE POLICY "Users can insert their own businesses"
ON businesses FOR INSERT
WITH CHECK (true); -- Durante el registro, el mapping se crea después

-- =====================================================
-- 3. POLÍTICAS PARA: user_business_mapping
-- =====================================================

-- Los usuarios pueden ver sus propios mappings
CREATE POLICY "Users can view their own mappings"
ON user_business_mapping FOR SELECT
USING (auth_user_id = auth.uid());

-- Los owners pueden insertar nuevos mappings (invitar usuarios)
CREATE POLICY "Owners can invite users"
ON user_business_mapping FOR INSERT
WITH CHECK (
  business_id IN (
    SELECT business_id 
    FROM user_business_mapping 
    WHERE auth_user_id = auth.uid()
      AND role = 'owner'
  )
);

-- Los owners pueden actualizar roles
CREATE POLICY "Owners can update roles"
ON user_business_mapping FOR UPDATE
USING (
  business_id IN (
    SELECT business_id 
    FROM user_business_mapping 
    WHERE auth_user_id = auth.uid()
      AND role = 'owner'
  )
);

-- =====================================================
-- 4. POLÍTICAS PARA: services
-- =====================================================

-- Ver servicios de mi negocio
CREATE POLICY "Users can view services of their business"
ON services FOR SELECT
USING (
  business_id IN (
    SELECT business_id 
    FROM user_business_mapping 
    WHERE auth_user_id = auth.uid()
  )
);

-- Crear servicios (owners y admins)
CREATE POLICY "Owners and admins can create services"
ON services FOR INSERT
WITH CHECK (
  business_id IN (
    SELECT business_id 
    FROM user_business_mapping 
    WHERE auth_user_id = auth.uid()
      AND role IN ('owner', 'admin')
  )
);

-- Actualizar servicios
CREATE POLICY "Owners and admins can update services"
ON services FOR UPDATE
USING (
  business_id IN (
    SELECT business_id 
    FROM user_business_mapping 
    WHERE auth_user_id = auth.uid()
      AND role IN ('owner', 'admin')
  )
);

-- Eliminar servicios
CREATE POLICY "Owners can delete services"
ON services FOR DELETE
USING (
  business_id IN (
    SELECT business_id 
    FROM user_business_mapping 
    WHERE auth_user_id = auth.uid()
      AND role = 'owner'
  )
);

-- =====================================================
-- 5. POLÍTICAS PARA: resources
-- =====================================================

-- Ver recursos de mi negocio
CREATE POLICY "Users can view resources of their business"
ON resources FOR SELECT
USING (
  business_id IN (
    SELECT business_id 
    FROM user_business_mapping 
    WHERE auth_user_id = auth.uid()
  )
);

-- Crear recursos (owners y admins)
CREATE POLICY "Owners and admins can create resources"
ON resources FOR INSERT
WITH CHECK (
  business_id IN (
    SELECT business_id 
    FROM user_business_mapping 
    WHERE auth_user_id = auth.uid()
      AND role IN ('owner', 'admin')
  )
);

-- Actualizar recursos
CREATE POLICY "Owners and admins can update resources"
ON resources FOR UPDATE
USING (
  business_id IN (
    SELECT business_id 
    FROM user_business_mapping 
    WHERE auth_user_id = auth.uid()
      AND role IN ('owner', 'admin')
  )
);

-- =====================================================
-- 6. POLÍTICAS PARA: appointments
-- =====================================================

-- Ver citas de mi negocio
CREATE POLICY "Users can view appointments of their business"
ON appointments FOR SELECT
USING (
  business_id IN (
    SELECT business_id 
    FROM user_business_mapping 
    WHERE auth_user_id = auth.uid()
  )
);

-- Crear citas
CREATE POLICY "Users can create appointments"
ON appointments FOR INSERT
WITH CHECK (
  business_id IN (
    SELECT business_id 
    FROM user_business_mapping 
    WHERE auth_user_id = auth.uid()
  )
);

-- Actualizar citas
CREATE POLICY "Users can update appointments"
ON appointments FOR UPDATE
USING (
  business_id IN (
    SELECT business_id 
    FROM user_business_mapping 
    WHERE auth_user_id = auth.uid()
  )
);

-- Eliminar citas (solo owners)
CREATE POLICY "Owners can delete appointments"
ON appointments FOR DELETE
USING (
  business_id IN (
    SELECT business_id 
    FROM user_business_mapping 
    WHERE auth_user_id = auth.uid()
      AND role = 'owner'
  )
);

-- =====================================================
-- 7. POLÍTICAS PARA: availability_slots
-- =====================================================

-- Ver slots de disponibilidad de mi negocio
CREATE POLICY "Users can view availability slots of their business"
ON availability_slots FOR SELECT
USING (
  business_id IN (
    SELECT business_id 
    FROM user_business_mapping 
    WHERE auth_user_id = auth.uid()
  )
);

-- Crear slots (owners y admins)
CREATE POLICY "Owners and admins can create slots"
ON availability_slots FOR INSERT
WITH CHECK (
  business_id IN (
    SELECT business_id 
    FROM user_business_mapping 
    WHERE auth_user_id = auth.uid()
      AND role IN ('owner', 'admin')
  )
);

-- Actualizar slots
CREATE POLICY "Owners and admins can update slots"
ON availability_slots FOR UPDATE
USING (
  business_id IN (
    SELECT business_id 
    FROM user_business_mapping 
    WHERE auth_user_id = auth.uid()
      AND role IN ('owner', 'admin')
  )
);

-- =====================================================
-- 8. POLÍTICAS PARA: customers
-- =====================================================

-- Ver clientes de mi negocio
CREATE POLICY "Users can view customers of their business"
ON customers FOR SELECT
USING (
  business_id IN (
    SELECT business_id 
    FROM user_business_mapping 
    WHERE auth_user_id = auth.uid()
  )
);

-- Crear clientes
CREATE POLICY "Users can create customers"
ON customers FOR INSERT
WITH CHECK (
  business_id IN (
    SELECT business_id 
    FROM user_business_mapping 
    WHERE auth_user_id = auth.uid()
  )
);

-- Actualizar clientes
CREATE POLICY "Users can update customers"
ON customers FOR UPDATE
USING (
  business_id IN (
    SELECT business_id 
    FROM user_business_mapping 
    WHERE auth_user_id = auth.uid()
  )
);

-- =====================================================
-- 9. POLÍTICAS PARA: profiles
-- =====================================================

-- Los usuarios pueden ver su propio perfil
CREATE POLICY "Users can view their own profile"
ON profiles FOR SELECT
USING (auth_user_id = auth.uid());

-- Los usuarios pueden actualizar su propio perfil
CREATE POLICY "Users can update their own profile"
ON profiles FOR UPDATE
USING (auth_user_id = auth.uid());

-- Los usuarios pueden crear su propio perfil
CREATE POLICY "Users can create their own profile"
ON profiles FOR INSERT
WITH CHECK (auth_user_id = auth.uid());

-- =====================================================
-- 10. POLÍTICAS PARA: business_operating_hours
-- =====================================================

-- Ver horarios de mi negocio
CREATE POLICY "Users can view operating hours of their business"
ON business_operating_hours FOR SELECT
USING (
  business_id IN (
    SELECT business_id 
    FROM user_business_mapping 
    WHERE auth_user_id = auth.uid()
  )
);

-- Crear/actualizar horarios (owners y admins)
CREATE POLICY "Owners and admins can manage operating hours"
ON business_operating_hours FOR ALL
USING (
  business_id IN (
    SELECT business_id 
    FROM user_business_mapping 
    WHERE auth_user_id = auth.uid()
      AND role IN ('owner', 'admin')
  )
);

-- =====================================================
-- 11. POLÍTICAS PARA: business_verticals (lectura pública)
-- =====================================================

-- Todos pueden ver los verticales disponibles
CREATE POLICY "Anyone can view business verticals"
ON business_verticals FOR SELECT
USING (true);

-- =====================================================
-- 12. POLÍTICAS PARA: service_templates (lectura pública)
-- =====================================================

-- Todos pueden ver las plantillas de servicios
CREATE POLICY "Anyone can view service templates"
ON service_templates FOR SELECT
USING (true);

-- =====================================================
-- ✅ VERIFICACIÓN DE RLS
-- =====================================================

-- Ejecuta esto para verificar que RLS está activo:
SELECT 
    schemaname,
    tablename,
    rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
  AND tablename IN (
    'businesses', 
    'user_business_mapping', 
    'services', 
    'resources', 
    'appointments',
    'availability_slots',
    'customers',
    'profiles'
  )
ORDER BY tablename;

-- rowsecurity = TRUE significa que RLS está activo ✅

-- =====================================================
-- 📊 VER POLÍTICAS ACTIVAS
-- =====================================================

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- =====================================================
-- ✅ RLS CONFIGURADO CORRECTAMENTE
-- =====================================================
-- Ahora tu app es SEGURA y cada usuario solo ve sus datos
-- =====================================================

