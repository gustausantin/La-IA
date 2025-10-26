-- ========================================
-- EMAIL NOTIFICATION TRIGGERS
-- Triggers que envían notificaciones por email automáticamente
-- cuando hay eventos en la tabla reservations
-- ========================================

-- =====================
-- FUNCIÓN: Notificar nueva reserva
-- =====================
CREATE OR REPLACE FUNCTION notify_new_reservation()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  edge_function_url TEXT;
  payload JSONB;
  http_response RECORD;
BEGIN
  -- URL de la Edge Function (ajustar según tu proyecto)
  edge_function_url := current_setting('app.settings.edge_function_url', true);
  
  -- Si no está configurada, usar default
  IF edge_function_url IS NULL OR edge_function_url = '' THEN
    edge_function_url := 'https://ktsqwvhqamedpmzkzjaz.supabase.co/functions/v1/send-notification-email';
  END IF;

  -- Preparar payload
  payload := jsonb_build_object(
    'event', 'new_reservation',
    'reservation_id', NEW.id,
    'restaurant_id', NEW.restaurant_id
  );

  -- Llamar a la Edge Function de forma asíncrona usando pg_net
  -- Nota: Requiere extensión pg_net habilitada
  BEGIN
    SELECT * INTO http_response
    FROM net.http_post(
      url := edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := payload
    );
    
    -- Log del resultado (opcional)
    RAISE NOTICE 'Email notification sent for new reservation: % (HTTP status: %)', NEW.id, http_response.status;
    
  EXCEPTION WHEN OTHERS THEN
    -- Si falla el envío, loggeamos pero NO bloqueamos la inserción
    RAISE WARNING 'Failed to send email notification for reservation %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- =====================
-- FUNCIÓN: Notificar reserva cancelada
-- =====================
CREATE OR REPLACE FUNCTION notify_cancelled_reservation()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  edge_function_url TEXT;
  payload JSONB;
  http_response RECORD;
BEGIN
  -- Solo enviar notificación si el status cambió a 'cancelled'
  IF OLD.status != 'cancelled' AND NEW.status = 'cancelled' THEN
    
    -- URL de la Edge Function
    edge_function_url := current_setting('app.settings.edge_function_url', true);
    
    IF edge_function_url IS NULL OR edge_function_url = '' THEN
      edge_function_url := 'https://ktsqwvhqamedpmzkzjaz.supabase.co/functions/v1/send-notification-email';
    END IF;

    -- Preparar payload
    payload := jsonb_build_object(
      'event', 'cancelled_reservation',
      'reservation_id', NEW.id,
      'restaurant_id', NEW.restaurant_id
    );

    -- Llamar a la Edge Function
    BEGIN
      SELECT * INTO http_response
      FROM net.http_post(
        url := edge_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := payload
      );
      
      RAISE NOTICE 'Cancellation email sent for reservation: % (HTTP status: %)', NEW.id, http_response.status;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to send cancellation email for reservation %: %', NEW.id, SQLERRM;
    END;
    
  END IF;

  RETURN NEW;
END;
$$;

-- =====================
-- CREAR TRIGGERS
-- =====================

-- Trigger para nuevas reservas
DROP TRIGGER IF EXISTS trigger_notify_new_reservation ON reservations;
CREATE TRIGGER trigger_notify_new_reservation
  AFTER INSERT ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_reservation();

-- Trigger para reservas canceladas
DROP TRIGGER IF EXISTS trigger_notify_cancelled_reservation ON reservations;
CREATE TRIGGER trigger_notify_cancelled_reservation
  AFTER UPDATE OF status ON reservations
  FOR EACH ROW
  WHEN (NEW.status = 'cancelled' AND OLD.status != 'cancelled')
  EXECUTE FUNCTION notify_cancelled_reservation();

-- =====================
-- COMENTARIOS Y DOCUMENTACIÓN
-- =====================
COMMENT ON FUNCTION notify_new_reservation() IS 
'Función trigger que envía notificación por email cuando se crea una nueva reserva. Llama a la Edge Function send-notification-email.';

COMMENT ON FUNCTION notify_cancelled_reservation() IS 
'Función trigger que envía notificación por email cuando una reserva cambia a estado cancelled. Llama a la Edge Function send-notification-email.';

COMMENT ON TRIGGER trigger_notify_new_reservation ON reservations IS 
'Trigger que se ejecuta automáticamente al insertar una nueva reserva y envía email de notificación al restaurante.';

COMMENT ON TRIGGER trigger_notify_cancelled_reservation ON reservations IS 
'Trigger que se ejecuta automáticamente cuando una reserva se cancela y envía email de notificación al restaurante.';

-- =====================
-- VERIFICACIÓN
-- =====================
-- Para verificar que los triggers se crearon correctamente:
-- SELECT * FROM pg_trigger WHERE tgname LIKE '%notify%';
-- SELECT routine_name, routine_definition FROM information_schema.routines WHERE routine_name LIKE '%notify%';

