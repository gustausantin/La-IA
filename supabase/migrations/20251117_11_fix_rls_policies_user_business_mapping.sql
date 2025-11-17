-- Migration: Fix RLS policies for user_business_mapping
-- Created: 2025-11-17
-- Purpose: Corregir políticas RLS que están causando que las queries se cuelguen

-- =====================================================
-- DIAGNÓSTICO: Verificar políticas actuales
-- =====================================================

SELECT 
    policyname,
    cmd as command,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public' 
AND tablename = 'user_business_mapping';

-- =====================================================
-- ELIMINAR TODAS LAS POLÍTICAS EXISTENTES
-- =====================================================

-- Eliminar TODAS las políticas existentes (incluyendo variaciones de nombres)
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    -- Eliminar todas las políticas de user_business_mapping
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'user_business_mapping'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON user_business_mapping', policy_record.policyname);
        RAISE NOTICE 'Eliminada política: %', policy_record.policyname;
    END LOOP;
END $$;

-- =====================================================
-- CREAR POLÍTICAS SIMPLIFICADAS Y OPTIMIZADAS
-- =====================================================

-- Policy: SELECT - Los usuarios pueden VER sus propios mappings
-- Política SIMPLE sin subqueries complejas que puedan causar deadlocks
CREATE POLICY "Users can view their own mappings"
ON user_business_mapping
FOR SELECT
TO authenticated
USING (auth_user_id = auth.uid());

-- Policy: INSERT - Los usuarios pueden CREAR su propio mapping
CREATE POLICY "Users can create their own mapping"
ON user_business_mapping
FOR INSERT
TO authenticated
WITH CHECK (auth_user_id = auth.uid());

-- Policy: UPDATE - Los usuarios pueden ACTUALIZAR su propio mapping
CREATE POLICY "Users can update their mapping"
ON user_business_mapping
FOR UPDATE
TO authenticated
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());

-- =====================================================
-- VERIFICAR QUE LAS POLÍTICAS SE CREARON CORRECTAMENTE
-- =====================================================

DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public' 
    AND tablename = 'user_business_mapping';
    
    RAISE NOTICE '📊 Total de políticas RLS en user_business_mapping: %', policy_count;
    
    IF policy_count < 3 THEN
        RAISE WARNING '⚠️ Pocas políticas detectadas. Verifica que se crearon correctamente.';
    ELSE
        RAISE NOTICE '✅ Políticas RLS recreadas correctamente';
    END IF;
END $$;

-- =====================================================
-- ACTUALIZAR ESTADÍSTICAS
-- =====================================================

ANALYZE public.user_business_mapping;

-- =====================================================
-- VERIFICAR QUE RLS ESTÁ HABILITADO
-- =====================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'user_business_mapping'
        AND rowsecurity = true
    ) THEN
        RAISE NOTICE '✅ RLS está habilitado en user_business_mapping';
    ELSE
        RAISE WARNING '⚠️ RLS NO está habilitado. Habilitándolo...';
        ALTER TABLE user_business_mapping ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Políticas RLS simplificadas y optimizadas. Las queries deberían funcionar ahora.';
END $$;

