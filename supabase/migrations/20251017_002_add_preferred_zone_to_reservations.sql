-- =====================================================
-- AGREGAR PREFERRED_ZONE A RESERVATIONS
-- Fecha: 17 Octubre 2025
-- Objetivo: Permitir guardar preferencia de zona del cliente en reservas
-- =====================================================

-- ===== VERIFICACIÓN PREVIA =====
-- Asegurar que zone_type existe (debe haber sido creado en migración anterior)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'zone_type') THEN
    RAISE EXCEPTION 'ERROR: zone_type no existe. Ejecuta primero 20251017_001_normalize_table_zones.sql';
  END IF;
  RAISE NOTICE '✅ zone_type existe, continuando...';
END $$;

-- ===== PASO 1: AGREGAR COLUMNA preferred_zone =====
-- Agregar columna a reservations usando el ENUM zone_type

ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS preferred_zone zone_type;

COMMENT ON COLUMN reservations.preferred_zone IS 
'Zona preferida por el cliente (interior|terraza|barra|privado). NULL = sin preferencia / asignación automática';

-- ===== PASO 2: CREAR ÍNDICE PARA CONSULTAS =====
-- Índice parcial para consultas de reservas por zona (solo cuando hay preferencia)

CREATE INDEX IF NOT EXISTS idx_reservations_preferred_zone
ON reservations(restaurant_id, preferred_zone, reservation_date)
WHERE preferred_zone IS NOT NULL;

COMMENT ON INDEX idx_reservations_preferred_zone IS 
'Índice para analytics de preferencias de zona por fecha';

-- ===== PASO 3: MIGRAR DATOS LEGACY (OPCIONAL) =====
-- Si hay valores en special_requests que mencionan zonas, podemos extraerlos
-- (Este paso es opcional y conservador - NO modifica special_requests existentes)

DO $$
DECLARE
  v_updated_count INTEGER := 0;
BEGIN
  -- Solo actualizar reservas futuras que mencionan zona explícitamente
  UPDATE reservations
  SET preferred_zone = CASE
    WHEN special_requests ILIKE '%terraza%' THEN 'terraza'::zone_type
    WHEN special_requests ILIKE '%privado%' OR special_requests ILIKE '%privada%' THEN 'privado'::zone_type
    WHEN special_requests ILIKE '%barra%' THEN 'barra'::zone_type
    WHEN special_requests ILIKE '%interior%' THEN 'interior'::zone_type
    ELSE NULL
  END
  WHERE reservation_date >= CURRENT_DATE  -- Solo futuras
    AND preferred_zone IS NULL            -- Solo si no está ya asignado
    AND special_requests IS NOT NULL
    AND special_requests != ''
    AND (
      special_requests ILIKE '%terraza%' OR
      special_requests ILIKE '%privado%' OR
      special_requests ILIKE '%privada%' OR
      special_requests ILIKE '%barra%' OR
      special_requests ILIKE '%interior%'
    );
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  IF v_updated_count > 0 THEN
    RAISE NOTICE '✅ Migradas % reservas futuras con zonas en special_requests', v_updated_count;
  ELSE
    RAISE NOTICE 'ℹ️ No se encontraron reservas futuras con zonas en special_requests';
  END IF;
END $$;

-- ===== PASO 4: ESTADÍSTICAS POST-MIGRACIÓN =====
-- Mostrar distribución actual de zonas en reservas

DO $$
DECLARE
  v_total_reservations INTEGER;
  v_with_zone INTEGER;
  v_without_zone INTEGER;
  v_interior INTEGER;
  v_terraza INTEGER;
  v_barra INTEGER;
  v_privado INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_reservations 
  FROM reservations 
  WHERE reservation_date >= CURRENT_DATE;
  
  SELECT COUNT(*) INTO v_with_zone 
  FROM reservations 
  WHERE reservation_date >= CURRENT_DATE 
    AND preferred_zone IS NOT NULL;
  
  SELECT COUNT(*) INTO v_without_zone 
  FROM reservations 
  WHERE reservation_date >= CURRENT_DATE 
    AND preferred_zone IS NULL;
  
  SELECT COUNT(*) INTO v_interior FROM reservations WHERE preferred_zone = 'interior';
  SELECT COUNT(*) INTO v_terraza FROM reservations WHERE preferred_zone = 'terraza';
  SELECT COUNT(*) INTO v_barra FROM reservations WHERE preferred_zone = 'barra';
  SELECT COUNT(*) INTO v_privado FROM reservations WHERE preferred_zone = 'privado';
  
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '📊 ESTADÍSTICAS DE PREFERRED_ZONE';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '✅ Total reservas futuras: %', v_total_reservations;
  RAISE NOTICE '📍 Con zona preferida: % (%.1f%%)', v_with_zone, (v_with_zone::float / NULLIF(v_total_reservations, 0) * 100);
  RAISE NOTICE '❓ Sin zona (auto): % (%.1f%%)', v_without_zone, (v_without_zone::float / NULLIF(v_total_reservations, 0) * 100);
  RAISE NOTICE '';
  RAISE NOTICE 'Distribución por zona:';
  RAISE NOTICE '  🏠 Interior: %', v_interior;
  RAISE NOTICE '  ☀️ Terraza: %', v_terraza;
  RAISE NOTICE '  🍷 Barra: %', v_barra;
  RAISE NOTICE '  🚪 Privado: %', v_privado;
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END $$;

