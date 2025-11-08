-- =====================================================
-- ESQUEMA REAL DE SUPABASE - FUENTE DE VERDAD ÚNICA
-- Fecha: 2025-11-08
-- Fuente: Extraído directamente de Supabase
-- =====================================================
-- ⚠️ ESTE ES EL ESQUEMA OFICIAL - SIEMPRE CONSULTAR AQUÍ
-- ⚠️ NO MODIFICAR - Solo actualizar cuando cambie la BD
-- =====================================================

-- =====================================================
-- TABLA: customers (CLIENTES)
-- =====================================================
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id),
    name VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(50),
    birthday DATE,
    preferences JSONB DEFAULT '{}'::jsonb,
    tags TEXT[],
    notes TEXT,
    total_visits INTEGER DEFAULT 0,
    total_spent NUMERIC DEFAULT 0,
    last_visit_at TIMESTAMPTZ,
    avg_ticket NUMERIC DEFAULT 0.00,
    segment_manual VARCHAR(50),
    segment_auto VARCHAR(50) DEFAULT 'nuevo'::character varying,
    consent_email BOOLEAN DEFAULT true,
    consent_sms BOOLEAN DEFAULT true,
    consent_whatsapp BOOLEAN DEFAULT false,
    last_contacted_at TIMESTAMPTZ,
    notifications_enabled BOOLEAN DEFAULT true,
    preferred_channel TEXT DEFAULT 'whatsapp'::text,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- TABLA: businesses (NEGOCIOS)
-- =====================================================
CREATE TABLE businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vertical_type VARCHAR NOT NULL, -- ENUM: peluqueria_barberia, estetica_spa, clinica_medica, etc.
    name VARCHAR(255) NOT NULL,
    business_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100) DEFAULT 'España'::character varying,
    postal_code VARCHAR(20),
    onboarding_completed BOOLEAN DEFAULT false,
    onboarding_step INTEGER DEFAULT 0,
    plan VARCHAR(50) DEFAULT 'trial'::character varying,
    active BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}'::jsonb,
    business_hours JSONB DEFAULT '{}'::jsonb,
    agent_config JSONB DEFAULT '{}'::jsonb,
    crm_config JSONB DEFAULT '{}'::jsonb,
    channels JSONB DEFAULT '{}'::jsonb,
    notifications JSONB DEFAULT '{}'::jsonb,
    owner_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    assigned_phone TEXT,
    phone_operator VARCHAR(50),
    agent_status TEXT DEFAULT 'OFF'::text,
    copilot_step INTEGER DEFAULT 0,
    copilot_completed BOOLEAN DEFAULT false,
    alert_whatsapp VARCHAR(50)
);

-- =====================================================
-- TABLA: appointments (CITAS/RESERVAS)
-- =====================================================
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    service_id UUID NOT NULL REFERENCES services(id),
    resource_id UUID REFERENCES resources(id),
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    duration_minutes INTEGER NOT NULL,
    end_time TIME,
    status VARCHAR DEFAULT 'confirmed'::appointment_status, -- ENUM: confirmed, cancelled, completed, no_show, pending
    source VARCHAR(50) DEFAULT 'web'::character varying,
    channel VARCHAR DEFAULT 'web'::channel_type, -- ENUM: web, phone, whatsapp, agent
    notes TEXT,
    special_requests TEXT,
    internal_notes TEXT,
    amount_paid NUMERIC DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- TABLA: services (SERVICIOS)
-- =====================================================
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    duration_minutes INTEGER NOT NULL,
    buffer_minutes INTEGER DEFAULT 0,
    price NUMERIC NOT NULL,
    cost NUMERIC,
    requires_resource BOOLEAN DEFAULT true,
    max_capacity INTEGER DEFAULT 1,
    is_available BOOLEAN DEFAULT true,
    is_online BOOLEAN DEFAULT false,
    popularity_score INTEGER DEFAULT 0,
    booking_count INTEGER DEFAULT 0,
    color VARCHAR(7),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- TABLA: resources (RECURSOS: mesas, camillas, etc.)
-- =====================================================
CREATE TABLE resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id),
    name VARCHAR(100) NOT NULL,
    resource_number VARCHAR(20),
    description TEXT,
    capacity INTEGER DEFAULT 1,
    status VARCHAR DEFAULT 'available'::resource_status, -- ENUM: available, occupied, maintenance, reserved
    location TEXT,
    position_x DOUBLE PRECISION,
    position_y DOUBLE PRECISION,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- TABLA: availability_slots (SLOTS DE DISPONIBILIDAD)
-- =====================================================
CREATE TABLE availability_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id),
    resource_id UUID NOT NULL REFERENCES resources(id),
    slot_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    status TEXT NOT NULL DEFAULT 'free'::text,
    appointment_id UUID REFERENCES appointments(id),
    shift_name TEXT,
    source TEXT DEFAULT 'system'::text,
    is_available BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- TABLA: user_business_mapping
-- =====================================================
CREATE TABLE user_business_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID NOT NULL REFERENCES auth.users(id),
    business_id UUID NOT NULL REFERENCES businesses(id),
    role VARCHAR DEFAULT 'staff'::user_role, -- ENUM: owner, manager, staff
    permissions JSONB DEFAULT '{}'::jsonb,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- TABLA: business_operating_hours (HORARIOS)
