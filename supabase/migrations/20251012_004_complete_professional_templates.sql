-- =====================================================
-- MIGRACIÓN: Sistema completo de plantillas profesionales
-- Fecha: 2025-10-12
-- Descripción: Crea todas las plantillas CRM profesionales para cada restaurante
-- =====================================================

-- Eliminar función anterior y recrearla con TODAS las plantillas
DROP FUNCTION IF EXISTS create_default_templates_for_restaurant(UUID);

CREATE OR REPLACE FUNCTION create_default_templates_for_restaurant(p_restaurant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  
  -- ===========================================
  -- CATEGORÍA: BIENVENIDA
  -- ===========================================
  
  -- 1. Bienvenida Nuevo Cliente (WhatsApp)
  INSERT INTO message_templates (
    restaurant_id, name, category, channel, content_markdown, is_active, segment, event_trigger
  ) VALUES (
    p_restaurant_id,
    'Bienvenida Nuevo Cliente',
    'bienvenida',
    'whatsapp',
    'Hola {{customer_name}}! 👋

Gracias por tu primera reserva en {{restaurant_name}}. 

Esperamos que disfrutes mucho de la experiencia.

¡Te esperamos! 🍽️',
    true,
    'all',
    'manual'
  ) ON CONFLICT (restaurant_id, name) DO NOTHING;

  -- 2. Bienvenida Nuevo Cliente (Email)
  INSERT INTO message_templates (
    restaurant_id, name, category, channel, content_markdown, is_active, segment, event_trigger
  ) VALUES (
    p_restaurant_id,
    'Email Bienvenida',
    'bienvenida',
    'email',
    '# ¡Bienvenido/a {{customer_name}}! 👋

Gracias por elegir **{{restaurant_name}}** para tu primera visita.

## Lo que te espera:

✨ Ingredientes frescos de temporada  
👨‍🍳 Cocina artesanal con pasión  
🍷 Maridajes cuidadosamente seleccionados  
🎵 Ambiente acogedor y profesional

Esperamos verte pronto.

---
El equipo de {{restaurant_name}}',
    true,
    'all',
    'manual'
  ) ON CONFLICT (restaurant_id, name) DO NOTHING;

  -- ===========================================
  -- CATEGORÍA: RECORDATORIOS DE RESERVA
  -- ===========================================
  
  -- 3. Confirmación 24h Antes
  INSERT INTO message_templates (
    restaurant_id, name, category, channel, content_markdown, is_active, segment, event_trigger
  ) VALUES (
    p_restaurant_id,
    'Confirmación 24h Antes',
    'recordatorio',
    'whatsapp',
    'Hola {{customer_name}}! 👋

Te recordamos tu reserva en {{restaurant_name}}:

📅 Mañana
🕐 {{reservation_time}}
👥 {{party_size}} personas

¿Confirmas tu asistencia?

✅ Responde SÍ para confirmar
❌ Responde NO si necesitas cancelar

Gracias!',
    true,
    'all',
    'manual'
  ) ON CONFLICT (restaurant_id, name) DO NOTHING;

  -- 4. Recordatorio Urgente (4h antes)
  INSERT INTO message_templates (
    restaurant_id, name, category, channel, content_markdown, is_active, segment, event_trigger
  ) VALUES (
    p_restaurant_id,
    'Recordatorio Urgente',
    'recordatorio',
    'whatsapp',
    '¡Hola {{customer_name}}! ⏰

Recordatorio: tu reserva es HOY

🕐 A las {{reservation_time}}
👥 Para {{party_size}} personas

¿Todo listo para tu visita?

✅ Responde SÍ si vienes
❌ Responde NO si necesitas cancelar

¡Te esperamos!',
    true,
    'all',
    'manual'
  ) ON CONFLICT (restaurant_id, name) DO NOTHING;

  -- ===========================================
  -- CATEGORÍA: CLIENTES VIP
  -- ===========================================
  
  -- 5. Upgrade a Cliente VIP
  INSERT INTO message_templates (
    restaurant_id, name, category, channel, content_markdown, is_active, segment, event_trigger
  ) VALUES (
    p_restaurant_id,
    'Bienvenida Cliente VIP',
    'vip_upgrade',
    'whatsapp',
    '¡Hola {{customer_name}}! 👑

**¡Felicidades!** Ahora eres cliente VIP de {{restaurant_name}}.

**Tus beneficios:**
✨ Postre de cortesía en tu próxima visita
🎯 Reservas prioritarias
🎁 Ofertas exclusivas
📱 Atención personalizada

Gracias por tu fidelidad.

{{restaurant_name}} ❤️',
    true,
    'all',
    'manual'
  ) ON CONFLICT (restaurant_id, name) DO NOTHING;

  -- ===========================================
  -- CATEGORÍA: ALTO VALOR
  -- ===========================================
  
  -- 6. Reconocimiento Cliente Alto Valor
  INSERT INTO message_templates (
    restaurant_id, name, category, channel, content_markdown, is_active, segment, event_trigger
  ) VALUES (
    p_restaurant_id,
    'Reconocimiento Alto Valor',
    'alto_valor',
    'whatsapp',
    '{{customer_name}}, ¡eres increíble! 💎

Queremos reconocer que eres uno de nuestros clientes más especiales en {{restaurant_name}}.

**Tus visitas nos importan:**
📊 {{visits_count}} visitas
💰 {{total_spent}}€ invertidos

**Como agradecimiento:**
🥂 Cena degustación para 2
👨‍🍳 Mesa del chef disponible
🎁 Invitación a eventos privados

¡Gracias por confiar en nosotros!',
    true,
    'all',
    'manual'
  ) ON CONFLICT (restaurant_id, name) DO NOTHING;

  -- ===========================================
  -- CATEGORÍA: REACTIVACIÓN / EN RIESGO
  -- ===========================================
  
  -- 7. Cliente Inactivo
  INSERT INTO message_templates (
    restaurant_id, name, category, channel, content_markdown, is_active, segment, event_trigger
  ) VALUES (
    p_restaurant_id,
    'Reactivación Cliente Inactivo',
    'reactivacion',
    'whatsapp',
    '¡Hola {{customer_name}}! 😊

Hace {{days_since_last_visit}} días que no te vemos en {{restaurant_name}} y te echamos de menos.

**Tenemos novedades en el menú** que seguro te encantarán 🍽️

¿Qué te parece reservar tu mesa favorita?

Responde a este mensaje o llama al {{restaurant_phone}}.

¡Esperamos verte pronto! ✨',
    true,
    'all',
    'manual'
  ) ON CONFLICT (restaurant_id, name) DO NOTHING;

  -- 8. Cliente en Riesgo
  INSERT INTO message_templates (
    restaurant_id, name, category, channel, content_markdown, is_active, segment, event_trigger
  ) VALUES (
    p_restaurant_id,
    'Recuperación Cliente en Riesgo',
    'recuperacion',
    'whatsapp',
    'Hola {{customer_name}} 😊

Notamos que antes venías más seguido y queremos asegurarnos de que todo esté bien.

¿Hubo algo que no te gustó en tu última visita?

**Tu opinión es muy importante para nosotros.** 💬

Si quieres darnos otra oportunidad, tienes un **20% de descuento** esta semana. 🎁

Responde o llámanos al {{restaurant_phone}}.

¡Nos encantaría verte de nuevo!',
    true,
    'all',
    'manual'
  ) ON CONFLICT (restaurant_id, name) DO NOTHING;

  -- ===========================================
  -- CATEGORÍA: NO-SHOWS
  -- ===========================================
  
  -- 9. Seguimiento No-Show
  INSERT INTO message_templates (
    restaurant_id, name, category, channel, content_markdown, is_active, segment, event_trigger
  ) VALUES (
    p_restaurant_id,
    'Seguimiento No-Show',
    'noshow',
    'whatsapp',
    'Hola {{customer_name}},

Notamos que no pudiste venir a tu reserva de ayer en {{restaurant_name}}.

¿Todo bien? ¿Hubo algún problema?

Si quieres volver a reservar, estamos aquí para ayudarte.

Responde a este mensaje o llama al {{restaurant_phone}}.

¡Esperamos verte pronto! 🍽️',
    true,
    'all',
    'manual'
  ) ON CONFLICT (restaurant_id, name) DO NOTHING;

  -- ===========================================
  -- CATEGORÍA: GRUPOS GRANDES
  -- ===========================================
  
  -- 10. Aprobación Grupo Grande
  INSERT INTO message_templates (
    restaurant_id, name, category, channel, content_markdown, is_active, segment, event_trigger
  ) VALUES (
    p_restaurant_id,
    'Aprobación Grupo Grande',
    'grupo_grande',
    'whatsapp',
    '🎉 ¡Buenas noticias {{customer_name}}!

Tu reserva de grupo grande en {{restaurant_name}} ha sido APROBADA ✅

📅 {{reservation_date}}
🕐 {{reservation_time}}
👥 {{party_size}} personas
📍 {{zone}}

Recibirás un recordatorio 24 horas antes.

¡Te esperamos! 🍽️',
    true,
    'all',
    'manual'
  ) ON CONFLICT (restaurant_id, name) DO NOTHING;

  -- 11. Rechazo Grupo Grande
  INSERT INTO message_templates (
    restaurant_id, name, category, channel, content_markdown, is_active, segment, event_trigger
  ) VALUES (
    p_restaurant_id,
    'Rechazo Grupo Grande',
    'grupo_grande',
    'whatsapp',
    'Hola {{customer_name}} 😔

Lamentablemente no pudimos confirmar tu reserva de grupo grande en {{restaurant_name}}.

📅 {{reservation_date}}
🕐 {{reservation_time}}
👥 {{party_size}} personas

**Motivo:** {{rejection_reason}}

¿Quieres intentar con otra fecha?

Llámanos al {{restaurant_phone}} y buscaremos la mejor opción.

¡Esperamos verte pronto! 🙏',
    true,
    'all',
    'manual'
  ) ON CONFLICT (restaurant_id, name) DO NOTHING;

END;
$$;

-- ===========================================
-- ACTUALIZAR PLANTILLAS PARA RESTAURANTES EXISTENTES
-- ===========================================

DO $$
DECLARE
  restaurant_record RECORD;
BEGIN
  FOR restaurant_record IN 
    SELECT id FROM restaurants
  LOOP
    PERFORM create_default_templates_for_restaurant(restaurant_record.id);
  END LOOP;
  
  RAISE NOTICE 'Sistema completo de plantillas creado para todos los restaurantes';
END;
$$;

-- ===========================================
-- VERIFICACIÓN
-- ===========================================

-- Ver todas las plantillas por restaurante
/*
SELECT 
  r.name as restaurant_name,
  mt.name as template_name,
  mt.category,
  mt.channel,
  mt.is_active
FROM restaurants r
JOIN message_templates mt ON mt.restaurant_id = r.id
ORDER BY r.name, mt.category, mt.name;
*/

-- Contar plantillas por restaurante
/*
SELECT 
  r.id,
  r.name as restaurant_name,
  COUNT(mt.id) as template_count
FROM restaurants r
LEFT JOIN message_templates mt ON mt.restaurant_id = r.id
GROUP BY r.id, r.name
ORDER BY template_count DESC;
*/

