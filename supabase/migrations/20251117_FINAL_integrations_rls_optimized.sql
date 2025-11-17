-- Migration: Final RLS Policies for Integrations Table
-- Created: 2025-11-17
-- Purpose: Políticas RLS optimizadas y finales para la tabla integrations
-- Status: PRODUCTION READY

-- =====================================================
-- FUNCIÓN HELPER PARA VERIFICAR BUSINESS ACCESS
-- =====================================================

-- Función helper optimizada que verifica acceso a business
-- Usa SECURITY DEFINER para mejor rendimiento y evita subqueries en políticas
CREATE OR REPLACE FUNCTION user_has_business_access(user_id UUID, target_business_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM user_business_mapping
        WHERE auth_user_id = user_id
        AND business_id = target_business_id
        AND active = true
    );
END;
$$;

GRANT EXECUTE ON FUNCTION user_has_business_access(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION user_has_business_access(UUID, UUID) IS 
'Función helper para verificar acceso a business. Usa SECURITY DEFINER para mejor rendimiento.';

-- =====================================================
-- ELIMINAR TODAS LAS POLÍTICAS EXISTENTES
-- =====================================================

DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'integrations'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON integrations', policy_record.policyname);
    END LOOP;
END $$;

-- =====================================================
-- CREAR POLÍTICAS RLS OPTIMIZADAS
-- =====================================================

-- Policy: SELECT - Usuarios pueden leer integraciones de sus negocios
CREATE POLICY "Users can read own business integrations"
ON public.integrations
FOR SELECT
TO authenticated
USING (user_has_business_access(auth.uid(), business_id));

-- Policy: INSERT - Usuarios pueden crear integraciones para sus negocios
CREATE POLICY "Users can insert own business integrations"
ON public.integrations
FOR INSERT
TO authenticated
WITH CHECK (user_has_business_access(auth.uid(), business_id));

-- Policy: UPDATE - Usuarios pueden actualizar integraciones de sus negocios
CREATE POLICY "Users can update own business integrations"
ON public.integrations
FOR UPDATE
TO authenticated
USING (user_has_business_access(auth.uid(), business_id))
WITH CHECK (user_has_business_access(auth.uid(), business_id));

-- Policy: DELETE - Usuarios pueden eliminar integraciones de sus negocios
CREATE POLICY "Users can delete own business integrations"
ON public.integrations
FOR DELETE
TO authenticated
USING (user_has_business_access(auth.uid(), business_id));

-- =====================================================
-- VERIFICAR QUE RLS ESTÁ HABILITADO
-- =====================================================

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- ACTUALIZAR ESTADÍSTICAS
-- =====================================================

ANALYZE public.integrations;

