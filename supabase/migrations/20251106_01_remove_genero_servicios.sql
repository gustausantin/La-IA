-- ============================================================================
-- MIGRACIÓN: ELIMINAR GÉNERO DE NOMBRES DE SERVICIOS
-- Fecha: 2025-11-06
-- Descripción: Actualizar nombres de servicios que contengan (Hombre) o (Mujer)
-- ============================================================================

-- Actualizar servicios en service_templates
UPDATE service_templates
SET 
  name = 'Corte y Peinado',
  description = 'Corte de pelo con peinado'
WHERE vertical_type = 'peluqueria_barberia' 
  AND name IN ('Corte Mujer', 'Corte de pelo femenino');

UPDATE service_templates
SET 
  name = 'Corte + Barba',
  description = 'Corte de pelo con arreglo de barba'
WHERE vertical_type = 'peluqueria_barberia' 
  AND name IN ('Corte Hombre', 'Corte de pelo masculino');

-- Actualizar servicios ya creados en businesses
UPDATE services
SET name = 'Corte y Peinado'
WHERE name LIKE '%Mujer%' 
  AND business_id IN (
    SELECT id FROM businesses WHERE vertical_type = 'peluqueria_barberia'
  );

UPDATE services
SET name = 'Corte + Barba'
WHERE name LIKE '%Hombre%' 
  AND business_id IN (
    SELECT id FROM businesses WHERE vertical_type = 'peluqueria_barberia'
  );

-- ============================================================================
-- FIN DE LA MIGRACIÓN
-- ============================================================================




