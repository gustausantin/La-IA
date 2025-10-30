-- =====================================================
-- MIGRACIÓN: Eliminar vertical "otros" completamente
-- Fecha: 30 de octubre de 2025
-- Descripción: Limpia todos los negocios con vertical_type = 'otros'
-- =====================================================

-- PASO 1: Actualizar negocios existentes con 'otros' a 'fisioterapia'
UPDATE businesses
SET 
    vertical_type = 'fisioterapia',
    updated_at = NOW()
WHERE vertical_type::text = 'otros';

-- PASO 2: Verificar si queda alguno
DO $$
DECLARE
    count_otros INTEGER;
BEGIN
    SELECT COUNT(*) INTO count_otros
    FROM businesses
    WHERE vertical_type::text = 'otros';
    
    IF count_otros > 0 THEN
        RAISE NOTICE 'Aún quedan % negocios con vertical "otros"', count_otros;
    ELSE
        RAISE NOTICE '✅ Todos los negocios con vertical "otros" han sido actualizados';
    END IF;
END $$;

-- PASO 3: Si el valor 'otros' existe en el enum, lo eliminamos
-- (Primero verificamos si existe)
DO $$
BEGIN
    -- Verificar si 'otros' existe en el enum
    IF EXISTS (
        SELECT 1 
        FROM pg_enum 
        WHERE enumlabel = 'otros' 
        AND enumtypid = 'vertical_type'::regtype
    ) THEN
        -- Eliminar el valor del enum (solo funciona si no hay datos usándolo)
        -- Como ya actualizamos todos los registros arriba, esto debería funcionar
        ALTER TYPE vertical_type RENAME TO vertical_type_old;
        
        CREATE TYPE vertical_type AS ENUM (
            'fisioterapia',
            'masajes_osteopatia',
            'clinica_dental',
            'psicologia_coaching',
            'centro_estetica',
            'peluqueria_barberia',
            'centro_unas',
            'entrenador_personal',
            'yoga_pilates',
            'veterinario'
        );
        
        -- Actualizar la columna para usar el nuevo tipo
        ALTER TABLE businesses 
            ALTER COLUMN vertical_type TYPE vertical_type 
            USING vertical_type::text::vertical_type;
        
        -- Eliminar el tipo viejo
        DROP TYPE vertical_type_old;
        
        RAISE NOTICE '✅ Enum vertical_type recreado sin "otros"';
    ELSE
        RAISE NOTICE 'ℹ️ El valor "otros" no existe en el enum vertical_type';
    END IF;
END $$;

-- PASO 4: Verificación final
SELECT 
    enumlabel as "Valores válidos de vertical_type"
FROM pg_enum
WHERE enumtypid = 'vertical_type'::regtype
ORDER BY enumsortorder;

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================

