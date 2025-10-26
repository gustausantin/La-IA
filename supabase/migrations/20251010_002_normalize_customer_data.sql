-- =====================================================
-- NORMALIZACIÓN DE DATOS DE CLIENTES
-- Fecha: 10 Octubre 2025
-- Descripción: Elimina duplicación de datos entre customers y reservations
-- Garantiza que los cambios en customers se reflejen en todas sus reservas
-- =====================================================

-- =====================================================
-- PASO 1: CREAR/ACTUALIZAR CUSTOMERS DESDE RESERVATIONS
-- =====================================================

-- Función para crear o actualizar customer desde datos de reserva
CREATE OR REPLACE FUNCTION upsert_customer_from_reservation(
    p_restaurant_id UUID,
    p_customer_name TEXT,
    p_customer_email TEXT DEFAULT NULL,
    p_customer_phone TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_customer_id UUID;
    v_existing_customer UUID;
BEGIN
    -- Buscar customer existente por email o teléfono
    SELECT id INTO v_existing_customer
    FROM customers
    WHERE restaurant_id = p_restaurant_id
      AND (
          (p_customer_email IS NOT NULL AND email = p_customer_email)
          OR (p_customer_phone IS NOT NULL AND phone = p_customer_phone)
      )
    LIMIT 1;
    
    IF v_existing_customer IS NOT NULL THEN
        -- Actualizar datos si han cambiado
        UPDATE customers
        SET 
            name = COALESCE(p_customer_name, name),
            email = COALESCE(p_customer_email, email),
            phone = COALESCE(p_customer_phone, phone),
            updated_at = NOW()
        WHERE id = v_existing_customer;
        
        RETURN v_existing_customer;
    ELSE
        -- Crear nuevo customer
        INSERT INTO customers (
            restaurant_id,
            name,
            email,
            phone,
            created_at,
            updated_at
        )
        VALUES (
            p_restaurant_id,
            p_customer_name,
            p_customer_email,
            p_customer_phone,
            NOW(),
            NOW()
        )
        RETURNING id INTO v_customer_id;
        
        RETURN v_customer_id;
    END IF;
END;
$$;

-- =====================================================
-- PASO 2: MIGRAR DATOS EXISTENTES
-- =====================================================

-- Asegurar que todas las reservas tienen un customer_id
DO $$
DECLARE
    reservation_record RECORD;
    new_customer_id UUID;
    migrated_count INTEGER := 0;
BEGIN
    RAISE NOTICE '🔄 Iniciando migración de datos de clientes...';
    
    -- Para cada reserva sin customer_id
    FOR reservation_record IN 
        SELECT id, restaurant_id, customer_name, customer_email, customer_phone
        FROM reservations
        WHERE customer_id IS NULL
          AND customer_name IS NOT NULL
    LOOP
        -- Crear/obtener customer
        new_customer_id := upsert_customer_from_reservation(
            reservation_record.restaurant_id,
            reservation_record.customer_name,
            reservation_record.customer_email,
            reservation_record.customer_phone
        );
        
        -- Actualizar reserva con customer_id
        UPDATE reservations
        SET customer_id = new_customer_id
        WHERE id = reservation_record.id;
        
        migrated_count := migrated_count + 1;
    END LOOP;
    
    RAISE NOTICE '✅ Migración completada: % reservas actualizadas', migrated_count;
END;
$$;

-- =====================================================
-- PASO 3: CREAR VISTA PARA COMPATIBILIDAD CON FRONTEND
-- =====================================================

-- Eliminar vista existente si existe (para evitar conflictos de columnas)
DROP VIEW IF EXISTS reservations_with_customer CASCADE;

-- Vista que "junta" los datos de customers con reservations
CREATE VIEW reservations_with_customer AS
SELECT 
    r.*,
    c.name as customer_name_view,
    c.email as customer_email_view,
    c.phone as customer_phone_view
FROM reservations r
LEFT JOIN customers c ON c.id = r.customer_id;

-- Comentario de la vista
COMMENT ON VIEW reservations_with_customer IS 'Vista que incluye datos del customer para compatibilidad con frontend existente';

-- =====================================================
-- PASO 4: TRIGGER PARA MANTENER SINCRONIZACIÓN
-- =====================================================

-- Trigger function: cuando se crea/actualiza una reserva, sincronizar customer
CREATE OR REPLACE FUNCTION sync_customer_on_reservation_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_customer_id UUID;
BEGIN
    -- Solo procesar si hay datos de customer y no hay customer_id
    IF NEW.customer_name IS NOT NULL AND NEW.customer_id IS NULL THEN
        -- Obtener/crear customer
        v_customer_id := upsert_customer_from_reservation(
            NEW.restaurant_id,
            NEW.customer_name,
            NEW.customer_email,
            NEW.customer_phone
        );
        
        -- Asignar customer_id
        NEW.customer_id := v_customer_id;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Crear trigger
DROP TRIGGER IF EXISTS trigger_sync_customer_on_reservation ON reservations;
CREATE TRIGGER trigger_sync_customer_on_reservation
    BEFORE INSERT OR UPDATE ON reservations
    FOR EACH ROW
    EXECUTE FUNCTION sync_customer_on_reservation_change();

-- =====================================================
-- PASO 5: FUNCIÓN RPC PARA OBTENER RESERVA CON DATOS DE CUSTOMER
-- =====================================================

-- RPC para frontend: obtener reserva con datos completos del customer
CREATE OR REPLACE FUNCTION get_reservation_with_customer(p_reservation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'id', r.id,
        'restaurant_id', r.restaurant_id,
        'customer_id', r.customer_id,
        'customer_name', c.name,
        'customer_email', c.email,
        'customer_phone', c.phone,
        'reservation_date', r.reservation_date,
        'reservation_time', r.reservation_time,
        'party_size', r.party_size,
        'status', r.status,
        'table_id', r.table_id,
        'channel', r.channel,
        'source', r.source,
        'special_requests', r.special_requests,
        'notes', r.notes,
        'created_at', r.created_at,
        'updated_at', r.updated_at
    )
    INTO result
    FROM reservations r
    LEFT JOIN customers c ON c.id = r.customer_id
    WHERE r.id = p_reservation_id;
    
    RETURN result;
END;
$$;

-- =====================================================
-- PASO 6: FUNCIÓN RPC PARA OBTENER RESERVAS DE UN RESTAURANTE
-- =====================================================

CREATE OR REPLACE FUNCTION get_reservations_with_customers(
    p_restaurant_id UUID,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', r.id,
            'restaurant_id', r.restaurant_id,
            'customer_id', r.customer_id,
            'customer_name', c.name,
            'customer_email', c.email,
            'customer_phone', c.phone,
            'reservation_date', r.reservation_date,
            'reservation_time', r.reservation_time,
            'party_size', r.party_size,
            'status', r.status,
            'table_id', r.table_id,
            'channel', r.channel,
            'source', r.source,
            'special_requests', r.special_requests,
            'notes', r.notes,
            'created_at', r.created_at,
            'updated_at', r.updated_at
        )
    )
    INTO result
    FROM reservations r
    LEFT JOIN customers c ON c.id = r.customer_id
    WHERE r.restaurant_id = p_restaurant_id
      AND (p_start_date IS NULL OR r.reservation_date >= p_start_date)
      AND (p_end_date IS NULL OR r.reservation_date <= p_end_date)
    ORDER BY r.reservation_date DESC, r.reservation_time DESC;
    
    RETURN COALESCE(result, '[]'::JSONB);
