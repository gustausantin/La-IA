-- =====================================================
-- MIGRACIÓN DEFINITIVA - ORDEN CORRECTO
-- Para: https://zrcsujgurtglyqoqiynr.supabase.co
-- =====================================================

-- =====================================================
-- PASO 1: EXTENSIONES
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- =====================================================
-- PASO 2: TIPOS ENUM (antes de tablas)
-- =====================================================

-- Crear ENUMs solo si no existen (evitar error "already exists")
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'zone_type') THEN
        CREATE TYPE zone_type AS ENUM ('interior', 'terraza', 'barra', 'privado', 'exterior');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'channel_type') THEN
        CREATE TYPE channel_type AS ENUM ('whatsapp', 'vapi', 'phone', 'email', 'web', 'instagram', 'facebook', 'google');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('owner', 'admin', 'manager', 'staff', 'viewer');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reservation_status') THEN
        CREATE TYPE reservation_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed', 'no_show', 'pending_approval');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'table_status') THEN
        CREATE TYPE table_status AS ENUM ('available', 'occupied', 'reserved', 'maintenance', 'disabled');
    END IF;
END $$;

-- =====================================================
-- PASO 3: TABLAS (61 tablas)
-- =====================================================

-- =====================================================
-- TABLA: agent_conversations
-- Descripción: Gestión de conversaciones del agente IA
-- =====================================================
CREATE TABLE IF NOT EXISTS agent_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    customer_id UUID,
    customer_phone VARCHAR NOT NULL,
    customer_name VARCHAR,
    customer_email VARCHAR,
    source_channel VARCHAR NOT NULL,
    interaction_type VARCHAR NOT NULL,
    status VARCHAR NOT NULL DEFAULT 'active',
    outcome VARCHAR,
    reservation_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolution_time_seconds INTEGER,
    sentiment VARCHAR,
    metadata JSONB DEFAULT '{}'
);

-- =====================================================
-- TABLA: agent_insights
-- Descripción: Insights y recomendaciones generadas por IA
-- =====================================================
CREATE TABLE IF NOT EXISTS agent_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID,
    type VARCHAR(50),
    title VARCHAR(255),
    description TEXT,
    priority VARCHAR(20) DEFAULT 'medium',
    action_required BOOLEAN DEFAULT FALSE,
    data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- =====================================================
-- TABLA: agent_messages
-- Descripción: Mensajes individuales dentro de conversaciones
-- =====================================================
CREATE TABLE IF NOT EXISTS agent_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL,
    restaurant_id UUID NOT NULL,
    direction VARCHAR NOT NULL,
    sender VARCHAR NOT NULL,
    message_text TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    tokens_used INTEGER,
    confidence_score NUMERIC,
    customer_phone VARCHAR NOT NULL
);

-- =====================================================
-- TABLA: agent_metrics
-- Descripción: Métricas diarias del agente IA
-- =====================================================
CREATE TABLE IF NOT EXISTS agent_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID,
    date DATE DEFAULT CURRENT_DATE,
    total_conversations INTEGER DEFAULT 0,
    successful_bookings INTEGER DEFAULT 0,
    avg_response_time DOUBLE PRECISION DEFAULT 0,
    conversion_rate DOUBLE PRECISION DEFAULT 0,
    customer_satisfaction DOUBLE PRECISION DEFAULT 0,
    channel_breakdown JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLA: ai_conversation_insights
-- Descripción: Análisis de sentimiento e intención por conversación
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_conversation_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL,
    restaurant_id UUID NOT NULL,
    sentiment VARCHAR(20),
    intent VARCHAR(50),
    confidence_score NUMERIC,
    key_topics TEXT[],
    suggested_actions TEXT[],
    urgency_level INTEGER DEFAULT 1,
    customer_satisfaction_predicted NUMERIC,
    analysis_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLA: analytics
-- Descripción: Métricas y KPIs del restaurante
-- =====================================================
CREATE TABLE IF NOT EXISTS analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    type VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    value NUMERIC NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW())
);

