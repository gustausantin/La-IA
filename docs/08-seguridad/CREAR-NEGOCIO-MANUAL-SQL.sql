-- =====================================================
-- 🔥 CREAR NEGOCIO MANUALMENTE DESDE SUPABASE
-- =====================================================
-- Este script crea el negocio directamente en Supabase
-- Bypaseando todo el frontend
-- =====================================================

-- 1. VERIFICAR QUE NO EXISTE YA
SELECT * FROM user_business_mapping 
WHERE auth_user_id = 'e973b789-907e-4a65-8b78-2432aa8ff039';

-- Si devuelve algo, BÓRRALO:
DELETE FROM user_business_mapping 
WHERE auth_user_id = 'e973b789-907e-4a65-8b78-2432aa8ff039';

-- 2. CREAR EL NEGOCIO
INSERT INTO businesses (
  name,
  vertical_type,
  phone,
  email,
  address,
  city,
  postal_code,
  active,
  settings
) VALUES (
  'Vaya Pelos',
  'peluqueria_barberia',
  '+34671126148',
  'gustausantin@icloud.com',
  'Felip II, 55',
  'Barcelona',
  '08027',
  true,
  '{
    "operating_hours": {
      "monday": {"open": "09:00", "close": "20:00", "closed": false},
      "tuesday": {"open": "09:00", "close": "20:00", "closed": false},
      "wednesday": {"open": "09:00", "close": "20:00", "closed": false},
      "thursday": {"open": "09:00", "close": "20:00", "closed": false},
      "friday": {"open": "09:00", "close": "20:00", "closed": false},
      "saturday": {"open": "10:00", "close": "14:00", "closed": false},
      "sunday": {"open": "00:00", "close": "00:00", "closed": true}
    }
  }'::jsonb
)
RETURNING id;

-- 3. COPIAR EL ID QUE DEVUELVE Y USARLO AQUÍ:
-- Reemplaza 'PEGA_EL_ID_AQUI' con el UUID que devolvió el INSERT anterior

INSERT INTO user_business_mapping (
  auth_user_id,
  business_id,
  role,
  active
) VALUES (
  'e973b789-907e-4a65-8b78-2432aa8ff039',
  'PEGA_EL_ID_AQUI',  -- ⬅️ REEMPLAZA ESTO
  'owner',
  true
);

-- 4. CREAR SERVICIOS PREDEFINIDOS
-- Reemplaza 'PEGA_EL_ID_AQUI' con el UUID del negocio

INSERT INTO services (business_id, name, duration_minutes, price, active, display_order) VALUES
  ('PEGA_EL_ID_AQUI', 'Corte', 60, 0, true, 1),
  ('PEGA_EL_ID_AQUI', 'Tinte', 60, 0, true, 2),
  ('PEGA_EL_ID_AQUI', 'Peinado', 60, 0, true, 3),
  ('PEGA_EL_ID_AQUI', 'Barba', 60, 0, true, 4);

-- 5. CREAR RECURSOS PREDEFINIDOS
-- Reemplaza 'PEGA_EL_ID_AQUI' con el UUID del negocio

INSERT INTO resources (business_id, name, type, capacity, active, display_order) VALUES
  ('PEGA_EL_ID_AQUI', 'Sillón 1', 'room', 1, true, 1),
  ('PEGA_EL_ID_AQUI', 'Sillón 2', 'room', 1, true, 2),
  ('PEGA_EL_ID_AQUI', 'Sillón 3', 'room', 1, true, 3);

-- =====================================================
-- ✅ VERIFICACIÓN FINAL
-- =====================================================

-- Ver negocio creado
SELECT * FROM businesses WHERE name = 'Vaya Pelos';

-- Ver mapping
SELECT * FROM user_business_mapping 
WHERE auth_user_id = 'e973b789-907e-4a65-8b78-2432aa8ff039';

-- Ver servicios
SELECT * FROM services WHERE business_id = 'PEGA_EL_ID_AQUI';

-- Ver recursos
SELECT * FROM resources WHERE business_id = 'PEGA_EL_ID_AQUI';


