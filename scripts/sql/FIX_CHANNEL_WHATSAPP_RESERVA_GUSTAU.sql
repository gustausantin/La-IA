-- =====================================================
-- FIX: Corregir 'channel' de reserva de Gustau
-- Fecha: 18 de octubre de 2025
-- Objetivo: Cambiar channel de 'web' a 'whatsapp' para reserva creada por agente
-- =====================================================

-- 🔍 VERIFICAR ESTADO ACTUAL
SELECT 
    id,
    customer_name,
    reservation_date,
    reservation_time,
    source,
    channel,
    created_at
FROM reservations
WHERE id = '604e7acc-e153-44a2-9573-f793a020e8a6';

-- ✅ CORREGIR channel
UPDATE reservations
SET 
    channel = 'whatsapp',
    updated_at = NOW()
WHERE id = '604e7acc-e153-44a2-9573-f793a020e8a6'
  AND source = 'agent_whatsapp';

-- 🔍 VERIFICAR CAMBIO
SELECT 
    id,
    customer_name,
    reservation_date,
    reservation_time,
    source,
    channel,
    created_at,
    updated_at
FROM reservations
WHERE id = '604e7acc-e153-44a2-9573-f793a020e8a6';

-- =====================================================
-- RESULTADO ESPERADO:
-- source: 'agent_whatsapp' ✓
-- channel: 'whatsapp' ✓
-- =====================================================




