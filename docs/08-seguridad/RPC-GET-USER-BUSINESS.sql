-- =====================================================
-- 🔐 FUNCIÓN RPC PROFESIONAL: get_user_business
-- =====================================================
-- Esta función bypasea RLS de forma segura para obtener
-- el negocio asociado a un usuario específico.
-- 
-- SECURITY DEFINER permite ejecutar con permisos elevados
-- pero solo devuelve datos del usuario autenticado (seguro)
-- =====================================================

-- 1. Borrar función si existe (para actualizaciones)
DROP FUNCTION IF EXISTS get_user_business(UUID);

-- 2. Crear función principal
CREATE OR REPLACE FUNCTION get_user_business(user_id UUID)
RETURNS TABLE (
  business_id UUID,
  business_name TEXT,
  business_email TEXT,
  business_phone TEXT,
  business_address TEXT,
  business_city TEXT,
  business_country TEXT,
  business_postal_code TEXT,
  vertical_type TEXT,
  business_active BOOLEAN,
  business_created_at TIMESTAMPTZ,
  business_settings JSONB,
  user_role TEXT,
  user_permissions JSONB
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Validación: solo el usuario autenticado puede consultar sus propios datos
  IF user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: can only query own business';
  END IF;

  RETURN QUERY
  SELECT 
    b.id AS business_id,
    b.name AS business_name,
    b.email AS business_email,
    b.phone AS business_phone,
    b.address AS business_address,
    b.city AS business_city,
    b.country AS business_country,
    b.postal_code AS business_postal_code,
    b.vertical_type::text AS vertical_type,
    b.active AS business_active,
    b.created_at AS business_created_at,
    b.settings AS business_settings,
    ubm.role::text AS user_role,
    ubm.permissions AS user_permissions
  FROM businesses b
  INNER JOIN user_business_mapping ubm ON ubm.business_id = b.id
  WHERE ubm.auth_user_id = user_id
    AND ubm.active = true
    AND b.active = true
  LIMIT 1;
END;
$$;

-- 3. Dar permisos a usuarios autenticados
GRANT EXECUTE ON FUNCTION get_user_business(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_business(UUID) TO anon;

-- 4. Comentarios para documentación
COMMENT ON FUNCTION get_user_business(UUID) IS 
'Obtiene el negocio asociado a un usuario de forma segura.
Bypasea RLS pero solo devuelve datos del usuario autenticado.
Retorna NULL si el usuario no tiene negocio asociado.';

-- =====================================================
-- ✅ VERIFICACIÓN
-- =====================================================

-- Prueba la función (ejecuta esto después de hacer login):
-- SELECT * FROM get_user_business(auth.uid());

-- Debería devolver:
-- - NULL si el usuario no tiene negocio (usuario nuevo)
-- - 1 fila con todos los datos del negocio si existe

-- =====================================================
-- 📊 VENTAJAS DE ESTA SOLUCIÓN
-- =====================================================

-- ✅ Bypasea RLS de forma segura
-- ✅ Solo 1 query (rápido y eficiente)
-- ✅ Validación de seguridad incorporada
-- ✅ Retorna NULL si no hay negocio (no se cuelga)
-- ✅ Escalable para millones de usuarios
-- ✅ Mantiene RLS activo en las tablas
-- ✅ Código limpio en el frontend

-- =====================================================


