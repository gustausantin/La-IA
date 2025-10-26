-- =====================================================
-- PARTE 2: PRIMARY KEYS
-- Fecha: 17 de octubre de 2025
-- =====================================================

SELECT 
    tc.table_name AS tabla,
    STRING_AGG(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS columnas_pk

FROM information_schema.table_constraints tc

JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema

WHERE 
    tc.table_schema = 'public'
    AND tc.constraint_type = 'PRIMARY KEY'

GROUP BY 
    tc.table_name

ORDER BY 
    tc.table_name;

