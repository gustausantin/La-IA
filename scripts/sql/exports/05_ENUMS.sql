-- =====================================================
-- PARTE 5: ENUMS (Tipos personalizados)
-- Fecha: 17 de octubre de 2025
-- =====================================================

SELECT 
    t.typname AS enum_name,
    STRING_AGG(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS valores_posibles

FROM pg_type t

JOIN pg_enum e 
    ON t.oid = e.enumtypid

JOIN pg_catalog.pg_namespace n 
    ON n.oid = t.typnamespace

WHERE 
    n.nspname = 'public'

GROUP BY 
    t.typname

ORDER BY 
    t.typname;