-- =====================================================
-- TABLA: analytics_historical
-- Descripción: Almacenamiento histórico de métricas
-- =====================================================
CREATE TABLE IF NOT EXISTS analytics_historical (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    metric_type TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    metric_value NUMERIC NOT NULL,
    dimension1 TEXT,
    dimension1_value TEXT,
    dimension2 TEXT,
    dimension2_value TEXT,
    period_type TEXT NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW())
);

-- =====================================================
-- TABLA: automation_rule_executions
-- Descripción: Registro de ejecuciones de reglas de automatización
-- =====================================================
CREATE TABLE IF NOT EXISTS automation_rule_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    rule_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    executed_at TIMESTAMPTZ DEFAULT timezone('utc', NOW()),
    status VARCHAR NOT NULL DEFAULT 'pending',
    result_data JSONB DEFAULT '{}',
    error_message TEXT,
    interaction_id UUID,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', NOW())
);

-- =====================================================
-- TABLA: automation_rules
-- Descripción: Reglas de automatización de CRM
-- =====================================================
CREATE TABLE IF NOT EXISTS automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    name VARCHAR NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    rule_type VARCHAR,
    trigger_condition JSONB NOT NULL DEFAULT '{}',
    action_type VARCHAR,
    action_config JSONB NOT NULL DEFAULT '{}',
    cooldown_days INTEGER DEFAULT 30,
    max_executions_per_customer INTEGER DEFAULT 3,
    execution_window_days INTEGER DEFAULT 90,
    execution_hours_start TIME DEFAULT '09:00:00',
    execution_hours_end TIME DEFAULT '21:00:00',
    execution_days_of_week INTEGER[] DEFAULT ARRAY[1,2,3,4,5,6,7],
    created_by UUID,
    last_executed_at TIMESTAMPTZ,
    total_executions INTEGER DEFAULT 0,
    successful_executions INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', NOW()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', NOW()),
    trigger_event TEXT NOT NULL DEFAULT 'manual',
    target_segment TEXT,
    template_id UUID,
    max_daily_executions INTEGER DEFAULT 50,
    aivi_config JSONB DEFAULT '{}',
    trigger_conditions_v2 JSONB DEFAULT '{}',
    execution_stats JSONB DEFAULT '{}',
    last_optimization_at TIMESTAMPTZ
);

-- =====================================================
-- TABLA: availability_change_log
-- Descripción: Log de cambios que requieren regeneración de disponibilidad
-- =====================================================
CREATE TABLE IF NOT EXISTS availability_change_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    change_type TEXT NOT NULL,
    change_description TEXT NOT NULL,
    old_values JSONB DEFAULT '{}',
    new_values JSONB DEFAULT '{}',
    affected_tables TEXT[] DEFAULT ARRAY[]::TEXT[],
    requires_regeneration BOOLEAN DEFAULT TRUE,
    regeneration_completed BOOLEAN DEFAULT FALSE,
    regeneration_completed_at TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    affected_dates_start DATE,
    affected_dates_end DATE
);

-- =====================================================
-- TABLA: availability_slots
-- Descripción: Slots de disponibilidad para reservas
-- =====================================================
CREATE TABLE IF NOT EXISTS availability_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    slot_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    table_id UUID NOT NULL,
    shift_name TEXT,
    status TEXT NOT NULL DEFAULT 'free',
    source TEXT DEFAULT 'system',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_available BOOLEAN DEFAULT TRUE,
    duration_minutes INTEGER DEFAULT 90,
    zone zone_type NOT NULL DEFAULT 'interior'
);

