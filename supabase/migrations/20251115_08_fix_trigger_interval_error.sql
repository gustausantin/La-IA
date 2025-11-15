-- =====================================================
-- MIGRACIÓN: FIX ERROR EN TRIGGER DE advance_booking_days
-- Fecha: 2025-11-15
-- Objetivo: Corregir error "operator does not exist: timestamp without time zone + integer"
--           en trigger_regenerate_on_advance_days_change
-- =====================================================

-- Corregir la función del trigger
CREATE OR REPLACE FUNCTION trigger_regenerate_on_advance_days_change()
RETURNS TRIGGER AS $$
DECLARE
    v_old_days INTEGER;
    v_new_days INTEGER;
    v_business_id UUID;
    v_result RECORD;
BEGIN
    v_business_id := NEW.id;
    
    -- Extraer días de antelación
    v_old_days := COALESCE((OLD.settings->>'advance_booking_days')::INTEGER, 30);
    v_new_days := COALESCE((NEW.settings->>'advance_booking_days')::INTEGER, 30);
    
    -- Solo actuar si cambió
    IF v_old_days IS DISTINCT FROM v_new_days THEN
        RAISE NOTICE 'Cambio detectado en días de antelación: % -> %', v_old_days, v_new_days;
        
        IF v_new_days > v_old_days THEN
            -- AUMENTAR: Generar días adicionales
            RAISE NOTICE 'Generando % días adicionales...', (v_new_days - v_old_days);
            
            SELECT * INTO v_result
            FROM generate_availability_slots_employee_based(
                p_business_id := v_business_id,
                p_start_date := (CURRENT_DATE + (v_old_days + 1))::DATE, -- ✅ CORREGIDO: Fecha de inicio como DATE
                p_days_ahead := (v_new_days - v_old_days), -- Días adicionales a generar desde la fecha de inicio
                p_regenerate := FALSE -- No regenerar, solo añadir
            );
            
            RAISE NOTICE 'Días adicionales generados: %', v_result.message;
            
        ELSIF v_new_days < v_old_days THEN
            -- DISMINUIR: Eliminar solo slots libres fuera del rango
            -- 🛡️ PROTECCIÓN CRÍTICA: NO eliminar slots en fechas con reservas activas
            -- ✅ MEJORADO: Protege por fecha Y resource_id (trabajador específico)
            DELETE FROM availability_slots
            WHERE business_id = v_business_id
            AND slot_date > CURRENT_DATE + (v_new_days || ' days')::INTERVAL
            AND status = 'free' -- ⚠️ SOLO LIBRES
            AND appointment_id IS NULL -- ⚠️ Sin reserva directa
            AND NOT EXISTS (
                -- 🛡️ Excluir slots que tienen reservas activas en esa fecha Y ese resource_id
                SELECT 1
                FROM appointments a
                WHERE a.business_id = v_business_id
                AND a.appointment_date = availability_slots.slot_date
                AND (
                    -- Si la reserva tiene resource_id, proteger solo ese resource_id
                    (a.resource_id IS NOT NULL AND a.resource_id = availability_slots.resource_id)
                    OR
                    -- Si la reserva NO tiene resource_id, proteger TODOS los slots de esa fecha
                    (a.resource_id IS NULL)
                )
                AND a.status NOT IN ('cancelled', 'completed')
            );
            
            RAISE NOTICE 'Slots libres eliminados fuera del nuevo rango (slots protegidos por trabajador y fecha)';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

SELECT 'Migración 20251115_08_fix_trigger_interval_error completada' AS status;

