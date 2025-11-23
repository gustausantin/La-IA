-- ============================================
-- MIGRACIÓN: Dashboard "Socio Virtual" - Funciones de Inteligencia
-- Fecha: 24 de Noviembre de 2025
-- Propósito: Funciones SQL para detectar escenarios críticos
-- ============================================

-- ============================================
-- FUNCIÓN 1: Detectar empleados ausentes con citas asignadas
-- ============================================

-- Eliminar TODAS las versiones existentes de la función
DO $$ 
BEGIN
    -- Eliminar todas las versiones de detect_employee_absences_with_appointments
    EXECUTE (
        SELECT string_agg('DROP FUNCTION IF EXISTS ' || oid::regprocedure || ';', ' ')
        FROM pg_proc
        WHERE proname = 'detect_employee_absences_with_appointments'
          AND pronamespace = 'public'::regnamespace
    );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Crear la función
CREATE FUNCTION detect_employee_absences_with_appointments(
  p_business_id UUID,
  p_timestamp TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  employee_id UUID,
  employee_name TEXT,
  employee_avatar_url TEXT,
  absence_type TEXT,
  absence_reason TEXT,
  affected_count INTEGER,
  affected_appointments JSONB,
  alternative_employees JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH 
  -- Empleados ausentes HOY
  absent_employees AS (
    SELECT 
      e.id,
      e.name,
      e.avatar_url,
      ea.absence_type,
      ea.reason
    FROM employees e
    JOIN employee_absences ea ON ea.employee_id = e.id
    WHERE e.business_id = p_business_id
      AND ea.business_id = p_business_id
      -- Ausencia activa hoy
      AND p_timestamp::DATE BETWEEN ea.start_date AND ea.end_date
      AND e.is_active = TRUE
  ),
  -- Citas afectadas de cada empleado ausente
  affected_apps AS (
    SELECT 
      ae.id AS emp_id,
      ae.name AS emp_name,
      ae.avatar_url AS emp_avatar,
      ae.absence_type,
      ae.reason,
      COUNT(a.id)::INTEGER AS total_affected,
      jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'customer_name', a.customer_name,
          'customer_phone', a.customer_phone,
          'time', a.appointment_time::TEXT,
          'date', a.appointment_date::TEXT,
          'service_id', a.service_id,
          'service_name', COALESCE(bs.name, 'Servicio'),
          'duration_minutes', a.duration_minutes
        ) ORDER BY a.appointment_time
      ) AS appointments_json
    FROM absent_employees ae
    JOIN appointments a ON a.employee_id = ae.id
    LEFT JOIN business_services bs ON bs.id = a.service_id
    WHERE a.business_id = p_business_id
      -- Cita es para hoy y futura
      AND a.appointment_date = p_timestamp::DATE
      AND a.appointment_time >= p_timestamp::TIME
      -- Cita no cancelada ni completada
      AND a.status NOT IN ('cancelled', 'completed', 'no_show')
    GROUP BY ae.id, ae.name, ae.avatar_url, ae.absence_type, ae.reason
  ),
  -- Empleados alternativos disponibles
  alternatives AS (
    SELECT 
      aa.emp_id,
      jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'name', e.name,
          'avatar_url', e.avatar_url,
          'assigned_resource_id', e.assigned_resource_id
        ) ORDER BY e.position_order
      ) AS alternative_emps
    FROM affected_apps aa
    CROSS JOIN employees e
    WHERE e.business_id = p_business_id
      AND e.is_active = TRUE
      AND e.id != aa.emp_id
      -- Empleado NO está ausente hoy
      AND NOT EXISTS (
        SELECT 1 FROM employee_absences ea2
        WHERE ea2.employee_id = e.id
          AND p_timestamp::DATE BETWEEN ea2.start_date AND ea2.end_date
      )
    GROUP BY aa.emp_id
  )
  SELECT 
    aa.emp_id,
    aa.emp_name,
    aa.emp_avatar,
    aa.absence_type,
    aa.reason,
    aa.total_affected,
    aa.appointments_json,
    COALESCE(alt.alternative_emps, '[]'::jsonb)
  FROM affected_apps aa
  LEFT JOIN alternatives alt ON alt.emp_id = aa.emp_id
  ORDER BY aa.total_affected DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION detect_employee_absences_with_appointments IS 
