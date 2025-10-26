-- ====================================
-- FIX: ELIMINAR FOREIGN KEYS DUPLICADAS
-- Fecha: 6 Octubre 2025
-- Problema: Múltiples relaciones entre reservations y customers
-- Solución: Mantener SOLO customer_id como FK principal
-- ====================================

-- 1. VERIFICAR Y ELIMINAR FOREIGN KEYS DUPLICADAS
-- Primero, listar todas las foreign keys existentes (para debug)
DO $$
DECLARE
    fk_record RECORD;
BEGIN
    RAISE NOTICE '🔍 Listando todas las foreign keys de reservations hacia customers:';
    
    FOR fk_record IN 
        SELECT 
            con.conname AS constraint_name,
            att.attname AS column_name
        FROM pg_constraint con
        JOIN pg_attribute att ON att.attnum = ANY(con.conkey) AND att.attrelid = con.conrelid
        WHERE con.conrelid = 'reservations'::regclass
          AND con.confrelid = 'customers'::regclass
          AND con.contype = 'f'
    LOOP
        RAISE NOTICE '  - FK: % (columna: %)', fk_record.constraint_name, fk_record.column_name;
    END LOOP;
END $$;

-- 2. ELIMINAR TODAS LAS FOREIGN KEYS EXISTENTES ENTRE RESERVATIONS Y CUSTOMERS
DO $$
DECLARE
    fk_record RECORD;
BEGIN
    FOR fk_record IN 
        SELECT con.conname AS constraint_name
        FROM pg_constraint con
        WHERE con.conrelid = 'reservations'::regclass
          AND con.confrelid = 'customers'::regclass
          AND con.contype = 'f'
    LOOP
        RAISE NOTICE '🗑️ Eliminando FK duplicada: %', fk_record.constraint_name;
        EXECUTE format('ALTER TABLE reservations DROP CONSTRAINT IF EXISTS %I', fk_record.constraint_name);
    END LOOP;
END $$;

-- 3. CREAR UNA ÚNICA FOREIGN KEY LIMPIA Y CLARA
ALTER TABLE reservations 
ADD CONSTRAINT reservations_customer_id_fkey 
FOREIGN KEY (customer_id) 
REFERENCES customers(id) 
ON DELETE SET NULL;

-- 4. CREAR ÍNDICE PARA MEJORAR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_reservations_customer_id ON reservations(customer_id);

-- 5. COMENTARIO PARA DOCUMENTACIÓN
COMMENT ON CONSTRAINT reservations_customer_id_fkey ON reservations IS 
'Única relación válida entre reservations y customers. Usa customer_id como FK principal.';

-- ====================================
-- MIGRACIÓN COMPLETADA ✅
-- Ahora Supabase sabrá exactamente qué relación usar
-- ====================================