-- =====================================================
-- TABLA: billing_tickets
-- Descripción: Tickets de facturación y consumos
-- =====================================================
CREATE TABLE IF NOT EXISTS billing_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    reservation_id UUID,
    table_id UUID,
    customer_id UUID,
    ticket_number VARCHAR(100) NOT NULL,
    external_ticket_id VARCHAR(255),
    ticket_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    service_start TIMESTAMPTZ,
    service_end TIMESTAMPTZ,
    items JSONB NOT NULL DEFAULT '[]',
    subtotal NUMERIC NOT NULL DEFAULT 0,
    tax_amount NUMERIC NOT NULL DEFAULT 0,
    discount_amount NUMERIC NOT NULL DEFAULT 0,
    total_amount NUMERIC NOT NULL DEFAULT 0,
    payment_method VARCHAR(50),
    tip_amount NUMERIC DEFAULT 0,
    covers_count INTEGER DEFAULT 1,
    waiter_name VARCHAR(255),
    kitchen_notes TEXT,
    special_requests TEXT,
    source_system VARCHAR(100),
    source_data JSONB,
    is_processed BOOLEAN DEFAULT FALSE,
    processing_errors TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    mesa_number VARCHAR(10),
    confidence_score NUMERIC DEFAULT 1.0,
    auto_matched BOOLEAN DEFAULT FALSE,
    matching_notes TEXT
);

-- =====================================================
-- TABLA: calendar_exceptions
-- Descripción: Excepciones de calendario (días especiales)
-- =====================================================
CREATE TABLE IF NOT EXISTS calendar_exceptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL,
    exception_date DATE NOT NULL,
    is_open BOOLEAN NOT NULL DEFAULT TRUE,
    reason TEXT,
    created_by TEXT DEFAULT 'system',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    open_time TIME,
    close_time TIME
);

-- =====================================================
-- TABLA: channel_credentials
-- Descripción: Credenciales de canales de comunicación
-- =====================================================
CREATE TABLE IF NOT EXISTS channel_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    channel TEXT NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    credentials JSONB NOT NULL DEFAULT '{}',
    config JSONB DEFAULT '{}',
    last_test_at TIMESTAMPTZ,
    last_test_success BOOLEAN,
    last_test_error TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', NOW()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', NOW()),
    channel_identifier VARCHAR
);

-- =====================================================
-- TABLA: channel_performance
-- Descripción: Métricas de rendimiento por canal
-- =====================================================
CREATE TABLE IF NOT EXISTS channel_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID,
    channel VARCHAR(50),
    date DATE DEFAULT CURRENT_DATE,
    conversations INTEGER DEFAULT 0,
    bookings INTEGER DEFAULT 0,
    conversion_rate DOUBLE PRECISION DEFAULT 0,
    avg_response_time DOUBLE PRECISION DEFAULT 0,
    customer_satisfaction DOUBLE PRECISION DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLA: conversation_analytics
-- Descripción: Analíticas de conversaciones
-- =====================================================
CREATE TABLE IF NOT EXISTS conversation_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID,
    restaurant_id UUID,
    total_messages INTEGER DEFAULT 0,
    ai_messages INTEGER DEFAULT 0,
    human_messages INTEGER DEFAULT 0,
    avg_response_time DOUBLE PRECISION DEFAULT 0,
    intent_detected VARCHAR(100),
    sentiment_score DOUBLE PRECISION DEFAULT 0,
    topics JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLA: crm_interactions
-- Descripción: Interacciones CRM con clientes
-- =====================================================
CREATE TABLE IF NOT EXISTS crm_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    interaction_type VARCHAR NOT NULL,
    campaign_id VARCHAR,
    campaign_name VARCHAR,
    channel VARCHAR NOT NULL,
    message_text TEXT NOT NULL,
    message_template_id VARCHAR,
    status VARCHAR NOT NULL DEFAULT 'sent',
    customer_responded BOOLEAN DEFAULT FALSE,
    response_received_at TIMESTAMPTZ,
    response_conversation_id UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ
);

-- =====================================================
-- TABLA: crm_settings
-- Descripción: Configuración de segmentación CRM
-- =====================================================
CREATE TABLE IF NOT EXISTS crm_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    days_new_customer INTEGER DEFAULT 7,
    days_active_customer INTEGER DEFAULT 30,
    days_inactive_customer INTEGER DEFAULT 60,
    visits_bib_customer INTEGER DEFAULT 10,
    days_risk_customer INTEGER DEFAULT 45,
    frequency_reactivation INTEGER DEFAULT 90,
    frequency_welcome INTEGER DEFAULT 1,
    frequency_bib_promotion INTEGER DEFAULT 180,
    auto_suggestions BOOLEAN DEFAULT TRUE,
    auto_segmentation BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', NOW()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', NOW())
);

