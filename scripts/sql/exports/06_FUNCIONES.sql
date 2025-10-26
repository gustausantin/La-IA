-- =====================================================
-- PARTE 6: FUNCIONES SQL
-- Fecha: 17 de octubre de 2025
-- =====================================================

SELECT 
    p.proname AS funcion,
    pg_get_function_arguments(p.oid) AS parametros

FROM pg_proc p

JOIN pg_namespace n 
    ON p.pronamespace = n.oid

WHERE 
    n.nspname = 'public'

ORDER BY 
    p.proname;

