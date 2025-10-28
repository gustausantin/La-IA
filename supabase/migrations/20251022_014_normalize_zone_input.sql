-- =====================================================
-- MIGRACIÓN: Normalización automática de zonas
-- FECHA: 22 Octubre 2025
-- OBJETIVO: Hacer el RPC robusto ante diferentes formatos
-- =====================================================

-- =====================================================
-- LIMPIEZA COMPLETA: Drop de TODAS las versiones
-- =====================================================

-- Drop find_table_combinations (todas las versiones)
DROP FUNCTION IF EXISTS find_table_combinations CASCADE;

-- Drop create_combined_reservation (todas las versiones)
DROP FUNCTION IF EXISTS create_combined_reservation CASCADE;

-- =====================================================
-- FUNCIÓN 1: find_table_combinations (con normalización)
-- =====================================================

CREATE OR REPLACE FUNCTION find_table_combinations(
  p_restaurant_id UUID,
  p_date DATE,
  p_time TIME,
  p_party_size INTEGER,
  p_zone TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_result JSON;
  v_min_advance_minutes INTEGER;
  v_minutes_until_reservation INTEGER;
  v_zone_normalized TEXT;
  v_restaurant_timezone TEXT;
BEGIN
  -- ✅ NORMALIZAR ZONA (quitar emojis, espacios, convertir a minúsculas)
  IF p_zone IS NOT NULL AND p_zone != 'any' THEN
    -- Quitar emojis comunes y espacios, convertir a minúsculas
    v_zone_normalized := LOWER(TRIM(
      REGEXP_REPLACE(p_zone, '[🏠☀️🍷🚪🌟✨]', '', 'g')
    ));
    
    -- Si quedó vacío después de limpiar, usar NULL
    IF v_zone_normalized = '' THEN
      v_zone_normalized := NULL;
    END IF;
    
    -- Validar que la zona normalizada sea válida
    IF v_zone_normalized IS NOT NULL AND 
       v_zone_normalized NOT IN ('interior', 'terraza', 'barra', 'privado') THEN
      RAISE EXCEPTION 'Zona no válida: %. Las zonas permitidas son: interior, terraza, barra, privado', p_zone;
    END IF;
  ELSE
    v_zone_normalized := p_zone;
  END IF;

  -- ✅ VALIDAR TIEMPO MÍNIMO DE ANTICIPACIÓN
  -- Obtener timezone y min_advance del restaurante
  SELECT 
    COALESCE(settings->>'timezone', 'Europe/Madrid'),
    COALESCE(
      (settings->>'min_advance_minutes')::INTEGER,
      (settings->>'min_advance_hours')::INTEGER * 60,
      0
    )
  INTO v_restaurant_timezone, v_min_advance_minutes
  FROM businesses
  WHERE id = p_restaurant_id;

  -- Calcular minutos hasta la reserva (usando la zona horaria del restaurante)
  v_minutes_until_reservation := EXTRACT(EPOCH FROM (
    timezone(v_restaurant_timezone, (p_date::TEXT || ' ' || p_time::TEXT)::TIMESTAMP) - NOW()
  )) / 60;

  -- Si no cumple el mínimo, retornar error
  IF v_minutes_until_reservation < v_min_advance_minutes THEN
    RETURN json_build_object(
      'available', false,
      'error', 'insufficient_advance_time',
      'message', format('Se requiere un mínimo de %s minutos de anticipación', v_min_advance_minutes),
      'minutes_required', v_min_advance_minutes,
      'minutes_provided', v_minutes_until_reservation
    );
  END IF;

  -- ✅ BUSCAR COMBINACIONES (usando zona normalizada)
  SELECT json_build_object(
    'available', true,
    'type', CASE 
      WHEN COUNT(*) = 1 THEN 'single'
      ELSE 'combination'
    END,
    'table_id', CASE WHEN COUNT(*) = 1 THEN (array_agg(t.id))[1] END,
    'table_ids', array_agg(t.id),
    'slot_ids', array_agg(s.id),
    'tables', json_agg(json_build_object(
      'id', t.id,
      'name', t.name,
      'capacity', t.capacity
    )),
    'zone', COALESCE(v_zone_normalized, 'any')
  )
  INTO v_result
  FROM tables t
  JOIN availability_slots s ON s.table_id = t.id
  WHERE t.restaurant_id = p_restaurant_id
    AND t.is_active = true
    AND s.slot_date = p_date
    AND s.start_time = p_time
    AND s.status = 'free'  -- ✅ CORRECTO: Solo slots 'free'
    AND s.is_available = true  -- ✅ Redundante pero por seguridad
    AND s.reservation_id IS NULL  -- ✅ CRÍTICO: Solo slots sin reserva
    AND (v_zone_normalized IS NULL OR v_zone_normalized = 'any' OR t.zone::TEXT = v_zone_normalized)
  GROUP BY t.zone
  HAVING SUM(t.capacity) >= p_party_size
  ORDER BY 
    CASE WHEN COUNT(*) = 1 THEN 0 ELSE 1 END,
    COUNT(*)
  LIMIT 1;

  -- Si no hay resultado, no disponible
  IF v_result IS NULL THEN
    RETURN json_build_object(
      'available', false,
      'message', 'No hay disponibilidad para esa fecha/hora/zona'
    );
  END IF;

  RETURN v_result;
END;
$$;

-- =====================================================
-- FUNCIÓN 2: create_combined_reservation (con normalización)
-- =====================================================

CREATE OR REPLACE FUNCTION create_combined_reservation(
  p_restaurant_id UUID,
  p_customer_id UUID,
  p_customer_phone TEXT,
  p_customer_name TEXT,
  p_reservation_date DATE,
  p_reservation_time TIME,
  p_party_size INTEGER,
  p_slot_ids UUID[],
  p_special_requests TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'manual'
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_reservation_id UUID;
  v_min_advance_minutes INTEGER;
  v_minutes_until_reservation INTEGER;
  v_restaurant_timezone TEXT;
BEGIN
  -- ✅ VALIDAR TIEMPO MÍNIMO DE ANTICIPACIÓN
  SELECT 
    COALESCE(settings->>'timezone', 'Europe/Madrid'),
    COALESCE(
      (settings->>'min_advance_minutes')::INTEGER,
      (settings->>'min_advance_hours')::INTEGER * 60,
      0
    )
  INTO v_restaurant_timezone, v_min_advance_minutes
  FROM businesses
  WHERE id = p_restaurant_id;

  -- Calcular minutos hasta la reserva (usando la zona horaria del restaurante)
  v_minutes_until_reservation := EXTRACT(EPOCH FROM (
    timezone(v_restaurant_timezone, (p_reservation_date::TEXT || ' ' || p_reservation_time::TEXT)::TIMESTAMP) - NOW()
  )) / 60;

  IF v_minutes_until_reservation < v_min_advance_minutes THEN
    RAISE EXCEPTION 'Se requiere un mínimo de % minutos de anticipación', v_min_advance_minutes;
  END IF;

  -- ✅ CREAR RESERVA
  INSERT INTO reservations (
    restaurant_id,
    customer_id,
    customer_phone,
    customer_name,
    reservation_date,
    reservation_time,
    party_size,
    special_requests,
    source,
    status
  )
  VALUES (
    p_restaurant_id,
    p_customer_id,
    p_customer_phone,
    p_customer_name,
    p_reservation_date,
    p_reservation_time,
    p_party_size,
    p_special_requests,
    p_source,
    'pending'
  )
  RETURNING id INTO v_reservation_id;

  -- ✅ MARCAR SLOTS COMO RESERVADOS
  UPDATE availability_slots
  SET 
    status = 'reserved',
    is_available = false,
    reservation_id = v_reservation_id
  WHERE id = ANY(p_slot_ids);

  -- ✅ RETORNAR RESULTADO
  RETURN json_build_object(
    'success', true,
    'reservation_id', v_reservation_id,
    'message', 'Reserva creada correctamente'
  );
END;
$$;

-- =====================================================
-- COMENTARIOS
-- =====================================================

COMMENT ON FUNCTION find_table_combinations IS 
'Encuentra combinaciones de mesas. Normaliza automáticamente el input de zona (quita emojis, espacios, convierte a minúsculas).';

COMMENT ON FUNCTION create_combined_reservation IS 
'Crea una reserva con validación de tiempo mínimo. Status inicial: pending.';