-- ===== PASO 5: ACTUALIZAR RPC create_reservation_validated (SI EXISTE) =====
-- Verificar si la función RPC existe y actualizarla para soportar preferred_zone

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'create_reservation_validated'
  ) THEN
    RAISE NOTICE '🔧 Actualizando función create_reservation_validated...';
    
    -- Actualizar función para incluir preferred_zone
    CREATE OR REPLACE FUNCTION create_reservation_validated(
      p_restaurant_id UUID,
      p_payload JSONB,
      p_slot_minutes INTEGER DEFAULT 90
    )
    RETURNS JSONB
    SECURITY DEFINER
    LANGUAGE plpgsql
    AS $func$
    DECLARE
      v_date DATE;
      v_time TIME;
      v_party_size INTEGER;
      v_table_id UUID;
      v_status TEXT;
      v_customer_name TEXT;
      v_customer_email TEXT;
      v_customer_phone TEXT;
      v_channel TEXT;
      v_source TEXT;
      v_special_requests TEXT;
      v_notes TEXT;
      v_preferred_zone zone_type;  -- ← NUEVO
      v_from TIME;
      v_to TIME;
      v_conflict RECORD;
      v_inserted reservations%ROWTYPE;
    BEGIN
      -- Extraer campos mínimos
      v_date := (p_payload->>'reservation_date')::DATE;
      v_time := (p_payload->>'reservation_time')::TIME;
      v_party_size := COALESCE((p_payload->>'party_size')::INT, 1);
      v_table_id := NULLIF(p_payload->>'table_id','')::UUID;
      v_status := COALESCE(NULLIF(p_payload->>'status',''), 'pending');
      v_customer_name := p_payload->>'customer_name';
      v_customer_email := p_payload->>'customer_email';
      v_customer_phone := p_payload->>'customer_phone';
      v_channel := COALESCE(NULLIF(p_payload->>'channel',''), 'manual');
      v_source := COALESCE(NULLIF(p_payload->>'source',''), 'manual');
      v_special_requests := p_payload->>'special_requests';
      v_notes := p_payload->>'notes';
      v_preferred_zone := NULLIF(p_payload->>'preferred_zone','')::zone_type;  -- ← NUEVO

      IF v_date IS NULL OR v_time IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'reservation_date y reservation_time son obligatorios');
      END IF;

      -- Validación de conflictos solo si hay mesa asignada
      IF v_table_id IS NOT NULL THEN
        v_from := (v_time - make_interval(mins => p_slot_minutes));
        v_to := (v_time + make_interval(mins => p_slot_minutes));

        SELECT r.* INTO v_conflict
        FROM reservations r
        WHERE r.restaurant_id = p_restaurant_id
          AND r.table_id = v_table_id
          AND r.reservation_date = v_date
          AND r.status IN ('pending','confirmed','seated')
          AND r.reservation_time BETWEEN v_from AND v_to
        LIMIT 1;

        IF FOUND THEN
          RETURN jsonb_build_object(
            'success', false,
            'error', 'Conflicto: la mesa ya está reservada en ese horario',
            'conflict', jsonb_build_object('id', v_conflict.id, 'time', v_conflict.reservation_time)
          );
        END IF;
      END IF;

      -- Insertar (ahora incluye preferred_zone)
      INSERT INTO reservations (
        id, restaurant_id, customer_id, customer_name, customer_email, customer_phone,
        reservation_date, reservation_time, party_size, table_id, table_number, status,
        special_requests, source, channel, notes, preferred_zone, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), p_restaurant_id, NULL, v_customer_name, v_customer_email, v_customer_phone,
        v_date, v_time, v_party_size, v_table_id, NULL, v_status,
        v_special_requests, v_source, v_channel, v_notes, v_preferred_zone, NOW(), NOW()
      ) RETURNING * INTO v_inserted;

      RETURN jsonb_build_object('success', true, 'reservation', to_jsonb(v_inserted));
    END;
    $func$;
    
    RAISE NOTICE '✅ Función create_reservation_validated actualizada con preferred_zone';
  ELSE
    RAISE NOTICE 'ℹ️ Función create_reservation_validated no existe (se creará después si es necesario)';
  END IF;
END $$;

-- ===== ROLLBACK (comentado por seguridad) =====
-- Si necesitas revertir esta migración, ejecuta:
/*
BEGIN;

-- Eliminar columna
ALTER TABLE reservations DROP COLUMN IF EXISTS preferred_zone;

-- Eliminar índice
DROP INDEX IF EXISTS idx_reservations_preferred_zone;

-- Revertir función RPC (si se modificó)
-- (Restaurar desde backup o versión anterior)

COMMIT;
*/

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================