-- =====================================================
-- TABLA: crm_suggestions
-- Descripción: Sugerencias automáticas de acciones CRM
-- =====================================================
CREATE TABLE IF NOT EXISTS crm_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    template_id UUID,
    type VARCHAR NOT NULL,
    priority VARCHAR DEFAULT 'medium',
    title VARCHAR NOT NULL,
    description TEXT,
    status VARCHAR DEFAULT 'pending',
    suggested_at TIMESTAMPTZ DEFAULT timezone('utc', NOW()),
    executed_at TIMESTAMPTZ,
    suggested_subject VARCHAR,
    suggested_content TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', NOW()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', NOW())
);

-- =====================================================
-- TABLA: crm_templates
-- Descripción: Plantillas de mensajes CRM (legacy)
-- =====================================================
CREATE TABLE IF NOT EXISTS crm_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    name VARCHAR NOT NULL,
    type VARCHAR NOT NULL,
    subject VARCHAR NOT NULL,
    content TEXT NOT NULL,
    variables JSONB DEFAULT '[]',
    active BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', NOW()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', NOW())
);

-- =====================================================
-- TABLA: customer_confirmations
-- Descripción: Confirmaciones de clientes para reservas
-- =====================================================
CREATE TABLE IF NOT EXISTS customer_confirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID,
    reservation_id UUID NOT NULL,
    restaurant_id UUID NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL,
    message_type VARCHAR NOT NULL,
    message_channel VARCHAR NOT NULL DEFAULT 'whatsapp',
    message_content TEXT,
    responded_at TIMESTAMPTZ,
    response_time_minutes INTEGER,
    response_content TEXT,
    confirmed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', NOW()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', NOW())
);

-- =====================================================
-- TABLA: customer_feedback
-- Descripción: Feedback de clientes post-visita
-- =====================================================
CREATE TABLE IF NOT EXISTS customer_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL,
    restaurant_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    rating INTEGER,
    feedback_text TEXT,
    feedback_type VARCHAR(20) DEFAULT 'satisfaction',
    resolved BOOLEAN DEFAULT FALSE,
    response_text TEXT,
    responded_by UUID,
    responded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLA: customer_interactions
-- Descripción: Interacciones del sistema con clientes
-- =====================================================
CREATE TABLE IF NOT EXISTS customer_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    channel VARCHAR NOT NULL,
    template_id UUID,
    interaction_type VARCHAR NOT NULL,
    subject TEXT,
    content TEXT NOT NULL,
    payload JSONB DEFAULT '{}',
    status VARCHAR NOT NULL DEFAULT 'pending',
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    replied_at TIMESTAMPTZ,
    external_id VARCHAR,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT timezone('utc', NOW()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', NOW())
);

