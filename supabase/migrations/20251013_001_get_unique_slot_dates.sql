-- ================================================
-- FUNCIÓN: get_unique_slot_dates
-- Obtiene fechas únicas de slots sin límite de 1000
-- ================================================

CREATE OR REPLACE FUNCTION get_unique_slot_dates(
    p_restaurant_id UUID,
    p_from_date DATE
)
RETURNS TABLE (
    slot_date DATE
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT a.slot_date
    FROM availability_slots a
    WHERE a.restaurant_id = p_restaurant_id
      AND a.slot_date >= p_from_date
    ORDER BY a.slot_date;
END;
$$;

-- Permisos
GRANT EXECUTE ON FUNCTION get_unique_slot_dates(UUID, DATE) TO authenticated, anon, service_role;

-- Comentario
COMMENT ON FUNCTION get_unique_slot_dates IS 'Obtiene fechas únicas de availability_slots sin límite de 1000 registros';

