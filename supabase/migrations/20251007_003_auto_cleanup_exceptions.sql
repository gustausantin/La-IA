-- ========================================
-- LIMPIEZA AUTOMÁTICA DE EXCEPCIONES
-- Elimina excepciones cuando ya no hay reservas en esa fecha
-- ========================================

-- Función para limpiar excepciones huérfanas (sin reservas activas)
CREATE OR REPLACE FUNCTION cleanup_orphan_exceptions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reservation_count INTEGER;
BEGIN
    -- Solo procesar si la reserva fue cancelada
    IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
        
        -- Contar reservas activas restantes en la misma fecha
        SELECT COUNT(*)
        INTO v_reservation_count
        FROM reservations
        WHERE restaurant_id = NEW.restaurant_id
          AND reservation_date = NEW.reservation_date
          AND status IN ('pending', 'pending_approval', 'confirmed', 'seated')
          AND id != NEW.id; -- Excluir la reserva actual
        
        -- Si no quedan reservas activas, eliminar la excepción
        IF v_reservation_count = 0 THEN
            DELETE FROM calendar_exceptions
            WHERE restaurant_id = NEW.restaurant_id
              AND exception_date = NEW.reservation_date
              AND created_by = 'system'; -- Solo eliminar excepciones automáticas
            
            RAISE NOTICE '🧹 Excepción eliminada para % (no quedan reservas activas)', NEW.reservation_date;
        ELSE
            RAISE NOTICE '✅ Excepción mantenida para % (quedan % reservas activas)', NEW.reservation_date, v_reservation_count;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Trigger para ejecutar la limpieza al actualizar una reserva
CREATE TRIGGER trigger_cleanup_exceptions_on_cancel
    AFTER UPDATE ON reservations
    FOR EACH ROW
    WHEN (NEW.status = 'cancelled' AND OLD.status != 'cancelled')
    EXECUTE FUNCTION cleanup_orphan_exceptions();

-- Comentario para documentación
COMMENT ON FUNCTION cleanup_orphan_exceptions IS 'Elimina automáticamente excepciones de calendario cuando ya no hay reservas activas en esa fecha';
COMMENT ON TRIGGER trigger_cleanup_exceptions_on_cancel ON reservations IS 'Limpia excepciones huérfanas al cancelar reservas';

-- ========================================
-- MIGRACIÓN COMPLETADA ✅
-- Limpieza automática de excepciones configurada
-- ========================================

