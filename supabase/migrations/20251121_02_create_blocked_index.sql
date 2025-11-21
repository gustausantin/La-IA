-- =====================================================
-- MIGRACIÓN: Crear índice para appointments bloqueados de Google Calendar
-- Fecha: 2025-11-21
-- Objetivo: Índice para búsquedas eficientes de eventos bloqueados
-- NOTA: Debe ejecutarse DESPUÉS de 20251121_01 (el enum 'blocked' debe existir)
-- =====================================================

-- Crear índice para appointments bloqueados de Google Calendar
-- ⚠️ Solo se crea si el enum 'blocked' ya existe
CREATE INDEX IF NOT EXISTS idx_appointments_source_blocked 
ON appointments(business_id, source, status) 
WHERE source = 'google_calendar' AND status = 'blocked';

COMMENT ON INDEX idx_appointments_source_blocked IS 
'Índice para búsquedas eficientes de appointments bloqueados importados de Google Calendar.';

