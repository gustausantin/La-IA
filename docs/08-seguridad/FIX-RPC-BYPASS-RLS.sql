-- =====================================================
-- 🔧 FIX: Hacer que la RPC bypasee RLS correctamente
-- =====================================================

-- 1. Borrar función anterior
DROP FUNCTION IF EXISTS get_user_business(UUID);

-- 2. Recrear con configuración correcta para bypassear RLS
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
DECLARE
  current_user_id UUID;
BEGIN
  -- Obtener el usuario actual
  current_user_id := auth.uid();
  
  -- Validación de seguridad
  IF user_id != current_user_id THEN
    RAISE EXCEPTION 'Unauthorized: can only query own business';
  END IF;

  -- Query SIN restricciones de RLS (SECURITY DEFINER lo permite)
  RETURN QUERY
  SELECT 
    b.id,
    b.name,
    b.email,
    b.phone,
    b.address,
    b.city,
    b.country,
    b.postal_code,
    b.vertical_type::text,
    b.active,
    b.created_at,
    b.settings,
    ubm.role::text,
    ubm.permissions
  FROM public.businesses b
  INNER JOIN public.user_business_mapping ubm ON ubm.business_id = b.id
  WHERE ubm.auth_user_id = user_id
    AND ubm.active = true
    AND b.active = true
  LIMIT 1;
END;
$$;

-- 3. Dar permisos
GRANT EXECUTE ON FUNCTION get_user_business(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_business(UUID) TO anon;

-- 4. Cambiar el owner de la función a postgres (para bypassear RLS)
ALTER FUNCTION get_user_business(UUID) OWNER TO postgres;

-- =====================================================
-- ✅ AHORA LA FUNCIÓN DEBERÍA FUNCIONAR
-- =====================================================

-- Prueba (debería devolver NULL o tus datos sin colgarse):
SELECT * FROM get_user_business(auth.uid());


