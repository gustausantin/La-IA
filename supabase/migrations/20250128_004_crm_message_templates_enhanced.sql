-- ========================================
-- CRM MESSAGE TEMPLATES ENHANCED - MIGRATION 004
-- Fecha: 28 Enero 2025
-- Descripción: Mejorar tabla message_templates para CRM avanzado
-- ========================================

-- 1. ACTUALIZAR TABLA message_templates existente
ALTER TABLE message_templates 
ADD COLUMN IF NOT EXISTS template_type VARCHAR CHECK (template_type IN ('bienvenida', 'reactivacion', 'vip_upgrade', 'recordatorio', 'marketing', 'feedback', 'alto_valor', 'en_riesgo')),
ADD COLUMN IF NOT EXISTS body_markdown TEXT, -- Contenido en Markdown
ADD COLUMN IF NOT EXISTS preview_text TEXT, -- Texto de preview para emails
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT ARRAY[]::TEXT[], -- Tags para organización
ADD COLUMN IF NOT EXISTS personalization_level VARCHAR DEFAULT 'basic' CHECK (personalization_level IN ('basic', 'advanced', 'ai_powered')),
ADD COLUMN IF NOT EXISTS success_rate NUMERIC DEFAULT 0.00, -- Tasa de éxito (0-100)
ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS conversion_rate NUMERIC DEFAULT 0.00; -- Tasa de conversión

-- 2. CREAR TABLA template_variables (variables disponibles)
CREATE TABLE IF NOT EXISTS template_variables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    
    variable_name VARCHAR NOT NULL, -- ej: first_name, last_visit_at, fav_item
    variable_type VARCHAR NOT NULL CHECK (variable_type IN ('text', 'date', 'number', 'currency', 'list')),
    description TEXT NOT NULL,
    example_value TEXT,
    
    -- Categorización
    category VARCHAR NOT NULL CHECK (category IN ('customer', 'restaurant', 'reservation', 'custom')),
    data_source VARCHAR, -- ej: customers.first_name, reservations.created_at
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- 3. INSERTAR VARIABLES PREDEFINIDAS para CRM
INSERT INTO template_variables (restaurant_id, variable_name, variable_type, description, example_value, category, data_source)
SELECT 
    r.id,
    'first_name',
    'text',
    'Nombre del cliente',
    'María',
    'customer',
    'customers.first_name'
FROM restaurants r
ON CONFLICT DO NOTHING;

INSERT INTO template_variables (restaurant_id, variable_name, variable_type, description, example_value, category, data_source)
SELECT 
    r.id,
    'full_name',
    'text',
    'Nombre completo del cliente',
    'María García López',
    'customer',
    'customers.name'
FROM restaurants r
ON CONFLICT DO NOTHING;

INSERT INTO template_variables (restaurant_id, variable_name, variable_type, description, example_value, category, data_source)
SELECT 
    r.id,
    'last_visit_at',
    'date',
    'Fecha de última visita',
    '15 de enero 2025',
    'customer',
    'customers.last_visit_at'
FROM restaurants r
ON CONFLICT DO NOTHING;

INSERT INTO template_variables (restaurant_id, variable_name, variable_type, description, example_value, category, data_source)
SELECT 
    r.id,
    'visits_count',
    'number',
    'Número total de visitas',
    '8',
    'customer',
    'customers.visits_count'
FROM restaurants r
ON CONFLICT DO NOTHING;

INSERT INTO template_variables (restaurant_id, variable_name, variable_type, description, example_value, category, data_source)
SELECT 
    r.id,
    'total_spent',
    'currency',
    'Total gastado por el cliente',
    '€285.50',
    'customer',
    'customers.total_spent'
FROM restaurants r
ON CONFLICT DO NOTHING;

INSERT INTO template_variables (restaurant_id, variable_name, variable_type, description, example_value, category, data_source)
SELECT 
    r.id,
    'restaurant_name',
    'text',
    'Nombre del restaurante',
    'Restaurante La Buena Mesa',
    'restaurant',
    'restaurants.name'
FROM restaurants r
ON CONFLICT DO NOTHING;