'Detecta empleados ausentes con citas asignadas y sugiere alternativas. Usado por Dashboard Socio Virtual.';

-- ============================================
-- FUNCIÓN 2: Obtener citas con alto riesgo de no-show
-- ============================================

-- Eliminar TODAS las versiones existentes de la función
DO $$ 
BEGIN
    -- Eliminar todas las versiones de get_high_risk_appointments
    EXECUTE (
        SELECT string_agg('DROP FUNCTION IF EXISTS ' || oid::regprocedure || ';', ' ')
        FROM pg_proc
        WHERE proname = 'get_high_risk_appointments'
          AND pronamespace = 'public'::regnamespace
    );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Crear la función
CREATE FUNCTION get_high_risk_appointments(
  p_business_id UUID,
  p_timestamp TIMESTAMPTZ DEFAULT NOW(),
  p_risk_threshold INTEGER DEFAULT 60
)
RETURNS TABLE (
  appointment_id UUID,
  customer_id UUID,
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  appointment_date DATE,
  appointment_time TIME,
  service_name TEXT,
  employee_name TEXT,
  risk_score INTEGER,
  risk_level TEXT,
  no_show_count INTEGER,
  days_since_last_visit INTEGER,
  last_confirmation_sent_at TIMESTAMPTZ,
  confirmed BOOLEAN,
  hours_until_appointment NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.customer_id,
    a.customer_name,
    a.customer_phone,
    a.customer_email,
    a.appointment_date,
    a.appointment_time,
    COALESCE(bs.name, 'Servicio') AS service_name,
    COALESCE(e.name, 'Sin asignar') AS employee_name,
    drs.risk_score,
    drs.risk_level,
    COALESCE(c.no_show_count, 0) AS no_show_count,
    COALESCE(
      EXTRACT(DAY FROM (p_timestamp::DATE - c.last_visit_date))::INTEGER,
      999
    ) AS days_since_last_visit,
    (
      SELECT sent_at 
      FROM customer_confirmations 
      WHERE appointment_id = a.id 
      ORDER BY sent_at DESC 
      LIMIT 1
    ) AS last_confirmation_sent_at,
    (
      SELECT confirmed 
      FROM customer_confirmations 
      WHERE appointment_id = a.id 
        AND confirmed = TRUE 
      ORDER BY sent_at DESC 
      LIMIT 1
    ) AS confirmed,
    EXTRACT(EPOCH FROM (
      (a.appointment_date + a.appointment_time) - p_timestamp
    )) / 3600 AS hours_until_appointment
  FROM appointments a
  CROSS JOIN LATERAL calculate_dynamic_risk_score(a.id) drs
  LEFT JOIN customers c ON c.id = a.customer_id
  LEFT JOIN business_services bs ON bs.id = a.service_id
  LEFT JOIN employees e ON e.id = a.employee_id
  WHERE a.business_id = p_business_id
    -- Cita es para hoy o futura
    AND (a.appointment_date > p_timestamp::DATE 
      OR (a.appointment_date = p_timestamp::DATE 
          AND a.appointment_time > p_timestamp::TIME))
    -- Riesgo alto
    AND drs.risk_score >= p_risk_threshold
    -- No cancelada ni completada
    AND a.status NOT IN ('cancelled', 'completed', 'no_show')
  ORDER BY 
    drs.risk_score DESC, 
    hours_until_appointment ASC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_high_risk_appointments IS 
'Obtiene citas con alto riesgo de no-show según score dinámico. Usado por Dashboard Socio Virtual.';

-- ============================================
-- FUNCIÓN 3: Obtener slots libres en próximas X horas
-- ============================================

-- Eliminar TODAS las versiones existentes de la función
DO $$ 
BEGIN
    -- Eliminar todas las versiones de get_upcoming_free_slots
    EXECUTE (
        SELECT string_agg('DROP FUNCTION IF EXISTS ' || oid::regprocedure || ';', ' ')
        FROM pg_proc
        WHERE proname = 'get_upcoming_free_slots'
          AND pronamespace = 'public'::regnamespace
    );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Crear la función
CREATE FUNCTION get_upcoming_free_slots(
  p_business_id UUID,
  p_timestamp TIMESTAMPTZ DEFAULT NOW(),
  p_hours_ahead INTEGER DEFAULT 2
)
RETURNS TABLE (
  slot_id UUID,
  slot_date DATE,
  start_time TIME,
  end_time TIME,
  employee_id UUID,
  employee_name TEXT,
  resource_id UUID,
  resource_name TEXT,
  minutes_until_slot INTEGER,
  potential_services JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    asl.id,
    asl.slot_date,
    asl.start_time,
    asl.end_time,
    asl.employee_id,
    COALESCE(e.name, 'Sin asignar') AS employee_name,
    asl.resource_id,
    COALESCE(r.name, 'Sin recurso') AS resource_name,
    EXTRACT(EPOCH FROM (
      (asl.slot_date + asl.start_time) - p_timestamp
    ))::INTEGER / 60 AS minutes_until_slot,
    (
      -- Servicios que podrían caber en este slot
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', bs.id,
          'name', bs.name,
          'duration_minutes', bs.duration_minutes,
          'price', bs.price
        )
      )
      FROM business_services bs
      WHERE bs.business_id = p_business_id
        AND bs.is_active = TRUE
        AND bs.duration_minutes <= asl.duration_minutes
      LIMIT 5
    ) AS potential_services
  FROM availability_slots asl
  LEFT JOIN employees e ON e.id = asl.employee_id
  LEFT JOIN resources r ON r.id = asl.resource_id
  WHERE asl.business_id = p_business_id
    AND asl.status = 'free'
    AND asl.is_available = TRUE
    -- Slot es futuro
    AND (asl.slot_date + asl.start_time) > p_timestamp
    -- Slot es en las próximas X horas
    AND (asl.slot_date + asl.start_time) <= (p_timestamp + (p_hours_ahead || ' hours')::INTERVAL)
  ORDER BY (asl.slot_date + asl.start_time) ASC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_upcoming_free_slots IS 
