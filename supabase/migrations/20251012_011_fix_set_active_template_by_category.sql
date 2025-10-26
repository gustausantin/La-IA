-- =====================================================
-- MIGRACIÓN: Corregir set_active_template para usar category en vez de name
-- Fecha: 2025-10-12
-- Descripción: Permite activar solo 1 plantilla por CATEGORÍA (no por nombre)
-- =====================================================

-- PASO 1: Eliminar el índice anterior (basado en 'name')
DROP INDEX IF EXISTS idx_unique_active_template_per_restaurant_and_type;

-- PASO 2: LIMPIAR DUPLICADOS ANTES DE CREAR EL ÍNDICE
-- Desactivar todas las plantillas duplicadas por categoría, dejando solo la más antigua
WITH templates_to_keep AS (
  SELECT DISTINCT ON (restaurant_id, category) id
  FROM message_templates
  WHERE is_active = true
  ORDER BY restaurant_id, category, created_at ASC
)
UPDATE message_templates
SET is_active = false, updated_at = NOW()
WHERE is_active = true
AND id NOT IN (SELECT id FROM templates_to_keep);

-- PASO 3: Crear nuevo índice único (ahora SIN duplicados)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_template_per_restaurant_and_category
ON message_templates (restaurant_id, category)
WHERE is_active = true;

COMMENT ON INDEX idx_unique_active_template_per_restaurant_and_category IS 
'Garantiza que solo UNA plantilla de la misma CATEGORÍA esté activa por restaurante';

-- Actualizar función para desactivar por CATEGORÍA
CREATE OR REPLACE FUNCTION set_active_template(
  p_template_id UUID,
  p_restaurant_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_template_category TEXT;
BEGIN
  -- Obtener la CATEGORÍA de la plantilla
  SELECT category INTO v_template_category
  FROM message_templates
  WHERE id = p_template_id AND restaurant_id = p_restaurant_id;
  
  IF v_template_category IS NULL THEN
    RAISE EXCEPTION 'Plantilla no encontrada';
  END IF;
  
  -- Desactivar todas las de la MISMA CATEGORÍA
  UPDATE message_templates
  SET is_active = false, updated_at = NOW()
  WHERE restaurant_id = p_restaurant_id
    AND category = v_template_category
    AND is_active = true;
  
  -- Activar la seleccionada
  UPDATE message_templates
  SET is_active = true, updated_at = NOW()
  WHERE id = p_template_id;
  
  RAISE NOTICE 'Plantilla de categoría % activada para restaurante %', v_template_category, p_restaurant_id;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION set_active_template TO authenticated;
GRANT EXECUTE ON FUNCTION set_active_template TO service_role;

-- =====================================================
-- VERIFICACIÓN FINAL
-- =====================================================

-- Ver si quedó algún duplicado (debería ser 0 rows)
SELECT 
  restaurant_id,
  category,
  COUNT(*) FILTER (WHERE is_active = true) as active_count,
  STRING_AGG(name, ', ') FILTER (WHERE is_active = true) as active_templates
FROM message_templates
GROUP BY restaurant_id, category
HAVING COUNT(*) FILTER (WHERE is_active = true) > 1;

