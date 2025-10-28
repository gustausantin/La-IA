-- =====================================================
-- SCRIPT TODO-EN-UNO: LIMPIAR + IMPORTAR ESQUEMA AUTÓNOMOS
-- Para: https://zrcsujgurtglyqoqiynr.supabase.co
-- =====================================================
--
-- ⚠️ IMPORTANTE: Este script borra las tablas antiguas
-- y crea el esquema nuevo para autónomos
--
-- =====================================================

-- =====================================================
-- PASO 1: LIMPIAR SCHEMA ANTERIOR (solo tablas, NO usuarios)
-- =====================================================

-- Borrar tablas viejas si existen
DROP TABLE IF EXISTS agent_conversations CASCADE;
DROP TABLE IF EXISTS agent_insights CASCADE;
DROP TABLE IF EXISTS agent_messages CASCADE;
DROP TABLE IF EXISTS agent_metrics CASCADE;
DROP TABLE IF EXISTS ai_conversation_insights CASCADE;
DROP TABLE IF EXISTS analytics CASCADE;
DROP TABLE IF EXISTS analytics_historical CASCADE;
DROP TABLE IF EXISTS automation_rule_executions CASCADE;
DROP TABLE IF EXISTS automation_rules CASCADE;
DROP TABLE IF EXISTS availability_change_log CASCADE;
DROP TABLE IF EXISTS availability_slots CASCADE;
DROP TABLE IF EXISTS billing_tickets CASCADE;
DROP TABLE IF EXISTS calendar_exceptions CASCADE;
DROP TABLE IF EXISTS channel_credentials CASCADE;
DROP TABLE IF EXISTS channel_performance CASCADE;
DROP TABLE IF EXISTS conversation_analytics CASCADE;
DROP TABLE IF EXISTS crm_interactions CASCADE;
DROP TABLE IF EXISTS crm_settings CASCADE;
DROP TABLE IF EXISTS crm_suggestions CASCADE;
DROP TABLE IF EXISTS crm_templates CASCADE;
DROP TABLE IF EXISTS customer_confirmations CASCADE;
DROP TABLE IF EXISTS customer_feedback CASCADE;
DROP TABLE IF EXISTS customer_interactions CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS daily_metrics CASCADE;
DROP TABLE IF EXISTS escalations CASCADE;
DROP TABLE IF EXISTS interaction_logs CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS inventory_items CASCADE;
DROP TABLE IF EXISTS menu_items CASCADE;
DROP TABLE IF EXISTS message_templates CASCADE;
DROP TABLE IF EXISTS noshow_actions CASCADE;
DROP TABLE IF EXISTS noshow_alerts CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS reservation_tables CASCADE;
DROP TABLE IF EXISTS reservations CASCADE;
DROP TABLE IF EXISTS restaurant_business_config CASCADE;
DROP TABLE IF EXISTS restaurant_operating_hours CASCADE;
DROP TABLE IF EXISTS restaurant_settings CASCADE;
DROP TABLE IF EXISTS restaurant_shifts CASCADE;
DROP TABLE IF EXISTS businesses CASCADE;
DROP TABLE IF EXISTS scheduled_messages CASCADE;
DROP TABLE IF EXISTS special_events CASCADE;
DROP TABLE IF EXISTS staff CASCADE;
DROP TABLE IF EXISTS tables CASCADE;
DROP TABLE IF EXISTS tables_zones_backup CASCADE;
DROP TABLE IF EXISTS template_variables CASCADE;
DROP TABLE IF EXISTS user_restaurant_mapping CASCADE;
DROP TABLE IF EXISTS whatsapp_message_buffer CASCADE;

-- Borrar ENUMs viejos
DROP TYPE IF EXISTS zone_type CASCADE;
DROP TYPE IF EXISTS channel_type CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS reservation_status CASCADE;
DROP TYPE IF EXISTS table_status CASCADE;
DROP TYPE IF EXISTS vertical_type CASCADE;
DROP TYPE IF EXISTS appointment_status CASCADE;
DROP TYPE IF EXISTS resource_status CASCADE;

-- =====================================================
-- PASO 2: EXTENSIONES
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- =====================================================
-- PASO 3: TIPOS ENUM NUEVOS
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
-- PASO 4: COPIAR RESTO DEL ESQUEMA
-- =====================================================
-- IMPORTANTE: Después de ejecutar este script,
-- copia y pega el contenido de:
-- DATABASE-SCHEMA-AUTONOMOS-2025.sql
-- desde la línea que dice "TABLA: business_verticals"
-- hasta el final del archivo
-- =====================================================

-- O mejor aún: ejecuta primero este script para limpiar,
-- y luego ejecuta DATABASE-SCHEMA-AUTONOMOS-2025.sql completo
-- =====================================================

-- ✅ LIMPIEZA COMPLETADA
-- Ahora ejecuta: DATABASE-SCHEMA-AUTONOMOS-2025.sql

