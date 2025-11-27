-- =====================================================
-- MIGRACIÓN: Asignar número de teléfono a Pelos Barbaros
-- Descripción: Asigna el número +34931204462 al negocio para que la Edge Function pueda identificarlo
-- =====================================================

-- Actualizar el negocio "Pelos Barbaros" con el número asignado
-- Buscamos por nombre del negocio o email del owner
UPDATE businesses
SET 
    assigned_phone = '+34931204462',
    updated_at = NOW()
WHERE 
    -- Buscar por nombre del negocio
    (LOWER(name) LIKE '%pelos%barbaros%' 
     OR LOWER(business_name) LIKE '%pelos%barbaros%')
    -- O por email del owner (si tenemos acceso a user_business_mapping)
    OR id IN (
        SELECT business_id 
        FROM user_business_mapping ubm
        JOIN auth.users u ON u.id = ubm.auth_user_id
        WHERE LOWER(u.email) = 'gustausantin@icloud.com'
        AND ubm.active = true
    )
    AND active = true;

-- Verificar que se actualizó correctamente
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO updated_count
    FROM businesses
    WHERE assigned_phone = '+34931204462';
    
    IF updated_count = 0 THEN
        RAISE NOTICE '⚠️ No se encontró el negocio "Pelos Barbaros". Verifica el nombre o crea el registro manualmente.';
    ELSIF updated_count = 1 THEN
        RAISE NOTICE '✅ Número +34931204462 asignado correctamente a Pelos Barbaros';
    ELSE
        RAISE NOTICE '⚠️ Se actualizaron % negocios con el número +34931204462. Verifica que sea correcto.', updated_count;
    END IF;
END $$;

-- Comentario para documentación
COMMENT ON COLUMN businesses.assigned_phone IS 
    'Número telefónico asignado del pool de LA-IA. Usado por VAPI para identificar el negocio en llamadas entrantes. Formato: +34XXXXXXXXX';

