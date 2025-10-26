-- =====================================================
-- SCRIPT: EXPORTAR ESTRUCTURA COMPLETA DE SUPABASE
-- Fecha: 17 de octubre de 2025
-- Descripción: Genera documentación COMPLETA del schema
-- =====================================================
-- 
-- INSTRUCCIONES:
-- 1. Copia este script completo
-- 2. Pégalo en Supabase SQL Editor
-- 3. Ejecuta
-- 4. Descarga los resultados como CSV o JSON
--
-- =====================================================

-- =====================================================
-- PARTE 1: TODAS LAS TABLAS CON SUS COLUMNAS
-- =====================================================

SELECT 
    t.table_schema AS esquema,
    t.table_name AS tabla,
    c.column_name AS columna,
    c.ordinal_position AS posicion,
    c.data_type AS tipo_dato,
    c.character_maximum_length AS longitud_maxima,
    c.is_nullable AS permite_null,
    c.column_default AS valor_default,
    
    -- Detectar si es PRIMARY KEY
    CASE 
        WHEN pk.column_name IS NOT NULL THEN 'PRIMARY KEY'
        ELSE ''
    END AS es_primary_key,
    
    -- Detectar si es FOREIGN KEY
    CASE 
        WHEN fk.column_name IS NOT NULL THEN 
            'FK → ' || fk.foreign_table_name || '(' || fk.foreign_column_name || ')'
        ELSE ''
    END AS foreign_key,
    
    -- Detectar si tiene UNIQUE constraint
    CASE 
        WHEN uq.column_name IS NOT NULL THEN 'UNIQUE'
        ELSE ''
    END AS es_unique,
    
    -- Detectar si tiene CHECK constraint
    COALESCE(chk.check_clause, '') AS check_constraint,
    
    -- Detectar si tiene INDEX
    CASE 
        WHEN idx.column_name IS NOT NULL THEN 'INDEX: ' || idx.index_name
        ELSE ''
    END AS indices

FROM information_schema.tables t

-- JOIN con columnas
INNER JOIN information_schema.columns c 
    ON t.table_schema = c.table_schema 
    AND t.table_name = c.table_name

-- LEFT JOIN para detectar PRIMARY KEYS
LEFT JOIN (
    SELECT 
        kcu.table_schema,
        kcu.table_name,
        kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY'
) pk ON c.table_schema = pk.table_schema 
    AND c.table_name = pk.table_name 
    AND c.column_name = pk.column_name

-- LEFT JOIN para detectar FOREIGN KEYS
LEFT JOIN (
    SELECT 
        kcu.table_schema,
        kcu.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
        AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
) fk ON c.table_schema = fk.table_schema 
    AND c.table_name = fk.table_name 
    AND c.column_name = fk.column_name

-- LEFT JOIN para detectar UNIQUE constraints
LEFT JOIN (
    SELECT 
        kcu.table_schema,
        kcu.table_name,
        kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'UNIQUE'
) uq ON c.table_schema = uq.table_schema 
    AND c.table_name = uq.table_name 
    AND c.column_name = uq.column_name

-- LEFT JOIN para detectar CHECK constraints
LEFT JOIN (
    SELECT 
        ccu.table_schema,
        ccu.table_name,
        ccu.column_name,
        cc.check_clause
    FROM information_schema.check_constraints cc
    JOIN information_schema.constraint_column_usage ccu
        ON cc.constraint_name = ccu.constraint_name
        AND cc.constraint_schema = ccu.constraint_schema
) chk ON c.table_schema = chk.table_schema 
    AND c.table_name = chk.table_name 
    AND c.column_name = chk.column_name

-- LEFT JOIN para detectar INDEXES
LEFT JOIN (
    SELECT 
        schemaname AS table_schema,
        tablename AS table_name,
        indexname AS index_name,
        indexdef AS index_definition
    FROM pg_indexes
) idx_raw ON c.table_schema = idx_raw.table_schema 
    AND c.table_name = idx_raw.table_name

LEFT JOIN LATERAL (
    SELECT 
        idx_raw.index_name,
        idx_raw.table_name,
        c.column_name
    WHERE idx_raw.index_definition LIKE '%' || c.column_name || '%'
) idx ON TRUE

WHERE 
    t.table_schema = 'public'  -- Solo tablas públicas
    AND t.table_type = 'BASE TABLE'  -- Solo tablas (no vistas)

ORDER BY 
    t.table_name, 
    c.ordinal_position;


-- =====================================================
-- PARTE 2: INFORMACIÓN DE TABLAS (Metadata)
-- =====================================================

