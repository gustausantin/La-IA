-- ================================================
-- MODIFICAR TRIGGER: Liberar slots en no_show
-- ================================================
-- Propósito: Que el trigger TAMBIÉN libere slots cuando status='no_show'
-- Actualmente solo libera en 'cancelled', añadimos 'no_show'
-- ================================================

DROP TRIGGER IF EXISTS trigger_auto_free_slots ON reservations;

CREATE OR REPLACE FUNCTION auto_free_slots_on_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reservation_duration INTEGER;
    v_table_record RECORD;
BEGIN
    -- ✅ MODIFICADO: Liberar en cancelled O no_show
    IF NEW.status IN ('cancelled', 'no_show') 
       AND OLD.status IN ('pending', 'confirmed', 'pending_approval', 'seated') THEN
        
        -- Obtener duración de reserva
        SELECT COALESCE((settings->>'reservation_duration')::INTEGER, 90)
        INTO v_reservation_duration
        FROM restaurants
        WHERE id = NEW.restaurant_id;
        
        -- Liberar slots de todas las mesas
        FOR v_table_record IN
            SELECT table_id
            FROM reservation_tables
            WHERE reservation_id = NEW.id
        LOOP
            UPDATE availability_slots
            SET
                status = 'free',
                is_available = TRUE,
                updated_at = NOW()
            WHERE restaurant_id = NEW.restaurant_id
              AND table_id = v_table_record.table_id
              AND slot_date = NEW.reservation_date
              AND status = 'reserved'
              AND (start_time, end_time) OVERLAPS (
                  NEW.reservation_time,
                  NEW.reservation_time + (v_reservation_duration || ' minutes')::INTERVAL
              );
            
            RAISE NOTICE '✅ Slots liberados para mesa % en fecha % (status: %)', 
                         v_table_record.table_id, NEW.reservation_date, NEW.status;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Aplicar trigger
CREATE TRIGGER trigger_auto_free_slots
    AFTER UPDATE ON reservations
    FOR EACH ROW
    WHEN (NEW.status IN ('cancelled', 'no_show'))
    EXECUTE FUNCTION auto_free_slots_on_cancel();

COMMENT ON TRIGGER trigger_auto_free_slots ON reservations IS
'Libera automáticamente los slots al cancelar O marcar como no_show';

-- ================================================
-- TESTING
-- ================================================
/*
-- Marcar una reserva como no_show y ver que los slots se liberan:
UPDATE reservations 
SET status = 'no_show' 
WHERE id = 'TU_RESERVATION_ID';

-- Verificar que los slots se liberaron:
SELECT * FROM availability_slots 
WHERE slot_date = '2025-10-13' 
  AND status = 'free'
ORDER BY start_time;
*/

