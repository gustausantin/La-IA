-- =====================================================
-- SCRIPT DE VERIFICACIÓN: Configuración de Zonas
-- Fecha: 19 Octubre 2025
-- Propósito: Verificar que la configuración de zonas
--           se guardó correctamente en businesses.settings
-- =====================================================

-- =====================================================
-- 1. VER CONFIGURACIÓN ACTUAL DE ZONAS POR RESTAURANTE
-- =====================================================

SELECT 
    id AS restaurant_id,
    name AS restaurant_name,
    settings->'zones' AS zones_config,
    settings->>'default_zone' AS default_zone,
    
    -- ✅ Contar cuántas zonas están activas
    (
        SELECT COUNT(*)
        FROM jsonb_object_keys(settings->'zones') AS zone_key
        WHERE (settings->'zones'->zone_key->>'enabled')::BOOLEAN = TRUE
    ) AS zonas_activas,
    
    -- 📋 Listar nombres de zonas activas
    (
        SELECT string_agg(zone_key, ', ')
        FROM jsonb_object_keys(settings->'zones') AS zone_key
        WHERE (settings->'zones'->zone_key->>'enabled')::BOOLEAN = TRUE
    ) AS zonas_activas_nombres,
    
    updated_at
FROM businesses
WHERE active = TRUE
ORDER BY name;

-- =====================================================
-- 2. DETALLE DE CADA ZONA POR RESTAURANTE
-- =====================================================

SELECT 
    r.name AS restaurant_name,
    zone_key AS zona,
    (r.settings->'zones'->zone_key->>'display_name')::TEXT AS nombre_visual,
    (r.settings->'zones'->zone_key->>'enabled')::BOOLEAN AS activa,
    (r.settings->'zones'->zone_key->>'icon')::TEXT AS icono,
    (r.settings->'zones'->zone_key->>'description')::TEXT AS descripcion,
    (r.settings->'zones'->zone_key->>'sort_order')::INTEGER AS orden
FROM businesses r,
     LATERAL jsonb_object_keys(r.settings->'zones') AS zone_key
WHERE r.active = TRUE
ORDER BY r.name, (r.settings->'zones'->zone_key->>'sort_order')::INTEGER;

-- =====================================================
-- 3. MESAS POR ZONA (VERIFICAR COHERENCIA)
-- =====================================================

SELECT 
    r.name AS restaurant_name,
    t.zone AS zona_mesa,
    COUNT(*) AS cantidad_mesas,
    
    -- ✅ Verificar si la zona está activa en la configuración
    CASE 
        WHEN (r.settings->'zones'->t.zone::TEXT->>'enabled')::BOOLEAN = TRUE THEN '✅ Activa'
        WHEN r.settings->'zones'->t.zone::TEXT IS NULL THEN '⚠️ No configurada'
        ELSE '❌ Inactiva'
    END AS estado_zona
FROM businesses r
JOIN tables t ON t.restaurant_id = r.id
WHERE r.active = TRUE
  AND t.is_active = TRUE
GROUP BY r.name, t.zone, r.settings->'zones'->t.zone::TEXT
ORDER BY r.name, t.zone;

-- =====================================================
-- 4. ALERTAS: MESAS EN ZONAS INACTIVAS
-- =====================================================

SELECT 
    r.name AS restaurant_name,
    t.table_number AS mesa,
    t.name AS nombre_mesa,
    t.zone AS zona,
    t.capacity AS capacidad,
    '⚠️ ALERTA: Mesa en zona INACTIVA' AS advertencia
FROM businesses r
JOIN tables t ON t.restaurant_id = r.id
WHERE r.active = TRUE
  AND t.is_active = TRUE
  AND r.settings ? 'zones'
  AND (r.settings->'zones'->t.zone::TEXT->>'enabled')::BOOLEAN = FALSE
ORDER BY r.name, t.zone, t.table_number;

-- =====================================================
-- 5. ALERTAS: MESAS EN ZONAS NO CONFIGURADAS
-- =====================================================

SELECT 
    r.name AS restaurant_name,
    t.table_number AS mesa,
    t.name AS nombre_mesa,
    t.zone AS zona,
    t.capacity AS capacidad,
    '⚠️ ALERTA: Zona NO configurada en settings' AS advertencia
FROM businesses r
JOIN tables t ON t.restaurant_id = r.id
WHERE r.active = TRUE
  AND t.is_active = TRUE
  AND (r.settings->'zones'->t.zone::TEXT IS NULL OR NOT (r.settings ? 'zones'))
ORDER BY r.name, t.zone, t.table_number;

-- =====================================================
-- 6. RESUMEN GENERAL
-- =====================================================

SELECT 
    r.name AS restaurant_name,
    
    -- Total de zonas configuradas
    (
        SELECT COUNT(*)
        FROM jsonb_object_keys(r.settings->'zones') AS zone_key
    ) AS zonas_configuradas,
    
    -- Zonas activas
    (
        SELECT COUNT(*)
        FROM jsonb_object_keys(r.settings->'zones') AS zone_key
        WHERE (r.settings->'zones'->zone_key->>'enabled')::BOOLEAN = TRUE
    ) AS zonas_activas,
    
    -- Zonas inactivas
    (
        SELECT COUNT(*)
        FROM jsonb_object_keys(r.settings->'zones') AS zone_key
        WHERE (r.settings->'zones'->zone_key->>'enabled')::BOOLEAN = FALSE
    ) AS zonas_inactivas,
    
    -- Total de mesas activas
    (
        SELECT COUNT(*)
        FROM tables t
        WHERE t.restaurant_id = r.id
          AND t.is_active = TRUE
    ) AS mesas_activas,
    
    -- Mesas en zonas activas (coherente)
    (
        SELECT COUNT(*)
        FROM tables t
        WHERE t.restaurant_id = r.id
          AND t.is_active = TRUE
          AND (r.settings->'zones'->t.zone::TEXT->>'enabled')::BOOLEAN = TRUE
    ) AS mesas_en_zonas_activas,
    
    -- Mesas en zonas inactivas (⚠️ PROBLEMA)
    (
        SELECT COUNT(*)
        FROM tables t
        WHERE t.restaurant_id = r.id
          AND t.is_active = TRUE
          AND (r.settings->'zones'->t.zone::TEXT->>'enabled')::BOOLEAN = FALSE
    ) AS mesas_en_zonas_inactivas,
    
    -- Zona por defecto
    r.settings->>'default_zone' AS zona_defecto
    
FROM businesses r
WHERE r.active = TRUE
ORDER BY r.name;

-- =====================================================
-- 7. FUNCIÓN HELPER: Obtener solo zonas activas
-- =====================================================

-- Esta función ya fue creada en la migración
-- Ejemplo de uso:
/*
SELECT * FROM get_active_zones('tu-restaurant-uuid-aqui');
*/

-- =====================================================
-- FIN DEL SCRIPT DE VERIFICACIÓN
-- =====================================================

-- 💡 TIPS DE USO:
--
-- 1. Ejecuta todo el script para ver un diagnóstico completo
-- 2. Si ves alertas en la sección 4 o 5, revisa la configuración
-- 3. La sección 6 te da un resumen rápido del estado
-- 4. Usa get_active_zones(restaurant_id) para obtener solo zonas activas

