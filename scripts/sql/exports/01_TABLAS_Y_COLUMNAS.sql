-- =====================================================
-- PARTE 1: TABLAS Y COLUMNAS (estructura básica)
-- Fecha: 17 de octubre de 2025
-- =====================================================

SELECT 
    t.table_name AS tabla,
    c.column_name AS columna,
    c.ordinal_position AS posicion,
    c.data_type AS tipo,
    c.character_maximum_length AS longitud,
    c.is_nullable AS null_permitido,
    c.column_default AS default_value

FROM information_schema.tables t

INNER JOIN information_schema.columns c 
    ON t.table_schema = c.table_schema 
    AND t.table_name = c.table_name

WHERE 
    t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'

ORDER BY 
    t.table_name, 
    c.ordinal_position;

