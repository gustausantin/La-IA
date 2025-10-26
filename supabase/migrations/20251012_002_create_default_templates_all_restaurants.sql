-- =====================================================
-- MIGRACIÓN: Crear plantillas por defecto para TODOS los restaurantes
-- Fecha: 2025-10-12
-- Descripción: Asegura que todos los restaurantes tengan las plantillas de recordatorios
-- =====================================================

-- Función para crear plantillas por defecto para un restaurante
CREATE OR REPLACE FUNCTION create_default_templates_for_restaurant(p_restaurant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- Recordatorio 24h antes
  INSERT INTO message_templates (
    restaurant_id,
    name,
    category,
    channel,
    content_markdown,
    is_active,
    segment,
    event_trigger
  ) VALUES (
    p_restaurant_id,
    'Recordatorio 24h antes',
    'recordatorio',
    'whatsapp',
    'Hola {{customer_name}}! 👋

Te esperamos *mañana a las {{reservation_time}}* para *{{party_size}} personas*.

¿Confirmas tu asistencia?

✅ Responde SÍ para confirmar
❌ Responde NO si necesitas cancelar

Gracias! 🍽️',
    true,
    'all',
    'manual'
  )
  ON CONFLICT (restaurant_id, name) DO NOTHING;

  -- Recordatorio 4h antes
  INSERT INTO message_templates (
    restaurant_id,
    name,
    category,
    channel,
    content_markdown,
    is_active,
    segment,
    event_trigger
  ) VALUES (
    p_restaurant_id,
    'Recordatorio 4h antes',
    'recordatorio',
    'whatsapp',
    '¡Hola {{customer_name}}! ⏰

Te recordamos que tu reserva es *HOY a las {{reservation_time}}* para *{{party_size}} personas*.

¿Todo listo para tu visita?

✅ Responde SÍ si vienes
❌ Responde NO si necesitas cancelar

¡Te esperamos! 🍽️',
    true,
    'all',
    'manual'
  )
  ON CONFLICT (restaurant_id, name) DO NOTHING;

END;
$$;

-- Crear plantillas para TODOS los restaurantes existentes
DO $$
DECLARE
  restaurant_record RECORD;
BEGIN
  FOR restaurant_record IN 
    SELECT id FROM restaurants
  LOOP
    PERFORM create_default_templates_for_restaurant(restaurant_record.id);
  END LOOP;
  
  RAISE NOTICE 'Plantillas por defecto creadas para todos los restaurantes';
END;
$$;

-- Trigger para crear plantillas automáticamente cuando se crea un nuevo restaurante
CREATE OR REPLACE FUNCTION trigger_create_default_templates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM create_default_templates_for_restaurant(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_restaurant_created_create_templates ON restaurants;

CREATE TRIGGER on_restaurant_created_create_templates
  AFTER INSERT ON restaurants
  FOR EACH ROW
  EXECUTE FUNCTION trigger_create_default_templates();

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_default_templates_for_restaurant TO service_role;
GRANT EXECUTE ON FUNCTION trigger_create_default_templates TO service_role;

-- =====================================================
-- VERIFICACIÓN:
-- =====================================================
-- Para verificar que todos los restaurantes tienen las plantillas:
/*
SELECT 
  r.id,
  r.name as restaurant_name,
  COUNT(mt.id) as template_count
FROM restaurants r
LEFT JOIN message_templates mt ON mt.restaurant_id = r.id 
  AND mt.name IN ('Recordatorio 24h antes', 'Recordatorio 4h antes')
GROUP BY r.id, r.name
ORDER BY template_count ASC;
*/

