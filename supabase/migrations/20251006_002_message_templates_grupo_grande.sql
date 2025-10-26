-- =====================================================
-- MESSAGE TEMPLATES - GRUPO GRANDE
-- Migración: 20251006_002_message_templates_grupo_grande.sql
-- Descripción: Agregar templates para gestión de grupos grandes
-- =====================================================

-- 1. ACTUALIZAR CONSTRAINTS para permitir nuevas categorías
-- =====================================================

-- Eliminar constraint existente de template_type si existe
ALTER TABLE message_templates 
DROP CONSTRAINT IF EXISTS message_templates_template_type_check;

-- Agregar nuevo constraint con tipos adicionales
ALTER TABLE message_templates 
ADD CONSTRAINT message_templates_template_type_check 
CHECK (template_type IN (
    'bienvenida', 
    'reactivacion', 
    'vip_upgrade', 
    'recordatorio', 
    'marketing', 
    'feedback', 
    'alto_valor', 
    'en_riesgo',
    'aprobacion_grupo',      -- 🆕 NUEVO
    'rechazo_grupo',         -- 🆕 NUEVO
    'confirmacion_24h'       -- 🆕 NUEVO
));

-- 2. INSERTAR TEMPLATES DE WHATSAPP PARA GRUPOS GRANDES
-- =====================================================

-- Template 1: Aprobación de Grupo Grande
INSERT INTO message_templates (
    restaurant_id,
    name,
    category,
    segment,
    event_trigger,
    content_markdown,
    variables,
    channel,
    is_active,
    template_type
)
SELECT 
    id as restaurant_id,
    'Aprobación Grupo Grande' as name,
    'grupo_grande' as category,
    'all' as segment,
    'group_approved' as event_trigger,
    '🎉 ¡Buenas noticias {{customer_name}}!

Tu reserva de grupo grande en {{restaurant_name}} ha sido APROBADA ✅

📅 {{reservation_date}}
🕐 {{reservation_time}}
👥 {{party_size}} personas
📍 {{zone}}

Recibirás un mensaje de confirmación 24 horas antes.

¡Te esperamos! 🍽️' as content_markdown,
    ARRAY['customer_name', 'restaurant_name', 'reservation_date', 'reservation_time', 'party_size', 'zone'] as variables,
    'whatsapp' as channel,
    true as is_active,
    'aprobacion_grupo' as template_type
FROM restaurants
WHERE NOT EXISTS (
    SELECT 1 FROM message_templates 
    WHERE message_templates.restaurant_id = restaurants.id 
    AND message_templates.name = 'Aprobación Grupo Grande'
);

-- Template 2: Rechazo de Grupo Grande
INSERT INTO message_templates (
    restaurant_id,
    name,
    category,
    segment,
    event_trigger,
    content_markdown,
    variables,
    channel,
    is_active,
    template_type
)
SELECT 
    id as restaurant_id,
    'Rechazo Grupo Grande' as name,
    'grupo_grande' as category,
    'all' as segment,
    'group_rejected' as event_trigger,
    'Hola {{customer_name}} 😔

Lamentablemente no hemos podido confirmar tu reserva de grupo grande en {{restaurant_name}}.

📅 {{reservation_date}}
🕐 {{reservation_time}}
👥 {{party_size}} personas

Motivo: {{rejection_reason}}

¿Quieres intentar con otra fecha? Llámanos al {{restaurant_phone}} y buscaremos la mejor opción para tu grupo.

¡Esperamos verte pronto! 🙏' as content_markdown,
    ARRAY['customer_name', 'restaurant_name', 'reservation_date', 'reservation_time', 'party_size', 'rejection_reason', 'restaurant_phone'] as variables,
    'whatsapp' as channel,
    true as is_active,
    'rechazo_grupo' as template_type
FROM restaurants
WHERE NOT EXISTS (
    SELECT 1 FROM message_templates 
    WHERE message_templates.restaurant_id = restaurants.id 
    AND message_templates.name = 'Rechazo Grupo Grande'
);

-- Template 3: Confirmación 24 horas antes
INSERT INTO message_templates (
    restaurant_id,
    name,
    category,
    segment,
    event_trigger,
    content_markdown,
    variables,
    channel,
    is_active,
    template_type
)
SELECT 
    id as restaurant_id,
    'Confirmación 24h Antes' as name,
    'recordatorio' as category,
    'all' as segment,
    'confirmation_24h' as event_trigger,
    'Hola {{customer_name}} 👋

Tienes una reserva en {{restaurant_name}} para MAÑANA:

📅 {{reservation_date}}
🕐 {{reservation_time}}
👥 {{party_size}} personas

¿Confirmas tu asistencia?

Responde:
✅ SÍ para confirmar
❌ NO para cancelar' as content_markdown,
    ARRAY['customer_name', 'restaurant_name', 'reservation_date', 'reservation_time', 'party_size'] as variables,
    'whatsapp' as channel,
    true as is_active,
    'confirmacion_24h' as template_type
FROM restaurants
WHERE NOT EXISTS (
    SELECT 1 FROM message_templates 
    WHERE message_templates.restaurant_id = restaurants.id 
    AND message_templates.name = 'Confirmación 24h Antes'
);

-- 3. CREAR ÍNDICES PARA MEJORAR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_message_templates_event_trigger 
ON message_templates(event_trigger);

CREATE INDEX IF NOT EXISTS idx_message_templates_category 
ON message_templates(category);

-- 4. COMENTARIOS PARA DOCUMENTACIÓN
-- =====================================================

COMMENT ON CONSTRAINT message_templates_template_type_check ON message_templates IS 
'Tipos de templates permitidos, incluyendo aprobacion_grupo, rechazo_grupo y confirmacion_24h para gestión de grupos grandes';

-- 5. VERIFICACIÓN
-- =====================================================

-- Mostrar templates creados
DO $$
DECLARE
    template_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO template_count
    FROM message_templates
    WHERE template_type IN ('aprobacion_grupo', 'rechazo_grupo', 'confirmacion_24h');
    
    RAISE NOTICE '✅ Templates de grupo grande creados: %', template_count;
END $$;
