-- =====================================================
-- MIGRACIÓN: Garantizar solo UNA plantilla activa por tipo/restaurante
-- Fecha: 2025-10-12
-- Descripción: Añade constraint único para evitar múltiples plantillas activas del mismo tipo
-- =====================================================

-- 1. Primero, desactivar todas las plantillas duplicadas (dejar solo la más reciente activa)
WITH ranked_templates AS (
  SELECT 
    id,
    restaurant_id,
    name,
    is_active,
    ROW_NUMBER() OVER (
      PARTITION BY restaurant_id, name, is_active 
      ORDER BY created_at DESC
    ) as rn
  FROM message_templates
  WHERE is_active = true
)
UPDATE message_templates mt
SET is_active = false
FROM ranked_templates rt
WHERE mt.id = rt.id 
  AND rt.rn > 1
  AND rt.is_active = true;

-- 2. Crear índice único: solo UNA plantilla activa por (restaurant_id, name)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_template_per_restaurant_and_type
ON message_templates (restaurant_id, name)
WHERE is_active = true;

-- 3. Comentario para documentación
COMMENT ON INDEX idx_unique_active_template_per_restaurant_and_type IS 
'Garantiza que solo UNA plantilla del mismo tipo/nombre esté activa por restaurante';

-- 4. Función para cambiar plantilla activa de forma segura
CREATE OR REPLACE FUNCTION set_active_template(
  p_template_id UUID,
  p_restaurant_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_template_name TEXT;
BEGIN
  -- Obtener el nombre de la plantilla
  SELECT name INTO v_template_name
  FROM message_templates
  WHERE id = p_template_id AND restaurant_id = p_restaurant_id;
  
  IF v_template_name IS NULL THEN
    RAISE EXCEPTION 'Plantilla no encontrada';
  END IF;
  
  -- Desactivar todas las del mismo tipo
  UPDATE message_templates
  SET is_active = false, updated_at = NOW()
  WHERE restaurant_id = p_restaurant_id
    AND name = v_template_name
    AND is_active = true;
  
  -- Activar la seleccionada
  UPDATE message_templates
  SET is_active = true, updated_at = NOW()
  WHERE id = p_template_id;
  
  RAISE NOTICE 'Plantilla % activada para restaurante %', v_template_name, p_restaurant_id;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION set_active_template TO authenticated;
GRANT EXECUTE ON FUNCTION set_active_template TO service_role;

-- =====================================================
-- EJEMPLO DE USO:
-- =====================================================
-- Para activar una plantilla específica:
/*
SELECT set_active_template(
  'template-uuid-here'::UUID,
  'restaurant-uuid-here'::UUID
);
*/

-- Para verificar que solo hay una activa por tipo:
/*
SELECT 
  restaurant_id,
  name,
  COUNT(*) FILTER (WHERE is_active = true) as active_count,
  COUNT(*) as total_count
FROM message_templates
GROUP BY restaurant_id, name
HAVING COUNT(*) FILTER (WHERE is_active = true) > 1;
*/

