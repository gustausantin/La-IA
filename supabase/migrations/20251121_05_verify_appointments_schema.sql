-- =====================================================
-- MIGRACIÓN: Verificar y actualizar esquema de appointments
-- Fecha: 2025-11-21
-- Objetivo: Asegurar que todas las columnas necesarias para Google Calendar sync existen
-- =====================================================

-- PASO 1: Verificar y convertir internal_notes de TEXT a JSONB si es necesario
DO $$
BEGIN
    -- Verificar si la columna existe y qué tipo tiene
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'appointments'
        AND column_name = 'internal_notes'
        AND data_type = 'text'
    ) THEN
        -- Convertir TEXT a JSONB
        RAISE NOTICE 'Convirtiendo internal_notes de TEXT a JSONB...';
        
        -- Primero, convertir valores existentes válidos a JSONB
        UPDATE appointments
        SET internal_notes = CASE
            WHEN internal_notes IS NULL OR internal_notes = '' THEN '{}'::jsonb
            WHEN internal_notes::text ~ '^[\s]*\{.*\}[\s]*$' THEN internal_notes::jsonb
            ELSE jsonb_build_object('raw_text', internal_notes)
        END
        WHERE internal_notes IS NOT NULL;
        
        -- Cambiar el tipo de la columna
        ALTER TABLE appointments
        ALTER COLUMN internal_notes TYPE JSONB USING (
            CASE
                WHEN internal_notes IS NULL THEN '{}'::jsonb
                WHEN internal_notes::text ~ '^[\s]*\{.*\}[\s]*$' THEN internal_notes::jsonb
                ELSE jsonb_build_object('raw_text', internal_notes)
            END
        );
        
        -- Establecer default
        ALTER TABLE appointments
        ALTER COLUMN internal_notes SET DEFAULT '{}'::jsonb;
        
        RAISE NOTICE 'Columna internal_notes convertida de TEXT a JSONB';
    ELSIF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'appointments'
        AND column_name = 'internal_notes'
        AND data_type = 'jsonb'
    ) THEN
        RAISE NOTICE 'Columna internal_notes ya es JSONB';
    ELSE
        -- Si no existe, crearla como JSONB
        ALTER TABLE appointments
        ADD COLUMN internal_notes JSONB DEFAULT '{}'::jsonb;
        
        RAISE NOTICE 'Columna internal_notes añadida como JSONB a appointments';
    END IF;
END $$;

-- PASO 2: Verificar y agregar columna synced_to_gcal (BOOLEAN) si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'appointments'
        AND column_name = 'synced_to_gcal'
    ) THEN
        ALTER TABLE appointments
        ADD COLUMN synced_to_gcal BOOLEAN DEFAULT FALSE;
        
        RAISE NOTICE 'Columna synced_to_gcal añadida a appointments';
    ELSE
        RAISE NOTICE 'Columna synced_to_gcal ya existe en appointments';
    END IF;
END $$;

-- PASO 3: Verificar que gcal_event_id existe (ya debería existir por migración anterior)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'appointments'
        AND column_name = 'gcal_event_id'
    ) THEN
        ALTER TABLE appointments
        ADD COLUMN gcal_event_id TEXT;
        
        RAISE NOTICE 'Columna gcal_event_id añadida a appointments';
    ELSE
        RAISE NOTICE 'Columna gcal_event_id ya existe en appointments';
    END IF;
END $$;

-- PASO 4: Verificar que calendar_id existe (ya debería existir por migración anterior)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'appointments'
        AND column_name = 'calendar_id'
    ) THEN
        ALTER TABLE appointments
        ADD COLUMN calendar_id TEXT;
        
        RAISE NOTICE 'Columna calendar_id añadida a appointments';
    ELSE
        RAISE NOTICE 'Columna calendar_id ya existe en appointments';
    END IF;
END $$;

-- PASO 5: Verificar que employee_id existe (ya debería existir por migración anterior)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'appointments'
        AND column_name = 'employee_id'
    ) THEN
        ALTER TABLE appointments
        ADD COLUMN employee_id UUID REFERENCES employees(id) ON DELETE SET NULL;
        
        RAISE NOTICE 'Columna employee_id añadida a appointments';
    ELSE
        RAISE NOTICE 'Columna employee_id ya existe en appointments';
    END IF;
END $$;

-- PASO 6: Crear índice GIN en internal_notes para búsquedas eficientes (solo si es JSONB)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'appointments'
        AND column_name = 'internal_notes'
        AND data_type = 'jsonb'
    ) THEN
        -- Crear índice GIN para JSONB
        CREATE INDEX IF NOT EXISTS idx_appointments_internal_notes_gin 
        ON appointments USING GIN (internal_notes)
        WHERE internal_notes IS NOT NULL;
        
        RAISE NOTICE 'Índice GIN creado en internal_notes (JSONB)';
    ELSE
        RAISE NOTICE 'internal_notes no es JSONB, no se crea índice GIN';
    END IF;
END $$;

-- PASO 7: Crear índice en synced_to_gcal si no existe
CREATE INDEX IF NOT EXISTS idx_appointments_synced_to_gcal
ON appointments(synced_to_gcal)
WHERE synced_to_gcal = TRUE;

-- PASO 8: Comentarios en las columnas
COMMENT ON COLUMN appointments.internal_notes IS 
'Notas internas en formato JSONB. Almacena información adicional como gcal_event_id, calendar_id, original_summary, etc. para eventos de Google Calendar.';

COMMENT ON COLUMN appointments.synced_to_gcal IS 
'Indica si la reserva ha sido sincronizada con Google Calendar. TRUE = sincronizada, FALSE = no sincronizada.';

-- PASO 9: Verificar estructura final
DO $$
DECLARE
    v_column_count INTEGER;
    v_columns TEXT;
BEGIN
    SELECT COUNT(*), string_agg(column_name || ' (' || data_type || ')', ', ' ORDER BY ordinal_position)
    INTO v_column_count, v_columns
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'appointments';
    
    RAISE NOTICE '✅ Tabla appointments tiene % columnas', v_column_count;
    RAISE NOTICE 'Columnas: %', v_columns;
END $$;

SELECT 'Migración 20251121_05_verify_appointments_schema completada. Esquema de appointments verificado y actualizado.' AS status;

