-- ============================================================
-- SOLUCIÓN PROFESIONAL: Fix de Relaciones en agent_conversations
-- ============================================================
-- Autor: Sistema La-IA
-- Fecha: 23 de noviembre de 2025
-- Propósito: Verificar y corregir las relaciones FK en agent_conversations
-- ============================================================

-- ============================================================
-- PASO 1: DIAGNÓSTICO
-- ============================================================

-- 1.1 Verificar si existe la FK a customers
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'agent_conversations'
ORDER BY tc.constraint_name;

-- Resultado esperado:
-- Si NO aparece 'customers' → La FK no existe (necesitamos crearla)
-- Si SÍ aparece 'customers' → La FK existe (problema de cache)

-- 1.2 Verificar columnas de agent_conversations
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'agent_conversations'
    AND column_name IN ('customer_id', 'customer_phone', 'customer_name', 'appointment_id')
ORDER BY ordinal_position;

-- 1.3 Verificar si hay datos en agent_conversations
SELECT 
    COUNT(*) as total_conversations,
    COUNT(customer_id) as with_customer_id,
    COUNT(customer_phone) as with_customer_phone,
    COUNT(customer_name) as with_customer_name
FROM agent_conversations;

-- ============================================================
-- PASO 2: SOLUCIÓN (ejecutar SOLO si la FK no existe)
-- ============================================================

-- 2.1 Crear FK a customers (si no existe)
DO $$
BEGIN
    -- Verificar si la constraint ya existe
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'agent_conversations_customer_id_fkey'
        AND table_name = 'agent_conversations'
    ) THEN
        -- Crear la FK
        ALTER TABLE agent_conversations
        ADD CONSTRAINT agent_conversations_customer_id_fkey
        FOREIGN KEY (customer_id)
        REFERENCES customers(id)
        ON DELETE SET NULL;
        
        RAISE NOTICE 'FK agent_conversations → customers creada exitosamente';
    ELSE
        RAISE NOTICE 'FK agent_conversations → customers ya existe';
    END IF;
END $$;

-- 2.2 Crear FK a appointments (si no existe)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'agent_conversations_appointment_id_fkey'
        AND table_name = 'agent_conversations'
    ) THEN
        ALTER TABLE agent_conversations
        ADD CONSTRAINT agent_conversations_appointment_id_fkey
        FOREIGN KEY (appointment_id)
        REFERENCES appointments(id)
        ON DELETE SET NULL;
        
        RAISE NOTICE 'FK agent_conversations → appointments creada exitosamente';
    ELSE
        RAISE NOTICE 'FK agent_conversations → appointments ya existe';
    END IF;
END $$;

-- 2.3 Crear índices para mejorar performance de JOINs
CREATE INDEX IF NOT EXISTS idx_agent_conversations_customer_id 
ON agent_conversations(customer_id) 
WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_conversations_appointment_id 
ON agent_conversations(appointment_id) 
WHERE appointment_id IS NOT NULL;

-- ============================================================
-- PASO 3: REFRESCAR CACHE DE SUPABASE
-- ============================================================

-- 3.1 Notificar a PostgREST para que recargue el schema
NOTIFY pgrst, 'reload schema';

-- 3.2 Si usas Supabase Studio, también puedes hacer:
-- Settings → API → "Reload Schema Cache"

-- ============================================================
-- PASO 4: VERIFICACIÓN FINAL
-- ============================================================

-- 4.1 Test: Verificar que el JOIN funciona
SELECT 
    ac.id,
    ac.customer_name,
    ac.customer_phone,
    c.name as customer_from_table,
    c.email as customer_email,
    a.appointment_date
FROM agent_conversations ac
LEFT JOIN customers c ON ac.customer_id = c.id
LEFT JOIN appointments a ON ac.appointment_id = a.id
LIMIT 5;

-- Si este query funciona → Las FKs están correctas

-- ============================================================
-- PASO 5: TEST EN POSTMAN/CURL (para verificar PostgREST)
-- ============================================================

/*
Test 1: Query básica (debería funcionar siempre)
GET /rest/v1/agent_conversations?select=*

Test 2: Query con JOIN a customers (debería funcionar después del fix)
GET /rest/v1/agent_conversations?select=*,customers(id,name,email,phone)

Test 3: Query con JOIN a appointments (debería funcionar después del fix)
GET /rest/v1/agent_conversations?select=*,appointments(id,appointment_date,appointment_time)

Test 4: Query con ambos JOINs
GET /rest/v1/agent_conversations?select=*,customers(id,name,email),appointments(id,appointment_date)
*/

-- ============================================================
-- NOTAS IMPORTANTES
-- ============================================================

/*
🔴 PROBLEMA ORIGINAL:
- PostgREST no encontraba la relación entre agent_conversations y customers
- Error: "Could not find a relationship between 'agent_conversations' and 'customers'"

✅ CAUSA RAÍZ:
1. La FK puede no estar creada en la base de datos (migración faltante)
2. O el cache de PostgREST está desactualizado

✅ SOLUCIÓN ROBUSTA:
1. Verificar si la FK existe
2. Crearla si no existe (con índices)
3. Refrescar cache de PostgREST
4. Actualizar el frontend para usar JOINs cuando sea necesario

📊 DISEÑO ARQUITECTÓNICO:
- agent_conversations.customer_id → customers.id (NULLABLE)
  * NULL cuando el cliente no está registrado aún
  * NOT NULL cuando ya existe en la tabla customers
  
- agent_conversations.customer_phone → SIEMPRE tiene valor
  * Es la clave para buscar/crear clientes
  
- agent_conversations.appointment_id → appointments.id (NULLABLE)
  * NULL cuando la conversación no generó una cita
  * NOT NULL cuando sí generó/modificó una cita

🎯 ESTRATEGIA DE DATOS:
1. Cuando llega una conversación de Vapi/N8N:
   - Buscar si existe customer con ese phone
   - Si existe → guardar customer_id
   - Si no existe → customer_id = NULL (crear después)
   
2. Beneficios del JOIN:
   - Acceso a datos completos del cliente (notes, segment, etc.)
   - Evitar duplicación de datos
   - Mantener consistencia

⚠️ MIGRACIÓN DE DATOS EXISTENTES:
Si ya tienes conversaciones con customer_id = NULL pero el cliente existe:
*/

-- Actualizar customer_id en conversaciones existentes
UPDATE agent_conversations ac
SET customer_id = c.id
FROM customers c
WHERE ac.customer_id IS NULL
    AND ac.customer_phone = c.phone;

-- Verificar cuántas se actualizaron
SELECT 
    COUNT(*) FILTER (WHERE customer_id IS NOT NULL) as with_customer_id,
    COUNT(*) FILTER (WHERE customer_id IS NULL) as without_customer_id
FROM agent_conversations;

-- ============================================================
-- ROLLBACK (si algo sale mal)
-- ============================================================

/*
-- Para eliminar las FKs (NO RECOMENDADO, solo para debugging)
ALTER TABLE agent_conversations DROP CONSTRAINT IF EXISTS agent_conversations_customer_id_fkey;
ALTER TABLE agent_conversations DROP CONSTRAINT IF EXISTS agent_conversations_appointment_id_fkey;

-- Para eliminar los índices
DROP INDEX IF EXISTS idx_agent_conversations_customer_id;
DROP INDEX IF EXISTS idx_agent_conversations_appointment_id;
*/


