-- =====================================================
-- MIGRACIÓN: Configuración de Zonas Disponibles
-- Fecha: 19 Octubre 2025
-- Propósito: Añadir configuración de zonas a businesses.settings
-- =====================================================

-- =====================================================
-- PASO 1: FUNCIÓN HELPER PARA GENERAR CONFIGURACIÓN
-- =====================================================

CREATE OR REPLACE FUNCTION generate_zones_config_for_restaurant(p_restaurant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_zones_in_use TEXT[];
    v_zones_config JSONB := '{}'::JSONB;
    v_default_zone TEXT;
    v_zone_counts JSONB;
    v_zone TEXT;
    v_zone_info JSONB;
BEGIN
    -- 1. Obtener zonas REALES que existen en tables para este restaurante
    SELECT ARRAY_AGG(DISTINCT zone ORDER BY zone)
    INTO v_zones_in_use
    FROM tables
    WHERE restaurant_id = p_restaurant_id
      AND is_active = TRUE
      AND zone IS NOT NULL
      AND zone != '';
    
    -- Si no hay zonas definidas, usar "interior" por defecto
    IF v_zones_in_use IS NULL OR array_length(v_zones_in_use, 1) = 0 THEN
        v_zones_in_use := ARRAY['interior'];
    END IF;
    
    RAISE NOTICE '🗺️ Restaurante %: Zonas detectadas: %', p_restaurant_id, v_zones_in_use;
    
    -- 2. Obtener conteos por zona (para determinar la más común)
    SELECT jsonb_object_agg(zone, cnt)
    INTO v_zone_counts
    FROM (
        SELECT zone, COUNT(*) as cnt
        FROM tables
        WHERE restaurant_id = p_restaurant_id
          AND is_active = TRUE
          AND zone IS NOT NULL
        GROUP BY zone
        ORDER BY cnt DESC
    ) counts;
    
    -- 3. Determinar zona por defecto (la más común)
    SELECT zone INTO v_default_zone
    FROM tables
    WHERE restaurant_id = p_restaurant_id
      AND is_active = TRUE
      AND zone IS NOT NULL
    GROUP BY zone
    ORDER BY COUNT(*) DESC
    LIMIT 1;
    
    -- Fallback si no hay zonas
    IF v_default_zone IS NULL THEN
        v_default_zone := 'interior';
    END IF;
    
    RAISE NOTICE '📍 Zona por defecto: % (más común)', v_default_zone;
    
    -- 4. Generar configuración para las 4 zonas estándar
    -- Solo marcar como enabled=true las que existen realmente
    
    -- INTERIOR
    v_zone_info := jsonb_build_object(
        'enabled', 'interior' = ANY(v_zones_in_use),
        'display_name', 'Interior',
        'description', 'Zona principal del restaurante',
        'icon', '🏠',
        'sort_order', 1
    );
    v_zones_config := v_zones_config || jsonb_build_object('interior', v_zone_info);
    
    -- TERRAZA
    v_zone_info := jsonb_build_object(
        'enabled', 'terraza' = ANY(v_zones_in_use),
        'display_name', 'Terraza',
        'description', 'Zona al aire libre',
        'icon', '☀️',
        'sort_order', 2
    );
    v_zones_config := v_zones_config || jsonb_build_object('terraza', v_zone_info);
    
    -- BARRA
    v_zone_info := jsonb_build_object(
        'enabled', 'barra' = ANY(v_zones_in_use),
        'display_name', 'Barra',
        'description', 'Mesas en la zona de barra',
        'icon', '🍷',
        'sort_order', 3
    );
    v_zones_config := v_zones_config || jsonb_build_object('barra', v_zone_info);
    
    -- PRIVADO
    v_zone_info := jsonb_build_object(
        'enabled', 'privado' = ANY(v_zones_in_use),
        'display_name', 'Sala Privada',
        'description', 'Sala privada o reservada',
        'icon', '🚪',
        'sort_order', 4
    );
    v_zones_config := v_zones_config || jsonb_build_object('privado', v_zone_info);
    
    -- 5. Añadir zonas adicionales que no son estándar (si existen)
    FOREACH v_zone IN ARRAY v_zones_in_use
    LOOP
        IF v_zone NOT IN ('interior', 'terraza', 'barra', 'privado') THEN
            RAISE NOTICE '⚠️ Zona no estándar detectada: "%"', v_zone;
            v_zone_info := jsonb_build_object(
                'enabled', true,
                'display_name', INITCAP(v_zone),
                'description', 'Zona personalizada',
                'icon', '📍',
                'sort_order', 10
            );
            v_zones_config := v_zones_config || jsonb_build_object(v_zone, v_zone_info);
        END IF;
    END LOOP;
    
    -- 6. Retornar configuración completa
    RETURN jsonb_build_object(
        'zones', v_zones_config,
        'default_zone', v_default_zone
    );
    
END;
$$;

COMMENT ON FUNCTION generate_zones_config_for_restaurant IS 
'Genera configuración de zonas basada en datos REALES de la tabla tables.
Solo marca como enabled=true las zonas que existen actualmente.
Detecta la zona más común y la establece como default.';

-- =====================================================
-- PASO 2: APLICAR CONFIGURACIÓN A TODOS LOS RESTAURANTES
-- =====================================================

DO $$
DECLARE
    v_restaurant RECORD;
    v_zones_config JSONB;
    v_current_settings JSONB;
    v_updated_settings JSONB;
    v_total_businesses INTEGER := 0;
    v_updated_businesses INTEGER := 0;
    v_skipped_businesses INTEGER := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '🚀 INICIANDO MIGRACIÓN: Configuración de Zonas';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '';
    
    -- Iterar sobre todos los restaurantes activos
    FOR v_restaurant IN 
        SELECT id, name, settings
        FROM businesses
        WHERE active = TRUE
        ORDER BY name
    LOOP
        v_total_businesses := v_total_businesses + 1;
        
        RAISE NOTICE '📍 Procesando: % (ID: %)', v_restaurant.name, v_restaurant.id;
        
        -- Obtener settings actuales
        v_current_settings := COALESCE(v_restaurant.settings, '{}'::JSONB);
        
        -- Verificar si ya tiene configuración de zonas
        IF v_current_settings ? 'zones' THEN
            RAISE NOTICE '⏭️  Ya tiene configuración de zonas, SALTANDO';
            v_skipped_businesses := v_skipped_businesses + 1;
            CONTINUE;
        END IF;
        
        -- Generar configuración de zonas basada en datos reales
        BEGIN
            v_zones_config := generate_zones_config_for_restaurant(v_restaurant.id);
            
            -- Fusionar con settings existentes
            v_updated_settings := v_current_settings || v_zones_config;
            
            -- Actualizar en BD
            UPDATE businesses
            SET 
                settings = v_updated_settings,
                updated_at = NOW()
            WHERE id = v_restaurant.id;
            
            RAISE NOTICE '✅ Zonas configuradas: %', 
                (SELECT string_agg(key, ', ')
                 FROM jsonb_object_keys(v_zones_config->'zones') AS key
                 WHERE (v_zones_config->'zones'->key->>'enabled')::BOOLEAN = TRUE);
            RAISE NOTICE '📍 Zona por defecto: %', v_zones_config->>'default_zone';
            RAISE NOTICE '';
            
            v_updated_businesses := v_updated_businesses + 1;
            
        EXCEPTION
            WHEN OTHERS THEN
                RAISE WARNING '❌ Error procesando restaurante %: %', v_restaurant.id, SQLERRM;
                v_skipped_businesses := v_skipped_businesses + 1;
        END;
    END LOOP;
    
    -- Resumen final
    RAISE NOTICE '';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '🎉 MIGRACIÓN COMPLETADA';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '📊 Total restaurantes: %', v_total_businesses;
    RAISE NOTICE '✅ Actualizados: %', v_updated_businesses;
    RAISE NOTICE '⏭️  Saltados (ya configurados): %', v_skipped_businesses;
    RAISE NOTICE '';
    RAISE NOTICE '🔍 VERIFICACIÓN:';
    RAISE NOTICE '   SELECT name, settings->''zones'', settings->''default_zone''';
    RAISE NOTICE '   FROM businesses WHERE active = TRUE;';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '';
    
END;
$$;

-- =====================================================
-- PASO 3: CREAR FUNCIÓN HELPER PARA OBTENER ZONAS ACTIVAS
-- =====================================================

CREATE OR REPLACE FUNCTION get_active_zones(p_restaurant_id UUID)
RETURNS TABLE(
    zone_key TEXT,
    display_name TEXT,
    icon TEXT,
    description TEXT,
    sort_order INTEGER
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_settings JSONB;
    v_zones JSONB;
BEGIN
    -- Obtener configuración de zonas
    SELECT settings INTO v_settings
    FROM businesses
    WHERE id = p_restaurant_id;
    
    IF v_settings IS NULL OR NOT (v_settings ? 'zones') THEN
        -- Retornar vacío si no hay configuración
        RETURN;
    END IF;
    
    v_zones := v_settings->'zones';
    
    -- Retornar solo zonas habilitadas
    RETURN QUERY
    SELECT 
        key::TEXT AS zone_key,
        (v_zones->key->>'display_name')::TEXT AS display_name,
        (v_zones->key->>'icon')::TEXT AS icon,
        (v_zones->key->>'description')::TEXT AS description,
        COALESCE((v_zones->key->>'sort_order')::INTEGER, 999) AS sort_order
    FROM jsonb_object_keys(v_zones) AS key
    WHERE (v_zones->key->>'enabled')::BOOLEAN = TRUE
    ORDER BY COALESCE((v_zones->key->>'sort_order')::INTEGER, 999), key;
    
END;
$$;

COMMENT ON FUNCTION get_active_zones IS 
'Obtiene solo las zonas ACTIVAS (enabled=true) de un restaurante.
Retorna lista ordenada por sort_order.
Uso: SELECT * FROM get_active_zones(''restaurant-uuid-here'');';

GRANT EXECUTE ON FUNCTION get_active_zones(UUID) TO authenticated, anon;

-- =====================================================
-- PASO 4: VALIDAR MIGRACIÓN
-- =====================================================

DO $$
DECLARE
    v_businesses_without_zones INTEGER;
    v_businesses_with_zones INTEGER;
    v_total_zones_enabled INTEGER;
BEGIN
    -- Contar restaurantes sin configuración de zonas
    SELECT COUNT(*)
    INTO v_businesses_without_zones
    FROM businesses
    WHERE active = TRUE
      AND (settings IS NULL OR NOT (settings ? 'zones'));
    
    -- Contar restaurantes con configuración de zonas
    SELECT COUNT(*)
    INTO v_businesses_with_zones
    FROM businesses
    WHERE active = TRUE
      AND settings ? 'zones';
    
    -- Contar total de zonas habilitadas
    SELECT COUNT(*)
    INTO v_total_zones_enabled
    FROM businesses,
         LATERAL jsonb_object_keys(settings->'zones') AS zone_key
    WHERE active = TRUE
      AND settings ? 'zones'
      AND (settings->'zones'->zone_key->>'enabled')::BOOLEAN = TRUE;
    
    RAISE NOTICE '';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '🔍 VALIDACIÓN POST-MIGRACIÓN';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '✅ Restaurantes CON zonas configuradas: %', v_businesses_with_zones;
    RAISE NOTICE '⚠️  Restaurantes SIN zonas configuradas: %', v_businesses_without_zones;
    RAISE NOTICE '📊 Total de zonas habilitadas: %', v_total_zones_enabled;
    RAISE NOTICE '';
    
    IF v_businesses_without_zones > 0 THEN
        RAISE WARNING '⚠️ Algunos restaurantes no tienen configuración de zonas.';
        RAISE NOTICE '   Ejecuta: SELECT id, name FROM businesses WHERE active = TRUE AND (settings IS NULL OR NOT (settings ? ''zones''));';
    ELSE
        RAISE NOTICE '🎉 ¡TODOS los restaurantes activos tienen configuración de zonas!';
    END IF;
    
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '';
    
END;
$$;

-- =====================================================
-- PASO 5: EJEMPLO DE USO
-- =====================================================

-- Comentado para no ejecutar automáticamente
/*
-- Ver configuración de zonas de un restaurante
SELECT 
    name,
    settings->'zones' AS zones_config,
    settings->>'default_zone' AS default_zone
FROM businesses
WHERE active = TRUE
LIMIT 1;

-- Ver solo zonas activas usando la función helper
SELECT * FROM get_active_zones('tu-restaurant-id-aqui');

-- Ver resumen de todas las configuraciones
SELECT 
    r.name,
    (SELECT COUNT(*) 
     FROM jsonb_object_keys(r.settings->'zones') AS zk
     WHERE (r.settings->'zones'->zk->>'enabled')::BOOLEAN = TRUE
    ) AS zonas_activas,
    r.settings->>'default_zone' AS zona_defecto
FROM businesses r
WHERE r.active = TRUE
ORDER BY r.name;
*/

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================