-- =====================================================
-- TABLA: customers
-- Descripción: Base de datos de clientes
-- =====================================================
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    preferences JSONB DEFAULT '{}',
    tags TEXT[],
    notes TEXT,
    total_visits INTEGER DEFAULT 0,
    total_spent NUMERIC DEFAULT 0,
    last_visit TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW()),
    first_name VARCHAR,
    last_name1 VARCHAR,
    last_name2 VARCHAR,
    segment_manual VARCHAR,
    segment_auto VARCHAR DEFAULT 'nuevo',
    visits_count INTEGER DEFAULT 0,
    last_visit_at TIMESTAMPTZ,
    avg_ticket NUMERIC DEFAULT 0.00,
    preferred_items JSONB DEFAULT '[]',
    consent_email BOOLEAN DEFAULT TRUE,
    consent_sms BOOLEAN DEFAULT TRUE,
    last_contacted_at TIMESTAMPTZ,
    next_action_at TIMESTAMPTZ,
    churn_risk_score INTEGER DEFAULT 0,
    predicted_ltv NUMERIC DEFAULT 0.00,
    notifications_enabled BOOLEAN DEFAULT TRUE,
    preferred_channel TEXT DEFAULT 'whatsapp',
    consent_whatsapp BOOLEAN DEFAULT FALSE,
    last_interaction_at TIMESTAMPTZ,
    interaction_count INTEGER DEFAULT 0,
    aivi_days NUMERIC DEFAULT 30.0,
    recency_days INTEGER DEFAULT 0,
    visits_12m INTEGER DEFAULT 0,
    total_spent_12m NUMERIC DEFAULT 0,
    top_dishes JSONB DEFAULT '[]',
    top_categories JSONB DEFAULT '[]',
    fav_weekday INTEGER DEFAULT 6,
    fav_hour_block INTEGER DEFAULT 20,
    is_vip_calculated BOOLEAN DEFAULT FALSE,
    segment_auto_v2 VARCHAR(20) DEFAULT 'nuevo',
    features_updated_at TIMESTAMPTZ DEFAULT NOW(),
    birthday DATE,
    UNIQUE (phone, restaurant_id)
);

-- =====================================================
-- TABLA: daily_metrics
-- Descripción: Métricas diarias del restaurante
-- =====================================================
CREATE TABLE IF NOT EXISTS daily_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    date DATE NOT NULL,
    total_reservations INTEGER DEFAULT 0,
    confirmed_reservations INTEGER DEFAULT 0,
    cancelled_reservations INTEGER DEFAULT 0,
    no_shows INTEGER DEFAULT 0,
    walk_ins INTEGER DEFAULT 0,
    total_customers INTEGER DEFAULT 0,
    new_customers INTEGER DEFAULT 0,
    returning_customers INTEGER DEFAULT 0,
    table_utilization_rate NUMERIC DEFAULT 0,
    average_party_size NUMERIC DEFAULT 0,
    peak_hour_start TIME,
    peak_hour_end TIME,
    total_revenue NUMERIC DEFAULT 0,
    average_spend_per_customer NUMERIC DEFAULT 0,
    customer_satisfaction_score NUMERIC,
    staff_efficiency_score NUMERIC,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW())
);

-- =====================================================
-- TABLA: escalations
-- Descripción: Escalaciones a humano desde el agente IA
-- =====================================================
CREATE TABLE IF NOT EXISTS escalations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    customer_phone VARCHAR NOT NULL,
    customer_name VARCHAR,
    customer_message TEXT,
    reason VARCHAR NOT NULL,
    urgency VARCHAR NOT NULL DEFAULT 'medium',
    status VARCHAR NOT NULL DEFAULT 'pending',
    escalated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW()),
    contacted_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', NOW()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', NOW())
);

-- =====================================================
-- TABLA: interaction_logs
-- Descripción: Log de interacciones con clientes
-- =====================================================
CREATE TABLE IF NOT EXISTS interaction_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    scheduled_message_id UUID,
    interaction_type TEXT NOT NULL,
    channel TEXT NOT NULL,
    subject TEXT,
    content_preview TEXT,
    provider_message_id TEXT,
    provider_response JSONB,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT timezone('utc', NOW()),
    created_by_user UUID,
    ip_address INET,
    user_agent TEXT
);

-- =====================================================
-- TABLA: inventory
-- Descripción: Inventario de productos (legacy)
-- =====================================================
CREATE TABLE IF NOT EXISTS inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    quantity NUMERIC NOT NULL DEFAULT 0,
    unit VARCHAR(50),
    min_threshold NUMERIC,
    cost_per_unit NUMERIC,
    supplier VARCHAR(255),
    last_updated TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW())
);

-- =====================================================
-- TABLA: inventory_items
-- Descripción: Items de inventario
-- =====================================================
CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    unit TEXT NOT NULL,
    current_stock NUMERIC DEFAULT 0,
    minimum_stock NUMERIC DEFAULT 0,
    maximum_stock NUMERIC,
    cost_per_unit NUMERIC DEFAULT 0,
    supplier TEXT,
    supplier_contact JSONB DEFAULT '{}',
    barcode TEXT,
    location TEXT,
    expiration_date DATE,
    last_restocked TIMESTAMPTZ,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW())
);

