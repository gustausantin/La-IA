-- =====================================================
-- SCRIPT: Asignar número de teléfono a Pelos Barbaros
-- Descripción: Asigna el número +34931204462 al negocio para que la Edge Function pueda identificarlo
-- 
-- INSTRUCCIONES:
-- 1. Ve al Dashboard de Supabase > SQL Editor
-- 2. Copia y pega este script
-- 3. Ejecuta el script
-- =====================================================

-- Actualizar el negocio "Pelos Barbaros" con el número asignado
UPDATE businesses
SET 
    assigned_phone = '+34931204462',
    updated_at = NOW()
WHERE 
    -- Buscar por nombre del negocio
    (LOWER(name) LIKE '%pelos%barbaros%' 
     OR LOWER(business_name) LIKE '%pelos%barbaros%')
    -- O por email del owner
    OR id IN (
        SELECT business_id 
        FROM user_business_mapping ubm
        JOIN auth.users u ON u.id = ubm.auth_user_id
        WHERE LOWER(u.email) = 'gustausantin@icloud.com'
        AND ubm.active = true
    )
    AND active = true;

-- Verificar que se actualizó correctamente
SELECT 
    id,
    name,
    business_name,
    assigned_phone,
    phone,
    vertical_type,
    active
FROM businesses
WHERE assigned_phone = '+34931204462';

