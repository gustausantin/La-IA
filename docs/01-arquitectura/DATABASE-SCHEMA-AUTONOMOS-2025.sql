-- =====================================================
-- ESQUEMA DE BASE DE DATOS PARA AUTÓNOMOS
-- Sistema Modular Multi-Vertical
-- Fecha: 27 de octubre de 2025
-- =====================================================
--
-- VERTICALES SOPORTADOS (optimizados para recepcionista IA):
-- 1. Fisioterapeutas (🏥) - TOP 1: Siempre ocupados, odian interrupciones
-- 2. Masajistas/Osteópatas (💆) - Sesiones 1 a 1, muy individuales
-- 3. Clínicas Dentales (🦷) - 2-5 personas, muchos no-shows
-- 4. Psicólogos/Coaches (🧠) - Citas 1 a 1, sin recepcionista
-- 5. Centros de Estética (✨) - Reservas cortas, mucha demanda
-- 6. Peluquerías/Barberías (💇) - Llamadas constantes
-- 7. Centros de Uñas (💅) - Dependientes de WhatsApp
-- 8. Entrenadores Personales (💪) - Agendas dispersas, GCal
-- 9. Yoga/Pilates (🧘) - Programaciones semanales, clases grupales
-- 10. Veterinarios (🐾) - Llamadas urgentes, sin recepcionista
--
-- =====================================================

-- =====================================================
-- PASO 1: EXTENSIONES
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- =====================================================
-- PASO 2: TIPOS ENUM
-- =====================================================

DO $$ 
BEGIN
    -- Tipos de vertical/sector de negocio
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vertical_type') THEN
        CREATE TYPE vertical_type AS ENUM (
            'fisioterapia',
            'masajes_osteopatia',
            'clinica_dental',
            'psicologia_coaching',
            'centro_estetica',
            'peluqueria_barberia',
            'centro_unas',
            'entrenador_personal',
            'yoga_pilates',
            'veterinario'
        );
    END IF;

    -- Estados de citas/appointments
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status') THEN
        CREATE TYPE appointment_status AS ENUM (
            'pending',
            'confirmed',
            'cancelled',
            'completed',
            'no_show',
            'pending_approval'
        );
    END IF;

    -- Estados de recursos (sillas, camillas, consultorios...)
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'resource_status') THEN
        CREATE TYPE resource_status AS ENUM (
            'available',
            'occupied',
            'reserved',
            'maintenance',
            'disabled'
        );
    END IF;

    -- Canales de comunicación
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'channel_type') THEN
        CREATE TYPE channel_type AS ENUM (
            'whatsapp',
            'vapi',
            'phone',
            'email',
            'web',
            'instagram',
            'facebook',
            'google'
        );
    END IF;

    -- Roles de usuario
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM (
            'owner',
            'admin',
            'manager',
            'staff',
            'viewer'
        );
    END IF;
END $$;

-- =====================================================
-- PASO 3: TABLAS CORE DEL SISTEMA
-- =====================================================

-- =====================================================
-- TABLA: business_verticals
-- Descripción: Catálogo de verticales/sectores soportados
-- =====================================================
CREATE TABLE IF NOT EXISTS business_verticals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code vertical_type NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    icon_emoji VARCHAR(10),
    resource_name_singular VARCHAR(50) NOT NULL, -- "Silla", "Camilla", "Consultorio"
    resource_name_plural VARCHAR(50) NOT NULL,   -- "Sillas", "Camillas", "Consultorios"
    appointment_name VARCHAR(50) DEFAULT 'Cita', -- "Cita", "Sesión", "Consulta"
    default_duration_minutes INTEGER DEFAULT 60,
    default_buffer_minutes INTEGER DEFAULT 15,
    features JSONB DEFAULT '[]', -- ['reservas', 'crm', 'recordatorios', 'historial_medico']
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLA: service_templates
-- Descripción: Servicios predefinidos por vertical
-- =====================================================
CREATE TABLE IF NOT EXISTS service_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vertical_type vertical_type NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    duration_minutes INTEGER NOT NULL,
    suggested_price NUMERIC(10,2),
    is_popular BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLA: businesses
