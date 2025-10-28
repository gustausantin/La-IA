-- ===================================
-- CREAR NEGOCIO MANUALMENTE
-- ===================================
-- Ejecuta esto en Supabase SQL Editor

-- 1. Obtener tu user ID
-- Tu user ID es: 47fec4e9-426d-4984-b9c6-549a897ac327

-- 2. Crear negocio
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
    "schedule": {
      "monday": {"open": "09:00", "close": "20:00", "closed": false},
      "tuesday": {"open": "09:00", "close": "20:00", "closed": false},
      "wednesday": {"open": "09:00", "close": "20:00", "closed": false},
      "thursday": {"open": "09:00", "close": "20:00", "closed": false},
      "friday": {"open": "09:00", "close": "20:00", "closed": false},
      "saturday": {"open": "10:00", "close": "14:00", "closed": false},
      "sunday": {"open": "00:00", "close": "00:00", "closed": true}
    }
  }'
) RETURNING id;

-- ✅ COPIA EL ID QUE TE DEVUELVA (ej: 12345678-1234-1234-1234-123456789012)

-- 3. Crear mapping (REEMPLAZA 'TU_BUSINESS_ID' con el ID del paso anterior)
INSERT INTO user_business_mapping (
  auth_user_id,
  business_id,
  role,
  active
) VALUES (
  '47fec4e9-426d-4984-b9c6-549a897ac327',
  'TU_BUSINESS_ID', -- ⚠️ REEMPLAZA ESTO
  'owner',
  true
);

-- 4. Crear servicios
INSERT INTO services (business_id, name, duration_minutes, price, active, display_order)
VALUES 
  ('TU_BUSINESS_ID', 'Corte', 60, 0, true, 1),
  ('TU_BUSINESS_ID', 'Tinte', 60, 0, true, 2),
  ('TU_BUSINESS_ID', 'Barba', 60, 0, true, 3),
  ('TU_BUSINESS_ID', 'Peinado', 60, 0, true, 4);

-- 5. Crear recursos
INSERT INTO resources (business_id, name, type, capacity, active, display_order)
VALUES 
  ('TU_BUSINESS_ID', 'Sillón 1', 'room', 1, true, 1),
  ('TU_BUSINESS_ID', 'Sillón 2', 'room', 1, true, 2),
  ('TU_BUSINESS_ID', 'Sillón 3', 'room', 1, true, 3);

-- ✅ LISTO! Ahora refresca el navegador y haz login


