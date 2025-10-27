-- =====================================================
-- MIGRACIÓN SUPABASE - ORDEN CORRECTO
-- Ejecutar en SQL Editor de Supabase
-- Proyecto: zrcsujgurtglyqoqiynr.supabase.co
-- =====================================================

-- =====================================================
-- PASO 1: CREAR TIPOS ENUM (PRIMERO)
-- =====================================================

-- Tipo para zonas de mesas
CREATE TYPE zone_type AS ENUM ('interior', 'terraza', 'barra', 'privado', 'exterior');

-- Tipo para canales de origen
CREATE TYPE channel_type AS ENUM ('whatsapp', 'vapi', 'phone', 'email', 'web', 'instagram', 'facebook', 'google');

-- Tipo para roles de usuario
CREATE TYPE user_role AS ENUM ('owner', 'admin', 'manager', 'staff', 'viewer');

-- Otros tipos que puedan ser necesarios
CREATE TYPE reservation_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed', 'no_show', 'pending_approval');

CREATE TYPE table_status AS ENUM ('available', 'occupied', 'reserved', 'maintenance', 'disabled');

-- =====================================================
-- PASO 2: HABILITAR EXTENSIONES
-- =====================================================

-- Extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Extensión para pg_cron (si es necesario)
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- =====================================================
-- PASO 3: CREAR TABLAS
-- (Ahora copia el resto del contenido del archivo)
-- =====================================================

-- Continúa con el resto del SQL desde:
-- docs/01-arquitectura/DATABASE-SCHEMA-ESTRUCTURA-COMPLETA-2025-10-17.sql
-- PERO OMITE la creación de tipos ENUM si están duplicados


