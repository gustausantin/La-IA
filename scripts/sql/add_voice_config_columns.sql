-- =====================================================
-- MIGRATION: Agregar configuración de voz para restaurantes
-- FECHA: 2025-10-23
-- PROPÓSITO: Soportar selección de voz (OpenAI TTS)
-- =====================================================

-- ✅ Agregar columnas de configuración de voz
ALTER TABLE restaurant_settings 
ADD COLUMN IF NOT EXISTS voice_provider TEXT DEFAULT 'openai',
ADD COLUMN IF NOT EXISTS voice_id TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS voice_gender TEXT DEFAULT 'female';

-- ✅ Comentarios en columnas
COMMENT ON COLUMN restaurant_settings.voice_provider IS 'Proveedor de TTS: openai, elevenlabs (futuro)';
COMMENT ON COLUMN restaurant_settings.voice_id IS 'ID de la voz específica (ej: nova, onyx, alloy). NULL = usar voice_gender';
COMMENT ON COLUMN restaurant_settings.voice_gender IS 'Género de la voz: female (nova), male (onyx)';

-- ✅ Crear constraint para voice_provider
ALTER TABLE restaurant_settings 
ADD CONSTRAINT check_voice_provider 
CHECK (voice_provider IN ('openai', 'elevenlabs'));

-- ✅ Crear constraint para voice_gender
ALTER TABLE restaurant_settings 
ADD CONSTRAINT check_voice_gender 
CHECK (voice_gender IN ('female', 'male'));

-- ✅ Índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_restaurant_settings_voice 
ON restaurant_settings(restaurant_id, voice_provider);

-- ✅ Actualizar restaurantes existentes con defaults
UPDATE restaurant_settings 
SET 
  voice_provider = 'openai',
  voice_gender = 'female'
WHERE voice_provider IS NULL OR voice_gender IS NULL;

-- =====================================================
-- EJEMPLOS DE USO:
-- =====================================================

-- 1️⃣ Configurar voz femenina (nova) para un restaurante
-- UPDATE restaurant_settings 
-- SET voice_gender = 'female', voice_id = 'nova'
-- WHERE restaurant_id = 'tu-restaurant-id';

-- 2️⃣ Configurar voz masculina (onyx) para un restaurante
-- UPDATE restaurant_settings 
-- SET voice_gender = 'male', voice_id = 'onyx'
-- WHERE restaurant_id = 'tu-restaurant-id';

-- 3️⃣ Usar voz personalizada (shimmer)
-- UPDATE restaurant_settings 
-- SET voice_id = 'shimmer'
-- WHERE restaurant_id = 'tu-restaurant-id';

-- =====================================================
-- VOCES DISPONIBLES EN OPENAI TTS-1:
-- =====================================================
-- 🟣 alloy    - Neutro/Masculino (versátil)
-- 🔴 echo     - Masculino (cálido)
-- 🟢 fable    - Neutro/Femenino (narrativo)
-- 🔵 onyx     - Masculino profundo (profesional) ✅ DEFAULT MALE
-- 🟡 nova     - Femenino joven (amigable) ✅ DEFAULT FEMALE
-- 🟠 shimmer  - Femenino suave (elegante)
-- =====================================================

-- ✅ Verificar cambios
SELECT 
  r.id,
  r.name,
  rs.voice_provider,
  rs.voice_id,
  rs.voice_gender
FROM restaurants r
LEFT JOIN restaurant_settings rs ON r.id = rs.restaurant_id
WHERE r.active = true
LIMIT 10;



