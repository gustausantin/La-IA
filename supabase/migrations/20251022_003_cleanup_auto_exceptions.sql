-- =====================================================
-- LIMPIAR EXCEPCIONES AUTOMÁTICAS DE CALENDARIO
-- =====================================================
-- Fecha: 22 Octubre 2025
-- Problema: Hay excepciones creadas automáticamente con horarios viejos
-- Solución: Eliminar excepciones automáticas para que el calendario use horarios semanales
-- =====================================================

-- Eliminar excepciones creadas automáticamente por el sistema
DELETE FROM calendar_exceptions
WHERE created_by = 'system'
  AND reason = 'Día protegido automáticamente (tiene reservas activas)';

-- Log de resultados
DO $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE '✅ Excepciones automáticas eliminadas: %', v_deleted_count;
  RAISE NOTICE '✅ El calendario ahora mostrará los horarios semanales normales';
  RAISE NOTICE '✅ Solo se mantendrán las excepciones creadas manualmente por usuarios';
END $$;

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

-- Mostrar excepciones restantes (solo las manuales)
SELECT 
    exception_date,
    is_open,
    open_time,
    close_time,
    reason,
    created_by
FROM calendar_exceptions
WHERE restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
ORDER BY exception_date;

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================

