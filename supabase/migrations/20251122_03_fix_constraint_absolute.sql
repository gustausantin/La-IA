-- =====================================================
-- MIGRACIÓN: CORREGIR CONSTRAINT PARA SER ABSOLUTA
-- Fecha: 2025-11-22
-- Objetivo: Hacer que la constraint sea ABSOLUTA - NO se puede crear
--           una reserva con resource_id sin employee_id (SIN EXCEPCIONES)
-- =====================================================

-- PASO 1: Eliminar la constraint anterior (si existe)
ALTER TABLE appointments
DROP CONSTRAINT IF EXISTS check_employee_id_with_resource;

-- PASO 2: Aplicar constraint ABSOLUTA (sin excepciones)
-- REGLA DE NEGOCIO CRÍTICA: Si hay resource_id, DEBE haber employee_id
-- Esto aplica a TODOS los appointments, sin importar el status
ALTER TABLE appointments
ADD CONSTRAINT check_employee_id_with_resource
CHECK (
  -- Si resource_id es NULL, employee_id puede ser NULL (reservas sin recurso específico)
  -- Si resource_id NO es NULL, employee_id DEBE estar presente (SIN EXCEPCIONES)
  (resource_id IS NULL) OR (employee_id IS NOT NULL)
);

COMMENT ON CONSTRAINT check_employee_id_with_resource ON appointments IS 
'REGLA ABSOLUTA: Si una reserva tiene un recurso asignado (resource_id), SIEMPRE debe tener un empleado asignado (employee_id). Sin excepciones. Esta es una regla de negocio crítica: cada recurso necesita un trabajador.';

-- PASO 3: Verificar que no haya datos que violen la nueva constraint
DO $$
DECLARE
    v_violating_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_violating_count
    FROM appointments
    WHERE resource_id IS NOT NULL
      AND employee_id IS NULL;
    
    IF v_violating_count > 0 THEN
        RAISE WARNING '⚠️ Hay % appointments que violan la regla. Estos deben corregirse antes de que la constraint funcione correctamente.', v_violating_count;
        RAISE WARNING 'Ejecuta: SELECT * FROM fix_missing_employee_id_from_resource(); para corregirlos.';
    ELSE
        RAISE NOTICE '✅ No hay appointments que violen la regla. La constraint está activa.';
    END IF;
END $$;

SELECT 'Migración 20251122_03_fix_constraint_absolute completada' AS status;

