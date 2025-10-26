-- =====================================================
-- MIGRACIÓN: Corregir canal de reservas manuales
-- Fecha: 2025-10-12
-- Descripción: Copiar valores de 'channel' a 'reservation_channel' para reservas manuales
-- =====================================================

-- PROBLEMA: Las reservas creadas desde el Dashboard tienen channel='manual'
-- pero el Dashboard busca reservation_channel='manual'

-- 1. Copiar valores de 'channel' a 'reservation_channel' donde reservation_channel es NULL
UPDATE reservations
SET 
  reservation_channel = channel,
  updated_at = NOW()
WHERE 
  reservation_channel IS NULL 
  AND channel IS NOT NULL;

-- 2. Para reservas manuales sin ningún canal especificado (fuente dashboard)
UPDATE reservations
SET 
  reservation_channel = 'manual',
  updated_at = NOW()
WHERE 
  reservation_channel IS NULL 
  AND channel IS NULL
  AND source = 'dashboard';

-- ===========================================
-- VERIFICACIÓN
-- ===========================================

-- Ver reservas manuales de HOY
SELECT 
  id,
  customer_name,
  reservation_date,
  reservation_time,
  party_size,
  channel,
  reservation_channel,
  source,
  status
FROM reservations
WHERE 
  reservation_date = CURRENT_DATE
  AND (reservation_channel = 'manual' OR source = 'dashboard')
ORDER BY reservation_time;

-- Contar reservas manuales por fecha
SELECT 
  reservation_date,
  COUNT(*) as manual_reservations
FROM reservations
WHERE 
  reservation_channel = 'manual'
  AND reservation_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY reservation_date
ORDER BY reservation_date DESC;