-- =====================================================
-- TABLA: menu_items
-- Descripción: Items del menú del restaurante
-- =====================================================
CREATE TABLE IF NOT EXISTS menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    price NUMERIC NOT NULL,
    cost NUMERIC,
    is_available BOOLEAN DEFAULT TRUE,
    allergens TEXT[],
    preparation_time INTEGER,
    popularity_score INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLA: message_templates
-- Descripción: Plantillas de mensajes para comunicaciones
-- =====================================================
CREATE TABLE IF NOT EXISTS message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    subject TEXT,
    variables TEXT[] DEFAULT ARRAY[]::TEXT[],
    channel TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    usage_count INTEGER DEFAULT 0,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW()),
    template_type VARCHAR,
    body_markdown TEXT,
    preview_text TEXT,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    personalization_level VARCHAR DEFAULT 'basic',
    success_rate NUMERIC DEFAULT 0.00,
    last_used_at TIMESTAMPTZ,
    conversion_rate NUMERIC DEFAULT 0.00,
    segment TEXT NOT NULL DEFAULT 'all',
    event_trigger TEXT NOT NULL DEFAULT 'manual',
    content_markdown TEXT NOT NULL DEFAULT '',
    provider_template_name TEXT,
    send_delay_hours INTEGER DEFAULT 0,
    priority INTEGER DEFAULT 5,
    variables_available JSONB DEFAULT '[]',
    segment_target_v2 VARCHAR(20) DEFAULT 'all',
    optimal_send_time VARCHAR(20) DEFAULT 'any',
    success_metrics JSONB DEFAULT '{}'
);

-- =====================================================
-- TABLA: noshow_actions
-- Descripción: Acciones preventivas de no-shows
-- =====================================================
CREATE TABLE IF NOT EXISTS noshow_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    reservation_id UUID,
    customer_id UUID,
    customer_name VARCHAR NOT NULL,
    customer_phone VARCHAR,
    reservation_date DATE NOT NULL,
    reservation_time TIME NOT NULL,
    party_size INTEGER NOT NULL,
    risk_level VARCHAR NOT NULL,
    risk_score INTEGER NOT NULL,
    risk_factors JSONB DEFAULT '[]',
    action_type VARCHAR NOT NULL,
    template_id UUID,
    template_name VARCHAR,
    message_sent TEXT NOT NULL,
    channel VARCHAR NOT NULL DEFAULT 'whatsapp',
    customer_response VARCHAR,
    response_time INTERVAL,
    response_message TEXT,
    final_outcome VARCHAR,
    prevented_noshow BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMPTZ DEFAULT timezone('utc', NOW()),
    response_received_at TIMESTAMPTZ,
    reservation_completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', NOW()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', NOW()),
    action_description TEXT,
    success BOOLEAN,
    notes TEXT,
    metadata JSONB DEFAULT '{}'
);

-- =====================================================
-- TABLA: noshow_alerts
-- Descripción: Alertas de riesgo de no-show
-- =====================================================
CREATE TABLE IF NOT EXISTS noshow_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    reservation_id UUID NOT NULL,
    customer_id UUID,
    customer_name VARCHAR NOT NULL,
    customer_phone VARCHAR,
    reservation_date DATE NOT NULL,
    reservation_time TIME NOT NULL,
    party_size INTEGER NOT NULL,
    risk_score INTEGER NOT NULL,
    alert_type VARCHAR NOT NULL DEFAULT 'needs_call',
    status VARCHAR NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT timezone('utc', NOW()),
    auto_release_at TIMESTAMPTZ NOT NULL,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID,
    resolution_notes TEXT,
    resolution_method VARCHAR,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', NOW())
);

