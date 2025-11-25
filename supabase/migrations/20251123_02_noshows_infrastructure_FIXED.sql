-- =====================================================
-- MIGRACIÓN: Sistema No-Shows Inteligente (Infraestructura CORREGIDA)
-- Fecha: 2025-11-23
-- Descripción: Crea/actualiza la infraestructura para el sistema
--              de prevención de no-shows con confirmaciones inteligentes
-- =====================================================

-- =====================================================
-- 1. TABLA: customer_confirmations (CREAR O ACTUALIZAR)
-- =====================================================

-- Verificar si la tabla existe y crearla/actualizarla
DO $$
BEGIN
    -- Si NO existe, crearla desde cero
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'customer_confirmations'
    ) THEN
        RAISE NOTICE 'Creando tabla customer_confirmations desde cero...';
        
        CREATE TABLE customer_confirmations (
            -- IDs y referencias
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
            appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
            customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
            
            -- Información del mensaje (columnas base que YA EXISTEN en el sistema)
            message_type TEXT NOT NULL, -- '24h', '4h', '2h', 'manual'
            message_channel TEXT NOT NULL DEFAULT 'whatsapp', -- 'whatsapp', 'sms', 'email'
            message_sent TEXT NOT NULL, -- Contenido del mensaje enviado
            sent_at TIMESTAMPTZ DEFAULT NOW(),
            
            -- Respuesta del cliente (columnas que YA EXISTEN)
            confirmed BOOLEAN DEFAULT FALSE,
            response_text TEXT, -- Texto de la respuesta del cliente
            response_at TIMESTAMPTZ, -- Cuándo respondió
            
            -- Timestamps
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        -- Índices
        CREATE INDEX idx_confirmations_appointment ON customer_confirmations(appointment_id);
        CREATE INDEX idx_confirmations_customer ON customer_confirmations(customer_id);
        CREATE INDEX idx_confirmations_business ON customer_confirmations(business_id);
        CREATE INDEX idx_confirmations_sent_at ON customer_confirmations(sent_at);
        CREATE INDEX idx_confirmations_confirmed ON customer_confirmations(confirmed);
        
        RAISE NOTICE '✅ Tabla customer_confirmations creada exitosamente';
    ELSE
        -- Si YA existe, verificar y añadir columnas faltantes
        RAISE NOTICE 'Tabla customer_confirmations ya existe, verificando columnas...';
        
        -- Verificar business_id
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'customer_confirmations' 
            AND column_name = 'business_id'
        ) THEN
            ALTER TABLE customer_confirmations 
            ADD COLUMN business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
            
            -- Llenar con datos existentes (obtener de appointments)
            UPDATE customer_confirmations cc
            SET business_id = a.business_id
            FROM appointments a
            WHERE cc.appointment_id = a.id;
            
            -- Hacer NOT NULL después de llenar datos
            ALTER TABLE customer_confirmations 
            ALTER COLUMN business_id SET NOT NULL;
            
            RAISE NOTICE '✅ Columna business_id añadida';
        END IF;
        
        -- Verificar message_sent
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'customer_confirmations' 
            AND column_name = 'message_sent'
        ) THEN
            -- Si existe 'message_content', renombrarla
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'customer_confirmations' 
                AND column_name = 'message_content'
            ) THEN
                ALTER TABLE customer_confirmations 
                RENAME COLUMN message_content TO message_sent;
                RAISE NOTICE '✅ Columna message_content renombrada a message_sent';
            ELSE
                ALTER TABLE customer_confirmations 
                ADD COLUMN message_sent TEXT DEFAULT 'N/A';
                RAISE NOTICE '✅ Columna message_sent añadida';
            END IF;
        END IF;
        
        -- Verificar message_channel
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'customer_confirmations' 
            AND column_name = 'message_channel'
        ) THEN
            ALTER TABLE customer_confirmations 
            ADD COLUMN message_channel TEXT DEFAULT 'whatsapp';
            RAISE NOTICE '✅ Columna message_channel añadida';
        END IF;
        
        -- Verificar response_text
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'customer_confirmations' 
            AND column_name = 'response_text'
        ) THEN
            -- Si existe 'response_content', renombrarla
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'customer_confirmations' 
                AND column_name = 'response_content'
            ) THEN
                ALTER TABLE customer_confirmations 
                RENAME COLUMN response_content TO response_text;
                RAISE NOTICE '✅ Columna response_content renombrada a response_text';
            ELSE
                ALTER TABLE customer_confirmations 
                ADD COLUMN response_text TEXT;
                RAISE NOTICE '✅ Columna response_text añadida';
            END IF;
        END IF;
        
        -- Verificar response_at
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'customer_confirmations' 
            AND column_name = 'response_at'
        ) THEN
            -- Si existe 'responded_at', renombrarla
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'customer_confirmations' 
                AND column_name = 'responded_at'
            ) THEN
                ALTER TABLE customer_confirmations 
                RENAME COLUMN responded_at TO response_at;
                RAISE NOTICE '✅ Columna responded_at renombrada a response_at';
            ELSE
                ALTER TABLE customer_confirmations 
                ADD COLUMN response_at TIMESTAMPTZ;
                RAISE NOTICE '✅ Columna response_at añadida';
            END IF;
        END IF;
        
        RAISE NOTICE '✅ Tabla customer_confirmations actualizada';
    END IF;
