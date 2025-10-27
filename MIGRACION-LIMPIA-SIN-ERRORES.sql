-- =====================================================
-- MIGRACIÓN LIMPIA - SIN ERRORES DE DUPLICADOS
-- Para: zrcsujgurtglyqoqiynr.supabase.co
-- =====================================================

-- =====================================================
-- PASO 1: TIPOS ENUM (con protección contra duplicados)
-- =====================================================

-- Usar DO block para crear ENUMs solo si no existen
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
-- PASO 2: EXTENSIONES
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- =====================================================
-- PASO 3: AHORA COPIA TODO EL CONTENIDO DE:
-- docs/01-arquitectura/DATABASE-SCHEMA-ESTRUCTURA-COMPLETA-2025-10-17.sql
-- PEGA DEBAJO DE ESTA LÍNEA
-- =====================================================

