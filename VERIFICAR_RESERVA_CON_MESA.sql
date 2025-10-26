-- =====================================================
-- 🔍 VERIFICAR RESERVA CON MESA
-- =====================================================

-- Buscar la reserva recién creada
SELECT 
    r.id,
    r.customer_name,
    r.reservation_date,
    r.reservation_time,
    r.party_size,
    r.status,
    -- ✅ Verificar si tiene mesas asignadas
    (SELECT COUNT(*) FROM reservation_tables WHERE reservation_id = r.id) as num_tables_assigned,
    -- ✅ Ver qué mesas tiene
    (SELECT string_agg(t.name, ', ') 
     FROM reservation_tables rt 
     JOIN tables t ON t.id = rt.table_id 
     WHERE rt.reservation_id = r.id) as table_names
FROM reservations r
WHERE r.id = '0f272e8e-f276-4a45-b699-6d68b78bf4c0';

-- =====================================================
-- 🔍 VERIFICAR RESERVATION_TABLES
-- =====================================================

SELECT 
    rt.*,
    t.name as table_name,
    t.capacity,
    t.zone
FROM reservation_tables rt
JOIN tables t ON t.id = rt.table_id
WHERE rt.reservation_id = '0f272e8e-f276-4a45-b699-6d68b78bf4c0';

-- =====================================================
-- 🔍 VERIFICAR AVAILABILITY_SLOTS
-- =====================================================

SELECT 
    slot_id,
    table_id,
    slot_date,
    start_time,
    status,
    reservation_id,
    is_available
FROM availability_slots
WHERE reservation_id = '0f272e8e-f276-4a45-b699-6d68b78bf4c0';

