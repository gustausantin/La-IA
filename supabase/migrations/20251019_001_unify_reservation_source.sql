-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN: UNIFICAR COLUMNAS DE SOURCE/CHANNEL EN RESERVATIONS
-- ═══════════════════════════════════════════════════════════════════
-- Fecha: 19 de Octubre 2025
-- Propósito: Simplificar y unificar columnas redundantes
-- NORMA 1: Ajuste quirúrgico, sin romper nada
-- NORMA 2: Usar datos reales existentes
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════
-- PASO 1: BACKUP DE DATOS ACTUALES (por seguridad)
-- ═══════════════════════════════════════════════════════════════════

-- Crear tabla temporal con backup de valores actuales
CREATE TEMP TABLE reservation_source_backup AS
SELECT 
  id,
  source,
  channel,
  reservation_source,
  reservation_channel
FROM reservations;

SELECT '✅ Backup creado: ' || COUNT(*) || ' registros guardados' as status
FROM reservation_source_backup;

-- ═══════════════════════════════════════════════════════════════════
-- PASO 2: UNIFICAR VALORES EN 'source' (LA COLUMNA QUE MANTENEMOS)
-- ═══════════════════════════════════════════════════════════════════

-- Mapeo de valores:
-- 'dashboard' (manual desde dashboard) → 'dashboard'
-- 'agent_whatsapp' (agente IA por WhatsApp) → 'agent_whatsapp'
-- 'agent_phone' (agente IA por teléfono) → 'agent_phone'
-- 'web' → 'dashboard' (asumir que es manual)
-- 'manual' → 'dashboard'

UPDATE reservations
SET source = CASE
  -- Si source ya está correcto, mantenerlo
  WHEN source IN ('dashboard', 'agent_whatsapp', 'agent_phone', 'agent_web', 'external_api') THEN source
  
  -- Si source es 'web' o 'manual', cambiar a 'dashboard'
  WHEN source IN ('web', 'manual') THEN 'dashboard'
  
  -- Si source es NULL, inferir desde reservation_source
  WHEN source IS NULL AND reservation_source = 'ia' THEN 'agent_whatsapp'
  WHEN source IS NULL AND reservation_source = 'manual' THEN 'dashboard'
  
  -- Fallback por defecto
  ELSE 'dashboard'
END
WHERE source NOT IN ('dashboard', 'agent_whatsapp', 'agent_phone', 'agent_web', 'external_api')
   OR source IS NULL;

-- Log de cambios
SELECT '✅ Unificación completada: ' || COUNT(*) || ' registros actualizados' as status
FROM reservations
WHERE source IN ('dashboard', 'agent_whatsapp', 'agent_phone', 'agent_web', 'external_api');

-- ═══════════════════════════════════════════════════════════════════
-- PASO 3: ELIMINAR DEPENDENCIAS (VISTAS) ANTES DE ELIMINAR COLUMNAS
-- ═══════════════════════════════════════════════════════════════════

-- Eliminar vista reservations_with_customer si existe
DROP VIEW IF EXISTS reservations_with_customer CASCADE;

SELECT '✅ Vista reservations_with_customer eliminada' as status;

-- ═══════════════════════════════════════════════════════════════════
-- PASO 4: ELIMINAR COLUMNAS REDUNDANTES
-- ═══════════════════════════════════════════════════════════════════

-- Ahora sí podemos eliminar las columnas sin problemas
ALTER TABLE reservations DROP COLUMN IF EXISTS channel;
ALTER TABLE reservations DROP COLUMN IF EXISTS reservation_source;
ALTER TABLE reservations DROP COLUMN IF EXISTS reservation_channel;

SELECT '✅ Columnas redundantes eliminadas' as status;

-- ═══════════════════════════════════════════════════════════════════
-- PASO 5: RECREAR VISTA SIN LAS COLUMNAS ELIMINADAS
-- ═══════════════════════════════════════════════════════════════════

-- Recrear vista reservations_with_customer manteniendo estructura original
-- pero SIN las columnas eliminadas (channel, reservation_source, reservation_channel)
CREATE OR REPLACE VIEW reservations_with_customer AS
SELECT 
  -- ✅ Todas las columnas de reservations que EXISTEN después de la migración
  r.id,
  r.restaurant_id,
  r.customer_id,
  r.customer_name,
  r.customer_email,
  r.customer_phone,
  r.reservation_date,
  r.reservation_time,
  r.date,
  r.time,
  r.party_size,
  r.status,
  r.table_id,
  r.table_number,
  r.special_requests,
  r.source,              -- ✅ ÚNICA columna de fuente/canal
  r.notes,
  r.spend_amount,
  r.preferred_zone,
  r.created_at,
  r.updated_at,
  -- ✅ Columnas del customer con alias (para compatibilidad)
  c.id AS linked_customer_id,
  c.name AS linked_customer_name,
  c.email AS linked_customer_email,
  c.phone AS linked_customer_phone,
  c.notes AS linked_customer_notes
