-- ============================================
-- FUNCIÓN UNIFICADA: get_unified_dashboard_snapshot
-- Propósito: Recopilar TODA la información del dashboard en UN SOLO JSON
-- ============================================

CREATE OR REPLACE FUNCTION get_unified_dashboard_snapshot(
  p_business_id UUID,
  p_timestamp TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_reservas JSONB;
  v_horarios JSONB;
  v_clientes JSONB;
  v_comunicaciones JSONB;
  v_noshows JSONB;
  v_facturacion JSONB;
BEGIN
  
  -- ============================================
  -- 1. RESERVAS
  -- ============================================
  SELECT jsonb_build_object(
    'proxima_cita', (
      SELECT jsonb_build_object(
        'cliente', a.customer_name,
        'hora', a.appointment_time::TEXT,
        'minutos_hasta', ROUND(EXTRACT(EPOCH FROM ((a.appointment_date + a.appointment_time) - p_timestamp)) / 60)::INTEGER,
        'servicio', COALESCE(bs.name, 'Servicio'),
        'empleado', COALESCE(e.name, 'Sin asignar'),
        'segmento', COALESCE(c.segment_auto, 'regular'),
        'ultima_visita', c.last_visit_at::TEXT,
        'dias_sin_venir', COALESCE(EXTRACT(DAY FROM (p_timestamp::DATE - c.last_visit_at))::INTEGER, 0),
        'notas', c.notes,
        'appointment_id', a.id,
        'customer_id', c.id
      )
      FROM appointments a
      LEFT JOIN customers c ON c.id = a.customer_id
      LEFT JOIN business_services bs ON bs.id = a.service_id
      LEFT JOIN employees e ON e.id = a.employee_id
      WHERE a.business_id = p_business_id
        AND (a.appointment_date > p_timestamp::DATE OR 
             (a.appointment_date = p_timestamp::DATE AND a.appointment_time >= p_timestamp::TIME))
        AND a.status NOT IN ('cancelled', 'completed', 'no_show')
      ORDER BY a.appointment_date, a.appointment_time ASC
      LIMIT 1
    ),
    'conflictos', (
      SELECT COUNT(*)::INTEGER
      FROM appointments a1
      JOIN appointments a2 
        ON a1.employee_id = a2.employee_id
        AND a1.id < a2.id
        AND a1.appointment_date = a2.appointment_date
        AND (
          a2.appointment_time < (a1.appointment_time + (a1.duration_minutes || ' minutes')::INTERVAL)
          AND
          (a2.appointment_time + (a2.duration_minutes || ' minutes')::INTERVAL) > a1.appointment_time
        )
      WHERE a1.business_id = p_business_id
        AND a1.appointment_date = p_timestamp::DATE
        AND a1.status NOT IN ('cancelled', 'completed')
        AND a2.status NOT IN ('cancelled', 'completed')
    ),
    'huecos_salvables', (
      SELECT COUNT(*)::INTEGER
      FROM get_upcoming_free_slots(p_business_id, p_timestamp, 2)
    )
  ) INTO v_reservas;

  -- ============================================
  -- 2. HORARIOS (Ausencias del equipo)
  -- ============================================
  SELECT jsonb_build_object(
    'ausentes_hoy', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'empleado_id', employee_id,
          'empleado', employee_name,
          'avatar', employee_avatar_url,
          'tipo_ausencia', absence_type,
          'razon', absence_reason,
          'citas_afectadas', affected_count,
          'citas_detalle', affected_appointments,
          'alternativas', alternative_employees
        )
      )
      FROM detect_employee_absences_with_appointments(p_business_id, p_timestamp)
    ), '[]'::jsonb)
  ) INTO v_horarios;

  -- ============================================
  -- 3. CLIENTES ESPECIALES HOY (VIP, nuevos, en riesgo)
  -- ============================================
  WITH clientes_especiales AS (
    SELECT DISTINCT ON (c.id)
      c.id AS customer_id,
      c.name AS cliente,
      c.segment_auto AS segmento,
      a.appointment_time AS hora_cita,
      c.last_visit_at AS ultima_visita,
      EXTRACT(DAY FROM (p_timestamp::DATE - c.last_visit_at))::INTEGER AS dias_sin_venir,
      c.total_spent AS total_gastado,
      c.total_visits AS visitas_totales,
      c.notes AS notas
    FROM customers c
    JOIN appointments a ON a.customer_id = c.id
    WHERE a.business_id = p_business_id
      AND a.appointment_date = p_timestamp::DATE
      AND a.status NOT IN ('cancelled', 'no_show')
      AND c.segment_auto IN ('vip', 'nuevo', 'en_riesgo')
    ORDER BY c.id, a.appointment_time ASC
  )
  SELECT jsonb_build_object(
    'especiales_hoy', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'cliente', cliente,
          'segmento', segmento,
          'hora_cita', hora_cita::TEXT,
          'ultima_visita', ultima_visita::TEXT,
          'dias_sin_venir', dias_sin_venir,
          'total_gastado', total_gastado,
          'visitas_totales', visitas_totales,
          'notas', notas,
          'customer_id', customer_id
        )
        ORDER BY 
          CASE segmento
            WHEN 'vip' THEN 1
            WHEN 'nuevo' THEN 2
            WHEN 'en_riesgo' THEN 3
          END,
          hora_cita ASC
      )
      FROM clientes_especiales
    ), '[]'::jsonb)
  ) INTO v_clientes;

  -- ============================================
  -- 4. COMUNICACIONES (Incidencias y mensajes sin leer)
  -- ============================================
  WITH incidencias_urgentes AS (
    SELECT 
      am.customer_phone,
      am.message_text,
      am.timestamp,
      ROUND(EXTRACT(EPOCH FROM (p_timestamp - am.timestamp)) / 3600)::INTEGER AS hace_horas
    FROM agent_messages am
    WHERE am.business_id = p_business_id
      AND am.direction = 'inbound'
      AND am.timestamp >= p_timestamp - INTERVAL '48 hours'
      AND (
        am.message_text ILIKE '%urgente%' OR
        am.message_text ILIKE '%problema%' OR
        am.message_text ILIKE '%queja%' OR
        am.message_text ILIKE '%hablar con%' OR
        am.message_text ILIKE '%gerente%' OR
        am.message_text ILIKE '%dueño%' OR
        (am.metadata->>'requires_attention')::BOOLEAN = TRUE
      )
      AND (am.metadata->>'resolved')::BOOLEAN IS DISTINCT FROM TRUE
    ORDER BY am.timestamp DESC
    LIMIT 3
  )
  SELECT jsonb_build_object(
    'mensajes_sin_leer', COALESCE((
      SELECT COUNT(*)::INTEGER
      FROM agent_messages am
      WHERE am.business_id = p_business_id
        AND am.direction = 'inbound'
        AND am.timestamp >= p_timestamp - INTERVAL '24 hours'
        AND (am.metadata->>'read')::BOOLEAN IS DISTINCT FROM TRUE
    ), 0),
    'incidencias_urgentes', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'cliente_telefono', customer_phone,
          'mensaje', message_text,
          'timestamp', timestamp,
          'hace_horas', hace_horas
        )
      )
      FROM incidencias_urgentes
    ), '[]'::jsonb)
  ) INTO v_comunicaciones;

  -- ============================================
  -- 5. NO-SHOWS EN RIESGO
  -- ============================================
  WITH noshows_en_riesgo AS (
    SELECT 
      appointment_id,
      customer_id,
      customer_name,
      customer_phone,
      customer_email,
      appointment_date,
      appointment_time,
      service_name,
      employee_name,
      risk_score,
      risk_level,
      no_show_count,
      days_since_last_visit,
      hours_until_appointment,
      last_confirmation_sent_at,
      confirmed
    FROM get_high_risk_appointments(p_business_id, p_timestamp, 60)
    WHERE appointment_date = p_timestamp::DATE
      AND hours_until_appointment < 4
    ORDER BY risk_score DESC, hours_until_appointment ASC
    LIMIT 5
  )
  SELECT jsonb_build_object(
    'en_riesgo_hoy', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'appointment_id', appointment_id,
          'customer_id', customer_id,
          'cliente', customer_name,
          'telefono', customer_phone,
          'email', customer_email,
          'fecha', appointment_date::TEXT,
          'hora', appointment_time::TEXT,
          'servicio', service_name,
          'empleado', employee_name,
          'risk_score', risk_score,
          'risk_level', risk_level,
          'historial_plantones', no_show_count,
          'dias_sin_visitar', days_since_last_visit,
          'horas_hasta', ROUND(hours_until_appointment::NUMERIC, 1),
          'ultima_confirmacion', last_confirmation_sent_at,
          'confirmado', confirmed
        )
      )
      FROM noshows_en_riesgo
    ), '[]'::jsonb)
  ) INTO v_noshows;

  -- ============================================
  -- 6. FACTURACIÓN
  -- ============================================
  WITH facturado AS (
    SELECT 
      COUNT(*)::INTEGER AS completadas,
      COALESCE(SUM(bs.suggested_price), 0) AS total
    FROM appointments a
    LEFT JOIN business_services bs ON bs.id = a.service_id
    WHERE a.business_id = p_business_id
      AND a.appointment_date = p_timestamp::DATE
      AND a.status = 'completed'
  ),
  pendiente AS (
    SELECT 
      COUNT(*)::INTEGER AS pendientes,
      COALESCE(SUM(bs.suggested_price), 0) AS potencial
    FROM appointments a
    LEFT JOIN business_services bs ON bs.id = a.service_id
    WHERE a.business_id = p_business_id
      AND a.appointment_date = p_timestamp::DATE
      AND a.status = 'pending'
      AND a.appointment_time > p_timestamp::TIME
  ),
  promedio AS (
    SELECT COALESCE(AVG(daily_total), 0) AS promedio_diario
    FROM (
      SELECT 
        a.appointment_date,
        SUM(bs.suggested_price) AS daily_total
      FROM appointments a
      LEFT JOIN business_services bs ON bs.id = a.service_id
      WHERE a.business_id = p_business_id
        AND a.appointment_date >= p_timestamp::DATE - INTERVAL '30 days'
        AND a.appointment_date < p_timestamp::DATE
        AND a.status = 'completed'
      GROUP BY a.appointment_date
    ) daily
  )
  SELECT jsonb_build_object(
    'total_hoy', f.total,
    'citas_completadas', f.completadas,
    'citas_pendientes', p.pendientes,
    'ingresos_potenciales', p.potencial,
    'promedio_diario', ROUND(pr.promedio_diario::NUMERIC, 2),
    'porcentaje_vs_promedio', CASE 
      WHEN pr.promedio_diario > 0 THEN ROUND((f.total / pr.promedio_diario * 100)::NUMERIC, 0)
      ELSE 0
    END
  )
  FROM facturado f, pendiente p, promedio pr
  INTO v_facturacion;

  -- ============================================
  -- RESULTADO FINAL
  -- ============================================
  SELECT jsonb_build_object(
    'timestamp', p_timestamp,
    'reservas', v_reservas,
    'horarios', v_horarios,
    'clientes', v_clientes,
    'comunicaciones', v_comunicaciones,
    'noshows', v_noshows,
    'facturacion', v_facturacion
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- COMENTARIO
-- ============================================
COMMENT ON FUNCTION get_unified_dashboard_snapshot IS 
'Devuelve un snapshot completo del estado del negocio para alimentar el dashboard inteligente.
Incluye: reservas, horarios, clientes especiales, comunicaciones, no-shows en riesgo y facturación.';