-- Descripción: Negocios de autónomos (antes "businesses")
-- =====================================================
CREATE TABLE IF NOT EXISTS businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vertical_type vertical_type NOT NULL,
    name VARCHAR(255) NOT NULL,
    business_name VARCHAR(255), -- Nombre fiscal si diferente
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100) DEFAULT 'España',
    postal_code VARCHAR(20),
    
    -- Onboarding
    onboarding_completed BOOLEAN DEFAULT FALSE,
    onboarding_step INTEGER DEFAULT 0,
    
    -- Plan y estado
    plan VARCHAR(50) DEFAULT 'trial',
    active BOOLEAN DEFAULT TRUE,
    
    -- Configuración
    settings JSONB DEFAULT '{}',
    business_hours JSONB DEFAULT '{}',
    
    -- IA y automatización
    agent_config JSONB DEFAULT '{}',
    crm_config JSONB DEFAULT '{}',
    channels JSONB DEFAULT '{}',
    notifications JSONB DEFAULT '{}',
    
    -- Metadata
    owner_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- TABLA: resources
-- Descripción: Recursos del negocio (antes "tables")
-- Ejemplos: Sillas, Camillas, Consultorios, Salas, etc.
-- =====================================================
CREATE TABLE IF NOT EXISTS resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL, -- "Silla 1", "Camilla A", "Consultorio 2"
    resource_number VARCHAR(20), -- Número o código
    description TEXT,
    capacity INTEGER DEFAULT 1, -- Normalmente 1, pero puede ser más (salas grupales)
    status resource_status DEFAULT 'available',
    
    -- Ubicación (opcional, para negocios con múltiples salas)
    location TEXT,
    position_x DOUBLE PRECISION,
    position_y DOUBLE PRECISION,
    
    -- Estado
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- TABLA: services
-- Descripción: Servicios ofrecidos por el negocio
-- Ejemplos: "Corte Hombre", "Masaje Relajante", "Sesión Fisioterapia"
-- =====================================================
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    
    -- Tiempo y precio
    duration_minutes INTEGER NOT NULL,
    buffer_minutes INTEGER DEFAULT 0, -- Tiempo entre citas
    price NUMERIC(10,2) NOT NULL,
    cost NUMERIC(10,2), -- Coste interno (opcional)
    
    -- Configuración
    requires_resource BOOLEAN DEFAULT TRUE, -- ¿Necesita silla/camilla?
    max_capacity INTEGER DEFAULT 1, -- Para clases grupales
    is_available BOOLEAN DEFAULT TRUE,
    is_online BOOLEAN DEFAULT FALSE, -- Para sesiones online
    
    -- Metadata
    popularity_score INTEGER DEFAULT 0,
    booking_count INTEGER DEFAULT 0,
    color VARCHAR(7), -- Color hex para UI
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLA: appointments
-- Descripción: Citas/Reservas (antes "reservations")
-- =====================================================
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    service_id UUID NOT NULL,
    resource_id UUID, -- Puede ser NULL si el servicio no requiere recurso
    
    -- Información del cliente
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    
    -- Fecha y hora
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    duration_minutes INTEGER NOT NULL,
    end_time TIME, -- Se calculará en la aplicación o mediante trigger
    
    -- Estado
    status appointment_status DEFAULT 'confirmed',
    
    -- Origen
    source VARCHAR(50) DEFAULT 'web',
    channel channel_type DEFAULT 'web',
    
    -- Información adicional
    notes TEXT,
    special_requests TEXT,
    internal_notes TEXT, -- Notas privadas del negocio
    
    -- Gasto (opcional, para seguimiento)
    amount_paid NUMERIC(10,2) DEFAULT 0.00,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- TABLA: availability_slots
