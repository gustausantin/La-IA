-- =====================================================
-- MIGRACIÓN: Agregar constraint único para prevenir
-- conflictos de recursos en availability_slots
-- =====================================================
-- Fecha: 2025-11-19
-- Descripción: 
--   - Constraint único para prevenir que el mismo recurso
--     se asigne a múltiples empleados en el mismo slot
--   - Esto garantiza integridad a nivel de base de datos
-- =====================================================

-- =====================================================
-- PASO 1: Limpiar conflictos existentes (si los hay)
-- =====================================================

-- Función para limpiar conflictos existentes
CREATE OR REPLACE FUNCTION cleanup_existing_resource_conflicts(
    p_business_id UUID DEFAULT NULL
)
RETURNS TABLE(
    deleted_count INTEGER,
    conflicts_found INTEGER,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted_count INTEGER := 0;
    v_conflicts_found INTEGER := 0;
    v_conflict RECORD;
BEGIN
    -- Encontrar conflictos: slots donde el mismo recurso está asignado
    -- a múltiples empleados en el mismo día y hora
    FOR v_conflict IN
        SELECT 
            avs1.resource_id,
            avs1.slot_date,
            avs1.start_time,
            COUNT(DISTINCT avs1.employee_id) as employee_count,
            array_agg(DISTINCT avs1.employee_id) as employee_ids
        FROM availability_slots avs1
        WHERE avs1.resource_id IS NOT NULL
          AND (p_business_id IS NULL OR avs1.business_id = p_business_id)
          AND avs1.status IN ('free', 'reserved', 'blocked')
        GROUP BY avs1.resource_id, avs1.slot_date, avs1.start_time
        HAVING COUNT(DISTINCT avs1.employee_id) > 1
    LOOP
        v_conflicts_found := v_conflicts_found + 1;
        
        -- Eliminar todos los slots conflictivos EXCEPTO el primero (por employee_id)
        -- Mantener el slot del empleado con el ID más bajo (arbitrario pero consistente)
        DELETE FROM availability_slots
        WHERE resource_id = v_conflict.resource_id
          AND slot_date = v_conflict.slot_date
          AND start_time = v_conflict.start_time
          AND employee_id != (
              SELECT MIN(employee_id) 
              FROM availability_slots
              WHERE resource_id = v_conflict.resource_id
                AND slot_date = v_conflict.slot_date
                AND start_time = v_conflict.start_time
          )
          AND status = 'free'; -- Solo eliminar slots libres
        
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    END LOOP;
    
    RETURN QUERY SELECT 
        v_deleted_count,
        v_conflicts_found,
        format(
            'Encontrados %s conflictos. Eliminados %s slots duplicados (se mantuvo el slot del primer empleado).',
            v_conflicts_found,
            v_deleted_count
        )::TEXT;
END;
$$;

COMMENT ON FUNCTION cleanup_existing_resource_conflicts IS 
'Limpia conflictos existentes donde el mismo recurso está asignado a múltiples empleados en el mismo slot.
Mantiene el slot del empleado con el ID más bajo y elimina los demás (solo slots libres).';

-- =====================================================
-- PASO 2: Agregar constraint único
-- =====================================================

-- Primero, eliminar constraint único existente si existe (por si acaso)
DO $$
BEGIN
    -- Intentar eliminar constraint si existe
    IF EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'unique_resource_slot_time'
    ) THEN
        ALTER TABLE availability_slots 
        DROP CONSTRAINT unique_resource_slot_time;
    END IF;
END $$;

-- Agregar constraint único: mismo recurso no puede estar en el mismo slot
-- (independientemente del empleado)
ALTER TABLE availability_slots
ADD CONSTRAINT unique_resource_slot_time 
UNIQUE (business_id, resource_id, slot_date, start_time);

COMMENT ON CONSTRAINT unique_resource_slot_time ON availability_slots IS 
'Garantiza que el mismo recurso no puede estar asignado a múltiples empleados en el mismo slot.
Previene conflictos de recursos a nivel de base de datos.';

-- =====================================================
-- PASO 3: Crear índice para mejorar rendimiento de búsquedas
-- =====================================================

-- Índice para mejorar búsquedas de conflictos
CREATE INDEX IF NOT EXISTS idx_availability_slots_resource_slot 
ON availability_slots(business_id, resource_id, slot_date, start_time);

COMMENT ON INDEX idx_availability_slots_resource_slot IS 
'Índice para mejorar búsquedas de conflictos de recursos en availability_slots.';

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================

SELECT 'Migración 20251119_02_add_unique_constraint_resource_slots completada' AS status;




