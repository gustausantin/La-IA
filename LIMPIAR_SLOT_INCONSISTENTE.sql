-- =====================================================
-- LIMPIAR SLOT INCONSISTENTE
-- Basado en auditoría real de la base de datos
-- =====================================================

-- PROBLEMA: 1 slot con status='free' Y reservation_id NOT NULL
-- Esto viola la lógica del negocio

-- Identificar el slot
SELECT 
  'ANTES DE LIMPIAR' AS momento,
  id,
  table_id,
  slot_date,
  start_time,
  status,
  is_available,
  reservation_id
FROM availability_slots
WHERE status = 'free'
  AND is_available = true
  AND reservation_id IS NOT NULL;

-- Limpiar: Quitar el reservation_id
UPDATE availability_slots
SET 
  reservation_id = NULL,
  updated_at = NOW()
WHERE status = 'free'
  AND is_available = true
  AND reservation_id IS NOT NULL;

-- Verificar después
SELECT 
  'DESPUÉS DE LIMPIAR' AS momento,
  id,
  table_id,
  slot_date,
  start_time,
  status,
  is_available,
  reservation_id
FROM availability_slots
WHERE status = 'free'
  AND is_available = true
  AND reservation_id IS NOT NULL;

-- Debería retornar 0 filas

