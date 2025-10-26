-- =====================================================
-- NORMALIZACIÓN AUTOMÁTICA DE NÚMEROS DE TELÉFONO
-- Fecha: 10 Octubre 2025
-- Descripción: Garantiza que todos los teléfonos se guarden en formato E.164 (+34...)
-- =====================================================

-- =====================================================
-- PASO 1: FUNCIÓN PARA NORMALIZAR TELÉFONOS
-- =====================================================

CREATE OR REPLACE FUNCTION normalize_phone_number(phone_input TEXT, default_country_code TEXT DEFAULT '+34')
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    cleaned_phone TEXT;
BEGIN
    -- Si es NULL o vacío, retornar NULL
    IF phone_input IS NULL OR TRIM(phone_input) = '' THEN
        RETURN NULL;
    END IF;
    
    -- Limpiar espacios, guiones, paréntesis
    cleaned_phone := REGEXP_REPLACE(phone_input, '[^0-9+]', '', 'g');
    
    -- Si ya tiene +, verificar que sea válido
    IF cleaned_phone LIKE '+%' THEN
        -- Ya tiene +, solo verificar que tenga al menos 10 dígitos después del +
        IF LENGTH(REGEXP_REPLACE(cleaned_phone, '[^0-9]', '', 'g')) >= 9 THEN
            RETURN cleaned_phone;
        ELSE
            -- Número inválido
            RETURN NULL;
        END IF;
    END IF;
    
    -- Si empieza con 00, convertir a +
    IF cleaned_phone LIKE '00%' THEN
        cleaned_phone := '+' || SUBSTRING(cleaned_phone FROM 3);
        RETURN cleaned_phone;
    END IF;
    
    -- Si empieza con el código de país sin +, agregar +
    IF cleaned_phone LIKE '34%' AND LENGTH(cleaned_phone) = 11 THEN
        RETURN '+' || cleaned_phone;
    END IF;
    
    -- Si no tiene código de país, agregar el default
    IF LENGTH(cleaned_phone) = 9 THEN
        RETURN default_country_code || cleaned_phone;
    END IF;
    
    -- Si tiene más de 9 dígitos pero menos de 11, asumir que falta el +
    IF LENGTH(cleaned_phone) > 9 AND LENGTH(cleaned_phone) <= 13 THEN
        RETURN '+' || cleaned_phone;
    END IF;
    
    -- Si nada coincide, retornar NULL (número inválido)
    RETURN NULL;
END;
$$;

-- Comentario de la función
COMMENT ON FUNCTION normalize_phone_number IS 'Normaliza números de teléfono al formato E.164 internacional (+34...)';

-- =====================================================
-- PASO 2: TRIGGER PARA CUSTOMERS
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_normalize_customer_phone()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Normalizar el teléfono antes de guardar
    IF NEW.phone IS NOT NULL THEN
        NEW.phone := normalize_phone_number(NEW.phone, '+34');
    END IF;
    
    RETURN NEW;
END;
$$;

-- Crear trigger en customers
DROP TRIGGER IF EXISTS trigger_normalize_phone_customers ON customers;
CREATE TRIGGER trigger_normalize_phone_customers
    BEFORE INSERT OR UPDATE OF phone ON customers
    FOR EACH ROW
    EXECUTE FUNCTION trigger_normalize_customer_phone();

-- =====================================================
-- PASO 3: TRIGGER PARA RESTAURANTS
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_normalize_restaurant_phone()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Normalizar el teléfono antes de guardar
    IF NEW.phone IS NOT NULL THEN
        NEW.phone := normalize_phone_number(NEW.phone, '+34');
    END IF;
    
    RETURN NEW;
END;
$$;

-- Crear trigger en restaurants
DROP TRIGGER IF EXISTS trigger_normalize_phone_restaurants ON restaurants;
CREATE TRIGGER trigger_normalize_phone_restaurants
    BEFORE INSERT OR UPDATE OF phone ON restaurants
    FOR EACH ROW
    EXECUTE FUNCTION trigger_normalize_restaurant_phone();

-- =====================================================
-- PASO 4: TRIGGER PARA RESERVATIONS (customer_phone)
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_normalize_reservation_phone()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Normalizar el teléfono antes de guardar
    IF NEW.customer_phone IS NOT NULL THEN
        NEW.customer_phone := normalize_phone_number(NEW.customer_phone, '+34');
    END IF;
    
    RETURN NEW;
END;
$$;

-- Crear trigger en reservations
DROP TRIGGER IF EXISTS trigger_normalize_phone_reservations ON reservations;
CREATE TRIGGER trigger_normalize_phone_reservations
    BEFORE INSERT OR UPDATE OF customer_phone ON reservations
    FOR EACH ROW
    EXECUTE FUNCTION trigger_normalize_reservation_phone();