-- =====================================================
CREATE TABLE business_operating_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id),
    day_of_week INTEGER NOT NULL, -- 0=Domingo, 1=Lunes, ..., 6=Sábado
    is_open BOOLEAN NOT NULL DEFAULT true,
    open_time TIME NOT NULL DEFAULT '09:00:00'::time,
    close_time TIME NOT NULL DEFAULT '20:00:00'::time,
    break_start TIME,
    break_end TIME,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- TABLA: calendar_exceptions (EXCEPCIONES DE CALENDARIO)
-- =====================================================
CREATE TABLE calendar_exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id),
    exception_date DATE NOT NULL,
    is_open BOOLEAN NOT NULL DEFAULT false,
    reason TEXT,
    open_time TIME,
    close_time TIME,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- TABLA: notifications
-- =====================================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id),
    user_id UUID,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL,
    priority TEXT DEFAULT 'normal'::text,
    is_read BOOLEAN DEFAULT false,
    action_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at TIMESTAMPTZ
);

-- =====================================================
-- TABLA: agent_conversations (CONVERSACIONES AGENTE IA)
-- =====================================================
CREATE TABLE agent_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id),
    customer_id UUID REFERENCES customers(id),
    customer_phone VARCHAR NOT NULL,
    customer_name VARCHAR,
    customer_email VARCHAR,
    source_channel VARCHAR NOT NULL, -- ENUM
    interaction_type VARCHAR NOT NULL,
    status VARCHAR NOT NULL DEFAULT 'active'::character varying,
    outcome VARCHAR,
    appointment_id UUID REFERENCES appointments(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    resolution_time_seconds INTEGER,
    sentiment VARCHAR,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- =====================================================
-- TABLA: agent_messages
-- =====================================================
CREATE TABLE agent_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES agent_conversations(id),
    business_id UUID NOT NULL REFERENCES businesses(id),
    direction VARCHAR NOT NULL,
    sender VARCHAR NOT NULL,
    message_text TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb,
    tokens_used INTEGER,
    confidence_score NUMERIC,
    customer_phone VARCHAR NOT NULL
);

-- =====================================================
-- TABLA: crm_interactions
-- =====================================================
CREATE TABLE crm_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    interaction_type VARCHAR NOT NULL,
    campaign_id VARCHAR,
    campaign_name VARCHAR,
    channel VARCHAR NOT NULL,
    message_text TEXT NOT NULL,
    message_template_id VARCHAR,
    status VARCHAR NOT NULL DEFAULT 'sent'::character varying,
    customer_responded BOOLEAN DEFAULT false,
    response_received_at TIMESTAMPTZ,
    response_conversation_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ
);

-- =====================================================
-- TABLA: customer_confirmations (CONFIRMACIONES)
-- =====================================================
CREATE TABLE customer_confirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id),
    appointment_id UUID NOT NULL REFERENCES appointments(id),
    business_id UUID NOT NULL REFERENCES businesses(id),
    sent_at TIMESTAMPTZ NOT NULL,
    message_type VARCHAR NOT NULL,
    message_channel VARCHAR NOT NULL DEFAULT 'whatsapp'::character varying,
    message_content TEXT,
    responded_at TIMESTAMPTZ,
    response_time_minutes INTEGER,
    response_content TEXT,
    confirmed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- TABLA: integrations (INTEGRACIONES - Google Calendar, etc.)
-- =====================================================
CREATE TABLE integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id),
    provider TEXT NOT NULL,
    credentials JSONB NOT NULL,
    status TEXT DEFAULT 'active'::text,
    scopes TEXT[],
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ
);

-- =====================================================
-- TABLA: google_calendar_events
-- =====================================================
CREATE TABLE google_calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id),
    integration_id UUID NOT NULL REFERENCES integrations(id),
    gcal_event_id TEXT NOT NULL,
    appointment_id UUID REFERENCES appointments(id),
    summary TEXT,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'confirmed'::text,
    attendees JSONB,
    location TEXT,
    raw_data JSONB,
    last_synced_at TIMESTAMPTZ DEFAULT now(),
    sync_status TEXT DEFAULT 'synced'::text,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- NOTAS IMPORTANTES
-- =====================================================

/*
DIFERENCIAS CLAVE ENCONTRADAS:

1. ✅ TODAS LAS TABLAS USAN: business_id (NO restaurant_id)

2. ✅ TABLA customers:
   - Campo de visitas: total_visits (NO visits_count)
   - Campo de apellido: last_name (NO last_name1, last_name2)
   - Campo de última visita: last_visit_at (correcto)
   - Tiene: avg_ticket (calculado)
   
3. ✅ TABLA appointments:
   - Campos de fecha/hora: appointment_date, appointment_time (separados)
   - NO tiene: start_time, reservation_date
   - Tiene: duration_minutes, end_time

4. ✅ TABLA resources:
   - NO tiene: zone (columna eliminada)
   - Tiene: location, position_x, position_y, resource_number
   
5. ✅ TABLA availability_slots:
   - Campo de recurso: resource_id (correcto)
   - Campo de cita: appointment_id (correcto)
   - NO tiene: table_id, reservation_id

REGLAS:
- Siempre usar business_id como FK
- customers.total_visits NO visits_count
- customers.last_name NO last_name1/last_name2
- appointments.appointment_date + appointment_time
- resources sin campo zone
*/

