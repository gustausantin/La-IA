-- =====================================================
-- FIX: LIMPIAR SLOTS INCONSISTENTES
-- =====================================================
-- Problema: Slots marcados como 'reserved' pero sin reservation_id
-- Solución: Marcarlos como 'free' y disponibles
-- =====================================================
-- Fecha: 2025-10-23
-- =====================================================

-- 1️⃣ IDENTIFICAR SLOTS INCONSISTENTES
SELECT 
    s.id,
    s.table_id,
    t.name as table_name,
    s.slot_date,
    s.start_time,
    s.end_time,
    s.status,
    s.reservation_id,
    s.is_available
FROM availability_slots s
LEFT JOIN tables t ON t.id = s.table_id
WHERE s.status = 'reserved'
  AND s.reservation_id IS NULL
ORDER BY s.slot_date DESC, t.name, s.start_time;

-- 2️⃣ LIMPIAR SLOTS INCONSISTENTES
-- Marcar como 'free' todos los slots que están 'reserved' pero sin reservation_id
UPDATE availability_slots
SET 
    status = 'free',
    is_available = true,
    reservation_id = NULL,
    updated_at = NOW()
WHERE status = 'reserved'
  AND reservation_id IS NULL;

-- 3️⃣ VERIFICAR CORRECCIÓN
SELECT 
    status,
    reservation_id IS NULL as sin_reserva,
    COUNT(*) as total_slots
FROM availability_slots
GROUP BY status, (reservation_id IS NULL)
ORDER BY status;

-- =====================================================
-- RESULTADO ESPERADO:
-- Todos los slots 'reserved' deben tener reservation_id NOT NULL
-- =====================================================



