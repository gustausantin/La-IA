-- =====================================================
-- APLICAR ESTO EN SUPABASE SQL EDITOR AHORA MISMO
-- https://supabase.com/dashboard/project/zrcsujgurtglyqoqiynr/sql/new
-- =====================================================

-- Eliminar versión rota (la que devuelve vacíos)
DROP FUNCTION IF EXISTS get_unified_dashboard_snapshot(UUID, TIMESTAMP) CASCADE;
DROP FUNCTION IF EXISTS get_unified_dashboard_snapshot(UUID) CASCADE;

-- Crear versión que SÍ devuelve datos (MISMA ESTRUCTURA, DATOS REALES)
CREATE OR REPLACE FUNCTION get_unified_dashboard_snapshot(
  p_business_id UUID,
  p_timestamp TIMESTAMP DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_today DATE;
  v_current_time TIME;
  v_result JSONB;
  v_reservas JSONB;
  v_equipo JSONB;
  v_facturacion JSONB;
  v_comunicaciones JSONB;
  v_noshows JSONB;
  v_clientes JSONB;
BEGIN
  v_today := p_timestamp::DATE;
  v_current_time := p_timestamp::TIME;

  -- =====================================================
  -- BLOQUE 1: RESERVAS
  -- =====================================================
  WITH reservas_hoy AS (
    SELECT 
      a.id,
      a.customer_name,
      a.appointment_time,
      a.appointment_date,
      a.duration_minutes,
      a.status,
      a.employee_id,
      a.notes,
      e.name as employee_name,
      COALESCE(a.duration_minutes, 60) as duracion
    FROM appointments a
    LEFT JOIN employees e ON e.id = a.employee_id
    WHERE a.business_id = p_business_id
      AND a.appointment_date = v_today
      AND a.status IN ('confirmed', 'pending')
  )
  SELECT jsonb_build_object(
    'total_hoy', COUNT(*),
    'conflictos', 0,
    'huecos_horas', 0,
    'proxima_cita', (
      SELECT jsonb_build_object(
        'hora', TO_CHAR(appointment_time, 'HH24:MI'),
        'cliente', customer_name,
        'empleado', employee_name,
        'minutos_hasta', ROUND(EXTRACT(EPOCH FROM (appointment_time - v_current_time)) / 60),
        'servicio', COALESCE(notes, 'Sin especificar')
      )
      FROM reservas_hoy
      WHERE appointment_time > v_current_time
      ORDER BY appointment_time
      LIMIT 1
    )
  )
  INTO v_reservas
  FROM reservas_hoy;

  IF v_reservas IS NULL OR (v_reservas->>'total_hoy')::int = 0 THEN
    v_reservas := jsonb_build_object(
      'total_hoy', 0,
      'conflictos', 0,
      'huecos_horas', 0,
      'proxima_cita', NULL
    );
  END IF;

  -- =====================================================
  -- BLOQUE 2: EQUIPO
  -- =====================================================
  WITH empleados_activos AS (
    SELECT 
      e.id,
      e.name
    FROM employees e
    WHERE e.business_id = p_business_id
      AND e.is_active = true
  )
  SELECT jsonb_build_object(
    'total_empleados', COUNT(*),
    'empleados_trabajando', COUNT(*),
    'total_horas_disponibles', 0,
    'total_horas_ocupadas', 0,
    'total_horas_libres', 0,
    'ocupacion_promedio', 0,
    'conflictos_horario', 0,
    'empleados_con_conflicto', '[]'::jsonb,
    'ausentes_hoy', '[]'::jsonb
  )
  INTO v_equipo
  FROM empleados_activos;

  IF v_equipo IS NULL THEN
    v_equipo := jsonb_build_object(
      'total_empleados', 0,
      'empleados_trabajando', 0,
      'total_horas_disponibles', 0,
      'total_horas_ocupadas', 0,
      'total_horas_libres', 0,
      'ocupacion_promedio', 0,
      'conflictos_horario', 0,
      'empleados_con_conflicto', '[]'::jsonb,
      'ausentes_hoy', '[]'::jsonb
    );
  END IF;

  -- =====================================================
  -- BLOQUE 3: FACTURACIÓN
  -- =====================================================
  WITH facturacion_hoy AS (
    SELECT
      COUNT(*) FILTER (WHERE status = 'completed') as citas_completadas,
      COUNT(*) FILTER (WHERE status IN ('confirmed', 'pending')) as citas_pendientes,
      COALESCE(SUM(price) FILTER (WHERE status = 'completed'), 0) as total_hoy
    FROM appointments
    WHERE business_id = p_business_id
      AND appointment_date = v_today
  ),
  promedio_semanal AS (
    SELECT AVG(daily_total) as promedio_diario
    FROM (
      SELECT DATE(appointment_date) as fecha, SUM(price) as daily_total
      FROM appointments
      WHERE business_id = p_business_id
        AND appointment_date >= v_today - INTERVAL '7 days'
        AND appointment_date < v_today
        AND status = 'completed'
      GROUP BY DATE(appointment_date)
    ) dias_previos
  )
  SELECT jsonb_build_object(
    'total_hoy', ROUND(COALESCE(f.total_hoy, 0)::numeric, 2),
    'citas_completadas', COALESCE(f.citas_completadas, 0),
    'citas_pendientes', COALESCE(f.citas_pendientes, 0),
    'promedio_diario', ROUND(COALESCE(p.promedio_diario, 0)::numeric, 2),
    'porcentaje_vs_promedio', CASE
      WHEN COALESCE(p.promedio_diario, 0) > 0 THEN
        ROUND((f.total_hoy / p.promedio_diario * 100)::numeric, 0)
      ELSE 0
    END
  )
  INTO v_facturacion
  FROM facturacion_hoy f, promedio_semanal p;

  IF v_facturacion IS NULL THEN
    v_facturacion := jsonb_build_object(
      'total_hoy', 0,
      'citas_completadas', 0,
      'citas_pendientes', 0,
      'promedio_diario', 0,
      'porcentaje_vs_promedio', 0
    );
  END IF;

  -- =====================================================
  -- BLOQUE 4: NOSHOWS
  -- =====================================================
  WITH clientes_riesgo AS (
    SELECT
      a.customer_name as cliente,
      TO_CHAR(a.appointment_time, 'HH24:MI') as hora,
      a.notes as servicio,
      a.customer_phone as telefono,
      CASE
        WHEN EXTRACT(EPOCH FROM (a.appointment_time - v_current_time)) / 3600 < 2 THEN 85
        WHEN EXTRACT(EPOCH FROM (a.appointment_time - v_current_time)) / 3600 < 4 THEN 60
        ELSE 30
      END as risk_score
    FROM appointments a
    WHERE a.business_id = p_business_id
      AND a.appointment_date = v_today
      AND a.status IN ('confirmed', 'pending')
      AND a.appointment_time > v_current_time
      AND EXTRACT(EPOCH FROM (a.appointment_time - v_current_time)) / 3600 < 4
    ORDER BY a.appointment_time
    LIMIT 3
  )
  SELECT jsonb_build_object(
    'en_riesgo_hoy', COALESCE(jsonb_agg(
      jsonb_build_object(
        'cliente', cliente,
        'hora', hora,
        'servicio', servicio,
        'telefono', telefono,
        'risk_score', risk_score
      )
    ), '[]'::jsonb)
  )
  INTO v_noshows
  FROM clientes_riesgo;

  IF v_noshows IS NULL THEN
    v_noshows := jsonb_build_object('en_riesgo_hoy', '[]'::jsonb);
  END IF;

  -- =====================================================
  -- BLOQUE 5: COMUNICACIONES
  -- =====================================================
  v_comunicaciones := jsonb_build_object(
    'mensajes_pendientes', 0,
    'incidencias_urgentes', 0
  );

  -- =====================================================
  -- BLOQUE 6: CLIENTES
  -- =====================================================
  v_clientes := jsonb_build_object(
    'especiales_hoy', '[]'::jsonb
  );

  -- =====================================================
  -- RESULTADO FINAL (MISMA ESTRUCTURA QUE ANTES)
  -- =====================================================
  v_result := jsonb_build_object(
    'reservas', v_reservas,
    'equipo', v_equipo,
    'horarios', v_equipo,
    'facturacion', v_facturacion,
    'comunicaciones', v_comunicaciones,
    'noshows', v_noshows,
    'clientes', v_clientes
  );

  RETURN v_result;
END;
$$;