-- 4. INSERTAR PLANTILLAS PREDEFINIDAS
INSERT INTO message_templates (restaurant_id, name, category, template_type, channel, subject, content, body_markdown, variables, tags)
SELECT 
    r.id,
    'Reactivación Cliente Inactivo',
    'reactivacion',
    'reactivacion',
    'email',
    '¡Te echamos de menos, {{first_name}}! 🍽️',
    'Hola {{first_name}}, hace tiempo que no te vemos en {{restaurant_name}}. Tu última visita fue el {{last_visit_at}}. ¡Vuelve y disfruta de nuestras novedades!',
    '# ¡Hola {{first_name}}! 👋

Hace **{{days_since_last_visit}} días** que no te vemos en **{{restaurant_name}}** y queremos que sepas que... **¡te echamos de menos!** 😔

## 🍽️ Tu última visita
Fue el **{{last_visit_at}}** y desde entonces hemos añadido platos increíbles que sabemos que te encantarán.

## 🎁 Oferta especial para ti
Como cliente especial, tienes un **20% de descuento** en tu próxima visita. Solo tienes que mencionar el código **VUELVE20**.

[**Reservar Mesa**]({{reservation_link}}) | [**Ver Carta**]({{menu_link}})

---
*{{restaurant_name}} - Donde cada comida es especial* ❤️',
    ARRAY['first_name', 'restaurant_name', 'last_visit_at', 'days_since_last_visit'],
    ARRAY['reactivacion', 'email', 'descuento']
FROM restaurants r
ON CONFLICT DO NOTHING;

INSERT INTO message_templates (restaurant_id, name, category, template_type, channel, subject, content, body_markdown, variables, tags)
SELECT 
    r.id,
    'Bienvenida Cliente VIP',
    'vip',
    'vip_upgrade',
    'whatsapp',
    'Bienvenida VIP',
    '🎉 ¡Felicidades {{first_name}}! Eres oficialmente cliente VIP de {{restaurant_name}} tras {{visits_count}} visitas. Disfruta de mesa preferente, descuentos exclusivos y atención prioritaria. ¡Gracias por tu fidelidad! 👑',
    '🎉 **¡Felicidades {{first_name}}!**

Eres oficialmente **cliente VIP** de {{restaurant_name}} tras **{{visits_count}} visitas**.

## 👑 Beneficios VIP:
- 🪑 Mesa preferente
- 💰 Descuentos exclusivos
- ⭐ Atención prioritaria
- 🎁 Sorpresas especiales

**¡Gracias por tu fidelidad!** ❤️',
    ARRAY['first_name', 'restaurant_name', 'visits_count'],
    ARRAY['vip', 'whatsapp', 'bienvenida']
FROM restaurants r
ON CONFLICT DO NOTHING;

-- 5. CREAR ÍNDICES
CREATE INDEX IF NOT EXISTS idx_message_templates_type ON message_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_message_templates_channel ON message_templates(channel);
CREATE INDEX IF NOT EXISTS idx_message_templates_active ON message_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_message_templates_success_rate ON message_templates(success_rate DESC);

CREATE INDEX idx_template_variables_restaurant ON template_variables(restaurant_id);
CREATE INDEX idx_template_variables_category ON template_variables(category);
CREATE INDEX idx_template_variables_name ON template_variables(variable_name);

-- 6. RLS para template_variables
ALTER TABLE template_variables ENABLE ROW LEVEL SECURITY;

CREATE POLICY template_variables_restaurant_access ON template_variables
    FOR ALL 
    USING (
        restaurant_id IN (
            SELECT urm.restaurant_id 
            FROM user_restaurant_mapping urm 
            WHERE urm.auth_user_id = auth.uid() 
            AND urm.active = true
        )
    );

-- 7. COMENTARIOS
COMMENT ON COLUMN message_templates.template_type IS 'Tipo de plantilla (bienvenida, reactivacion, vip_upgrade, etc.)';
COMMENT ON COLUMN message_templates.body_markdown IS 'Contenido de la plantilla en formato Markdown';
COMMENT ON COLUMN message_templates.personalization_level IS 'Nivel de personalización (basic, advanced, ai_powered)';
COMMENT ON COLUMN message_templates.success_rate IS 'Tasa de éxito de la plantilla (0-100)';
COMMENT ON COLUMN message_templates.conversion_rate IS 'Tasa de conversión (clics/acciones) de la plantilla';

COMMENT ON TABLE template_variables IS 'Variables disponibles para personalizar plantillas';
COMMENT ON COLUMN template_variables.data_source IS 'Fuente de datos (tabla.columna) para obtener el valor';

-- ========================================
-- MESSAGE TEMPLATES ENHANCED COMPLETADO ✅
-- ========================================
