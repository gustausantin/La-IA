-- Crear RPC para insertar reservas con validación de conflictos de mesa
CREATE OR REPLACE FUNCTION create_reservation_validated(
  p_restaurant_id UUID,
  p_payload JSONB,
  p_slot_minutes INTEGER DEFAULT 90
)
RETURNS JSONB
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  v_date DATE;
  v_time TIME;
  v_party_size INTEGER;
  v_table_id UUID;
  v_status TEXT;
  v_customer_name TEXT;
  v_customer_email TEXT;
  v_customer_phone TEXT;
  v_channel TEXT;
  v_source TEXT;
  v_special_requests TEXT;
  v_notes TEXT;
  v_from TIME;
  v_to TIME;
  v_conflict RECORD;
  v_inserted reservations%ROWTYPE;
BEGIN
  -- Extraer campos mínimos
  v_date := (p_payload->>'reservation_date')::DATE;
  v_time := (p_payload->>'reservation_time')::TIME;
  v_party_size := COALESCE((p_payload->>'party_size')::INT, 1);
  v_table_id := NULLIF(p_payload->>'table_id','')::UUID;
  v_status := COALESCE(NULLIF(p_payload->>'status',''), 'pending');
  v_customer_name := p_payload->>'customer_name';
  v_customer_email := p_payload->>'customer_email';
  v_customer_phone := p_payload->>'customer_phone';
  v_channel := COALESCE(NULLIF(p_payload->>'channel',''), 'manual');
  v_source := COALESCE(NULLIF(p_payload->>'source',''), 'manual');
  v_special_requests := p_payload->>'special_requests';
  v_notes := p_payload->>'notes';

  IF v_date IS NULL OR v_time IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'reservation_date y reservation_time son obligatorios');
  END IF;

  -- Validación de conflictos solo si hay mesa asignada
  IF v_table_id IS NOT NULL THEN
    v_from := (v_time - make_interval(mins => p_slot_minutes));
    v_to := (v_time + make_interval(mins => p_slot_minutes));

    SELECT r.* INTO v_conflict
    FROM reservations r
    WHERE r.restaurant_id = p_restaurant_id
      AND r.table_id = v_table_id
      AND r.reservation_date = v_date
      AND r.status IN ('pending','confirmed','seated')
      AND r.reservation_time BETWEEN v_from AND v_to
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Conflicto: la mesa ya está reservada en ese horario',
        'conflict', jsonb_build_object('id', v_conflict.id, 'time', v_conflict.reservation_time)
      );
    END IF;
  END IF;

  -- Insertar
  INSERT INTO reservations (
    id, restaurant_id, customer_id, customer_name, customer_email, customer_phone,
    reservation_date, reservation_time, party_size, table_id, table_number, status,
    special_requests, source, channel, notes, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), p_restaurant_id, NULL, v_customer_name, v_customer_email, v_customer_phone,
    v_date, v_time, v_party_size, v_table_id, NULL, v_status,
    v_special_requests, v_source, v_channel, v_notes, NOW(), NOW()
  ) RETURNING * INTO v_inserted;

  RETURN jsonb_build_object('success', true, 'reservation', to_jsonb(v_inserted));
END;
$$;


