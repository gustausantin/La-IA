-- =====================================================
-- 🔗 SQL ALIAS PARA COMPATIBILIDAD
-- =====================================================
-- Este script crea vistas/alias para mantener compatibilidad
-- con código antiguo mientras migramos gradualmente
-- =====================================================

-- 1. Crear vista "restaurants" que apunta a "businesses"
CREATE OR REPLACE VIEW restaurants AS
SELECT 
  id,
  name,
  email,
  phone,
  address,
  city,
  postal_code AS "postal_code",
  vertical AS "cuisine_type", -- Mapeo temporal
  settings,
  active,
  created_at,
  updated_at
FROM businesses;

-- 2. Crear vista "user_restaurant_mapping" que apunta a "user_business_mapping"
CREATE OR REPLACE VIEW user_restaurant_mapping AS
SELECT 
  id,
  auth_user_id,
  business_id AS restaurant_id, -- Alias del campo
  role,
  permissions,
  created_at
FROM user_business_mapping;

-- 3. Hacer las vistas actualizables (para INSERT/UPDATE)
-- Vista restaurants
CREATE OR REPLACE RULE restaurants_insert AS
  ON INSERT TO restaurants DO INSTEAD
  INSERT INTO businesses (
    id, name, email, phone, address, city, postal_code, 
    vertical, settings, active
  )
  VALUES (
    NEW.id, NEW.name, NEW.email, NEW.phone, NEW.address, 
    NEW.city, NEW.postal_code, NEW.cuisine_type, NEW.settings, NEW.active
  )
  RETURNING 
    id, name, email, phone, address, city, postal_code AS "postal_code",
    vertical AS "cuisine_type", settings, active, created_at, updated_at;

CREATE OR REPLACE RULE restaurants_update AS
  ON UPDATE TO restaurants DO INSTEAD
  UPDATE businesses SET
    name = NEW.name,
    email = NEW.email,
    phone = NEW.phone,
    address = NEW.address,
    city = NEW.city,
    postal_code = NEW.postal_code,
    vertical = NEW.cuisine_type,
    settings = NEW.settings,
    active = NEW.active,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = OLD.id
  RETURNING 
    id, name, email, phone, address, city, postal_code AS "postal_code",
    vertical AS "cuisine_type", settings, active, created_at, updated_at;

-- Vista user_restaurant_mapping
CREATE OR REPLACE RULE user_restaurant_mapping_insert AS
  ON INSERT TO user_restaurant_mapping DO INSTEAD
  INSERT INTO user_business_mapping (
    auth_user_id, business_id, role, permissions
  )
  VALUES (
    NEW.auth_user_id, NEW.restaurant_id, NEW.role, NEW.permissions
  )
  RETURNING 
    id, auth_user_id, business_id AS restaurant_id, role, permissions, created_at;

CREATE OR REPLACE RULE user_restaurant_mapping_update AS
  ON UPDATE TO user_restaurant_mapping DO INSTEAD
  UPDATE user_business_mapping SET
    business_id = NEW.restaurant_id,
    role = NEW.role,
    permissions = NEW.permissions
  WHERE id = OLD.id
  RETURNING 
    id, auth_user_id, business_id AS restaurant_id, role, permissions, created_at;

-- =====================================================
-- ✅ RESULTADO
-- =====================================================
-- Ahora tu código puede usar "restaurants" y "user_restaurant_mapping"
-- y funcionará perfectamente porque son vistas que apuntan
-- a las tablas reales "businesses" y "user_business_mapping"
--
-- Esto permite migración gradual sin romper nada.
-- =====================================================

-- Verificar que las vistas se crearon
SELECT 
  table_name, 
  table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('restaurants', 'user_restaurant_mapping')
ORDER BY table_name;

