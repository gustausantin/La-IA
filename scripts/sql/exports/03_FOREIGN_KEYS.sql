-- =====================================================
-- PARTE 3: FOREIGN KEYS
-- Fecha: 17 de octubre de 2025
-- =====================================================

SELECT 
    tc.table_name AS tabla,
    kcu.column_name AS columna,
    ccu.table_name AS tabla_referenciada,
    ccu.column_name AS columna_referenciada,
    tc.constraint_name AS nombre_constraint

FROM information_schema.table_constraints tc

JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema

JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
    AND tc.table_schema = ccu.table_schema

WHERE 
    tc.table_schema = 'public'
    AND tc.constraint_type = 'FOREIGN KEY'

ORDER BY 
    tc.table_name,
    kcu.column_name;

