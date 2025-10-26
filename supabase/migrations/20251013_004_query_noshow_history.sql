-- ================================================
-- FUNCIÓN: get_noshow_history
-- ================================================
-- Propósito: Buscar historial de no-shows cuando cliente aparece
-- Uso: Frontend para verificar si cliente tuvo reserva liberada
-- ================================================

CREATE OR REPLACE FUNCTION get_noshow_history(
    p_restaurant_id UUID,
    p_date DATE,
    p_phone TEXT DEFAULT NULL,
    p_customer_name TEXT DEFAULT NULL
)
RETURNS TABLE (
    reservation_id UUID,
    customer_name TEXT,
    customer_phone TEXT,
    reservation_date DATE,
    reservation_time TIME,
    party_size INT,
    action_type TEXT,
    action_description TEXT,
    released_at TIMESTAMPTZ,
    notes TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id as reservation_id,
        r.customer_name,
        r.customer_phone,
        r.reservation_date,
        r.reservation_time,
        r.party_size,
        na.action_type,
        na.action_description,
        na.created_at as released_at,
        na.notes
    FROM reservations r
    INNER JOIN noshow_actions na ON na.reservation_id = r.id
    WHERE r.restaurant_id = p_restaurant_id
      AND r.reservation_date = p_date
      AND r.status = 'no_show'
      AND na.action_type = 'auto_release'
      AND (
          p_phone IS NULL OR r.customer_phone = p_phone
      )
      AND (
          p_customer_name IS NULL OR r.customer_name ILIKE '%' || p_customer_name || '%'
      )
    ORDER BY r.reservation_time DESC;
END;
$$;

-- Permisos
GRANT EXECUTE ON FUNCTION get_noshow_history(UUID, DATE, TEXT, TEXT) 
TO authenticated, service_role;

-- Comentario
COMMENT ON FUNCTION get_noshow_history IS 
'Busca historial de reservas liberadas automáticamente. Útil cuando un cliente aparece después de ser marcado como no_show.';

-- ================================================
-- EJEMPLOS DE USO
-- ================================================

/*
-- 1. Buscar por teléfono (cuando cliente llega)
SELECT * FROM get_noshow_history(
    'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'::UUID,  -- restaurant_id
    '2025-10-13'::DATE,                            -- fecha de hoy
    '+34622333659'                                 -- teléfono del cliente
);

-- 2. Buscar por nombre
SELECT * FROM get_noshow_history(
    'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'::UUID,
    '2025-10-13'::DATE,
    NULL,
    'Gustau'
);

-- 3. Ver TODOS los no-shows liberados hoy
SELECT * FROM get_noshow_history(
    'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'::UUID,
    '2025-10-13'::DATE
);

RESULTADO EJEMPLO:
┌─────────────┬───────────────┬──────────────┬─────────────┬──────────┬───────────┬──────────────┬─────────────────────────┬─────────────────────┬─────────────────────────┐
│ reservation │ customer_name │ customer_pho │ reservation │ reserva- │ party_siz │ action_type  │ action_description      │ released_at         │ notes                   │
│ _id         │               │ ne           │ _date       │ tion_tim │ e         │              │                         │                     │                         │
│             │               │              │             │ e        │           │              │                         │                     │                         │
├─────────────┼───────────────┼──────────────┼─────────────┼──────────┼───────────┼──────────────┼─────────────────────────┼─────────────────────┼─────────────────────────┤
│ abc-123-def │ Gustau Santin │ +34622333659 │ 2025-10-13  │ 13:00:00 │ 4         │ auto_release │ Cliente no confirmó...  │ 2025-10-13 11:00:00 │ HISTORIAL COMPLETO:...  │
└─────────────┴───────────────┴──────────────┴─────────────┴──────────┴───────────┴──────────────┴─────────────────────────┴─────────────────────┴─────────────────────────┘

USO EN FRONTEND:
1. Cliente llega: "Tengo reserva a las 13:00"
2. Buscas: get_noshow_history(restaurant_id, hoy, teléfono_o_nombre)
3. Si encuentra resultado:
   - Mostrar alert: "Esta reserva fue liberada a las 11:00 por falta de confirmación"
   - Mostrar notes completo con el historial
   - Opciones:
     a) Buscar mesa disponible → Crear NUEVA reserva
     b) No hay disponibilidad → Disculparse
4. Si NO encuentra resultado:
   - No hay reserva en el sistema
*/