END $$;

COMMENT ON TABLE customer_confirmations IS 
'Historial completo de confirmaciones enviadas y respuestas recibidas. 
Permite auditoría, control de costes y análisis de tasas de confirmación.';

-- =====================================================
-- 2. CAMPO: customers.no_show_count
-- =====================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'customers' 
        AND column_name = 'no_show_count'
    ) THEN
        ALTER TABLE customers 
        ADD COLUMN no_show_count INTEGER DEFAULT 0;
        
        -- Actualizar histórico (contar no-shows existentes)
        UPDATE customers c
        SET no_show_count = (
            SELECT COUNT(*) 
            FROM appointments a 
            WHERE a.customer_id = c.id 
            AND a.status = 'no_show'
        )
        WHERE EXISTS (
            SELECT 1 FROM appointments a 
            WHERE a.customer_id = c.id 
            AND a.status = 'no_show'
        );
        
        RAISE NOTICE '✅ Columna no_show_count añadida a customers';
    ELSE
        RAISE NOTICE 'Columna no_show_count ya existe en customers';
    END IF;
END $$;

COMMENT ON COLUMN customers.no_show_count IS 
'Número total de no-shows del cliente. Se usa para calcular risk_score y aplicar políticas diferenciadas.';

-- =====================================================
-- 3. TRIGGER: Auto-incrementar no_show_count
-- =====================================================

CREATE OR REPLACE FUNCTION increment_customer_noshow_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo si cambia a 'no_show'
    IF (OLD.status IS NULL OR OLD.status != 'no_show') AND NEW.status = 'no_show' THEN
        UPDATE customers
        SET no_show_count = no_show_count + 1
        WHERE id = NEW.customer_id;
        
        RAISE NOTICE 'Incrementado no_show_count para customer %', NEW.customer_id;
    END IF;
    
    -- Si revierte de 'no_show' a otro estado, decrementar
    IF OLD.status = 'no_show' AND NEW.status != 'no_show' THEN
        UPDATE customers
        SET no_show_count = GREATEST(0, no_show_count - 1)
        WHERE id = NEW.customer_id;
        
        RAISE NOTICE 'Decrementado no_show_count para customer %', NEW.customer_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_increment_noshow_count ON appointments;
CREATE TRIGGER trigger_increment_noshow_count
AFTER UPDATE OF status ON appointments
FOR EACH ROW
EXECUTE FUNCTION increment_customer_noshow_count();

COMMENT ON FUNCTION increment_customer_noshow_count IS 
'Mantiene actualizado el contador de no-shows del cliente automáticamente.';

-- =====================================================
-- 4. TRIGGER: Auto-liberar slots en no_show/cancelled
-- =====================================================

CREATE OR REPLACE FUNCTION auto_release_slots_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo si cambia a 'no_show' o 'cancelled'
    IF (OLD.status IS NULL OR OLD.status NOT IN ('no_show', 'cancelled')) 
        AND NEW.status IN ('no_show', 'cancelled') THEN
        
        -- Liberar availability_slots asociados
        UPDATE availability_slots
        SET 
            status = 'free',
            is_available = TRUE,
            updated_at = NOW()
        WHERE business_id = NEW.business_id
        AND slot_date = NEW.appointment_date
        AND start_time = NEW.appointment_time
        AND (
            resource_id = NEW.resource_id 
            OR employee_id = NEW.employee_id
        );
        
        RAISE NOTICE 'Slots liberados para appointment % (status: % → %)', 
            NEW.id, OLD.status, NEW.status;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_release_slots ON appointments;
