-- =====================================================
-- AGREGAR ZONA A AVAILABILITY_SLOTS
-- Fecha: 17 Octubre 2025
-- Objetivo: Permitir zonas dinámicas por slot (terraza mañana, interior noche)
-- =====================================================

-- ===== PASO 1: AGREGAR COLUMNA ZONE =====
-- Agregar columna zone con el tipo ENUM zone_type

ALTER TABLE availability_slots 
ADD COLUMN IF NOT EXISTS zone zone_type;

COMMENT ON COLUMN availability_slots.zone IS 'Zona de la mesa para este slot (puede cambiar dinámicamente)';

-- ===== PASO 2: BACKFILL - COPIAR DESDE TABLES =====
-- Rellenar zona existente copiando desde la tabla tables

UPDATE availability_slots AS als
SET zone = t.zone
FROM tables AS t
WHERE als.table_id = t.id
  AND als.zone IS NULL;  -- Solo actualizar si aún no tiene valor

-- Log de cambios
DO $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE '✅ Backfill completado: % slots actualizados con zona desde tables', v_updated_count;
END $$;

-- ===== PASO 3: ESTABLECER DEFAULT Y NOT NULL =====
-- Asegurar que todos los slots futuros tengan zona

ALTER TABLE availability_slots 
ALTER COLUMN zone SET DEFAULT 'interior'::zone_type;

ALTER TABLE availability_slots 
ALTER COLUMN zone SET NOT NULL;

-- ===== PASO 4: CREAR ÍNDICE OPTIMIZADO =====
-- Índice compuesto para consultas de disponibilidad por zona

CREATE INDEX IF NOT EXISTS idx_availability_slots_zone_search 
ON availability_slots(restaurant_id, slot_date, start_time, zone, status)
WHERE status = 'free';

COMMENT ON INDEX idx_availability_slots_zone_search IS 'Índice optimizado para check_availability con filtro de zona';

-- ===== PASO 5: VERIFICACIÓN POST-MIGRACIÓN =====
-- Verificar que todos los valores se copiaron correctamente

DO $$
DECLARE
  v_total_slots INTEGER;
  v_slots_con_zona INTEGER;
  v_slots_sin_zona INTEGER;
  v_interior INTEGER;
  v_terraza INTEGER;
  v_barra INTEGER;
  v_privado INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_slots FROM availability_slots;
  SELECT COUNT(*) INTO v_slots_con_zona FROM availability_slots WHERE zone IS NOT NULL;
  SELECT COUNT(*) INTO v_slots_sin_zona FROM availability_slots WHERE zone IS NULL;
  SELECT COUNT(*) INTO v_interior FROM availability_slots WHERE zone = 'interior';
  SELECT COUNT(*) INTO v_terraza FROM availability_slots WHERE zone = 'terraza';
  SELECT COUNT(*) INTO v_barra FROM availability_slots WHERE zone = 'barra';
  SELECT COUNT(*) INTO v_privado FROM availability_slots WHERE zone = 'privado';
  
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '📊 VERIFICACIÓN DE ZONAS EN AVAILABILITY_SLOTS';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '✅ Total slots: %', v_total_slots;
  RAISE NOTICE '✅ Slots con zona: %', v_slots_con_zona;
  RAISE NOTICE '⚠️  Slots sin zona: %', v_slots_sin_zona;
  RAISE NOTICE '🏠 Interior: % slots', v_interior;
  RAISE NOTICE '☀️ Terraza: % slots', v_terraza;
  RAISE NOTICE '🍷 Barra: % slots', v_barra;
  RAISE NOTICE '🚪 Privado: % slots', v_privado;
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  
  -- Validar que no hay slots sin zona
  IF v_slots_sin_zona > 0 THEN
    RAISE WARNING '⚠️ ADVERTENCIA: Hay % slots sin zona asignada', v_slots_sin_zona;
  ELSE
    RAISE NOTICE '✅ MIGRACIÓN EXITOSA: Todos los slots tienen zona asignada';
  END IF;
END $$;

-- ===== ROLLBACK (comentado por seguridad) =====
-- Si necesitas revertir esta migración, ejecuta:
/*
BEGIN;

-- Eliminar índice
DROP INDEX IF EXISTS idx_availability_slots_zone_search;

-- Eliminar columna
ALTER TABLE availability_slots DROP COLUMN IF EXISTS zone;

COMMIT;
*/

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================

