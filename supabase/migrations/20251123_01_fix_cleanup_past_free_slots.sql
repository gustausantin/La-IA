-- =====================================================
-- MIGRACIÓN: Corregir limpieza de slots pasados libres
-- =====================================================
-- Fecha: 2025-11-23
-- Descripción: 
--   - Modificar cleanup_employee_free_slots para eliminar también slots pasados libres
--   - Solo mantener slots pasados con actividad (reservas, etc.)
--   - Los slots pasados con status='free' deben eliminarse
-- =====================================================

-- =====================================================
-- FUNCIÓN ACTUALIZADA: Eliminar slots libres (pasados y futuros)
-- =====================================================
CREATE OR REPLACE FUNCTION cleanup_employee_free_slots(
    p_employee_id UUID,
    p_business_id UUID DEFAULT NULL,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE(
    deleted_count INTEGER,
    protected_count INTEGER,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted_count INTEGER := 0;
    v_protected_count INTEGER := 0;
    v_past_deleted_count INTEGER := 0;
    v_future_deleted_count INTEGER := 0;
    v_past_protected_count INTEGER := 0;
    v_future_protected_count INTEGER := 0;
    v_start_date DATE;
    v_end_date DATE;
    v_today DATE := CURRENT_DATE;
BEGIN
    -- Validar que el empleado existe
    IF NOT EXISTS (SELECT 1 FROM employees WHERE id = p_employee_id) THEN
        RETURN QUERY SELECT 
            0::INTEGER,
            0::INTEGER,
            'Error: Empleado no encontrado'::TEXT;
        RETURN;
    END IF;
    
    -- Determinar rango de fechas FUTURAS
    -- Si no se especifica, eliminar desde hoy hasta 90 días adelante
    v_start_date := COALESCE(p_start_date, v_today)::DATE;
    
    IF p_end_date IS NULL THEN
        -- Si no hay horarios, eliminar slots futuros (hasta 90 días)
        v_end_date := (v_today + INTERVAL '90 days')::DATE;
    ELSE
        v_end_date := p_end_date::DATE;
    END IF;
    
    -- =====================================================
    -- 1. LIMPIAR SLOTS PASADOS LIBRES (slot_date < TODAY)
    -- =====================================================
    -- 🛡️ CONTAR slots protegidos en el pasado (con reservas o actividad)
    SELECT COUNT(*) INTO v_past_protected_count
    FROM availability_slots
    WHERE employee_id = p_employee_id
      AND slot_date < v_today
      AND (status != 'free' OR appointment_id IS NOT NULL);
    
    -- 🗑️ ELIMINAR slots PASADOS libres (status = 'free' y sin appointment_id)
    DELETE FROM availability_slots
    WHERE employee_id = p_employee_id
      AND slot_date < v_today
      AND status = 'free'
      AND appointment_id IS NULL;
    
    GET DIAGNOSTICS v_past_deleted_count = ROW_COUNT;
    
    -- =====================================================
    -- 2. LIMPIAR SLOTS FUTUROS LIBRES (slot_date >= TODAY)
    -- =====================================================
    -- 🛡️ CONTAR slots protegidos en el futuro (con reservas o actividad)
    SELECT COUNT(*) INTO v_future_protected_count
    FROM availability_slots
    WHERE employee_id = p_employee_id
      AND slot_date >= v_start_date
      AND slot_date <= v_end_date
      AND (status != 'free' OR appointment_id IS NOT NULL);
    
    -- 🗑️ ELIMINAR slots FUTUROS libres (status = 'free' y sin appointment_id)
    DELETE FROM availability_slots
    WHERE employee_id = p_employee_id
      AND slot_date >= v_start_date
      AND slot_date <= v_end_date
      AND status = 'free'
      AND appointment_id IS NULL;
    
    GET DIAGNOSTICS v_future_deleted_count = ROW_COUNT;
    
    -- Totales
    v_deleted_count := v_past_deleted_count + v_future_deleted_count;
    v_protected_count := v_past_protected_count + v_future_protected_count;
    
    -- Retornar resultado
    RETURN QUERY SELECT 
        v_deleted_count,
        v_protected_count,
        format(
            'Eliminados %s slots libres (%s pasados, %s futuros). Protegidos %s slots con actividad.',
            v_deleted_count,
            v_past_deleted_count,
            v_future_deleted_count,
            v_protected_count
        )::TEXT;
END;
$$;

COMMENT ON FUNCTION cleanup_employee_free_slots IS 
'Elimina slots libres de un empleado (pasados y futuros).
- Elimina TODOS los slots pasados con status=''free'' (solo mantiene los con actividad)
- Elimina slots futuros libres en el rango especificado
- Solo elimina slots con status=''free'' y sin appointment_id.
- Protege automáticamente slots con reservas o actividad.';

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================

SELECT 'Migración 20251123_01_fix_cleanup_past_free_slots completada' AS status;












