-- ========================================
-- PLANTILLAS CRM: Recordatorios 24h y 4h
-- Fecha: 11 Octubre 2025
-- Descripción: Añadir plantillas personalizables para recordatorios automáticos
-- ========================================

-- Función para insertar plantillas de recordatorio para un restaurante
CREATE OR REPLACE FUNCTION insert_reminder_templates_for_restaurant(p_restaurant_id UUID)
RETURNS void AS $$
BEGIN
    -- 1. PLANTILLA: Recordatorio 24h antes
    INSERT INTO message_templates (
        restaurant_id, 
        name, 
        category, 
        template_type,
        segment, 
        event_trigger,
        subject, 
        content_markdown, 
        variables, 
        channel, 
        is_active, 
        priority,
        send_delay_hours,
        optimal_send_time,
        tags
    ) VALUES (
        p_restaurant_id,
        'Recordatorio 24h antes',
        'recordatorio',
        'recordatorio',
        'all',
        'reservation_reminder_24h',
        'Recordatorio: Reserva mañana en {{restaurant_name}} 📅',
        E'Hola {{customer_name}}! 👋\n\nTe esperamos *mañana a las {{reservation_time}}* para *{{party_size}} personas*.\n\n¿Confirmas tu asistencia?\n\n✅ Responde SÍ para confirmar\n❌ Responde NO si necesitas cancelar\n\nGracias! 🍽️',
        ARRAY['customer_name', 'restaurant_name', 'reservation_time', 'party_size'],
        'whatsapp',
        true,
        1,
        -24, -- Enviar 24h antes
        '10:00', -- Hora óptima de envío
        ARRAY['recordatorio', 'whatsapp', 'confirmacion', '24h']
    ) ON CONFLICT (restaurant_id, name) DO UPDATE 
    SET 
        content_markdown = EXCLUDED.content_markdown,
        variables = EXCLUDED.variables,
        updated_at = NOW();

    -- 2. PLANTILLA: Recordatorio 4h antes (Alerta urgente)
    INSERT INTO message_templates (
        restaurant_id, 
        name, 
        category, 
        template_type,
        segment, 
        event_trigger,
        subject, 
        content_markdown, 
        variables, 
        channel, 
        is_active, 
        priority,
        send_delay_hours,
        optimal_send_time,
        tags
    ) VALUES (
        p_restaurant_id,
        'Recordatorio 4h antes',
        'recordatorio',
        'recordatorio',
        'all',
        'reservation_reminder_4h',
        '⏰ Tu reserva es en 4 horas - {{restaurant_name}}',
        E'¡Hola {{customer_name}}! ⏰\n\nTe recordamos que tu reserva es *HOY a las {{reservation_time}}* para *{{party_size}} personas*.\n\n¿Todo listo para tu visita?\n\n✅ Responde SÍ si vienes\n❌ Responde NO si necesitas cancelar\n\n¡Te esperamos! 🍽️',
        ARRAY['customer_name', 'restaurant_name', 'reservation_time', 'party_size'],
        'whatsapp',
        true,
        2, -- Alta prioridad
        -4, -- Enviar 4h antes
        'any', -- Cualquier hora (4h antes de la reserva)
        ARRAY['recordatorio', 'whatsapp', 'urgente', '4h']
    ) ON CONFLICT (restaurant_id, name) DO UPDATE 
    SET 
        content_markdown = EXCLUDED.content_markdown,
        variables = EXCLUDED.variables,
        updated_at = NOW();

    RAISE NOTICE 'Plantillas de recordatorio creadas/actualizadas para restaurant ID: %', p_restaurant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplicar plantillas a todos los restaurantes existentes
DO $$
DECLARE
    restaurant_record RECORD;
BEGIN
    FOR restaurant_record IN 
        SELECT id, name FROM businesses WHERE active = true
    LOOP
        PERFORM insert_reminder_templates_for_restaurant(restaurant_record.id);
        RAISE NOTICE 'Plantillas de recordatorio creadas para: %', restaurant_record.name;
    END LOOP;
END $$;

-- Actualizar trigger para incluir plantillas de recordatorio en nuevos restaurantes
CREATE OR REPLACE FUNCTION create_base_crm_templates_for_new_restaurant()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.active = true THEN
        -- Plantillas base (función existente)
        PERFORM insert_base_templates_for_restaurant(NEW.id);
        PERFORM insert_base_automation_rules_for_restaurant(NEW.id);
        
        -- Plantillas de recordatorio (nueva)
        PERFORM insert_reminder_templates_for_restaurant(NEW.id);
        
        RAISE NOTICE 'Plantillas CRM completas creadas automáticamente para: %', NEW.name;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- FUNCIÓN: Obtener plantilla de recordatorio para N8n
-- ========================================

CREATE OR REPLACE FUNCTION get_reminder_template(
    p_restaurant_id UUID,
    p_template_name TEXT DEFAULT 'Recordatorio 24h antes'
)
RETURNS TABLE(
    template_id UUID,
    template_name TEXT,
    content TEXT,
    variables TEXT[],
    channel TEXT,
    is_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mt.id as template_id,
        mt.name as template_name,
        mt.content_markdown as content,
        mt.variables,
        mt.channel,
        mt.is_active
    FROM message_templates mt
    WHERE mt.restaurant_id = p_restaurant_id
    AND mt.name = p_template_name
    AND mt.is_active = true
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- FUNCIÓN: Reemplazar variables en plantilla
-- ========================================

CREATE OR REPLACE FUNCTION replace_template_variables(
    p_template_content TEXT,
    p_variables JSONB
)
RETURNS TEXT AS $$
DECLARE
    v_result TEXT;
    v_key TEXT;
    v_value TEXT;
BEGIN
    v_result := p_template_content;
    
    -- Iterar sobre cada variable en el JSONB
    FOR v_key, v_value IN SELECT * FROM jsonb_each_text(p_variables)
    LOOP
        -- Reemplazar {{variable}} con el valor
        v_result := REPLACE(v_result, '{{' || v_key || '}}', v_value);
    END LOOP;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ========================================
-- COMENTARIOS
-- ========================================

COMMENT ON FUNCTION insert_reminder_templates_for_restaurant(UUID) IS 'Crea/actualiza plantillas de recordatorio (24h y 4h) para un restaurante';
COMMENT ON FUNCTION get_reminder_template(UUID, TEXT) IS 'Obtiene plantilla de recordatorio activa para N8n workflows';
COMMENT ON FUNCTION replace_template_variables(TEXT, JSONB) IS 'Reemplaza variables {{variable}} en una plantilla con valores reales';

-- ========================================
-- PLANTILLAS DE RECORDATORIO COMPLETADAS ✅
-- ========================================


