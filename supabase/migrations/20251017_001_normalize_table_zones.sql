-- =====================================================
-- NORMALIZACIÓN DE ZONAS EN TABLES
-- Fecha: 17 Octubre 2025
-- Objetivo: Estandarizar zonas a 4 valores (interior, terraza, barra, privado)
-- =====================================================

-- ===== PASO 1: BACKUP DE SEGURIDAD =====
-- Crear tabla temporal con valores actuales (por si necesitamos rollback)
CREATE TABLE IF NOT EXISTS tables_zones_backup AS
SELECT id, restaurant_id, zone, updated_at
FROM tables
WHERE restaurant_id IS NOT NULL;

COMMENT ON TABLE tables_zones_backup IS 'Backup de zonas antes de normalización (17-Oct-2025)';

-- ===== PASO 2: NORMALIZAR VALORES EXISTENTES =====
-- Convertir todos los valores actuales a los 4 estándares

UPDATE tables
SET zone = CASE
  -- Terraza y variantes
  WHEN zone ILIKE '%terraza%' THEN 'terraza'
  WHEN zone ILIKE '%exterior%' THEN 'terraza'
  WHEN zone = 'Terraza' THEN 'terraza'
  WHEN zone = 'Exterior' THEN 'terraza'
  
  -- Privado y variantes
  WHEN zone ILIKE '%privado%' THEN 'privado'
  WHEN zone ILIKE '%vip%' THEN 'privado'
  WHEN zone ILIKE '%reserv%' THEN 'privado'
  WHEN zone = 'Privado' THEN 'privado'
  WHEN zone = 'VIP' THEN 'privado'
  WHEN zone = 'Zona VIP' THEN 'privado'
  WHEN zone ILIKE '%sala%' THEN 'privado'
  
  -- Barra
  WHEN zone ILIKE '%barra%' THEN 'barra'
  WHEN zone = 'Barra' THEN 'barra'
  
  -- Interior y todo lo demás (default)
  WHEN zone ILIKE '%interior%' THEN 'interior'
  WHEN zone ILIKE '%sal%n%' THEN 'interior'
  WHEN zone = 'Salón principal' THEN 'interior'
  WHEN zone = 'Salón secundario' THEN 'interior'
  WHEN zone = 'main' THEN 'interior'
  WHEN zone = 'Main' THEN 'interior'
  WHEN zone = 'Otros' THEN 'interior'
  
  -- Default para cualquier otro valor
  ELSE 'interior'
END
WHERE restaurant_id IS NOT NULL;

-- Log de cambios
DO $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE '✅ Normalizadas % filas en tables.zone', v_updated_count;
END $$;

-- ===== PASO 3: CREAR ENUM DE ZONAS =====
-- Crear tipo enumerado con los 4 valores estándar

CREATE TYPE zone_type AS ENUM ('interior', 'terraza', 'barra', 'privado');

COMMENT ON TYPE zone_type IS 'Tipos de zona disponibles: interior, terraza, barra, privado';

-- ===== PASO 4: ELIMINAR DEFAULT ANTES DE CAMBIAR TIPO =====
-- Necesario para evitar error de cast del default

ALTER TABLE tables 
ALTER COLUMN zone DROP DEFAULT;

-- ===== PASO 5: CONVERTIR COLUMNA A ENUM =====
-- Cambiar el tipo de la columna zone de VARCHAR a ENUM

ALTER TABLE tables 
ALTER COLUMN zone TYPE zone_type USING zone::zone_type;

-- ===== PASO 6: ESTABLECER NUEVO DEFAULT Y NOT NULL =====
-- Asegurar que todas las mesas nuevas tengan zona por defecto

ALTER TABLE tables 
ALTER COLUMN zone SET DEFAULT 'interior'::zone_type;

ALTER TABLE tables 
ALTER COLUMN zone SET NOT NULL;

-- ===== PASO 7: CREAR ÍNDICE PARA CONSULTAS =====
-- Optimizar consultas que filtren por zona

CREATE INDEX IF NOT EXISTS idx_tables_zone 
ON tables(restaurant_id, zone) 
WHERE is_active = true;

COMMENT ON INDEX idx_tables_zone IS 'Índice para consultas de mesas por zona (usado por check_availability)';

-- ===== PASO 8: VERIFICACIÓN POST-MIGRACIÓN =====
-- Verificar que todos los valores se convirtieron correctamente

DO $$
DECLARE
  v_total_tables INTEGER;
  v_interior INTEGER;
  v_terraza INTEGER;
  v_barra INTEGER;
  v_privado INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_tables FROM tables WHERE restaurant_id IS NOT NULL;
  SELECT COUNT(*) INTO v_interior FROM tables WHERE zone = 'interior';
  SELECT COUNT(*) INTO v_terraza FROM tables WHERE zone = 'terraza';
  SELECT COUNT(*) INTO v_barra FROM tables WHERE zone = 'barra';
  SELECT COUNT(*) INTO v_privado FROM tables WHERE zone = 'privado';
  
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '📊 VERIFICACIÓN DE ZONAS';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '✅ Total mesas: %', v_total_tables;
  RAISE NOTICE '🏠 Interior: % mesas', v_interior;
  RAISE NOTICE '☀️ Terraza: % mesas', v_terraza;
  RAISE NOTICE '🍷 Barra: % mesas', v_barra;
  RAISE NOTICE '🚪 Privado: % mesas', v_privado;
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  
  -- Validar que la suma coincide
  IF (v_interior + v_terraza + v_barra + v_privado) = v_total_tables THEN
    RAISE NOTICE '✅ MIGRACIÓN EXITOSA: Todos los valores se convirtieron correctamente';
  ELSE
    RAISE WARNING '⚠️ ADVERTENCIA: Hay discrepancia en los conteos';
  END IF;
END $$;

-- ===== ROLLBACK (comentado por seguridad) =====
-- Si necesitas revertir esta migración, ejecuta:
/*
BEGIN;

-- Volver a VARCHAR
ALTER TABLE tables ALTER COLUMN zone TYPE varchar USING zone::varchar;

-- Restaurar valores originales desde backup
UPDATE tables t
SET zone = b.zone
FROM tables_zones_backup b
WHERE t.id = b.id;

-- Eliminar ENUM
DROP TYPE zone_type;

-- Eliminar índice
DROP INDEX IF EXISTS idx_tables_zone;

-- Eliminar backup
DROP TABLE IF EXISTS tables_zones_backup;

COMMIT;
*/

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================

