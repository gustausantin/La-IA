-- Migration: Fix integrations table structure
-- Created: 2025-11-17
-- Purpose: Asegurar que la tabla integrations tenga todas las columnas necesarias

-- Verificar y agregar columnas faltantes
DO $$ 
BEGIN
    -- Agregar is_active si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'integrations' 
        AND column_name = 'is_active'
    ) THEN
        ALTER TABLE public.integrations 
        ADD COLUMN is_active BOOLEAN DEFAULT true;
        
        RAISE NOTICE 'Columna is_active agregada a integrations';
    ELSE
        RAISE NOTICE 'Columna is_active ya existe';
    END IF;

    -- Agregar access_token si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'integrations' 
        AND column_name = 'access_token'
    ) THEN
        ALTER TABLE public.integrations 
        ADD COLUMN access_token TEXT;
        
        RAISE NOTICE 'Columna access_token agregada a integrations';
    ELSE
        RAISE NOTICE 'Columna access_token ya existe';
    END IF;

    -- Agregar refresh_token si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'integrations' 
        AND column_name = 'refresh_token'
    ) THEN
        ALTER TABLE public.integrations 
        ADD COLUMN refresh_token TEXT;
        
        RAISE NOTICE 'Columna refresh_token agregada a integrations';
    ELSE
        RAISE NOTICE 'Columna refresh_token ya existe';
    END IF;

    -- Agregar token_expires_at si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'integrations' 
        AND column_name = 'token_expires_at'
    ) THEN
        ALTER TABLE public.integrations 
        ADD COLUMN token_expires_at TIMESTAMPTZ;
        
        RAISE NOTICE 'Columna token_expires_at agregada a integrations';
    ELSE
        RAISE NOTICE 'Columna token_expires_at ya existe';
    END IF;

    -- Agregar config si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'integrations' 
        AND column_name = 'config'
    ) THEN
        ALTER TABLE public.integrations 
        ADD COLUMN config JSONB DEFAULT '{}'::jsonb;
        
        RAISE NOTICE 'Columna config agregada a integrations';
    ELSE
        RAISE NOTICE 'Columna config ya existe';
    END IF;

    -- Agregar connected_at si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'integrations' 
        AND column_name = 'connected_at'
    ) THEN
        ALTER TABLE public.integrations 
        ADD COLUMN connected_at TIMESTAMPTZ DEFAULT NOW();
        
        RAISE NOTICE 'Columna connected_at agregada a integrations';
    ELSE
        RAISE NOTICE 'Columna connected_at ya existe';
    END IF;

    -- Agregar last_sync_at si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'integrations' 
        AND column_name = 'last_sync_at'
    ) THEN
        ALTER TABLE public.integrations 
        ADD COLUMN last_sync_at TIMESTAMPTZ;
        
        RAISE NOTICE 'Columna last_sync_at agregada a integrations';
    ELSE
        RAISE NOTICE 'Columna last_sync_at ya existe';
    END IF;

    -- Agregar disconnected_at si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'integrations' 
        AND column_name = 'disconnected_at'
    ) THEN
        ALTER TABLE public.integrations 
        ADD COLUMN disconnected_at TIMESTAMPTZ;
        
        RAISE NOTICE 'Columna disconnected_at agregada a integrations';
    ELSE
        RAISE NOTICE 'Columna disconnected_at ya existe';
    END IF;

    -- Agregar error_log si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'integrations' 
        AND column_name = 'error_log'
    ) THEN
        ALTER TABLE public.integrations 
        ADD COLUMN error_log JSONB DEFAULT '[]'::jsonb;
        
        RAISE NOTICE 'Columna error_log agregada a integrations';
    ELSE
        RAISE NOTICE 'Columna error_log ya existe';
    END IF;

END $$;

-- Crear índice para is_active si no existe
CREATE INDEX IF NOT EXISTS idx_integrations_active 
ON public.integrations(is_active) 
WHERE is_active = true;

-- Verificar estructura final
DO $$
DECLARE
    col_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'integrations';
    
    RAISE NOTICE 'Tabla integrations tiene % columnas', col_count;
END $$;