-- Descripción: Slots de disponibilidad para citas
-- =====================================================
CREATE TABLE IF NOT EXISTS availability_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL,
    resource_id UUID NOT NULL,
    
    slot_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    
    status TEXT NOT NULL DEFAULT 'free', -- 'free', 'booked', 'blocked'
    appointment_id UUID, -- Si está reservado
    
    shift_name TEXT, -- "Mañana", "Tarde"
    source TEXT DEFAULT 'system',
    
    is_available BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLA: customers
-- Descripción: Base de datos de clientes
-- =====================================================
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL,
    
    -- Información personal
    name VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(50),
    birthday DATE,
    
    -- Preferencias y notas
    preferences JSONB DEFAULT '{}',
    tags TEXT[],
    notes TEXT,
    
    -- Estadísticas
    total_visits INTEGER DEFAULT 0,
    total_spent NUMERIC DEFAULT 0,
    last_visit_at TIMESTAMPTZ,
    avg_ticket NUMERIC DEFAULT 0.00,
    
    -- Segmentación
    segment_manual VARCHAR(50),
    segment_auto VARCHAR(50) DEFAULT 'nuevo',
    
    -- Consentimientos
    consent_email BOOLEAN DEFAULT TRUE,
    consent_sms BOOLEAN DEFAULT TRUE,
    consent_whatsapp BOOLEAN DEFAULT FALSE,
    
    -- CRM
    last_contacted_at TIMESTAMPTZ,
    notifications_enabled BOOLEAN DEFAULT TRUE,
    preferred_channel TEXT DEFAULT 'whatsapp',
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE (phone, business_id)
);

-- =====================================================
-- TABLA: business_operating_hours
-- Descripción: Horarios de operación del negocio
-- =====================================================
CREATE TABLE IF NOT EXISTS business_operating_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL,
    day_of_week INTEGER NOT NULL, -- 0=Domingo, 1=Lunes, ..., 6=Sábado
    is_open BOOLEAN NOT NULL DEFAULT TRUE,
    open_time TIME NOT NULL DEFAULT '09:00:00',
    close_time TIME NOT NULL DEFAULT '20:00:00',
    break_start TIME, -- Descanso (opcional)
    break_end TIME,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLA: business_shifts
-- Descripción: Turnos de trabajo (opcional, para negocios con múltiples turnos)
-- =====================================================
CREATE TABLE IF NOT EXISTS business_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL,
    day_of_week INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL, -- "Mañana", "Tarde", "Noche"
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLA: calendar_exceptions
-- Descripción: Excepciones de calendario (días especiales, vacaciones)
-- =====================================================
CREATE TABLE IF NOT EXISTS calendar_exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL,
    exception_date DATE NOT NULL,
    is_open BOOLEAN NOT NULL DEFAULT FALSE,
    reason TEXT,
    open_time TIME,
    close_time TIME,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLAS DE SOPORTE (CRM, Comunicaciones, Analytics)
-- =====================================================

-- =====================================================
-- TABLA: agent_conversations
-- Descripción: Conversaciones del agente IA
-- =====================================================
CREATE TABLE IF NOT EXISTS agent_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL,
    customer_id UUID,
    customer_phone VARCHAR NOT NULL,
    customer_name VARCHAR,
    customer_email VARCHAR,
    source_channel channel_type NOT NULL,
    interaction_type VARCHAR NOT NULL,
    status VARCHAR NOT NULL DEFAULT 'active',
    outcome VARCHAR,
    appointment_id UUID, -- Referencia a appointment si se creó una cita
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolution_time_seconds INTEGER,
    sentiment VARCHAR,
    metadata JSONB DEFAULT '{}'
);

-- =====================================================
-- TABLA: agent_messages
-- Descripción: Mensajes individuales dentro de conversaciones
-- =====================================================
CREATE TABLE IF NOT EXISTS agent_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL,
    business_id UUID NOT NULL,
    direction VARCHAR NOT NULL, -- 'inbound', 'outbound'
    sender VARCHAR NOT NULL,
    message_text TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    tokens_used INTEGER,
    confidence_score NUMERIC,
    customer_phone VARCHAR NOT NULL
);

