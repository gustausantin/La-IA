-- =====================================================
-- AUDITORÍA COMPLETA: availability_slots
-- =====================================================

-- 1. ESTRUCTURA DE LA TABLA
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'availability_slots'
ORDER BY ordinal_position;

-- 2. CONSTRAINTS Y CHECKS
SELECT
  con.conname AS constraint_name,
  con.contype AS constraint_type,
  pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'availability_slots';

-- 3. VALORES ÚNICOS EN LA COLUMNA "status"
SELECT 
  status,
  COUNT(*) AS count
FROM availability_slots
GROUP BY status
ORDER BY count DESC;

-- 4. VALORES ÚNICOS EN LA COLUMNA "is_available"
SELECT 
  is_available,
  COUNT(*) AS count
FROM availability_slots
GROUP BY is_available;

-- 5. COMBINACIONES DE status + is_available + reservation_id
SELECT 
  status,
  is_available,
  CASE 
    WHEN reservation_id IS NULL THEN 'NULL'
    ELSE 'NOT NULL'
  END AS has_reservation,
  COUNT(*) AS count
FROM availability_slots
GROUP BY status, is_available, CASE WHEN reservation_id IS NULL THEN 'NULL' ELSE 'NOT NULL' END
ORDER BY count DESC;

-- 6. SLOTS INCONSISTENTES (is_available=true PERO tiene reservation_id)
SELECT 
  'INCONSISTENTES' AS tipo,
  id,
  table_id,
  slot_date,
  start_time,
  status,
  is_available,
  reservation_id
FROM availability_slots
WHERE is_available = true AND reservation_id IS NOT NULL
LIMIT 20;

-- 7. ÍNDICES
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'availability_slots';

