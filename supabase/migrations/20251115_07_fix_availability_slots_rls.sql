-- =====================================================
-- MIGRACIÓN: FIX RLS PARA availability_slots
-- Fecha: 2025-11-15
-- Objetivo: Asegurar que los usuarios puedan leer los slots
--           de disponibilidad de sus negocios
-- =====================================================

-- Verificar si RLS está habilitado
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE tablename = 'availability_slots' 
        AND schemaname = 'public'
    ) THEN
        RAISE NOTICE '⚠️ Tabla availability_slots no existe';
        RETURN;
    END IF;
END $$;

-- Habilitar RLS si no está habilitado
ALTER TABLE availability_slots ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas antiguas si existen
DROP POLICY IF EXISTS "Users can view availability slots of their business" ON availability_slots;
DROP POLICY IF EXISTS "Users can manage availability slots of their business" ON availability_slots;
DROP POLICY IF EXISTS "Users can view slots" ON availability_slots;
DROP POLICY IF EXISTS "Users can manage slots" ON availability_slots;

-- ✅ POLÍTICA PARA SELECT (leer slots)
CREATE POLICY "Users can view availability slots of their business"
ON availability_slots
FOR SELECT
TO authenticated
USING (
    business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
);

-- ✅ POLÍTICA PARA INSERT (crear slots - normalmente desde funciones)
CREATE POLICY "Users can insert availability slots"
ON availability_slots
FOR INSERT
TO authenticated
WITH CHECK (
    business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
);

-- ✅ POLÍTICA PARA UPDATE (actualizar slots)
CREATE POLICY "Users can update availability slots"
ON availability_slots
FOR UPDATE
TO authenticated
USING (
    business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
)
WITH CHECK (
    business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
);

-- ✅ POLÍTICA PARA DELETE (eliminar slots)
CREATE POLICY "Users can delete availability slots"
ON availability_slots
FOR DELETE
TO authenticated
USING (
    business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
);

-- Verificar que las políticas se crearon correctamente
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE tablename = 'availability_slots';
    
    RAISE NOTICE '✅ Políticas RLS creadas para availability_slots: %', policy_count;
    
    IF policy_count = 0 THEN
        RAISE WARNING '⚠️ No se crearon políticas. Verifica que la tabla existe.';
    END IF;
END $$;

SELECT 'Migración 20251115_07_fix_availability_slots_rls completada' AS status;


