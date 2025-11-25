-- ============================================
-- MIGRACIÓN: Expandir get_unified_dashboard_snapshot con TODOS los detalles
-- Fecha: 2025-11-24
-- Propósito: Añadir datos completos para expansiones de acordeones
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
  -- 1. RESERVAS (Expandido con próximas 5 citas + huecos)
  -- ============================================
  WITH proximas_citas AS (
    SELECT 
      a.id AS appointment_id,
      a.customer_name AS cliente,
      a.appointment_time::TEXT AS hora,
      a.appointment_date::TEXT AS fecha,
      ROUND(EXTRACT(EPOCH FROM ((a.appointment_date + a.appointment_time) - p_timestamp)) / 60)::INTEGER AS minutos_hasta,
      COALESCE(bs.name, 'Servicio') AS servicio,
      COALESCE(e.name, 'Sin asignar') AS empleado,
      a.duration_minutes AS duracion,
      CASE 
        WHEN a.status = 'confirmed' THEN 'confirmada'
        WHEN a.status = 'pending' THEN 'pendiente'
        ELSE 'en_riesgo'
      END AS estado,
      c.id AS customer_id,
      COALESCE(c.segment_auto, 'regular') AS segmento
    FROM appointments a
    LEFT JOIN customers c ON c.id = a.customer_id
    LEFT JOIN business_services bs ON bs.id = a.service_id
    LEFT JOIN employees e ON e.id = a.employee_id
    WHERE a.business_id = p_business_id
      AND (a.appointment_date > p_timestamp::DATE OR 
           (a.appointment_date = p_timestamp::DATE AND a.appointment_time >= p_timestamp::TIME))
      AND a.status NOT IN ('cancelled', 'completed', 'no_show')
    ORDER BY a.appointment_date, a.appointment_time ASC
    LIMIT 5
  ),
  huecos_proximos AS (
    SELECT 
      asl.start_time::TEXT AS hora_inicio,
      asl.end_time::TEXT AS hora_fin,
      COALESCE(e.name, 'Sin asignar') AS empleado,
      asl.duration_minutes AS duracion_minutos
    FROM availability_slots asl
    LEFT JOIN employees e ON e.id = asl.employee_id
    WHERE asl.business_id = p_business_id
      AND asl.status = 'free'
      AND asl.is_available = TRUE
      AND (asl.slot_date + asl.start_time) > p_timestamp
      AND (asl.slot_date + asl.start_time) <= (p_timestamp + INTERVAL '3 hours')
    ORDER BY asl.slot_date, asl.start_time ASC
    LIMIT 10
  )
  SELECT jsonb_build_object(
    'proxima_cita', (SELECT row_to_json(pc) FROM proximas_citas pc LIMIT 1),
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
    'huecos_salvables', (SELECT COUNT(*)::INTEGER FROM huecos_proximos),
    'proximas_5_citas', COALESCE((SELECT jsonb_agg(row_to_json(pc)) FROM proximas_citas pc), '[]'::jsonb),
    'huecos_proximas_3h', COALESCE((SELECT jsonb_agg(row_to_json(hp)) FROM huecos_proximos hp), '[]'::jsonb)
  ) INTO v_reservas;

  -- ============================================
  -- 2. HORARIOS / EQUIPO (Expandido con estado en tiempo real)
  -- ============================================
  WITH estado_empleados AS (
    SELECT 
      e.id AS empleado_id,
      e.name AS nombre,
      e.avatar_url,
      CASE 
        WHEN EXISTS (
          SELECT 1 FROM employee_absences ea 
          WHERE ea.employee_id = e.id 
          AND p_timestamp::DATE BETWEEN ea.start_date AND ea.end_date
        ) THEN 'ausente'
        WHEN EXISTS (
          SELECT 1 FROM appointments a 
          WHERE a.employee_id = e.id 
          AND a.appointment_date = p_timestamp::DATE
          AND a.appointment_time <= p_timestamp::TIME
          AND (a.appointment_time + (a.duration_minutes || ' minutes')::INTERVAL) > p_timestamp::TIME
          AND a.status NOT IN ('cancelled', 'no_show')
        ) THEN 'ocupado'
        ELSE 'libre'
      END AS estado,
      (
        SELECT a.customer_name 
        FROM appointments a 
        WHERE a.employee_id = e.id 
          AND a.appointment_date = p_timestamp::DATE
          AND a.appointment_time <= p_timestamp::TIME
          AND (a.appointment_time + (a.duration_minutes || ' minutes')::INTERVAL) > p_timestamp::TIME
          AND a.status NOT IN ('cancelled', 'no_show')
        LIMIT 1
      ) AS cliente_actual,
      (
        SELECT (a.appointment_time + (a.duration_minutes || ' minutes')::INTERVAL)::TIME::TEXT
        FROM appointments a 
        WHERE a.employee_id = e.id 
          AND a.appointment_date = p_timestamp::DATE
          AND a.appointment_time <= p_timestamp::TIME
          AND (a.appointment_time + (a.duration_minutes || ' minutes')::INTERVAL) > p_timestamp::TIME
          AND a.status NOT IN ('cancelled', 'no_show')
        LIMIT 1
      ) AS hora_fin_actual,
      (
        SELECT a.appointment_time::TEXT
        FROM appointments a 
        WHERE a.employee_id = e.id 
          AND a.appointment_date = p_timestamp::DATE
          AND a.appointment_time > p_timestamp::TIME
          AND a.status NOT IN ('cancelled', 'no_show')
        ORDER BY a.appointment_time ASC
        LIMIT 1
      ) AS proxima_cita,
      (
        SELECT COUNT(*)::INTEGER
        FROM appointments a 
        WHERE a.employee_id = e.id 
          AND a.appointment_date = p_timestamp::DATE
          AND a.status NOT IN ('cancelled', 'no_show')
      ) AS citas_hoy_total,
      (
        SELECT COUNT(*)::INTEGER
        FROM appointments a 
        WHERE a.employee_id = e.id 
          AND a.appointment_date = p_timestamp::DATE
          AND a.status = 'completed'
      ) AS citas_hoy_completadas,
      (
        SELECT ea.reason 
        FROM employee_absences ea 
        WHERE ea.employee_id = e.id 
        AND p_timestamp::DATE BETWEEN ea.start_date AND ea.end_date
        LIMIT 1
      ) AS razon_ausencia,
      (
        SELECT ea.start_date::TEXT
        FROM employee_absences ea 
        WHERE ea.employee_id = e.id 
        AND p_timestamp::DATE BETWEEN ea.start_date AND ea.end_date
        LIMIT 1
      ) AS fecha_ausencia_inicio,
      (
        SELECT ea.end_date::TEXT
        FROM employee_absences ea 
        WHERE ea.employee_id = e.id 
        AND p_timestamp::DATE BETWEEN ea.start_date AND ea.end_date
        LIMIT 1
      ) AS fecha_ausencia_fin,
      (
        SELECT COUNT(*)::INTEGER
        FROM appointments a 
        WHERE a.employee_id = e.id 
          AND a.appointment_date = p_timestamp::DATE
          AND a.status NOT IN ('cancelled', 'completed', 'no_show')
      ) AS citas_afectadas
    FROM employees e
    WHERE e.business_id = p_business_id
      AND e.is_active = TRUE
    ORDER BY e.position_order NULLS LAST
  ),
  proximas_ausencias AS (
    SELECT 
      e.name AS empleado,
      ea.reason AS razon,
      ea.start_date::TEXT AS fecha_inicio,
      ea.end_date::TEXT AS fecha_fin
    FROM employee_absences ea
    JOIN employees e ON e.id = ea.employee_id
    WHERE ea.business_id = p_business_id
      AND ea.start_date > p_timestamp::DATE
      AND ea.start_date <= (p_timestamp::DATE + INTERVAL '7 days')
    ORDER BY ea.start_date ASC
    LIMIT 5
  )
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
    ), '[]'::jsonb),
    'equipo_detalle', COALESCE((SELECT jsonb_agg(row_to_json(ee)) FROM estado_empleados ee), '[]'::jsonb),
    'proximas_ausencias_7dias', COALESCE((SELECT jsonb_agg(row_to_json(pa)) FROM proximas_ausencias pa), '[]'::jsonb)
  ) INTO v_horarios;

  -- ============================================
  -- 3. CLIENTES ESPECIALES HOY (+ Clientes en riesgo sin cita)
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
  ),
  clientes_reactivar AS (
    SELECT 
      c.id AS customer_id,
      c.name AS cliente,
      c.phone AS telefono,
      c.last_visit_at::TEXT AS ultima_visita,
      EXTRACT(DAY FROM (p_timestamp::DATE - c.last_visit_at))::INTEGER AS dias_sin_venir,
      c.segment_auto AS segmento,
      c.total_spent AS total_gastado,
      c.total_visits AS visitas_totales
    FROM customers c
    WHERE c.business_id = p_business_id
      AND c.segment_auto = 'en_riesgo'
      AND NOT EXISTS (
        SELECT 1 FROM appointments a 
        WHERE a.customer_id = c.id 
        AND a.appointment_date >= p_timestamp::DATE
        AND a.status NOT IN ('cancelled', 'no_show')
      )
    ORDER BY c.last_visit_at ASC NULLS LAST
    LIMIT 5
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
    ), '[]'::jsonb),
    'vip_hoy', COALESCE((SELECT COUNT(*)::INTEGER FROM clientes_especiales WHERE segmento = 'vip'), 0),
    'nuevos_hoy', COALESCE((SELECT COUNT(*)::INTEGER FROM clientes_especiales WHERE segmento = 'nuevo'), 0),
    'en_riesgo_hoy', COALESCE((SELECT COUNT(*)::INTEGER FROM clientes_especiales WHERE segmento = 'en_riesgo'), 0),
    'sugerencias_reactivacion', COALESCE((SELECT jsonb_agg(row_to_json(cr)) FROM clientes_reactivar cr), '[]'::jsonb)
  ) INTO v_clientes;

  -- ============================================
  -- 4. COMUNICACIONES (Expandido con últimos mensajes + llamadas)
  -- ============================================
  WITH ultimos_mensajes AS (
    SELECT 
      am.customer_phone AS telefono,
      c.name AS cliente,
      am.message_text AS mensaje,
      am.timestamp,
      ROUND(EXTRACT(EPOCH FROM (p_timestamp - am.timestamp)) / 3600)::INTEGER AS hace_horas,
      (am.metadata->>'read')::BOOLEAN AS leido,
      c.id AS customer_id
    FROM agent_messages am
    LEFT JOIN customers c ON c.phone = am.customer_phone AND c.business_id = am.business_id
    WHERE am.business_id = p_business_id
      AND am.direction = 'inbound'
      AND am.timestamp >= p_timestamp - INTERVAL '24 hours'
    ORDER BY am.timestamp DESC
    LIMIT 5
  ),
  comunicaciones_urgentes AS (
    SELECT 
      am.customer_phone AS telefono,
      c.name AS cliente,
      am.message_text AS mensaje,
      am.timestamp,
      ROUND(EXTRACT(EPOCH FROM (p_timestamp - am.timestamp)) / 3600)::INTEGER AS hace_horas,
      CASE 
        WHEN am.message_text ILIKE '%queja%' OR am.message_text ILIKE '%reclamo%' THEN 'queja'
        WHEN am.message_text ILIKE '%urgente%' OR am.message_text ILIKE '%emergencia%' THEN 'urgente'
        ELSE 'consulta'
      END AS tipo,
      c.id AS customer_id
    FROM agent_messages am
    LEFT JOIN customers c ON c.phone = am.customer_phone AND c.business_id = am.business_id
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
  ),
  ultimas_llamadas AS (
    SELECT 
      pc.phone_number AS telefono,
      c.name AS cliente,
      pc.direction,
      pc.status,
      pc.duration_seconds,
      pc.call_started_at AS timestamp,
      ROUND(EXTRACT(EPOCH FROM (p_timestamp - pc.call_started_at)) / 3600)::INTEGER AS hace_horas,
      c.id AS customer_id
    FROM phone_calls pc
    LEFT JOIN customers c ON c.phone = pc.phone_number AND c.business_id = pc.business_id
    WHERE pc.business_id = p_business_id
      AND pc.call_started_at >= p_timestamp - INTERVAL '24 hours'
    ORDER BY pc.call_started_at DESC
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
    'incidencias_urgentes', COALESCE((SELECT jsonb_agg(row_to_json(cu)) FROM comunicaciones_urgentes cu), '[]'::jsonb),
    'ultimos_mensajes', COALESCE((SELECT jsonb_agg(row_to_json(um)) FROM ultimos_mensajes um), '[]'::jsonb),
    'ultimas_llamadas', COALESCE((SELECT jsonb_agg(row_to_json(ul)) FROM ultimas_llamadas ul), '[]'::jsonb),
    'total_mensajes_24h', COALESCE((
      SELECT COUNT(*)::INTEGER
      FROM agent_messages am
      WHERE am.business_id = p_business_id
        AND am.timestamp >= p_timestamp - INTERVAL '24 hours'
    ), 0),
    'total_llamadas_24h', COALESCE((
      SELECT COUNT(*)::INTEGER
      FROM phone_calls pc
      WHERE pc.business_id = p_business_id
        AND pc.call_started_at >= p_timestamp - INTERVAL '24 hours'
    ), 0)
  ) INTO v_comunicaciones;

  -- ============================================
  -- 5. NO-SHOWS EN RIESGO (+ Estadísticas del mes)
  -- ============================================
  WITH noshows_en_riesgo AS (
    SELECT 
      appointment_id,
      customer_id,
      customer_name AS cliente,
      customer_phone AS telefono,
      customer_email AS email,
      appointment_date AS fecha,
      appointment_time AS hora,
      service_name AS servicio,
      employee_name AS empleado,
      risk_score,
      risk_level,
      no_show_count AS historial_plantones,
      days_since_last_visit AS dias_sin_visitar,
      ROUND(hours_until_appointment::NUMERIC, 1) AS horas_hasta,
      last_confirmation_sent_at AS ultima_confirmacion,
      confirmed
    FROM get_high_risk_appointments(p_business_id, p_timestamp, 60)
    WHERE appointment_date = p_timestamp::DATE
      AND hours_until_appointment < 4
    ORDER BY risk_score DESC, hours_until_appointment ASC
    LIMIT 5
  )
  SELECT jsonb_build_object(
    'en_riesgo_hoy', COALESCE((SELECT jsonb_agg(row_to_json(nr)) FROM noshows_en_riesgo nr), '[]'::jsonb),
    'total_riesgo_alto_hoy', COALESCE((SELECT COUNT(*)::INTEGER FROM noshows_en_riesgo WHERE risk_level = 'high'), 0),
    'total_riesgo_medio_hoy', COALESCE((SELECT COUNT(*)::INTEGER FROM noshows_en_riesgo WHERE risk_level = 'medium'), 0),
    'total_noshows_mes', COALESCE((
      SELECT COUNT(*)::INTEGER
      FROM appointments a
      WHERE a.business_id = p_business_id
        AND a.appointment_date >= DATE_TRUNC('month', p_timestamp::DATE)
        AND a.appointment_date < p_timestamp::DATE
        AND a.status = 'no_show'
    ), 0),
    'perdidas_estimadas_mes', COALESCE((
      SELECT SUM(bs.suggested_price)
      FROM appointments a
      LEFT JOIN business_services bs ON bs.id = a.service_id
      WHERE a.business_id = p_business_id
        AND a.appointment_date >= DATE_TRUNC('month', p_timestamp::DATE)
        AND a.appointment_date < p_timestamp::DATE
        AND a.status = 'no_show'
    ), 0)
  ) INTO v_noshows;

  -- ============================================
  -- 6. FACTURACIÓN (Expandido con semana, mes, comparativas, top servicios)
  -- ============================================
  WITH facturado_hoy AS (
    SELECT 
      COUNT(*)::INTEGER AS servicios,
      COALESCE(SUM(bs.suggested_price), 0) AS total
    FROM appointments a
    LEFT JOIN business_services bs ON bs.id = a.service_id
    WHERE a.business_id = p_business_id
      AND a.appointment_date = p_timestamp::DATE
      AND a.status = 'completed'
  ),
  facturado_ayer AS (
    SELECT 
      COUNT(*)::INTEGER AS servicios,
      COALESCE(SUM(bs.suggested_price), 0) AS total
    FROM appointments a
    LEFT JOIN business_services bs ON bs.id = a.service_id
    WHERE a.business_id = p_business_id
      AND a.appointment_date = (p_timestamp::DATE - INTERVAL '1 day')
      AND a.status = 'completed'
  ),
  facturado_semana AS (
    SELECT 
      COUNT(*)::INTEGER AS servicios,
      COALESCE(SUM(bs.suggested_price), 0) AS total
    FROM appointments a
    LEFT JOIN business_services bs ON bs.id = a.service_id
    WHERE a.business_id = p_business_id
      AND a.appointment_date >= DATE_TRUNC('week', p_timestamp::DATE)
      AND a.appointment_date <= p_timestamp::DATE
      AND a.status = 'completed'
  ),
  facturado_mes AS (
    SELECT 
      COUNT(*)::INTEGER AS servicios,
      COALESCE(SUM(bs.suggested_price), 0) AS total
    FROM appointments a
    LEFT JOIN business_services bs ON bs.id = a.service_id
    WHERE a.business_id = p_business_id
      AND a.appointment_date >= DATE_TRUNC('month', p_timestamp::DATE)
      AND a.appointment_date <= p_timestamp::DATE
      AND a.status = 'completed'
  ),
  promedio_historico AS (
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
  ),
  top_servicios_mes AS (
    SELECT 
      bs.name AS nombre,
      COUNT(*)::INTEGER AS cantidad,
      COALESCE(SUM(bs.suggested_price), 0) AS ingresos
    FROM appointments a
    LEFT JOIN business_services bs ON bs.id = a.service_id
    WHERE a.business_id = p_business_id
      AND a.appointment_date >= DATE_TRUNC('month', p_timestamp::DATE)
      AND a.appointment_date <= p_timestamp::DATE
      AND a.status = 'completed'
      AND bs.name IS NOT NULL
    GROUP BY bs.name
    ORDER BY cantidad DESC
    LIMIT 3
  ),
  pendientes AS (
    SELECT 
      COUNT(*)::INTEGER AS cantidad,
      COALESCE(SUM(bs.suggested_price), 0) AS potencial
    FROM appointments a
    LEFT JOIN business_services bs ON bs.id = a.service_id
    WHERE a.business_id = p_business_id
      AND a.appointment_date = p_timestamp::DATE
      AND a.status = 'pending'
      AND a.appointment_time > p_timestamp::TIME
  )
  SELECT jsonb_build_object(
    'total_hoy', fh.total,
    'citas_completadas', fh.servicios,
    'citas_pendientes', p.cantidad,
    'ingresos_potenciales', p.potencial,
    'promedio_diario', ROUND(ph.promedio_diario::NUMERIC, 2),
    'porcentaje_vs_promedio', CASE 
      WHEN ph.promedio_diario > 0 THEN ROUND((fh.total / ph.promedio_diario * 100)::NUMERIC, 0)
      ELSE 0
    END,
    'hoy', jsonb_build_object(
      'total', fh.total,
      'servicios', fh.servicios,
      'meta_diaria', ROUND(ph.promedio_diario::NUMERIC, 2),
      'porcentaje_meta', CASE 
        WHEN ph.promedio_diario > 0 THEN ROUND((fh.total / ph.promedio_diario * 100)::NUMERIC, 0)
        ELSE 0
      END
    ),
    'ayer', jsonb_build_object(
      'total', fa.total,
      'diferencia_euros', fh.total - fa.total,
      'diferencia_porcentaje', CASE 
        WHEN fa.total > 0 THEN ROUND(((fh.total - fa.total)::NUMERIC / fa.total * 100), 0)
        ELSE 0
      END
    ),
    'semana_actual', jsonb_build_object(
      'total', fs.total,
      'servicios', fs.servicios,
      'promedio_diario_semana', CASE 
        WHEN EXTRACT(DOW FROM p_timestamp::DATE) > 0 
        THEN ROUND((fs.total / EXTRACT(DOW FROM p_timestamp::DATE))::NUMERIC, 2)
        ELSE fs.total
      END
    ),
    'mes_actual', jsonb_build_object(
      'total', fm.total,
      'servicios', fm.servicios,
      'promedio_diario_mes', CASE 
        WHEN EXTRACT(DAY FROM p_timestamp::DATE) > 0 
        THEN ROUND((fm.total / EXTRACT(DAY FROM p_timestamp::DATE))::NUMERIC, 2)
        ELSE fm.total
      END
    ),
    'top_servicios_mes', COALESCE((SELECT jsonb_agg(row_to_json(ts)) FROM top_servicios_mes ts), '[]'::jsonb)
  )
  FROM facturado_hoy fh, facturado_ayer fa, facturado_semana fs, facturado_mes fm, promedio_historico ph, pendientes p
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
'Versión EXPANDIDA del snapshot del dashboard.
Incluye: reservas (próximas 5 + huecos), equipo (estado real-time + ausencias futuras), 
clientes (especiales + sugerencias reactivación), comunicaciones (mensajes + llamadas), 
no-shows (estadísticas mes), facturación (día/semana/mes + top servicios).';


