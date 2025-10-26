-- =====================================================
-- RENOMBRAR Y CLARIFICAR: min_advance_hours → min_advance_minutes
-- =====================================================
-- Fecha: 22 Octubre 2025
-- Problema: Campo "min_advance_hours" es confuso (algunos lo usan como horas, otros como minutos)
-- Solución: Renombrar a "min_advance_minutes" para claridad total
-- =====================================================

-- PASO 1: Verificar valores actuales y decidir si convertir
-- Si el valor es típicamente < 24, probablemente ya son MINUTOS (ej: 30)
-- Si el valor es típicamente 1-4, probablemente son HORAS (ej: 2)

-- 🔍 ANÁLISIS: Basado en el código:
-- - reservationValidationService.js: Lo usa como MINUTOS
-- - AvailabilityService.js: Lo usa como HORAS
-- - Frontend UI: Dice "Minutos mínimos" y muestra 30
-- CONCLUSIÓN: El valor guardado es MINUTOS, pero hay código que lo malinterpreta

-- =====================================================
-- ESTRATEGIA: Asumir que son MINUTOS (valor típico: 30)
-- =====================================================

DO $$
DECLARE
    restaurant RECORD;
BEGIN
    -- Verificar si la columna existe en el JSONB
    RAISE NOTICE '🔍 Verificando valores actuales de min_advance_hours...';
    
    -- Mostrar valores actuales (para debug)
    FOR restaurant IN 
        SELECT id, name, (settings->>'min_advance_hours') as current_value
        FROM restaurants
        WHERE settings ? 'min_advance_hours'
    LOOP
        RAISE NOTICE '  Restaurant: % | min_advance_hours actual: %', 
            restaurant.name, restaurant.current_value;
    END LOOP;
END $$;

-- =====================================================
-- MIGRACIÓN: Renombrar min_advance_hours → min_advance_minutes
-- =====================================================

UPDATE restaurants
SET settings = settings 
    - 'min_advance_hours'  -- Eliminar clave antigua
    || jsonb_build_object(
        'min_advance_minutes', 
        COALESCE((settings->>'min_advance_hours')::INTEGER, 30) -- Default: 30 minutos
    )
WHERE settings ? 'min_advance_hours';

-- =====================================================
-- VERIFICACIÓN: Mostrar valores actualizados
-- =====================================================

DO $$
DECLARE
    restaurant RECORD;
BEGIN
    RAISE NOTICE '✅ Valores actualizados:';
    
    FOR restaurant IN 
        SELECT id, name, (settings->>'min_advance_minutes') as new_value
        FROM restaurants
        WHERE settings ? 'min_advance_minutes'
    LOOP
        RAISE NOTICE '  Restaurant: % | min_advance_minutes nuevo: % min', 
            restaurant.name, restaurant.new_value;
    END LOOP;
END $$;

-- =====================================================
-- ✅ COMENTARIOS
-- =====================================================

COMMENT ON COLUMN restaurants.settings IS 
'JSONB con configuración del restaurante. 
Claves relevantes:
- min_advance_minutes: Minutos mínimos de antelación para reservas (INTEGER)
- reservation_duration: Duración de reserva en minutos (INTEGER)
- advance_booking_days: Días máximos de antelación (INTEGER)
- max_party_size: Tamaño máximo de grupo (INTEGER)
- min_party_size: Tamaño mínimo de grupo (INTEGER)';

-- =====================================================
-- ✅ FIN DE LA MIGRACIÓN
-- =====================================================

