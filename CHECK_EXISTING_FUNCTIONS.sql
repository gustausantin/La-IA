-- ============================================
-- Script para verificar funciones existentes
-- Ejecuta esto ANTES de la migración para ver qué hay
-- ============================================

-- Ver todas las versiones de get_high_risk_appointments
SELECT 
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'get_high_risk_appointments'
  AND n.nspname = 'public';

-- Ver detect_employee_absences_with_appointments
SELECT 
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'detect_employee_absences_with_appointments'
  AND n.nspname = 'public';

-- Ver get_upcoming_free_slots
SELECT 
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'get_upcoming_free_slots'
  AND n.nspname = 'public';