-- =====================================================
-- TABLA: message_templates
-- Descripción: Plantillas de mensajes para comunicaciones
-- =====================================================
CREATE TABLE IF NOT EXISTS message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    subject TEXT,
    content_markdown TEXT NOT NULL,
    variables TEXT[] DEFAULT ARRAY[]::TEXT[],
    channel TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    usage_count INTEGER DEFAULT 0,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- TABLA: customer_confirmations
-- Descripción: Confirmaciones de clientes para citas
-- =====================================================
CREATE TABLE IF NOT EXISTS customer_confirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID,
    appointment_id UUID NOT NULL,
    business_id UUID NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL,
    message_type VARCHAR NOT NULL,
    message_channel VARCHAR NOT NULL DEFAULT 'whatsapp',
    message_content TEXT,
    responded_at TIMESTAMPTZ,
    response_time_minutes INTEGER,
    response_content TEXT,
    confirmed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLA: customer_feedback
-- Descripción: Feedback de clientes post-visita
-- =====================================================
CREATE TABLE IF NOT EXISTS customer_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID,
    business_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    appointment_id UUID,
    rating INTEGER, -- 1-5 o 1-10
    feedback_text TEXT,
    feedback_type VARCHAR(20) DEFAULT 'satisfaction',
    resolved BOOLEAN DEFAULT FALSE,
    response_text TEXT,
    responded_by UUID,
    responded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLA: analytics
-- Descripción: Métricas y KPIs del negocio
-- =====================================================
CREATE TABLE IF NOT EXISTS analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL,
    type VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    value NUMERIC NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- TABLA: profiles
-- Descripción: Perfiles de usuarios (dueños, staff)
-- =====================================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    avatar_url TEXT,
    phone VARCHAR(50),
    role user_role DEFAULT 'owner',
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- TABLA: user_business_mapping
-- Descripción: Mapeo de usuarios a negocios (multi-tenancy)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_business_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID NOT NULL,
    business_id UUID NOT NULL,
    role user_role DEFAULT 'staff',
    permissions JSONB DEFAULT '{}',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- TABLA: notifications
-- Descripción: Notificaciones del sistema
-- =====================================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL,
    user_id UUID,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL,
    priority TEXT DEFAULT 'normal',
    is_read BOOLEAN DEFAULT FALSE,
    action_url TEXT,
    metadata JSONB DEFAULT '{}',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

-- =====================================================
-- TABLA: agent_metrics
-- Descripción: Métricas diarias del agente IA
-- =====================================================
CREATE TABLE IF NOT EXISTS agent_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL,
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
-- TABLA: channel_credentials
-- Descripción: Credenciales de canales de comunicación
-- =====================================================
CREATE TABLE IF NOT EXISTS channel_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL,
    channel TEXT NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    credentials JSONB NOT NULL DEFAULT '{}',
    config JSONB DEFAULT '{}',
    last_test_at TIMESTAMPTZ,
    last_test_success BOOLEAN,
    last_test_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    channel_identifier VARCHAR
);

-- =====================================================
-- TABLA: escalations
-- Descripción: Escalaciones a humano desde el agente IA
-- =====================================================
CREATE TABLE IF NOT EXISTS escalations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL,
    customer_phone VARCHAR NOT NULL,
    customer_name VARCHAR,
    customer_message TEXT,
    reason VARCHAR NOT NULL,
    urgency VARCHAR NOT NULL DEFAULT 'medium',
    status VARCHAR NOT NULL DEFAULT 'pending',
    escalated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    contacted_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLA: crm_interactions
-- Descripción: Interacciones CRM con clientes
-- =====================================================
CREATE TABLE IF NOT EXISTS crm_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL,
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
-- TABLA: automation_rules
-- Descripción: Reglas de automatización de CRM
-- =====================================================
CREATE TABLE IF NOT EXISTS automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL,
    name VARCHAR NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    rule_type VARCHAR,
    trigger_condition JSONB NOT NULL DEFAULT '{}',
    action_type VARCHAR,
    action_config JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    last_executed_at TIMESTAMPTZ,
    total_executions INTEGER DEFAULT 0,
    successful_executions INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLA: scheduled_messages
