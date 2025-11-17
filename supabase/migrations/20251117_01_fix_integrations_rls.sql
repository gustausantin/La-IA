-- Migration: Fix RLS Policies for integrations table
-- Created: 2025-11-17
-- Purpose: Corregir políticas RLS para usar user_business_mapping en lugar de owner_id

-- 🔒 ACTUALIZAR POLÍTICAS RLS DE INTEGRATIONS

-- Eliminar políticas antiguas que usan owner_id
DROP POLICY IF EXISTS "Users can read own business integrations" ON public.integrations;
DROP POLICY IF EXISTS "Users can insert own business integrations" ON public.integrations;
DROP POLICY IF EXISTS "Users can update own business integrations" ON public.integrations;
DROP POLICY IF EXISTS "Users can delete own business integrations" ON public.integrations;

-- Policy: Users can read their own business integrations (usando user_business_mapping)
CREATE POLICY "Users can read own business integrations"
    ON public.integrations
    FOR SELECT
    TO authenticated
    USING (
        business_id IN (
            SELECT business_id FROM public.user_business_mapping
            WHERE auth_user_id = auth.uid()
            AND active = true
        )
    );

-- Policy: Users can insert integrations for their business (usando user_business_mapping)
CREATE POLICY "Users can insert own business integrations"
    ON public.integrations
    FOR INSERT
    TO authenticated
    WITH CHECK (
        business_id IN (
            SELECT business_id FROM public.user_business_mapping
            WHERE auth_user_id = auth.uid()
            AND active = true
        )
    );

-- Policy: Users can update their own business integrations (usando user_business_mapping)
CREATE POLICY "Users can update own business integrations"
    ON public.integrations
    FOR UPDATE
    TO authenticated
    USING (
        business_id IN (
            SELECT business_id FROM public.user_business_mapping
            WHERE auth_user_id = auth.uid()
            AND active = true
        )
    )
    WITH CHECK (
        business_id IN (
            SELECT business_id FROM public.user_business_mapping
            WHERE auth_user_id = auth.uid()
            AND active = true
        )
    );

-- Policy: Users can delete their own business integrations (usando user_business_mapping)
CREATE POLICY "Users can delete own business integrations"
    ON public.integrations
    FOR DELETE
    TO authenticated
    USING (
        business_id IN (
            SELECT business_id FROM public.user_business_mapping
            WHERE auth_user_id = auth.uid()
            AND active = true
        )
    );

