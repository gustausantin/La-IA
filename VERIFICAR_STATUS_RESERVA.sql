-- =====================================================
-- VERIFICAR STATUS DE LA ÚLTIMA RESERVA CREADA
-- =====================================================

-- Ver la última reserva creada por el agente
SELECT 
    id,
    customer_name,
    reservation_date,
    reservation_time,
    party_size,
    status,  -- ← ESTO ES LO CRÍTICO
    source,
    created_at,
    updated_at
FROM reservations
WHERE restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
  AND source LIKE 'agent_%'
ORDER BY created_at DESC
LIMIT 5;

-- Ver si hay alguna actualización del status después de crear
SELECT 
    id,
    customer_name,
    status,
    created_at,
    updated_at,
    (updated_at - created_at) as tiempo_hasta_actualizacion
FROM reservations
WHERE restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
  AND source LIKE 'agent_%'
  AND updated_at > created_at  -- Solo las que fueron actualizadas después de crearlas
ORDER BY created_at DESC
LIMIT 10;