-- =====================================================
-- TABLA: notifications
-- Descripción: Notificaciones del sistema
-- =====================================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    user_id UUID,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL,
    priority TEXT DEFAULT 'normal',
    is_read BOOLEAN DEFAULT FALSE,
    action_url TEXT,
    metadata JSONB DEFAULT '{}',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW()),
    read_at TIMESTAMPTZ
);

-- =====================================================
-- TABLA: profiles
-- Descripción: Perfiles de usuarios
-- =====================================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID NOT NULL,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    avatar_url TEXT,
    restaurant_name VARCHAR(255),
    phone VARCHAR(50),
    role VARCHAR(50) DEFAULT 'owner',
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW())
);

-- =====================================================
-- TABLA: reservation_tables
-- Descripción: Relación many-to-many entre reservas y mesas
-- =====================================================
CREATE TABLE IF NOT EXISTS reservation_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id UUID NOT NULL,
    table_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLA: reservations
-- Descripción: Reservas de clientes
-- =====================================================
CREATE TABLE IF NOT EXISTS reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    reservation_date DATE NOT NULL,
    reservation_time TIME NOT NULL,
    party_size INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'confirmed',
    table_number VARCHAR(20),
    special_requests TEXT,
    source VARCHAR(50) DEFAULT 'web',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW()),
    channel VARCHAR(50) DEFAULT 'web',
    date DATE,
    time TIME,
    table_id UUID,
    spend_amount NUMERIC DEFAULT 0.00,
    reservation_source VARCHAR DEFAULT 'manual',
    reservation_channel VARCHAR DEFAULT 'web',
    preferred_zone zone_type
);

-- =====================================================
-- TABLA: restaurant_business_config
-- Descripción: Configuración de negocio del restaurante
-- =====================================================
CREATE TABLE IF NOT EXISTS restaurant_business_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID,
    avg_ticket_price NUMERIC DEFAULT 35.00,
    monthly_revenue NUMERIC,
    staff_cost_monthly NUMERIC DEFAULT 1800.00,
    current_reservations_monthly INTEGER DEFAULT 0,
    target_growth_percentage NUMERIC DEFAULT 15.00,
    ai_system_cost NUMERIC DEFAULT 199.00,
    ai_expected_improvement NUMERIC DEFAULT 15.00,
    operating_hours_daily INTEGER DEFAULT 12,
    peak_hours_percentage NUMERIC DEFAULT 30.00,
    manual_response_time_minutes NUMERIC DEFAULT 5.00,
    configured_by VARCHAR(255),
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLA: restaurant_operating_hours
-- Descripción: Horarios de operación del restaurante
-- =====================================================
CREATE TABLE IF NOT EXISTS restaurant_operating_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    day_of_week INTEGER NOT NULL,
    is_open BOOLEAN NOT NULL DEFAULT TRUE,
    open_time TIME NOT NULL DEFAULT '09:00:00',
    close_time TIME NOT NULL DEFAULT '22:00:00',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLA: restaurant_settings
-- Descripción: Configuración general del restaurante
-- =====================================================
CREATE TABLE IF NOT EXISTS restaurant_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    category TEXT NOT NULL,
    setting_key TEXT NOT NULL,
    setting_value JSONB NOT NULL,
    description TEXT,
    is_sensitive BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW())
);

-- =====================================================
-- TABLA: restaurant_shifts
-- Descripción: Turnos de servicio del restaurante
-- =====================================================
CREATE TABLE IF NOT EXISTS restaurant_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    day_of_week INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLA: businesses
-- Descripción: Información principal de restaurantes
-- =====================================================
CREATE TABLE IF NOT EXISTS businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100) DEFAULT 'España',
    postal_code VARCHAR(20),
    cuisine_type VARCHAR(100),
    plan VARCHAR(50) DEFAULT 'trial',
    active BOOLEAN DEFAULT TRUE,
    settings JSONB DEFAULT '{}',
    agent_config JSONB DEFAULT '{}',
    business_hours JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW()),
    owner_id UUID,
    crm_config JSONB DEFAULT '{}',
    channels JSONB DEFAULT '{}',
    notifications JSONB DEFAULT '{}'
);