SELECT 
    t.table_name AS tabla,
    pg_size_pretty(pg_total_relation_size(quote_ident(t.table_schema) || '.' || quote_ident(t.table_name))) AS tamaño_total,
    (
        SELECT COUNT(*) 
        FROM information_schema.columns c 
        WHERE c.table_schema = t.table_schema 
        AND c.table_name = t.table_name
    ) AS num_columnas,
    obj_description((quote_ident(t.table_schema) || '.' || quote_ident(t.table_name))::regclass, 'pg_class') AS comentario

FROM information_schema.tables t
WHERE 
    t.table_schema = 'public' 
    AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name;


-- =====================================================
-- PARTE 3: TODOS LOS CONSTRAINTS (Restricciones)
-- =====================================================

SELECT 
    tc.table_name AS tabla,
    tc.constraint_name AS constraint,
    tc.constraint_type AS tipo,
    
    -- Columnas involucradas
    STRING_AGG(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS columnas,
    
    -- Si es FK, mostrar tabla referenciada
    CASE 
        WHEN tc.constraint_type = 'FOREIGN KEY' THEN
            (
                SELECT ccu.table_name || '(' || STRING_AGG(ccu.column_name, ', ') || ')'
                FROM information_schema.constraint_column_usage ccu
                WHERE ccu.constraint_name = tc.constraint_name
                AND ccu.constraint_schema = tc.constraint_schema
                GROUP BY ccu.table_name
            )
        ELSE ''
    END AS tabla_referenciada,
    
    -- Si es CHECK, mostrar condición
    COALESCE(cc.check_clause, '') AS check_condition

FROM information_schema.table_constraints tc

LEFT JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema

LEFT JOIN information_schema.check_constraints cc
    ON tc.constraint_name = cc.constraint_name
    AND tc.constraint_schema = cc.constraint_schema

WHERE 
    tc.table_schema = 'public'

GROUP BY 
    tc.table_name, 
    tc.constraint_name, 
    tc.constraint_type,
    tc.constraint_schema,
    cc.check_clause

ORDER BY 
    tc.table_name, 
    tc.constraint_type;


-- =====================================================
-- PARTE 4: TODOS LOS ÍNDICES
-- =====================================================

SELECT 
    schemaname AS esquema,
    tablename AS tabla,
    indexname AS indice,
    indexdef AS definicion
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;


-- =====================================================
-- PARTE 5: TODOS LOS ENUMS (Tipos personalizados)
-- =====================================================

SELECT 
    t.typname AS enum_name,
    STRING_AGG(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS valores_posibles
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
GROUP BY t.typname
ORDER BY t.typname;


-- =====================================================
-- PARTE 6: TODAS LAS FUNCIONES Y TRIGGERS
-- =====================================================

-- Funciones
SELECT 
    n.nspname AS esquema,
    p.proname AS funcion,
    pg_get_function_arguments(p.oid) AS parametros,
    pg_get_functiondef(p.oid) AS definicion
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- Triggers
SELECT 
    t.tgname AS trigger_name,
    c.relname AS tabla,
    p.proname AS funcion_trigger,
    CASE t.tgtype::int & 2
        WHEN 0 THEN 'AFTER'
        ELSE 'BEFORE'
    END AS momento,
    CASE t.tgtype::int & 28
        WHEN 4 THEN 'INSERT'
        WHEN 8 THEN 'DELETE'
        WHEN 16 THEN 'UPDATE'
        WHEN 12 THEN 'INSERT, DELETE'
        WHEN 20 THEN 'INSERT, UPDATE'
        WHEN 24 THEN 'DELETE, UPDATE'
        WHEN 28 THEN 'INSERT, DELETE, UPDATE'
    END AS evento
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND NOT t.tgisinternal
ORDER BY c.relname, t.tgname;


-- =====================================================
-- PARTE 7: RLS POLICIES (Row Level Security)
-- =====================================================

SELECT 
    schemaname AS esquema,
    tablename AS tabla,
    policyname AS politica,
    permissive AS tipo,
    roles AS roles,
    cmd AS comando,
    qual AS condicion_using,
    with_check AS condicion_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;


-- =====================================================
-- FIN DEL SCRIPT
-- =====================================================
-- 
-- RESULTADO: 7 consultas diferentes
-- 1. Estructura completa de columnas con constraints
-- 2. Metadata de tablas (tamaño, num columnas)
-- 3. Todos los constraints (PK, FK, UNIQUE, CHECK)
-- 4. Todos los índices
-- 5. Todos los ENUMs personalizados
-- 6. Todas las funciones y triggers
-- 7. Todas las políticas RLS
--
-- Ejecuta cada consulta por separado y descarga los resultados.
-- =====================================================

