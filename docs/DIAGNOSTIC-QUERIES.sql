-- =====================================================
-- QUERIES DE DIAGNÓSTICO PARA GOOGLE CALENDAR
-- =====================================================

-- 1. Verificar que el usuario tiene un mapping
SELECT 
    ubm.id,
    ubm.auth_user_id,
    ubm.business_id,
    ubm.role,
    ubm.active,
    ubm.created_at,
    b.name as business_name,
    b.active as business_active
FROM user_business_mapping ubm
LEFT JOIN businesses b ON b.id = ubm.business_id
WHERE ubm.auth_user_id = '856e76ff-417f-46d0-8191-edbaa4838310'  -- Reemplaza con tu user_id
ORDER BY ubm.created_at DESC;

-- 2. Verificar integraciones existentes
SELECT 
    id,
    business_id,
    provider,
    is_active,
    status,
    connected_at,
    created_at,
    CASE 
        WHEN access_token IS NOT NULL THEN 'Sí' 
        ELSE 'No' 
    END as tiene_access_token,
    CASE 
        WHEN refresh_token IS NOT NULL THEN 'Sí' 
        ELSE 'No' 
    END as tiene_refresh_token,
    config->>'calendar_name' as calendar_name
FROM integrations 
WHERE provider = 'google_calendar'
ORDER BY created_at DESC
LIMIT 10;

-- 3. Verificar políticas RLS de integrations
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'integrations';

-- 4. Verificar políticas RLS de user_business_mapping
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'user_business_mapping';

-- 5. Verificar que el negocio existe y está activo
SELECT 
    id,
    name,
    email,
    active,
    created_at,
    settings
FROM businesses
WHERE id = '3bbe9ac3-3e61-471e-822e-e159f6ad8ae2';  -- Reemplaza con tu business_id

-- 6. Contar registros en cada tabla
SELECT 
    'user_business_mapping' as tabla,
    COUNT(*) as total_registros,
    COUNT(*) FILTER (WHERE active = true) as activos
FROM user_business_mapping
UNION ALL
SELECT 
    'businesses' as tabla,
    COUNT(*) as total_registros,
    COUNT(*) FILTER (WHERE active = true) as activos
FROM businesses
UNION ALL
SELECT 
    'integrations' as tabla,
    COUNT(*) as total_registros,
    COUNT(*) FILTER (WHERE is_active = true OR status = 'active') as activos
FROM integrations;

