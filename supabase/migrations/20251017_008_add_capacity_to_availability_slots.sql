-- =====================================================
-- AGREGAR CAPACITY Y TABLE_NAME A AVAILABILITY_SLOTS
-- Fecha: 17 Octubre 2025
-- Objetivo: Eliminar necesidad de JOIN con tables en consultas
-- NORMA 1: Ajuste quirúrgico - Solo 2 columnas
-- NORMA 2: Datos reales - Copiados desde tables
-- NORMA 3: Multi-tenant - Respeta restaurant_id
-- NORMA 4: Esquema verificado - tables.capacity y tables.name existen
-- =====================================================

-- ===== PASO 1: AGREGAR COLUMNAS =====

ALTER TABLE availability_slots 
ADD COLUMN IF NOT EXISTS capacity INTEGER;

COMMENT ON COLUMN availability_slots.capacity IS 
'Capacidad de la mesa (copiado desde tables.capacity al generar slot)';

ALTER TABLE availability_slots 
ADD COLUMN IF NOT EXISTS table_name TEXT;

COMMENT ON COLUMN availability_slots.table_name IS 
'Nombre de la mesa (copiado desde tables.name al generar slot)';

-- ===== PASO 2: BACKFILL - COPIAR DATOS DESDE TABLES =====

UPDATE availability_slots AS a
SET 
  capacity = t.capacity,
  table_name = t.name
FROM tables AS t
WHERE a.table_id = t.id
  AND (a.capacity IS NULL OR a.table_name IS NULL);

-- Log de resultados
DO $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE '✅ Backfill completado: % slots actualizados con capacity y table_name', v_updated_count;
END $$;

-- ===== PASO 3: ESTABLECER NOT NULL (después de backfill) =====

-- Verificar que no hay NULLs antes de aplicar NOT NULL
DO $$
DECLARE
  v_nulls_capacity INTEGER;
  v_nulls_table_name INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_nulls_capacity 
  FROM availability_slots 
  WHERE capacity IS NULL;
  
  SELECT COUNT(*) INTO v_nulls_table_name 
  FROM availability_slots 
  WHERE table_name IS NULL;
  
  IF v_nulls_capacity > 0 THEN
    RAISE WARNING '⚠️ HAY % slots sin capacity - NO se aplicará NOT NULL', v_nulls_capacity;
  ELSE
    ALTER TABLE availability_slots ALTER COLUMN capacity SET NOT NULL;
    RAISE NOTICE '✅ Columna capacity ahora es NOT NULL';
  END IF;
  
  IF v_nulls_table_name > 0 THEN
    RAISE WARNING '⚠️ HAY % slots sin table_name - NO se aplicará NOT NULL', v_nulls_table_name;
  ELSE
    ALTER TABLE availability_slots ALTER COLUMN table_name SET NOT NULL;
    RAISE NOTICE '✅ Columna table_name ahora es NOT NULL';
  END IF;
END $$;

-- ===== PASO 4: CREAR ÍNDICE PARA BÚSQUEDAS POR CAPACIDAD =====

CREATE INDEX IF NOT EXISTS idx_availability_slots_capacity 
ON availability_slots(restaurant_id, slot_date, capacity, status)
WHERE status = 'free';

COMMENT ON INDEX idx_availability_slots_capacity IS 
'Índice optimizado para búsqueda de disponibilidad por capacidad mínima';

-- ===== PASO 5: VERIFICACIÓN POST-MIGRACIÓN =====

DO $$
DECLARE
  v_total_slots INTEGER;
  v_slots_con_capacity INTEGER;
  v_slots_sin_capacity INTEGER;
  v_capacity_min INTEGER;
  v_capacity_max INTEGER;
  v_capacity_avg NUMERIC;
BEGIN
  SELECT COUNT(*) INTO v_total_slots FROM availability_slots;
  SELECT COUNT(*) INTO v_slots_con_capacity FROM availability_slots WHERE capacity IS NOT NULL;
  SELECT COUNT(*) INTO v_slots_sin_capacity FROM availability_slots WHERE capacity IS NULL;
  SELECT MIN(capacity) INTO v_capacity_min FROM availability_slots;
  SELECT MAX(capacity) INTO v_capacity_max FROM availability_slots;
  SELECT AVG(capacity) INTO v_capacity_avg FROM availability_slots;
  
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '📊 VERIFICACIÓN: CAPACITY EN AVAILABILITY_SLOTS';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '✅ Total slots: %', v_total_slots;
  RAISE NOTICE '✅ Slots con capacity: %', v_slots_con_capacity;
  RAISE NOTICE '⚠️  Slots sin capacity: %', v_slots_sin_capacity;
  RAISE NOTICE '📊 Capacidad mínima: % personas', v_capacity_min;
  RAISE NOTICE '📊 Capacidad máxima: % personas', v_capacity_max;
  RAISE NOTICE '📊 Capacidad promedio: % personas', ROUND(v_capacity_avg, 2);
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  
  IF v_slots_sin_capacity > 0 THEN
    RAISE WARNING '⚠️ ADVERTENCIA: Hay % slots sin capacity', v_slots_sin_capacity;
  ELSE
    RAISE NOTICE '✅ MIGRACIÓN EXITOSA: Todos los slots tienen capacity';
  END IF;
END $$;

-- ===== ROLLBACK (comentado por seguridad) =====
-- Si necesitas revertir esta migración, ejecuta:
/*
BEGIN;

-- Eliminar índice
DROP INDEX IF EXISTS idx_availability_slots_capacity;

-- Eliminar columnas
ALTER TABLE availability_slots DROP COLUMN IF EXISTS capacity;
ALTER TABLE availability_slots DROP COLUMN IF EXISTS table_name;

COMMIT;
*/

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================