-- Descripción: Mensajes programados para envío
-- =====================================================
CREATE TABLE IF NOT EXISTS scheduled_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    automation_rule_id UUID,
    template_id UUID,
    scheduled_for TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
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
-- TABLA: whatsapp_message_buffer
-- Descripción: Buffer temporal de mensajes WhatsApp
-- =====================================================
CREATE TABLE IF NOT EXISTS whatsapp_message_buffer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL,
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
-- INSERTAR DATOS INICIALES: VERTICALES
-- =====================================================

INSERT INTO business_verticals (code, name, display_name, description, icon_emoji, resource_name_singular, resource_name_plural, appointment_name, default_duration_minutes, features) VALUES
('fisioterapia', 'fisioterapia', 'Fisioterapia', 'Clínicas y consultas de fisioterapia. Siempre ocupados, odian interrupciones durante sesiones.', '🏥', 'Box', 'Boxes', 'Sesión', 45, '["reservas", "crm", "recordatorios", "historial_medico", "ia_recepcionista"]'),
('masajes_osteopatia', 'masajes_osteopatia', 'Masajes y Osteopatía', 'Centros de masajes, osteopatía y terapias corporales. Sesiones 1 a 1, muy individuales.', '💆', 'Camilla', 'Camillas', 'Sesión', 60, '["reservas", "crm", "recordatorios", "historial_medico", "ia_recepcionista"]'),
('clinica_dental', 'clinica_dental', 'Clínica Dental', 'Clínicas dentales pequeñas (2-5 personas). Teléfono fijo, WhatsApp y muchos no-shows.', '🦷', 'Consultorio', 'Consultorios', 'Consulta', 30, '["reservas", "crm", "recordatorios", "historial_medico", "noshow_prevention", "ia_recepcionista"]'),
('psicologia_coaching', 'psicologia_coaching', 'Psicología y Coaching', 'Psicólogos, coaches y terapeutas. Citas 1 a 1, sin recepcionista, usan Google Calendar.', '🧠', 'Despacho', 'Despachos', 'Sesión', 60, '["reservas", "crm", "recordatorios", "notas_privadas", "gcal_sync", "ia_recepcionista"]'),
('centro_estetica', 'centro_estetica', 'Centro de Estética', 'Centros de estética, depilación y pestañas. Reservas cortas, mucha demanda, clientela repetitiva.', '✨', 'Cabina', 'Cabinas', 'Cita', 45, '["reservas", "crm", "recordatorios", "alta_rotacion", "ia_recepcionista"]'),
('peluqueria_barberia', 'peluqueria_barberia', 'Peluquería y Barbería', 'Peluquerías y barberías. Llamadas constantes, si no cogen pierden clientes.', '💇', 'Silla', 'Sillas', 'Cita', 45, '["reservas", "crm", "recordatorios", "alta_demanda", "ia_recepcionista"]'),
('centro_unas', 'centro_unas', 'Centro de Uñas', 'Centros de manicura y pedicura. Muy dependientes de WhatsApp.', '💅', 'Mesa', 'Mesas', 'Cita', 60, '["reservas", "crm", "recordatorios", "whatsapp_priority", "ia_recepcionista"]'),
('entrenador_personal', 'entrenador_personal', 'Entrenador Personal', 'Entrenadores personales y estudios de fitness. Agendas dispersas, usan Google Calendar.', '💪', 'Sala', 'Salas', 'Sesión', 60, '["reservas", "crm", "recordatorios", "gcal_sync", "ia_recepcionista"]'),
('yoga_pilates', 'yoga_pilates', 'Yoga y Pilates', 'Clases de yoga, pilates y meditación. Programaciones semanales, ideal para automatizar.', '🧘', 'Sala', 'Salas', 'Clase', 60, '["reservas", "crm", "recordatorios", "clases_grupales", "programacion_semanal", "ia_recepcionista"]'),
('veterinario', 'veterinario', 'Veterinario', 'Clínicas veterinarias y de mascotas. Llamadas urgentes, sin recepcionista en muchas horas.', '🐾', 'Consultorio', 'Consultorios', 'Consulta', 30, '["reservas", "crm", "recordatorios", "urgencias", "historial_medico", "ia_recepcionista"]')
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- INSERTAR SERVICIOS PREDEFINIDOS POR VERTICAL
-- =====================================================

