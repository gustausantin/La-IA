-- =====================================================
-- PARTE 4: ÍNDICES
-- Fecha: 17 de octubre de 2025
-- =====================================================

SELECT 
    tablename AS tabla,
    indexname AS indice,
    indexdef AS definicion

FROM pg_indexes

WHERE 
    schemaname = 'public'

ORDER BY 
    tablename, 
    indexname;