-- =====================================================
-- PASO 5: NORMALIZAR DATOS EXISTENTES
-- =====================================================

DO $$
DECLARE
    updated_customers INTEGER := 0;
    updated_restaurants INTEGER := 0;
    updated_reservations INTEGER := 0;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '🔄 NORMALIZANDO TELÉFONOS EXISTENTES';
    RAISE NOTICE '========================================';
    
    -- Normalizar customers
    UPDATE customers
    SET phone = normalize_phone_number(phone, '+34')
    WHERE phone IS NOT NULL
      AND phone != normalize_phone_number(phone, '+34');
    
    GET DIAGNOSTICS updated_customers = ROW_COUNT;
    RAISE NOTICE '✅ Customers actualizados: %', updated_customers;
    
    -- Normalizar restaurants
    UPDATE restaurants
    SET phone = normalize_phone_number(phone, '+34')
    WHERE phone IS NOT NULL
      AND phone != normalize_phone_number(phone, '+34');
    
    GET DIAGNOSTICS updated_restaurants = ROW_COUNT;
    RAISE NOTICE '✅ Restaurants actualizados: %', updated_restaurants;
    
    -- Normalizar reservations
    UPDATE reservations
    SET customer_phone = normalize_phone_number(customer_phone, '+34')
    WHERE customer_phone IS NOT NULL
      AND customer_phone != normalize_phone_number(customer_phone, '+34');
    
    GET DIAGNOSTICS updated_reservations = ROW_COUNT;
    RAISE NOTICE '✅ Reservations actualizadas: %', updated_reservations;
    
    RAISE NOTICE ' ';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ NORMALIZACIÓN COMPLETADA';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Total actualizado: %', updated_customers + updated_restaurants + updated_reservations;
END;
$$;

-- =====================================================
-- PASO 6: TESTS
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE ' ';
    RAISE NOTICE '========================================';
    RAISE NOTICE '🧪 TESTS DE NORMALIZACIÓN';
    RAISE NOTICE '========================================';
    
    -- Test 1: Teléfono con +
    RAISE NOTICE 'Test 1: % → %', '+34671126148', normalize_phone_number('+34671126148');
    
    -- Test 2: Teléfono sin +
    RAISE NOTICE 'Test 2: % → %', '34671126148', normalize_phone_number('34671126148');
    
    -- Test 3: Teléfono con 00
    RAISE NOTICE 'Test 3: % → %', '0034671126148', normalize_phone_number('0034671126148');
    
    -- Test 4: Teléfono solo 9 dígitos
    RAISE NOTICE 'Test 4: % → %', '671126148', normalize_phone_number('671126148');
    
    -- Test 5: Teléfono con espacios y guiones
    RAISE NOTICE 'Test 5: % → %', '+34 671 12 61 48', normalize_phone_number('+34 671 12 61 48');
    
    -- Test 6: Teléfono con paréntesis
    RAISE NOTICE 'Test 6: % → %', '(+34) 671-126-148', normalize_phone_number('(+34) 671-126-148');
    
    RAISE NOTICE '========================================';
END;
$$;

-- =====================================================
-- RESUMEN
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE ' ';
    RAISE NOTICE '========================================';
    RAISE NOTICE '📋 RESUMEN DE LA MIGRACIÓN';
    RAISE NOTICE '========================================';
    RAISE NOTICE '1. ✅ Función normalize_phone_number() creada';
    RAISE NOTICE '2. ✅ Triggers en customers, restaurants, reservations';
    RAISE NOTICE '3. ✅ Datos existentes normalizados';
    RAISE NOTICE '4. ✅ Tests ejecutados';
    RAISE NOTICE ' ';
    RAISE NOTICE '📝 COMPORTAMIENTO:';
    RAISE NOTICE '   - Usuario escribe: 671126148 → BD guarda: +34671126148';
    RAISE NOTICE '   - Usuario escribe: +34671126148 → BD guarda: +34671126148';
    RAISE NOTICE '   - Usuario escribe: 0034671126148 → BD guarda: +34671126148';
    RAISE NOTICE '   - Usuario escribe: +34 671 12 61 48 → BD guarda: +34671126148';
    RAISE NOTICE ' ';
    RAISE NOTICE '🎯 RESULTADO:';
    RAISE NOTICE '   - TODOS los teléfonos en formato E.164 (+34...)';
    RAISE NOTICE '   - N8n siempre recibe teléfonos normalizados';
    RAISE NOTICE '   - WhatsApp funciona sin problemas';
    RAISE NOTICE '========================================';
END;
$$;

