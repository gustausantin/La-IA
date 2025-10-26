-- =====================================================
-- DEBUG: Verificar disponibilidad paso a paso
-- =====================================================

-- DATOS DE LA PRUEBA:
-- restaurant_id: d6b63130-1ebf-4284-98fc-a3b31a85d9d1
-- date: 2025-10-22
-- time: 20:30
-- party_size: 4
-- zone: interior

-- =====================================================
-- PASO 1: ¿Existen mesas activas en el restaurante?
-- =====================================================

SELECT 
  'PASO 1: Mesas activas' AS paso,
  id,
  name,
  capacity,
  zone,
  is_active
FROM tables
WHERE restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
  AND is_active = true
ORDER BY zone, name;

-- =====================================================
-- PASO 2: ¿Existen slots para esa fecha/hora?
-- =====================================================

SELECT 
  'PASO 2: Slots para 2025-10-22 20:30' AS paso,
  s.id AS slot_id,
  s.table_id,
  t.name AS table_name,
  t.zone,
  t.capacity,
  s.slot_date,
  s.start_time,
  s.is_available,
  s.status,
  s.reservation_id
FROM availability_slots s
JOIN tables t ON t.id = s.table_id
WHERE s.slot_date = '2025-10-22'
  AND s.start_time = '20:30:00'
  AND t.restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
ORDER BY t.zone, t.name;

-- =====================================================
-- PASO 3: ¿Hay slots DISPONIBLES para esa fecha/hora?
-- =====================================================

SELECT 
  'PASO 3: Slots DISPONIBLES' AS paso,
  s.id AS slot_id,
  t.name AS table_name,
  t.zone,
  t.capacity,
  s.is_available,
  s.status
FROM availability_slots s
JOIN tables t ON t.id = s.table_id
WHERE s.slot_date = '2025-10-22'
  AND s.start_time = '20:30:00'
  AND t.restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
  AND t.is_active = true
  AND s.is_available = true
  AND s.status = 'available'
ORDER BY t.zone, t.name;

-- =====================================================
-- PASO 4: ¿Hay slots disponibles en INTERIOR?
-- =====================================================

SELECT 
  'PASO 4: Slots en INTERIOR' AS paso,
  s.id AS slot_id,
  t.name AS table_name,
  t.zone,
  t.capacity,
  s.is_available,
  s.status
FROM availability_slots s
JOIN tables t ON t.id = s.table_id
WHERE s.slot_date = '2025-10-22'
  AND s.start_time = '20:30:00'
  AND t.restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
  AND t.is_active = true
  AND s.is_available = true
  AND s.status = 'available'
  AND t.zone::TEXT = 'interior'
ORDER BY t.name;

-- =====================================================
-- PASO 5: ¿Cuál es la capacidad total disponible en INTERIOR?
-- =====================================================

SELECT 
  'PASO 5: Capacidad total en INTERIOR' AS paso,
  t.zone,
  COUNT(*) AS num_tables,
  SUM(t.capacity) AS total_capacity,
  ARRAY_AGG(t.name) AS table_names,
  ARRAY_AGG(t.capacity) AS capacities
FROM availability_slots s
JOIN tables t ON t.id = s.table_id
WHERE s.slot_date = '2025-10-22'
  AND s.start_time = '20:30:00'
  AND t.restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
  AND t.is_active = true
  AND s.is_available = true
  AND s.status = 'available'
  AND t.zone::TEXT = 'interior'
GROUP BY t.zone
HAVING SUM(t.capacity) >= 4;

-- =====================================================
-- PASO 6: Llamar al RPC directamente
-- =====================================================

SELECT 
  'PASO 6: Resultado del RPC' AS paso,
  find_table_combinations(
    'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'::UUID,
    '2025-10-22'::DATE,
    '20:30:00'::TIME,
    4,
    'interior'
  ) AS result;

-- =====================================================
-- PASO 7: ¿Qué pasa si buscamos en ANY zona?
-- =====================================================

SELECT 
  'PASO 7: Resultado con zona ANY' AS paso,
  find_table_combinations(
    'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'::UUID,
    '2025-10-22'::DATE,
    '20:30:00'::TIME,
    4,
    'any'
  ) AS result;

-- =====================================================
-- PASO 8: ¿Qué pasa si buscamos sin especificar zona?
-- =====================================================

SELECT 
  'PASO 8: Resultado sin zona (NULL)' AS paso,
  find_table_combinations(
    'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'::UUID,
    '2025-10-22'::DATE,
    '20:30:00'::TIME,
    4,
    NULL
  ) AS result;

-- =====================================================
-- PASO 9: Verificar validación de tiempo mínimo
-- =====================================================

SELECT 
  'PASO 9: Configuración min_advance' AS paso,
  id,
  name,
  settings->>'min_advance_minutes' AS min_advance_minutes,
  settings->>'min_advance_hours' AS min_advance_hours
FROM restaurants
WHERE id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1';

-- =====================================================
-- PASO 10: Calcular tiempo hasta la reserva
-- =====================================================

SELECT 
  'PASO 10: Tiempo hasta reserva' AS paso,
  NOW() AS ahora,
  '2025-10-22 20:30:00'::TIMESTAMP AS hora_reserva,
  EXTRACT(EPOCH FROM ('2025-10-22 20:30:00'::TIMESTAMP - NOW())) / 60 AS minutos_hasta_reserva;

