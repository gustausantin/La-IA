-- =====================================================
-- REGENERAR TODOS LOS DÍAS FUTUROS (MULTI-TENANT)
-- Fecha: 17 Octubre 2025
-- =====================================================

-- 🎯 ESTE SCRIPT:
-- Regenera slots para los próximos 30 días
-- Para TODOS los restaurantes activos
-- Respeta días con reservas (no los toca)

-- ⚠️ ADVERTENCIA:
-- Este proceso puede tardar 1-2 minutos
-- NO interrumpas la ejecución

-- =====================================================
-- REGENERAR PRÓXIMOS 30 DÍAS
-- =====================================================

DO $$
DECLARE
    v_restaurant RECORD;
    v_result JSONB;
    v_total_created INTEGER := 0;
    v_total_deleted INTEGER := 0;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'REGENERANDO PRÓXIMOS 30 DÍAS';
    RAISE NOTICE 'Fecha inicio: %', CURRENT_DATE;
    RAISE NOTICE 'Fecha fin: %', CURRENT_DATE + INTERVAL '30 days';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    
    FOR v_restaurant IN 
        SELECT id, name 
        FROM restaurants 
        WHERE active = true
        ORDER BY name
    LOOP
        RAISE NOTICE '🏪 Procesando: %', v_restaurant.name;
        
        -- Regenerar
        SELECT cleanup_and_regenerate_availability(
            v_restaurant.id,
            CURRENT_DATE,
            CURRENT_DATE + INTERVAL '30 days'
        ) INTO v_result;
        
        v_total_created := v_total_created + (v_result->>'slots_created')::INTEGER;
        v_total_deleted := v_total_deleted + (v_result->>'slots_deleted')::INTEGER;
        
        RAISE NOTICE '   ✅ Slots creados: %', v_result->>'slots_created';
        RAISE NOTICE '   🧹 Slots eliminados: %', v_result->>'slots_deleted';
        RAISE NOTICE '   🛡️ Días protegidos: %', v_result->>'days_protected';
        RAISE NOTICE '';
    END LOOP;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ REGENERACIÓN COMPLETADA';
    RAISE NOTICE '📊 TOTAL slots creados: %', v_total_created;
    RAISE NOTICE '🧹 TOTAL slots eliminados: %', v_total_deleted;
    RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- VERIFICAR RESULTADOS
-- =====================================================

-- Resumen por restaurante
SELECT 
    r.name as restaurante,
    COUNT(a.id) as total_slots_generados,
    COUNT(DISTINCT a.slot_date) as dias_con_slots,
    MIN(a.slot_date) as primer_dia,
    MAX(a.slot_date) as ultimo_dia
FROM restaurants r
LEFT JOIN availability_slots a ON r.id = a.restaurant_id
    AND a.slot_date >= CURRENT_DATE
    AND a.slot_date <= CURRENT_DATE + INTERVAL '30 days'
    AND a.status = 'free'
WHERE r.active = true
GROUP BY r.id, r.name
ORDER BY r.name;

-- =====================================================
-- VERIFICAR ÚLTIMO SLOT DE HOY
-- =====================================================

WITH ultimo_slot AS (
    SELECT 
        restaurant_id,
        MAX(start_time) as max_start_time
    FROM availability_slots
    WHERE slot_date = CURRENT_DATE
      AND status = 'free'
    GROUP BY restaurant_id
)
SELECT 
    r.name as restaurante,
    a.start_time as ultimo_slot_inicio,
    a.end_time as ultimo_slot_fin,
    COUNT(*) as mesas_disponibles
FROM ultimo_slot u
JOIN restaurants r ON u.restaurant_id = r.id
JOIN availability_slots a ON a.restaurant_id = u.restaurant_id
    AND a.start_time = u.max_start_time
    AND a.slot_date = CURRENT_DATE
    AND a.status = 'free'
WHERE r.active = true
GROUP BY r.name, a.start_time, a.end_time
ORDER BY r.name;

-- =====================================================
-- ✅ RESULTADO ESPERADO:
-- - Cientos de slots creados
-- - Último slot coincide con hora de cierre
-- - Días con reservas NO modificados (protegidos)
-- =====================================================


