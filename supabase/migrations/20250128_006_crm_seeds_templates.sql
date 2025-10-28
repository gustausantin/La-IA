    -- =====================================================
    -- CRM SEEDS - PLANTILLAS BASE Y REGLAS DE AUTOMATIZACIÓN
    -- Migración: 20250128_006_crm_seeds_templates.sql
    -- Autor: La-IA CRM Team
    -- Descripción: Plantillas base y reglas para todos los restaurantes
    -- =====================================================

    -- Función para insertar plantillas base en todos los restaurantes existentes
    CREATE OR REPLACE FUNCTION insert_base_templates_for_restaurant(p_restaurant_id UUID)
    RETURNS void AS $$
    BEGIN
        -- 1. PLANTILLA: Bienvenida (Nuevo Cliente)
        INSERT INTO message_templates (
            restaurant_id, name, category, segment, event_trigger,
            subject, content_markdown, variables, channel, is_active, priority
        ) VALUES (
            p_restaurant_id,
            'Bienvenida Nuevo Cliente',
            'bienvenida',
            'nuevo',
            'reservation_completed',
            '¡Bienvenido a {{restaurant_name}}! 🎉',
            E'¡Hola {{first_name}}! 👋\n\nSoy del equipo de **{{restaurant_name}}**. \n\n¡Gracias por registrarte y hacer tu primera reserva con nosotros! Esperamos que hayas disfrutado mucho de la experiencia. 🍽️\n\n¿Te parece bien si te enviamos de vez en cuando nuestras **novedades del menú** y **ofertas especiales**? \n\n¡Nos encantaría verte pronto de nuevo! ✨\n\n*Responde STOP si no quieres recibir más mensajes.*',
            ARRAY['first_name', 'restaurant_name'],
            'whatsapp',
            true,
            1
        ) ON CONFLICT (restaurant_id, name) DO NOTHING;

        -- 2. PLANTILLA: Reactivación (Cliente Inactivo)
        INSERT INTO message_templates (
            restaurant_id, name, category, segment, event_trigger,
            subject, content_markdown, variables, channel, is_active, priority
        ) VALUES (
            p_restaurant_id,
            'Reactivación Cliente Inactivo',
            'reactivacion',
            'inactivo',
            'daily_check',
            '¡Te echamos de menos en {{restaurant_name}}! 💔',
            E'¡Hola {{first_name}}! 😊\n\nHace **{{days_since_last_visit}} días** que no te vemos por **{{restaurant_name}}** y te echamos mucho de menos. 💔\n\n¿Qué te parece si te guardamos tu **mesa favorita** y te preparamos un **detallito especial** si vienes esta semana? 🎁\n\n**¡Tenemos novedades en el menú que seguro te van a encantar!** 🍽️\n\nReserva fácilmente respondiendo a este mensaje o llamando al {{restaurant_phone}}.\n\n*¡Esperamos verte muy pronto!* ✨\n\n*Responde STOP si no quieres recibir más mensajes.*',
            ARRAY['first_name', 'restaurant_name', 'days_since_last_visit', 'restaurant_phone'],
            'whatsapp',
            true,
            2
        ) ON CONFLICT (restaurant_id, name) DO NOTHING;

        -- 3. PLANTILLA: VIP Upgrade
        INSERT INTO message_templates (
            restaurant_id, name, category, segment, event_trigger,
            subject, content_markdown, variables, channel, is_active, priority
        ) VALUES (
            p_restaurant_id,
            'Bienvenida Cliente VIP',
            'vip_upgrade',
            'vip',
            'segment_changed',
            '¡Felicidades! Ahora eres cliente VIP 👑',
            E'¡Hola {{first_name}}! 👑\n\n**¡Felicidades!** Te has convertido en **cliente VIP** de {{restaurant_name}} gracias a tu fidelidad. \n\n**¿Qué significa ser VIP?**\n✨ **Postre de cortesía** en tu próxima visita\n🎯 **Reservas prioritarias** en fechas especiales\n🎁 **Ofertas exclusivas** solo para VIPs\n📱 **Atención personalizada** siempre\n\n**Tu próxima visita incluye un delicioso postre de cortesía.** 🥂\n\n¡Gracias por elegirnos una y otra vez! Eres parte de la familia {{restaurant_name}}. ❤️\n\n*Responde STOP si no quieres recibir más mensajes.*',
            ARRAY['first_name', 'restaurant_name'],
            'whatsapp',
            true,
            1
        ) ON CONFLICT (restaurant_id, name) DO NOTHING;

        -- 4. PLANTILLA: Cliente en Riesgo
        INSERT INTO message_templates (
            restaurant_id, name, category, segment, event_trigger,
            subject, content_markdown, variables, channel, is_active, priority
        ) VALUES (
            p_restaurant_id,
            'Recuperación Cliente en Riesgo',
            'recuperacion',
            'en_riesgo',
            'daily_check',
            '¿Todo bien? Te echamos de menos 💭',
            E'Hola {{first_name}} 😊\n\nHemos notado que antes venías más seguido a **{{restaurant_name}}** y queremos asegurarnos de que todo esté bien.\n\n¿Hubo algo que no te gustó en tu última visita? ¿Podemos mejorar algo? \n\n**Tu opinión es súper importante para nosotros.** 💬\n\nSi quieres darnos otra oportunidad, tenemos un **20% de descuento** especial para ti esta semana. 🎁\n\nResponde a este mensaje o llámanos al {{restaurant_phone}}. ¡Nos encantaría verte de nuevo!\n\n*Responde STOP si no quieres recibir más mensajes.*',
            ARRAY['first_name', 'restaurant_name', 'restaurant_phone'],
            'whatsapp',
            true,
            3
        ) ON CONFLICT (restaurant_id, name) DO NOTHING;

        -- 5. PLANTILLA: Alto Valor
        INSERT INTO message_templates (
            restaurant_id, name, category, segment, event_trigger,
            subject, content_markdown, variables, channel, is_active, priority
        ) VALUES (
            p_restaurant_id,
            'Reconocimiento Alto Valor',
            'alto_valor',
            'alto_valor',
            'segment_changed',
            'Gracias por ser un cliente tan especial 💎',
            E'{{first_name}}, ¡eres increíble! 💎\n\nQueremos reconocer que eres uno de nuestros **clientes más especiales** en {{restaurant_name}}.\n\nCon **{{visits_count}} visitas** y **€{{total_spent}}** invertidos con nosotros, demuestras una confianza que nos emociona profundamente. ❤️\n\n**Como agradecimiento:**\n🥂 **Cena degustación gratuita** para 2 personas\n👨‍🍳 **Mesa del chef** disponible para ti\n🎁 **Invitación exclusiva** a nuestros eventos privados\n\n¡Esperamos poder sorprenderte muy pronto con algo especial!\n\n*Responde STOP si no quieres recibir más mensajes.*',
            ARRAY['first_name', 'restaurant_name', 'visits_count', 'total_spent'],
            'whatsapp',
            true,
            1
        ) ON CONFLICT (restaurant_id, name) DO NOTHING;

        -- 6. PLANTILLA: Email Bienvenida
        INSERT INTO message_templates (
            restaurant_id, name, category, segment, event_trigger,
            subject, content_markdown, variables, channel, is_active, priority
        ) VALUES (
            p_restaurant_id,
            'Email Bienvenida',
            'bienvenida',
            'nuevo',
            'reservation_completed',
            '¡Bienvenido a la familia {{restaurant_name}}! 🎉',
            E'# ¡Hola {{first_name}}! 👋\n\nGracias por elegir **{{restaurant_name}}** para tu primera experiencia gastronómica con nosotros.\n\n## ¿Qué puedes esperar?\n\n✨ **Menú de temporada** con ingredientes frescos locales\n👨‍🍳 **Cocina artesanal** preparada con pasión\n🍷 **Maridajes únicos** seleccionados por nuestro sumiller\n🎵 **Ambiente acogedor** perfecto para cualquier ocasión\n\n## Mantente conectado\n\nSíguenos en nuestras redes sociales para conocer:\n- Nuevos platos y menús especiales\n- Eventos exclusivos para clientes\n- Ofertas y promociones especiales\n\n---\n\n**¡Esperamos verte muy pronto de nuevo!**\n\nEl equipo de {{restaurant_name}}\n📧 {{restaurant_email}} | 📞 {{restaurant_phone}}\n\n---\n*Si no deseas recibir más correos, puedes [darte de baja aquí]({{unsubscribe_url}}).*',
            ARRAY['first_name', 'restaurant_name', 'restaurant_email', 'restaurant_phone'],
            'email',
            true,
            2
        ) ON CONFLICT (restaurant_id, name) DO NOTHING;

    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    -- Función para insertar reglas de automatización base
    CREATE OR REPLACE FUNCTION insert_base_automation_rules_for_restaurant(p_restaurant_id UUID)
    RETURNS void AS $$
    DECLARE
        template_bienvenida_id UUID;
        template_reactivacion_id UUID;
        template_vip_id UUID;
        template_riesgo_id UUID;
        template_alto_valor_id UUID;
    BEGIN
        -- Obtener IDs de las plantillas creadas
        SELECT id INTO template_bienvenida_id FROM message_templates 
        WHERE restaurant_id = p_restaurant_id AND name = 'Bienvenida Nuevo Cliente';
        
        SELECT id INTO template_reactivacion_id FROM message_templates 
        WHERE restaurant_id = p_restaurant_id AND name = 'Reactivación Cliente Inactivo';
        
        SELECT id INTO template_vip_id FROM message_templates 
        WHERE restaurant_id = p_restaurant_id AND name = 'Bienvenida Cliente VIP';
        
        SELECT id INTO template_riesgo_id FROM message_templates 
        WHERE restaurant_id = p_restaurant_id AND name = 'Recuperación Cliente en Riesgo';
        
        SELECT id INTO template_alto_valor_id FROM message_templates 
        WHERE restaurant_id = p_restaurant_id AND name = 'Reconocimiento Alto Valor';

        -- 1. REGLA: Bienvenida automática
                INSERT INTO automation_rules (
            restaurant_id, name, description, is_active,
            trigger_event, target_segment, template_id,
            cooldown_days, max_executions_per_customer, max_daily_executions,
            execution_hours_start, execution_hours_end, execution_days_of_week,
            action_config
        ) VALUES (
            p_restaurant_id,
            'Bienvenida Nuevo Cliente',
            'Envía mensaje de bienvenida automáticamente cuando un cliente completa su primera reserva',
            true,
            'reservation_completed',
            'nuevo',
            template_bienvenida_id,
            90, -- 3 meses de cooldown
            1,  -- Solo una vez por cliente
            20, -- Máximo 20 bienvenidas por día
            '10:00', '20:00',
            ARRAY[1,2,3,4,5,6,7],
            '{"channel": "whatsapp", "fallback_to_email": true}'::jsonb
        ) ON CONFLICT (restaurant_id, name) DO NOTHING;

        -- 2. REGLA: Reactivación clientes inactivos
        INSERT INTO automation_rules (
            restaurant_id, name, description, is_active,
                    trigger_event, target_segment, template_id,
        cooldown_days, max_executions_per_customer, max_daily_executions,
        execution_hours_start, execution_hours_end, execution_days_of_week,
        action_config
        ) VALUES (
            p_restaurant_id,
            'Reactivación Clientes Inactivos',
            'Envía mensaje de reactivación a clientes que llevan más de 60 días sin visita',
            true,
            'daily_check',
            'inactivo',
            template_reactivacion_id,
            45, -- 45 días entre intentos de reactivación
            3,  -- Máximo 3 intentos por cliente
            15, -- Máximo 15 reactivaciones por día
            '11:00', '19:00',
            ARRAY[2,3,4,5,6], -- Martes a Sábado
            '{"channel": "whatsapp", "fallback_to_email": true, "min_days_inactive": 60}'::jsonb
        ) ON CONFLICT (restaurant_id, name) DO NOTHING;

        -- 3. REGLA: Upgrade a VIP
        INSERT INTO automation_rules (
            restaurant_id, name, description, is_active,
                    trigger_event, target_segment, template_id,
        cooldown_days, max_executions_per_customer, max_daily_executions,
        execution_hours_start, execution_hours_end, execution_days_of_week,
        action_config
        ) VALUES (
            p_restaurant_id,
            'Bienvenida VIP Automática',
            'Envía felicitación cuando un cliente se convierte en VIP',
            true,
            'segment_changed',
            'vip',
            template_vip_id,
            180, -- 6 meses de cooldown
            1,   -- Solo una vez por cliente
            10,  -- Máximo 10 upgrades VIP por día
            '12:00', '18:00',
            ARRAY[1,2,3,4,5,6,7],
            '{"channel": "whatsapp", "fallback_to_email": true, "from_segment": "regular"}'::jsonb
        ) ON CONFLICT (restaurant_id, name) DO NOTHING;

        -- 4. REGLA: Recuperación clientes en riesgo
        INSERT INTO automation_rules (
            restaurant_id, name, description, is_active,
                    trigger_event, target_segment, template_id,
        cooldown_days, max_executions_per_customer, max_daily_executions,
        execution_hours_start, execution_hours_end, execution_days_of_week,
        action_config
        ) VALUES (
            p_restaurant_id,
            'Recuperación Clientes en Riesgo',
            'Contacta clientes que solían ser frecuentes pero han reducido visitas',
            true,
            'daily_check',
            'en_riesgo',
            template_riesgo_id,
            60, -- 2 meses entre intentos
            2,  -- Máximo 2 intentos por cliente
            8,  -- Máximo 8 por día (más personalizado)
            '14:00', '17:00',
            ARRAY[3,4,5], -- Miércoles a Viernes
            '{"channel": "whatsapp", "fallback_to_email": true, "discount_percentage": 20}'::jsonb
        ) ON CONFLICT (restaurant_id, name) DO NOTHING;

        -- 5. REGLA: Reconocimiento alto valor
        INSERT INTO automation_rules (
            restaurant_id, name, description, is_active,
                    trigger_event, target_segment, template_id,
        cooldown_days, max_executions_per_customer, max_daily_executions,
        execution_hours_start, execution_hours_end, execution_days_of_week,
        action_config
        ) VALUES (
            p_restaurant_id,
            'Reconocimiento Alto Valor',
            'Agradece a clientes de alto valor por su fidelidad',
            true,
            'segment_changed',
            'alto_valor',
            template_alto_valor_id,
            365, -- Una vez al año
            1,   -- Solo una vez por cliente
            5,   -- Máximo 5 por día (muy exclusivo)
            '16:00', '18:00',
            ARRAY[1,2,3,4,5,6,7],
            '{"channel": "whatsapp", "fallback_to_email": true, "special_offer": "chef_table"}'::jsonb
        ) ON CONFLICT (restaurant_id, name) DO NOTHING;

    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    -- Aplicar plantillas y reglas a todos los restaurantes existentes
    DO $$
    DECLARE
        restaurant_record RECORD;
    BEGIN
        FOR restaurant_record IN 
            SELECT id FROM businesses WHERE active = true
        LOOP
            -- Insertar plantillas base
            PERFORM insert_base_templates_for_restaurant(restaurant_record.id);
            
            -- Insertar reglas de automatización base
            PERFORM insert_base_automation_rules_for_restaurant(restaurant_record.id);
            
            RAISE NOTICE 'Plantillas y reglas base creadas para restaurant ID: %', restaurant_record.id;
        END LOOP;
    END $$;

    -- Trigger para crear plantillas automáticamente en nuevos restaurantes
    CREATE OR REPLACE FUNCTION create_base_crm_templates_for_new_restaurant()
    RETURNS TRIGGER AS $$
    BEGIN
        -- Solo crear si el restaurante está activo
        IF NEW.active = true THEN
            PERFORM insert_base_templates_for_restaurant(NEW.id);
            PERFORM insert_base_automation_rules_for_restaurant(NEW.id);
            
            RAISE NOTICE 'Plantillas CRM base creadas automáticamente para nuevo restaurant: %', NEW.name;
        END IF;
        
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    -- Aplicar trigger a la tabla businesses
    DROP TRIGGER IF EXISTS trigger_create_base_crm_templates ON businesses;
    CREATE TRIGGER trigger_create_base_crm_templates
        AFTER INSERT ON businesses
        FOR EACH ROW
        EXECUTE FUNCTION create_base_crm_templates_for_new_restaurant();

    -- Limpiar funciones temporales (mantener solo las de utilidad)
    -- Las funciones insert_base_* se mantienen para uso futuro

    -- =====================================================
    -- COMENTARIOS Y DOCUMENTACIÓN
    -- =====================================================

    COMMENT ON FUNCTION insert_base_templates_for_restaurant(UUID) IS 'Crea plantillas base de CRM para un restaurante específico';
    COMMENT ON FUNCTION insert_base_automation_rules_for_restaurant(UUID) IS 'Crea reglas de automatización base para un restaurante específico';
    COMMENT ON FUNCTION create_base_crm_templates_for_new_restaurant() IS 'Trigger function: crea automáticamente plantillas CRM para restaurantes nuevos';

    -- =====================================================
    -- FIN DE SEEDS CRM
    -- =====================================================
