-- =====================================================
-- FIX: Deshabilitar validación RLS circular en onboarding
-- Migración: 20251107_02_disable_rls_check_for_onboarding.sql
-- Problema: La policy "Users can create their first business" crea deadlock
-- Solución: Eliminar la validación en la policy, permitir siempre INSERT
-- =====================================================

-- Eliminar la policy antigua que causa deadlock
DROP POLICY IF EXISTS "Users can create their first business" ON businesses;

-- Crear nueva policy SIN validación de mapping existente
CREATE POLICY "Users can create their first business"
ON businesses
FOR INSERT
TO authenticated
WITH CHECK (
    -- Permitir que el usuario cree un business si:
    -- 1. Es el owner (owner_id = auth.uid())
    owner_id = auth.uid()
    -- NO validamos si ya tiene negocio, eso lo maneja la aplicación
);

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================

-- Log
DO $$
BEGIN
    RAISE NOTICE '✅ RLS policy actualizada para businesses - sin deadlock en onboarding';
END $$;