CREATE TRIGGER trigger_auto_release_slots
AFTER UPDATE OF status ON appointments
FOR EACH ROW
EXECUTE FUNCTION auto_release_slots_on_status_change();

COMMENT ON FUNCTION auto_release_slots_on_status_change IS 
'Libera automáticamente los availability_slots cuando un appointment cambia a no_show o cancelled.
Garantiza consistencia de datos sin depender de lógica externa (N8N).';

-- =====================================================
-- 5. FUNCIÓN: record_customer_confirmation()
-- =====================================================

CREATE OR REPLACE FUNCTION record_customer_confirmation(
    p_appointment_id UUID,
    p_message_type TEXT,
    p_channel TEXT,
    p_message TEXT
) RETURNS UUID AS $$
DECLARE
    v_confirmation_id UUID;
    v_business_id UUID;
    v_customer_id UUID;
BEGIN
    -- Obtener business_id y customer_id del appointment
    SELECT business_id, customer_id 
    INTO v_business_id, v_customer_id
    FROM appointments
    WHERE id = p_appointment_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Appointment % no encontrado', p_appointment_id;
    END IF;
    
    -- Insertar registro de confirmación
    INSERT INTO customer_confirmations (
        business_id,
        appointment_id,
        customer_id,
        message_type,
        message_channel,
        message_sent
    ) VALUES (
        v_business_id,
        p_appointment_id,
        v_customer_id,
        p_message_type,
        p_channel,
        p_message
    ) RETURNING id INTO v_confirmation_id;
    
    RAISE NOTICE 'Confirmación registrada: % (type: %, channel: %)', 
        v_confirmation_id, p_message_type, p_channel;
    
    RETURN v_confirmation_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION record_customer_confirmation IS 
'Registra un mensaje de confirmación enviado a un cliente.
Uso: SELECT record_customer_confirmation(appointment_id, ''24h'', ''whatsapp'', ''Mensaje...'')';

-- =====================================================
-- 6. FUNCIÓN: process_customer_response()
-- =====================================================

CREATE OR REPLACE FUNCTION process_customer_response(
    p_appointment_id UUID,
    p_message_type TEXT,
    p_response TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_confirmed BOOLEAN;
    v_confirmation_id UUID;
BEGIN
    -- Detectar si es una confirmación positiva
    v_confirmed := (
        LOWER(p_response) SIMILAR TO 
        '%(si|sí|yes|confirmo|confirm|ok|vale|perfecto|claro|seguro|afirmativo)%'
    );
    
    -- Buscar la última confirmación de este tipo
    SELECT id INTO v_confirmation_id
    FROM customer_confirmations
    WHERE appointment_id = p_appointment_id
    AND message_type = p_message_type
    ORDER BY sent_at DESC
    LIMIT 1;
    
    IF NOT FOUND THEN
        RAISE WARNING 'No se encontró confirmación previa para appointment % (type: %)', 
            p_appointment_id, p_message_type;
        RETURN FALSE;
    END IF;
    
    -- Actualizar registro de confirmación
    UPDATE customer_confirmations
    SET 
        confirmed = v_confirmed,
        response_text = p_response,
        response_at = NOW(),
        updated_at = NOW()
    WHERE id = v_confirmation_id;
    
    -- Si confirmó, actualizar estado del appointment
    IF v_confirmed THEN
        UPDATE appointments
        SET 
            status = 'confirmed',
            updated_at = NOW()
        WHERE id = p_appointment_id;
        
        RAISE NOTICE 'Cliente confirmó appointment %', p_appointment_id;
    ELSE
        RAISE NOTICE 'Cliente NO confirmó appointment % (respuesta: %)', 
            p_appointment_id, p_response;
    END IF;
    
    RETURN v_confirmed;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION process_customer_response IS 
'Procesa la respuesta de un cliente (Sí/No) y actualiza el estado del appointment si confirmó.
Uso: SELECT process_customer_response(appointment_id, ''24h'', ''Si, confirmo'')';

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================

SELECT 'Migración 20251123_02_noshows_infrastructure_FIXED completada exitosamente' AS status;





