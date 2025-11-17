-- Migration: Optimize integrations table performance
-- Created: 2025-11-17
-- Purpose: Crear índices profesionales para queries de integraciones

-- =====================================================
-- ÍNDICES PROFESIONALES PARA integrations
-- =====================================================

-- Índice compuesto para la query más común: business_id + provider
-- Este índice es CRÍTICO para el rendimiento de loadIntegrationsConfig
CREATE INDEX IF NOT EXISTS idx_integrations_business_provider 
ON public.integrations(business_id, provider);

-- Índice para business_id solo (para queries de todas las integraciones de un negocio)
CREATE INDEX IF NOT EXISTS idx_integrations_business_id 
ON public.integrations(business_id);

-- Índice para provider (para queries globales por tipo de integración)
CREATE INDEX IF NOT EXISTS idx_integrations_provider 
ON public.integrations(provider);

-- Índice para is_active (para queries de integraciones activas)
CREATE INDEX IF NOT EXISTS idx_integrations_is_active 
ON public.integrations(is_active) 
WHERE is_active = true;

-- Índice para status (para queries por estado)
CREATE INDEX IF NOT EXISTS idx_integrations_status 
ON public.integrations(status) 
WHERE status = 'active';

-- Índice compuesto para business_id + is_active (para queries optimizadas)
CREATE INDEX IF NOT EXISTS idx_integrations_business_active 
ON public.integrations(business_id, is_active) 
WHERE is_active = true;

-- Índice para connected_at (para ordenamiento y queries temporales)
CREATE INDEX IF NOT EXISTS idx_integrations_connected_at 
ON public.integrations(connected_at DESC);

-- =====================================================
-- ANALIZAR TABLA PARA OPTIMIZACIÓN
-- =====================================================

ANALYZE public.integrations;

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

DO $$
DECLARE
    index_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO index_count
    FROM pg_indexes
    WHERE schemaname = 'public' 
    AND tablename = 'integrations';
    
    RAISE NOTICE 'Total de índices en integrations: %', index_count;
    
    IF index_count < 5 THEN
        RAISE WARNING 'ADVERTENCIA: Pocos índices detectados. Verifica que se crearon correctamente.';
    END IF;
END $$;

