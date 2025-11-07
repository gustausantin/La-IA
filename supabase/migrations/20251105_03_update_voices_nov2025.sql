-- ============================================================================
-- MIGRACIÓN: ACTUALIZAR VOCES NOVIEMBRE 2025
-- Fecha: 2025-11-05
-- Descripción: Crear/actualizar voice_catalog con las nuevas voces
-- ============================================================================

-- 1. CREAR TABLA voice_catalog SI NO EXISTE
CREATE TABLE IF NOT EXISTS voice_catalog (
  id SERIAL PRIMARY KEY,
  frontend_id VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  elevenlabs_voice_id VARCHAR(100) NOT NULL,
  gender VARCHAR(20) NOT NULL CHECK (gender IN ('female', 'male')),
  description TEXT,
  audio_demo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. LIMPIAR registros existentes
TRUNCATE TABLE voice_catalog CASCADE;

-- 3. INSERTAR LAS NUEVAS 4 VOCES
INSERT INTO voice_catalog (
  frontend_id,
  display_name,
  elevenlabs_voice_id,
  gender,
  description,
  audio_demo_url
) VALUES
  -- Female 1: Eva Dorado
  (
    'Female_1_Eva_Dorado_RgXx32WYOGrd7gFNifSf',
    'Femenina 1 - Eva',
    'RgXx32WYOGrd7gFNifSf',
    'female',
    'Voz cálida y profesional',
    'https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/voice-demos/Female_1_Eva_Dorado_RgXx32WYOGrd7gFNifSf.mp3.mp3'
  ),
  -- Female 2: Susi
  (
    'Female_2_Susi_v3V1d2rk6528UrLKRuy8',
    'Femenina 2 - Susi',
    'v3V1d2rk6528UrLKRuy8',
    'female',
    'Voz joven y dinámica',
    'https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/voice-demos/Female_2_Susi_v3V1d2rk6528UrLKRuy8.mp3.mp3'
  ),
  -- Male 1: Viraj
  (
    'Male_1_Viraj_iWNf11sz1GrUE4ppxTOL',
    'Masculina 1 - Viraj',
    'iWNf11sz1GrUE4ppxTOL',
    'male',
    'Voz profesional y clara',
    'https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/voice-demos/Male_1_Viraj_iWNf11sz1GrUE4ppxTOL.mp3.mp3'
  ),
  -- Male 2: Danny
  (
    'Male_2_Danny_wnKyx1zkUEUnfURKiuaP',
    'Masculina 2 - Danny',
    'wnKyx1zkUEUnfURKiuaP',
    'male',
    'Voz energética y cercana',
    'https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/voice-demos/Male_2_Danny_wnKyx1zkUEUnfURKiuaP.mp3.mp3'
  );

-- 4. ACTUALIZAR get_elevenlabs_voice_id() para el nuevo mapeo
CREATE OR REPLACE FUNCTION get_elevenlabs_voice_id(frontend_voice_id TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE frontend_voice_id
    -- Nuevas voces Nov 2025
    WHEN 'Female_1_Eva_Dorado_RgXx32WYOGrd7gFNifSf' THEN 'RgXx32WYOGrd7gFNifSf'
    WHEN 'Female_2_Susi_v3V1d2rk6528UrLKRuy8' THEN 'v3V1d2rk6528UrLKRuy8'
    WHEN 'Male_1_Viraj_iWNf11sz1GrUE4ppxTOL' THEN 'iWNf11sz1GrUE4ppxTOL'
    WHEN 'Male_2_Danny_wnKyx1zkUEUnfURKiuaP' THEN 'wnKyx1zkUEUnfURKiuaP'
    
    -- Voces antiguas (por si hay datos legacy)
    WHEN 'Female 1 Susi.mp3' THEN 'EXAVITQu4vr4xnSDxMaL'
    WHEN 'Female 2 Eva.mp3' THEN 'ThT5KcBeYPX3keUQqHPh'
    WHEN 'Male 1 Mark.mp3' THEN 'TX3LPaxmHKxFdv7VOQHJ'
    WHEN 'Male 2 Viraj.mp3' THEN 'pNInz6obpgDQGcFmaJgB'
    
    -- Si ya es un ID válido de ElevenLabs, devolverlo tal cual
    ELSE frontend_voice_id
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 5. COMENTARIO: NO actualizar live_demo_config automáticamente
-- El usuario debe elegir la voz de nuevo en el onboarding
-- Si quieres resetear la demo actual:
-- UPDATE live_demo_config SET assistant_voice_id = 'Female_1_Eva_Dorado_RgXx32WYOGrd7gFNifSf' WHERE id = 1;

-- ============================================================================
-- FIN DE LA MIGRACIÓN
-- ============================================================================