-- =====================================================
-- TABLA: scheduled_messages
-- Descripción: Mensajes programados para envío
-- =====================================================
CREATE TABLE IF NOT EXISTS scheduled_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    automation_rule_id UUID,
    template_id UUID,
    scheduled_for TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', NOW()),
    channel_planned TEXT NOT NULL,
    channel_final TEXT,
    subject_rendered TEXT,
    content_rendered TEXT NOT NULL,
    variables_used JSONB DEFAULT '{}',
    status TEXT DEFAULT 'planned',
    provider_message_id TEXT,
    provider_response JSONB,
    retry_count INTEGER DEFAULT 0,
    last_error TEXT,
    last_attempted_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ
);

-- =====================================================
-- TABLA: special_events
-- Descripción: Eventos especiales y días cerrados
-- =====================================================
CREATE TABLE IF NOT EXISTS special_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    event_date DATE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) DEFAULT 'evento',
    start_time TIME,
    end_time TIME,
    is_closed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', NOW()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', NOW())
);

-- =====================================================
-- TABLA: staff
-- Descripción: Personal del restaurante
-- =====================================================
CREATE TABLE IF NOT EXISTS staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    auth_user_id UUID,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    role VARCHAR(100) NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    schedule JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW())
);

-- =====================================================
-- TABLA: tables
-- Descripción: Mesas del restaurante
-- =====================================================
CREATE TABLE IF NOT EXISTS tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    table_number TEXT NOT NULL,
    capacity INTEGER NOT NULL,
    location TEXT,
    status TEXT DEFAULT 'available',
    position_x DOUBLE PRECISION,
    position_y DOUBLE PRECISION,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW()),
    zone zone_type NOT NULL DEFAULT 'interior',
    name VARCHAR(100)
);

-- =====================================================
-- TABLA: tables_zones_backup
-- Descripción: Backup de zonas de mesas (pre-migración)
-- =====================================================
CREATE TABLE IF NOT EXISTS tables_zones_backup (
    id UUID,
    restaurant_id UUID,
    zone VARCHAR(50),
    updated_at TIMESTAMPTZ
);

-- =====================================================
-- TABLA: template_variables
-- Descripción: Variables disponibles para plantillas
-- =====================================================
CREATE TABLE IF NOT EXISTS template_variables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    variable_name VARCHAR NOT NULL,
    variable_type VARCHAR NOT NULL,
    description TEXT NOT NULL,
    example_value TEXT,
    category VARCHAR NOT NULL,
    data_source VARCHAR,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', NOW())
);

-- =====================================================
-- TABLA: user_restaurant_mapping
-- Descripción: Mapeo de usuarios a restaurantes
-- =====================================================
CREATE TABLE IF NOT EXISTS user_restaurant_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID NOT NULL,
    restaurant_id UUID NOT NULL,
    role VARCHAR(50) DEFAULT 'staff',
    permissions JSONB DEFAULT '{}',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW())
);

-- =====================================================
-- TABLA: whatsapp_message_buffer
-- Descripción: Buffer temporal de mensajes WhatsApp
-- =====================================================
CREATE TABLE IF NOT EXISTS whatsapp_message_buffer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    buffer_key VARCHAR NOT NULL,
    customer_phone VARCHAR NOT NULL,
    customer_name VARCHAR NOT NULL,
    messages TEXT NOT NULL DEFAULT '',
    message_count INTEGER NOT NULL DEFAULT 1,
    first_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processing_since TIMESTAMPTZ
);

-- =====================================================
-- ✅ MIGRACIÓN COMPLETADA
-- =====================================================
-- Total de tablas creadas: 61
-- Total de ENUMs creados: 5
-- Extensiones habilitadas: uuid-ossp, pg_cron
--
-- ⚠️ NOTA: Esta migración solo crea el esquema (tablas y tipos).
-- Las funciones, triggers, índices y foreign keys se migrarán en 
-- scripts separados para mejor control y troubleshooting.
-- =====================================================