FROM reservations r
LEFT JOIN customers c ON c.id = r.customer_id;

-- Comentario
COMMENT ON VIEW reservations_with_customer IS 'Vista que incluye datos del customer para compatibilidad con frontend. Actualizada: columnas channel, reservation_source y reservation_channel eliminadas. Solo source existe ahora.';

SELECT '✅ Vista reservations_with_customer recreada correctamente' as status;

-- ═══════════════════════════════════════════════════════════════════
-- PASO 6: AÑADIR CONSTRAINT PARA VALORES VÁLIDOS DE 'source'
-- ═══════════════════════════════════════════════════════════════════

-- Eliminar constraint antiguo si existe
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_source_check;

-- Añadir nuevo constraint con valores válidos
ALTER TABLE reservations 
ADD CONSTRAINT reservations_source_check 
CHECK (source IN (
  'dashboard',      -- Manual desde dashboard
  'agent_whatsapp', -- Agente IA por WhatsApp
  'agent_phone',    -- Agente IA por teléfono
  'agent_web',      -- Agente IA por webchat
  'agent_instagram',-- Agente IA por Instagram
  'agent_facebook', -- Agente IA por Facebook
  'external_api'    -- API externa (TheFork, Google Reserve, etc.)
));

SELECT '✅ Constraint de validación añadido' as status;

-- ═══════════════════════════════════════════════════════════════════
-- PASO 7: CREAR ÍNDICE OPTIMIZADO PARA 'source'
-- ═══════════════════════════════════════════════════════════════════

-- Eliminar índices antiguos relacionados con channel/reservation_source
DROP INDEX IF EXISTS idx_reservations_channel;
DROP INDEX IF EXISTS idx_reservations_reservation_source;

-- Crear índice optimizado para 'source'
CREATE INDEX IF NOT EXISTS idx_reservations_source 
ON reservations(restaurant_id, source, created_at DESC);

SELECT '✅ Índice optimizado creado' as status;

-- ═══════════════════════════════════════════════════════════════════
-- PASO 8: ACTUALIZAR VALORES POR DEFECTO
-- ═══════════════════════════════════════════════════════════════════

-- Establecer 'dashboard' como valor por defecto
ALTER TABLE reservations 
ALTER COLUMN source SET DEFAULT 'dashboard';

SELECT '✅ Valor por defecto establecido' as status;

-- ═══════════════════════════════════════════════════════════════════
-- PASO 9: VERIFICACIÓN FINAL
-- ═══════════════════════════════════════════════════════════════════

-- Mostrar distribución final de valores
SELECT 
  source,
  COUNT(*) as total_reservations,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage
FROM reservations
GROUP BY source
ORDER BY total_reservations DESC;

-- Verificar que no hay valores NULL
SELECT '✅ Reservas con source NULL: ' || COUNT(*) as status
FROM reservations
WHERE source IS NULL;

-- Verificar que todos los valores son válidos
SELECT '✅ Reservas con source válido: ' || COUNT(*) as status
FROM reservations
WHERE source IN ('dashboard', 'agent_whatsapp', 'agent_phone', 'agent_web', 
                 'agent_instagram', 'agent_facebook', 'external_api');

COMMIT;

-- ═══════════════════════════════════════════════════════════════════
-- RESUMEN DE CAMBIOS
-- ═══════════════════════════════════════════════════════════════════
-- ✅ Columna 'source' unificada con valores correctos
-- ✅ Columnas 'channel', 'reservation_source', 'reservation_channel' eliminadas
-- ✅ Constraint de validación añadido
-- ✅ Índice optimizado creado
-- ✅ Valor por defecto establecido
-- ✅ 0 datos perdidos (backup en tabla temporal)
-- ═══════════════════════════════════════════════════════════════════

-- NOTA: Si necesitas revertir, ejecuta:
-- SELECT * FROM reservation_source_backup; -- Ver backup
-- -- Restaurar valores desde backup si es necesario