'Obtiene slots libres en las próximas X horas. Usado por Dashboard Socio Virtual (Escenario Hueco Muerto).';

-- ============================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- ============================================

-- Índice para búsquedas de ausencias por fecha
CREATE INDEX IF NOT EXISTS idx_employee_absences_date_range 
ON employee_absences(business_id, start_date, end_date) 
WHERE start_date IS NOT NULL AND end_date IS NOT NULL;

-- Índice para citas futuras con status
CREATE INDEX IF NOT EXISTS idx_appointments_future_status 
ON appointments(business_id, appointment_date, appointment_time, status) 
WHERE status NOT IN ('cancelled', 'completed', 'no_show');

-- Índice para availability_slots libres
CREATE INDEX IF NOT EXISTS idx_availability_slots_free 
ON availability_slots(business_id, slot_date, start_time, status) 
WHERE status = 'free' AND is_available = TRUE;

-- ============================================
-- TESTING (Comentado - descomentar para probar)
-- ============================================

/*
-- Test 1: Detectar empleados ausentes con citas
SELECT * FROM detect_employee_absences_with_appointments(
  'tu-business-id-aqui'::UUID,
  NOW()
);

-- Test 2: Obtener citas con alto riesgo de no-show
SELECT * FROM get_high_risk_appointments(
  'tu-business-id-aqui'::UUID,
  NOW(),
  60 -- threshold de 60 puntos
);

-- Test 3: Obtener slots libres en próximas 2 horas
SELECT * FROM get_upcoming_free_slots(
  'tu-business-id-aqui'::UUID,
  NOW(),
  2 -- próximas 2 horas
);
*/

-- ============================================
-- GRANTS (Permisos)
-- ============================================

-- Dar permisos a roles autenticados
GRANT EXECUTE ON FUNCTION detect_employee_absences_with_appointments TO authenticated;
GRANT EXECUTE ON FUNCTION get_high_risk_appointments TO authenticated;
GRANT EXECUTE ON FUNCTION get_upcoming_free_slots TO authenticated;

-- ============================================
-- FIN DE LA MIGRACIÓN
-- ============================================