END;
$$;

-- =====================================================
-- PASO 7: HACER CUSTOMER_ID OBLIGATORIO (DESPUÉS DE MIGRACIÓN)
-- =====================================================

-- Verificar que todas las reservas tienen customer_id
DO $$
DECLARE
    missing_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO missing_count
    FROM reservations
    WHERE customer_id IS NULL;
    
    IF missing_count > 0 THEN
        RAISE WARNING '⚠️  Hay % reservas sin customer_id. No se puede hacer el campo obligatorio aún.', missing_count;
    ELSE
        RAISE NOTICE '✅ Todas las reservas tienen customer_id. Haciendo campo obligatorio...';
        
        -- Hacer customer_id NOT NULL
        ALTER TABLE reservations 
        ALTER COLUMN customer_id SET NOT NULL;
        
        RAISE NOTICE '✅ Campo customer_id ahora es obligatorio';
    END IF;
END;
$$;

-- =====================================================
-- PASO 8: DEPRECAR COLUMNAS ANTIGUAS (customer_name, customer_email, customer_phone)
-- =====================================================

-- Comentar columnas como "deprecadas" (no las borramos todavía por seguridad)
COMMENT ON COLUMN reservations.customer_name IS 'DEPRECATED: Usar customers.name via customer_id';
COMMENT ON COLUMN reservations.customer_email IS 'DEPRECATED: Usar customers.email via customer_id';
COMMENT ON COLUMN reservations.customer_phone IS 'DEPRECATED: Usar customers.phone via customer_id';

-- =====================================================
-- PASO 9: ÍNDICES PARA PERFORMANCE
-- =====================================================

-- Índice en customer_id para JOINs rápidos
CREATE INDEX IF NOT EXISTS idx_reservations_customer_id ON reservations(customer_id);

-- Índice compuesto para búsquedas por restaurante + customer
CREATE INDEX IF NOT EXISTS idx_reservations_restaurant_customer 
    ON reservations(restaurant_id, customer_id);

-- =====================================================
-- RESUMEN
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ NORMALIZACIÓN DE DATOS COMPLETADA';
    RAISE NOTICE '========================================';
    RAISE NOTICE '1. ✅ Función upsert_customer_from_reservation creada';
    RAISE NOTICE '2. ✅ Datos migrados: reservations → customers';
    RAISE NOTICE '3. ✅ Vista reservations_with_customer creada';
    RAISE NOTICE '4. ✅ Trigger de sincronización activado';
    RAISE NOTICE '5. ✅ RPCs get_reservation_with_customer y get_reservations_with_customers creados';
    RAISE NOTICE '6. ✅ Índices de performance creados';
    RAISE NOTICE ' ';
    RAISE NOTICE '📝 PRÓXIMOS PASOS PARA EL FRONTEND:';
    RAISE NOTICE '   - Usar get_reservations_with_customers() en lugar de SELECT directo';
    RAISE NOTICE '   - Al crear reservas, solo enviar customer_name/email/phone';
    RAISE NOTICE '   - El trigger sincronizará automáticamente con customers';
    RAISE NOTICE '   - Modificar customers actualizará todas sus reservas';
    RAISE NOTICE '========================================';
END;
$$;

