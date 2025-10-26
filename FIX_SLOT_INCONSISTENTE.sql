-- =====================================================
-- FIX: Limpiar slot inconsistente
-- =====================================================

-- PROBLEMA: Este slot tiene reservation_id PERO is_available = true
-- slot_id: 2d48d251-70dd-4157-89d1-6caf62aab556
-- reservation_id: 89d48ed5-99a0-46c6-a90b-47943ca9bda0

-- OPCIÓN 1: Limpiar el reservation_id (si la reserva no es válida)
UPDATE availability_slots
SET 
  reservation_id = NULL,
  status = 'available',
  is_available = true
WHERE id = '2d48d251-70dd-4157-89d1-6caf62aab556'
  AND reservation_id IS NOT NULL
  AND is_available = true;

-- Verificar
SELECT 
  id,
  table_id,
  slot_date,
  start_time,
  is_available,
  status,
  reservation_id
FROM availability_slots
WHERE id = '2d48d251-70dd-4157-89d1-6caf62aab556';

