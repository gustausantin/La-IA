-- =====================================================
-- FIX: Normalizar nombres de recursos según vertical
-- Fecha: 2025-11-08
-- =====================================================

-- Esta migración arregla nombres inconsistentes de recursos
-- para que coincidan con el vocabulario del vertical del negocio

-- PASO 1: Actualizar recursos de peluquerías/barberías
UPDATE resources r
SET name = CONCAT('Sillón ', r.resource_number),
    updated_at = NOW()
FROM businesses b
WHERE r.business_id = b.id
  AND b.vertical_type = 'peluqueria_barberia'
  AND r.name NOT LIKE 'Sillón%';

-- PASO 2: Actualizar recursos de fisioterapias
UPDATE resources r
SET name = CONCAT('Box ', r.resource_number),
    updated_at = NOW()
FROM businesses b
WHERE r.business_id = b.id
  AND b.vertical_type = 'fisioterapia'
  AND r.name NOT LIKE 'Box%';

-- PASO 3: Actualizar recursos de masajes/osteopatía
UPDATE resources r
SET name = CONCAT('Camilla ', r.resource_number),
    updated_at = NOW()
FROM businesses b
WHERE r.business_id = b.id
  AND b.vertical_type = 'masajes_osteopatia'
  AND r.name NOT LIKE 'Camilla%';

-- PASO 4: Actualizar recursos de clínicas dentales
UPDATE resources r
SET name = CONCAT('Consultorio ', r.resource_number),
    updated_at = NOW()
FROM businesses b
WHERE r.business_id = b.id
  AND b.vertical_type = 'clinica_dental'
  AND r.name NOT LIKE 'Consultorio%';

-- PASO 5: Actualizar recursos de veterinarias
UPDATE resources r
SET name = CONCAT('Consultorio ', r.resource_number),
    updated_at = NOW()
FROM businesses b
WHERE r.business_id = b.id
  AND b.vertical_type = 'veterinario'
  AND r.name NOT LIKE 'Consultorio%';

-- PASO 6: Actualizar recursos de centros de estética
UPDATE resources r
SET name = CONCAT('Cabina ', r.resource_number),
    updated_at = NOW()
FROM businesses b
WHERE r.business_id = b.id
  AND b.vertical_type = 'centro_estetica'
  AND r.name NOT LIKE 'Cabina%';

-- PASO 7: Actualizar recursos de yoga/pilates
UPDATE resources r
SET name = CONCAT('Sala ', r.resource_number),
    updated_at = NOW()
FROM businesses b
WHERE r.business_id = b.id
  AND b.vertical_type = 'yoga_pilates'
  AND r.name NOT LIKE 'Sala%';

-- PASO 8: Actualizar recursos de centros de uñas
UPDATE resources r
SET name = CONCAT('Mesa ', r.resource_number),
    updated_at = NOW()
FROM businesses b
WHERE r.business_id = b.id
  AND b.vertical_type = 'centro_unas'
  AND r.name NOT LIKE 'Mesa%';

-- Log de resultados
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Normalizados % recursos', updated_count;
END $$;



