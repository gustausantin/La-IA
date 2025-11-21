-- =====================================================
-- MIGRACIÓN: Agregar status 'blocked' y campos de Google Calendar a appointments
-- Fecha: 2025-11-21
-- Objetivo: Permitir importar eventos bloqueados de Google Calendar
-- =====================================================

-- PASO 1: Agregar 'blocked' al enum appointment_status
-- ⚠️ IMPORTANTE: PostgreSQL requiere COMMIT después de agregar un valor al enum
-- antes de poder usarlo en índices o consultas
DO $$
BEGIN
    -- Verificar si 'blocked' ya existe
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_enum 
        WHERE enumlabel = 'blocked' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'appointment_status')
    ) THEN
        -- ⚠️ Esto requiere COMMIT antes de poder usar 'blocked' en índices
        ALTER TYPE appointment_status ADD VALUE 'blocked';
        RAISE NOTICE 'Valor ''blocked'' agregado al enum appointment_status';
    ELSE
        RAISE NOTICE 'Valor ''blocked'' ya existe en appointment_status';
    END IF;
END $$;

-- PASO 2: Agregar columna gcal_event_id a appointments
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'appointments'
        AND column_name = 'gcal_event_id'
    ) THEN
        ALTER TABLE appointments
        ADD COLUMN gcal_event_id TEXT;
        
        RAISE NOTICE 'Columna gcal_event_id añadida a appointments';
    ELSE
        RAISE NOTICE 'Columna gcal_event_id ya existe en appointments';
    END IF;
END $$;

-- PASO 3: Agregar columna calendar_id a appointments
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'appointments'
        AND column_name = 'calendar_id'
    ) THEN
        ALTER TABLE appointments
        ADD COLUMN calendar_id TEXT;
        
        RAISE NOTICE 'Columna calendar_id añadida a appointments';
    ELSE
        RAISE NOTICE 'Columna calendar_id ya existe en appointments';
    END IF;
END $$;

-- PASO 4: Crear índices para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_appointments_gcal_event_id 
ON appointments(gcal_event_id) 
WHERE gcal_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_calendar_id 
ON appointments(calendar_id) 
WHERE calendar_id IS NOT NULL;

-- ⚠️ Este índice NO se puede crear aquí porque 'blocked' se acaba de agregar
-- y PostgreSQL no permite usarlo en la misma transacción
-- Se creará en una segunda migración o manualmente después
-- CREATE INDEX IF NOT EXISTS idx_appointments_source_blocked 
-- ON appointments(business_id, source, status) 
-- WHERE source = 'google_calendar' AND status = 'blocked';

-- PASO 5: Comentarios en las columnas
COMMENT ON COLUMN appointments.gcal_event_id IS 
'ID del evento en Google Calendar. Usado para tracking y sincronización bidireccional.';

COMMENT ON COLUMN appointments.calendar_id IS 
'ID del calendario de Google Calendar del que proviene el evento. Permite identificar el calendario específico vinculado a un recurso o empleado.';