-- 1. Fisioterapia
INSERT INTO service_templates (vertical_type, name, description, category, duration_minutes, suggested_price, is_popular) VALUES
('fisioterapia', 'Sesión Fisioterapia', 'Sesión de fisioterapia general', 'Traumatología', 45, 40.00, true),
('fisioterapia', 'Fisioterapia Deportiva', 'Tratamiento para lesiones deportivas', 'Deportiva', 45, 45.00, true),
('fisioterapia', 'Punción Seca', 'Tratamiento con punción seca', 'Traumatología', 30, 35.00, false),
('fisioterapia', 'Vendaje Neuromuscular', 'Aplicación de vendaje funcional', 'Deportiva', 20, 20.00, false),
('fisioterapia', 'Terapia Manual', 'Tratamiento con técnicas manuales', 'Traumatología', 45, 40.00, false);

-- 2. Masajes y Osteopatía
INSERT INTO service_templates (vertical_type, name, description, category, duration_minutes, suggested_price, is_popular) VALUES
('masajes_osteopatia', 'Masaje Relajante 60min', 'Masaje relajante corporal completo', 'Relajante', 60, 50.00, true),
('masajes_osteopatia', 'Masaje Deportivo', 'Masaje para deportistas y recuperación', 'Deportivo', 45, 45.00, true),
('masajes_osteopatia', 'Osteopatía Estructural', 'Tratamiento osteopático completo', 'Osteopatía', 60, 60.00, true),
('masajes_osteopatia', 'Masaje Tailandés', 'Masaje tradicional tailandés', 'Terapéutico', 90, 80.00, false),
('masajes_osteopatia', 'Masaje Descontracturante', 'Tratamiento de contracturas musculares', 'Terapéutico', 60, 55.00, false);

-- 3. Clínicas Dentales
INSERT INTO service_templates (vertical_type, name, description, category, duration_minutes, suggested_price, is_popular) VALUES
('clinica_dental', 'Revisión General', 'Revisión dental completa', 'Revisión', 30, 40.00, true),
('clinica_dental', 'Limpieza Dental', 'Limpieza y profilaxis dental', 'Tratamiento', 45, 60.00, true),
('clinica_dental', 'Empaste', 'Empaste dental (obturación)', 'Tratamiento', 60, 80.00, true),
('clinica_dental', 'Ortodoncia (Revisión)', 'Revisión y ajuste de ortodoncia', 'Ortodoncia', 30, 50.00, false),
('clinica_dental', 'Blanqueamiento', 'Blanqueamiento dental profesional', 'Estética', 60, 150.00, false);

-- 4. Psicología y Coaching
INSERT INTO service_templates (vertical_type, name, description, category, duration_minutes, suggested_price, is_popular) VALUES
('psicologia_coaching', 'Primera Consulta', 'Primera sesión de evaluación', 'Terapia Individual', 90, 80.00, true),
('psicologia_coaching', 'Sesión Individual', 'Sesión de terapia individual', 'Terapia Individual', 60, 60.00, true),
('psicologia_coaching', 'Sesión de Pareja', 'Terapia de pareja', 'Terapia Pareja', 90, 90.00, false),
('psicologia_coaching', 'Sesión de Coaching', 'Coaching personal o profesional', 'Coaching', 60, 70.00, false),
('psicologia_coaching', 'Terapia Familiar', 'Sesión de terapia familiar', 'Terapia Familiar', 90, 100.00, false);

