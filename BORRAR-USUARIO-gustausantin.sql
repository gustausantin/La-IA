-- =====================================================
-- BORRAR TODO DEL USUARIO: gustausantin@icloud.com
-- =====================================================

-- 1. Obtener el ID del usuario
DO $$ 
DECLARE
    v_user_id UUID;
BEGIN
    -- Buscar el user ID por email
    SELECT id INTO v_user_id 
    FROM auth.users 
    WHERE email = 'gustausantin@icloud.com';

    IF v_user_id IS NULL THEN
        RAISE NOTICE 'Usuario no encontrado';
        RETURN;
    END IF;

    RAISE NOTICE 'Usuario encontrado: %', v_user_id;

    -- 2. Borrar de user_business_mapping
    DELETE FROM user_business_mapping 
    WHERE auth_user_id = v_user_id;
    RAISE NOTICE 'Borrado de user_business_mapping';

    -- 3. Borrar negocios del usuario
    DELETE FROM businesses 
    WHERE owner_id = v_user_id;
    RAISE NOTICE 'Borrados negocios';

    -- 4. Borrar de profiles
    DELETE FROM profiles 
    WHERE auth_user_id = v_user_id;
    RAISE NOTICE 'Borrado de profiles';

    -- 5. OPCIONAL: Borrar el usuario de auth (comentado por seguridad)
    -- Si quieres borrar también el usuario de autenticación, descomenta:
    -- DELETE FROM auth.users WHERE id = v_user_id;
    -- RAISE NOTICE 'Usuario borrado de auth';

    RAISE NOTICE '✅ LIMPIEZA COMPLETADA para gustausantin@icloud.com';
END $$;

-- =====================================================
-- VERIFICACIÓN: Comprobar que está todo limpio
-- =====================================================

SELECT 
    u.email,
    u.id as user_id,
    (SELECT COUNT(*) FROM user_business_mapping WHERE auth_user_id = u.id) as mappings,
    (SELECT COUNT(*) FROM businesses WHERE owner_id = u.id) as businesses,
    (SELECT COUNT(*) FROM profiles WHERE auth_user_id = u.id) as profiles
FROM auth.users u
WHERE u.email = 'gustausantin@icloud.com';

-- Debe devolver:
-- email: gustausantin@icloud.com
-- mappings: 0
-- businesses: 0
-- profiles: 0

