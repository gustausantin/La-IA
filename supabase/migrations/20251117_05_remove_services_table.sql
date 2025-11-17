-- =====================================================
-- MIGRACIÓN: Eliminar tabla services (legacy)
-- Fecha: 2025-11-17
-- Objetivo: Unificar todo en business_services para evitar inconsistencias
-- =====================================================

-- PASO 1: Verificar si hay datos en services que necesiten migrarse
DO $$
DECLARE
    v_services_count INTEGER;
    v_business_services_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_services_count FROM services;
    SELECT COUNT(*) INTO v_business_services_count FROM business_services;
    
    RAISE NOTICE '📊 Servicios en tabla services: %', v_services_count;
    RAISE NOTICE '📊 Servicios en tabla business_services: %', v_business_services_count;
    
    -- Si hay datos en services, intentar migrarlos
    IF v_services_count > 0 THEN
        RAISE NOTICE '⚠️ ADVERTENCIA: Hay % servicios en la tabla services que se migrarán a business_services', v_services_count;
        
        -- Migrar datos de services a business_services
        -- NOTA: services tiene: price, is_available (NO tiene display_order ni position_order)
        -- business_services tiene: suggested_price, is_active, position_order
        INSERT INTO business_services (
            business_id,
            name,
            category,
            description,
            duration_minutes,
            suggested_price,
            is_active,
            position_order,
            created_at,
            updated_at
        )
        SELECT 
            business_id,
            name,
            category,
            description,
            duration_minutes,
            COALESCE(price, 0) as suggested_price, -- Mapear price a suggested_price
            COALESCE(is_available, true) as is_active, -- Mapear is_available a is_active
            0 as position_order, -- Valor por defecto ya que services no tiene esta columna
            created_at,
            updated_at
        FROM services
        WHERE NOT EXISTS (
            -- Evitar duplicados: solo migrar si no existe ya en business_services
            SELECT 1 FROM business_services bs
            WHERE bs.business_id = services.business_id
            AND bs.name = services.name
        );
        
        GET DIAGNOSTICS v_services_count = ROW_COUNT;
        RAISE NOTICE '✅ Migrados % servicios de services a business_services', v_services_count;
    ELSE
        RAISE NOTICE '✅ No hay datos en services para migrar';
    END IF;
END $$;

-- PASO 2: Actualizar waitlist.service_id para que apunte a business_services
-- Primero eliminar la FK antigua
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'waitlist_service_id_fkey'
    ) THEN
        ALTER TABLE waitlist DROP CONSTRAINT waitlist_service_id_fkey;
        RAISE NOTICE '✅ FK waitlist_service_id_fkey eliminada';
    ELSE
        RAISE NOTICE 'ℹ️ FK waitlist_service_id_fkey no existe (ya fue eliminada)';
    END IF;
END $$;

-- Crear nueva FK apuntando a business_services
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'waitlist_service_id_business_services_fkey'
    ) THEN
        ALTER TABLE waitlist
        ADD CONSTRAINT waitlist_service_id_business_services_fkey
        FOREIGN KEY (service_id) 
        REFERENCES business_services(id) 
        ON DELETE SET NULL;
        
        RAISE NOTICE '✅ Nueva FK waitlist_service_id_business_services_fkey creada';
    ELSE
        RAISE NOTICE 'ℹ️ FK waitlist_service_id_business_services_fkey ya existe';
    END IF;
END $$;

-- PASO 3: Actualizar la vista waitlist_summary para usar business_services
DROP VIEW IF EXISTS waitlist_summary;
CREATE OR REPLACE VIEW waitlist_summary AS
SELECT 
    w.business_id,
    w.preferred_date,
    bs.name AS service_name,
    COUNT(*) AS waiting_count,
    MIN(w.created_at) AS oldest_request,
    AVG(w.priority) AS avg_priority
FROM waitlist w
LEFT JOIN business_services bs ON w.service_id = bs.id
WHERE w.status = 'waiting'
  AND w.expires_at > now()
GROUP BY w.business_id, w.preferred_date, bs.name
ORDER BY w.preferred_date ASC, waiting_count DESC;

DO $$
BEGIN
    RAISE NOTICE '✅ Vista waitlist_summary actualizada para usar business_services';
END $$;

-- PASO 4: Eliminar RLS policies de services
DO $$
BEGIN
    -- Eliminar todas las policies de services
    DROP POLICY IF EXISTS "Users can manage services of their business" ON services;
    DROP POLICY IF EXISTS "Users can view their business services" ON services;
    
    RAISE NOTICE '✅ RLS policies de services eliminadas';
END $$;

-- PASO 5: Eliminar índices de services
DROP INDEX IF EXISTS idx_services_business;
DROP INDEX IF EXISTS idx_services_active;
DROP INDEX IF EXISTS idx_services_category;

DO $$
BEGIN
    RAISE NOTICE '✅ Índices de services eliminados';
END $$;

-- PASO 6: Eliminar la tabla services completamente
DROP TABLE IF EXISTS services CASCADE;

DO $$
BEGIN
    RAISE NOTICE '✅ Tabla services eliminada completamente';
END $$;

-- =====================================================
-- VERIFICACIÓN FINAL
-- =====================================================
DO $$
DECLARE
    v_waitlist_fk_exists BOOLEAN;
    v_services_table_exists BOOLEAN;
BEGIN
    -- Verificar que la FK de waitlist apunta a business_services
    SELECT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'waitlist_service_id_business_services_fkey'
    ) INTO v_waitlist_fk_exists;
    
    -- Verificar que services ya no existe
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'services'
    ) INTO v_services_table_exists;
    
    IF v_waitlist_fk_exists AND NOT v_services_table_exists THEN
        RAISE NOTICE '✅ VERIFICACIÓN EXITOSA: Migración completada correctamente';
        RAISE NOTICE '   - waitlist.service_id ahora apunta a business_services';
        RAISE NOTICE '   - Tabla services eliminada';
    ELSE
        RAISE WARNING '⚠️ VERIFICACIÓN: Revisar manualmente';
        RAISE NOTICE '   - waitlist FK existe: %', v_waitlist_fk_exists;
        RAISE NOTICE '   - services table existe: %', v_services_table_exists;
    END IF;
END $$;

-- =====================================================
-- COMENTARIOS
-- =====================================================
COMMENT ON CONSTRAINT waitlist_service_id_business_services_fkey ON waitlist IS 
'FK actualizada: waitlist.service_id ahora apunta a business_services en lugar de services (legacy)';