-- 5. Centros de Estética
INSERT INTO service_templates (vertical_type, name, description, category, duration_minutes, suggested_price, is_popular) VALUES
('centro_estetica', 'Depilación Láser', 'Sesión de depilación láser', 'Depilación', 30, 40.00, true),
('centro_estetica', 'Limpieza Facial', 'Limpieza facial profunda', 'Facial', 60, 45.00, true),
('centro_estetica', 'Extensiones de Pestañas', 'Aplicación de extensiones', 'Pestañas', 90, 60.00, true),
('centro_estetica', 'Micropigmentación Cejas', 'Microblading de cejas', 'Cejas', 120, 150.00, false),
('centro_estetica', 'Tratamiento Facial', 'Tratamiento facial personalizado', 'Facial', 75, 65.00, false);

-- 6. Peluquerías y Barberías
INSERT INTO service_templates (vertical_type, name, description, category, duration_minutes, suggested_price, is_popular) VALUES
('peluqueria_barberia', 'Corte Hombre', 'Corte de pelo para hombre', 'Cabello', 30, 15.00, true),
('peluqueria_barberia', 'Corte Mujer', 'Corte de pelo para mujer', 'Cabello', 45, 25.00, true),
('peluqueria_barberia', 'Barba', 'Arreglo y perfilado de barba', 'Barbería', 20, 10.00, true),
('peluqueria_barberia', 'Tinte Completo', 'Tinte de raíces y puntas', 'Color', 90, 50.00, false),
('peluqueria_barberia', 'Mechas', 'Mechas californianas o balayage', 'Color', 120, 80.00, false);

-- 7. Centros de Uñas
INSERT INTO service_templates (vertical_type, name, description, category, duration_minutes, suggested_price, is_popular) VALUES
('centro_unas', 'Manicura', 'Manicura básica', 'Manos', 30, 20.00, true),
('centro_unas', 'Pedicura', 'Pedicura básica', 'Pies', 45, 25.00, true),
('centro_unas', 'Uñas de Gel', 'Aplicación de uñas de gel', 'Manos', 60, 35.00, true),
('centro_unas', 'Manicura Permanente', 'Esmalte semipermanente', 'Manos', 45, 30.00, true),
('centro_unas', 'Uñas Acrílicas', 'Aplicación de uñas acrílicas', 'Manos', 90, 45.00, false);

-- 8. Entrenadores Personales
INSERT INTO service_templates (vertical_type, name, description, category, duration_minutes, suggested_price, is_popular) VALUES
('entrenador_personal', 'Sesión Personal', 'Entrenamiento personalizado 1 a 1', 'Personal', 60, 40.00, true),
('entrenador_personal', 'Valoración Inicial', 'Valoración física y plan de entrenamiento', 'Valoración', 90, 60.00, true),
('entrenador_personal', 'Sesión Pareja', 'Entrenamiento para dos personas', 'Personal', 60, 60.00, false),
('entrenador_personal', 'Plan Nutricional', 'Consulta y plan nutricional', 'Nutrición', 60, 50.00, false);

-- 9. Yoga y Pilates
INSERT INTO service_templates (vertical_type, name, description, category, duration_minutes, suggested_price, is_popular) VALUES
('yoga_pilates', 'Clase de Yoga', 'Clase de yoga grupal', 'Yoga', 60, 15.00, true),
('yoga_pilates', 'Clase de Pilates', 'Clase de pilates grupal', 'Pilates', 60, 15.00, true),
('yoga_pilates', 'Yoga Privado', 'Sesión privada de yoga', 'Privado', 60, 50.00, false),
('yoga_pilates', 'Meditación Guiada', 'Sesión de meditación guiada', 'Meditación', 45, 12.00, false),
('yoga_pilates', 'Pilates Reformer', 'Clase de pilates con máquina', 'Pilates', 60, 25.00, false);

-- 10. Veterinarios
INSERT INTO service_templates (vertical_type, name, description, category, duration_minutes, suggested_price, is_popular) VALUES
('veterinario', 'Consulta General', 'Consulta veterinaria general', 'Consulta', 30, 35.00, true),
('veterinario', 'Vacunación', 'Vacunación y desparasitación', 'Preventivo', 20, 40.00, true),
('veterinario', 'Revisión Anual', 'Revisión completa anual', 'Preventivo', 45, 50.00, true),
('veterinario', 'Urgencia', 'Consulta de urgencia', 'Urgencias', 30, 60.00, false),
('veterinario', 'Peluquería Canina', 'Baño y corte de pelo', 'Estética', 60, 30.00, false);

-- =====================================================
-- TRIGGERS Y FUNCIONES AUXILIARES
-- =====================================================

-- Función para calcular end_time en appointments
CREATE OR REPLACE FUNCTION calculate_appointment_end_time()
RETURNS TRIGGER AS $$
BEGIN
    NEW.end_time := NEW.appointment_time + (NEW.duration_minutes || ' minutes')::INTERVAL;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para calcular end_time automáticamente
DROP TRIGGER IF EXISTS trigger_calculate_appointment_end_time ON appointments;
CREATE TRIGGER trigger_calculate_appointment_end_time
    BEFORE INSERT OR UPDATE OF appointment_time, duration_minutes
    ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION calculate_appointment_end_time();

-- =====================================================
-- ✅ ESQUEMA COMPLETADO
-- =====================================================
-- Total de tablas creadas: 27 tablas core
--
-- TABLAS PRINCIPALES (11):
--   1. business_verticals
--   2. service_templates
--   3. businesses
--   4. resources
--   5. services
--   6. appointments
--   7. availability_slots
--   8. customers
--   9. business_operating_hours
--   10. business_shifts
--   11. calendar_exceptions
--
-- TABLAS IA Y COMUNICACIONES (6):
--   12. agent_conversations
--   13. agent_messages
--   14. agent_metrics
--   15. message_templates
--   16. channel_credentials
--   17. escalations
--
-- TABLAS CRM Y AUTOMATIZACIÓN (4):
--   18. customer_confirmations
--   19. customer_feedback
--   20. crm_interactions
--   21. automation_rules
--   22. scheduled_messages
--
-- TABLAS SOPORTE (5):
--   23. analytics
--   24. profiles
--   25. user_business_mapping
--   26. notifications
--   27. whatsapp_message_buffer
-- Total de ENUMs creados: 5
-- Total de triggers: 1 (cálculo automático de end_time)
-- Total de verticales: 10 (optimizados para IA recepcionista)
-- Total de servicios predefinidos: 48
--
-- VERTICALES CON MEJOR FIT PARA RECEPCIONISTA IA:
-- 1. 🏥 Fisioterapia (5 servicios) - TOP PRIORIDAD
-- 2. 💆 Masajes/Osteopatía (5 servicios)
-- 3. 🦷 Clínicas Dentales (5 servicios) - Prevención no-shows
-- 4. 🧠 Psicología/Coaching (5 servicios) - Integración GCal
-- 5. ✨ Centros de Estética (5 servicios) - Alta rotación
-- 6. 💇 Peluquerías/Barberías (5 servicios) - Alta demanda
-- 7. 💅 Centros de Uñas (5 servicios) - WhatsApp priority
-- 8. 💪 Entrenadores Personales (4 servicios) - GCal sync
-- 9. 🧘 Yoga/Pilates (5 servicios) - Clases grupales
-- 10. 🐾 Veterinarios (5 servicios) - Urgencias
--
-- CARACTERÍSTICAS ESPECIALES POR VERTICAL:
-- - ia_recepcionista: Todos los verticales
-- - gcal_sync: Psicología/Coaching, Entrenadores
-- - noshow_prevention: Clínicas Dentales
-- - whatsapp_priority: Centros de Uñas
-- - historial_medico: Fisioterapia, Masajes, Clínicas, Veterinarios
-- - urgencias: Veterinarios
-- - clases_grupales: Yoga/Pilates
--
-- PRÓXIMOS PASOS:
-- 1. Ejecutar este script en Supabase SQL Editor
-- 2. Configurar RLS (Row Level Security)
-- 3. Crear índices de optimización
-- 4. Adaptar frontend para usar nueva terminología
-- 5. Implementar integraciones específicas (GCal, WhatsApp)
-- =====================================================

