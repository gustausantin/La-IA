-- =====================================================
-- MIGRACIÓN: MEJORAR get_unified_dashboard_snapshot
-- Fecha: 2025-11-28
-- Propósito: Añadir análisis detallado por empleado y detectar conflictos
-- =====================================================

-- =====================================================
-- FUNCIÓN MEJORADA: get_unified_dashboard_snapshot
-- =====================================================
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
  -- Extraer fecha y hora del timestamp
  v_today := p_timestamp::DATE;
  v_current_time := p_timestamp::TIME;

  -- =====================================================
  -- BLOQUE 1: RESERVAS (mejorado con info de empleados)
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
  ),
  empleados_activos AS (
    SELECT 
      e.id,
      e.name,
      e.color,
      e.position_order,
      -- Obtener horario del empleado para HOY
      CASE 
        WHEN EXTRACT(DOW FROM v_today) = 0 THEN es.sunday_start
        WHEN EXTRACT(DOW FROM v_today) = 1 THEN es.monday_start
        WHEN EXTRACT(DOW FROM v_today) = 2 THEN es.tuesday_start
        WHEN EXTRACT(DOW FROM v_today) = 3 THEN es.wednesday_start
        WHEN EXTRACT(DOW FROM v_today) = 4 THEN es.thursday_start
        WHEN EXTRACT(DOW FROM v_today) = 5 THEN es.friday_start
        WHEN EXTRACT(DOW FROM v_today) = 6 THEN es.saturday_start
      END as horario_inicio,
      CASE 
        WHEN EXTRACT(DOW FROM v_today) = 0 THEN es.sunday_end
        WHEN EXTRACT(DOW FROM v_today) = 1 THEN es.monday_end
        WHEN EXTRACT(DOW FROM v_today) = 2 THEN es.tuesday_end
        WHEN EXTRACT(DOW FROM v_today) = 3 THEN es.wednesday_end
        WHEN EXTRACT(DOW FROM v_today) = 4 THEN es.thursday_end
        WHEN EXTRACT(DOW FROM v_today) = 5 THEN es.friday_end
        WHEN EXTRACT(DOW FROM v_today) = 6 THEN es.saturday_end
      END as horario_fin,
      -- Calcular horas totales trabajadas hoy
      CASE 
        WHEN EXTRACT(DOW FROM v_today) = 0 AND es.sunday_start IS NOT NULL THEN 
          EXTRACT(EPOCH FROM (es.sunday_end - es.sunday_start)) / 3600
        WHEN EXTRACT(DOW FROM v_today) = 1 AND es.monday_start IS NOT NULL THEN 
          EXTRACT(EPOCH FROM (es.monday_end - es.monday_start)) / 3600
        WHEN EXTRACT(DOW FROM v_today) = 2 AND es.tuesday_start IS NOT NULL THEN 
          EXTRACT(EPOCH FROM (es.tuesday_end - es.tuesday_start)) / 3600
        WHEN EXTRACT(DOW FROM v_today) = 3 AND es.wednesday_start IS NOT NULL THEN 
          EXTRACT(EPOCH FROM (es.wednesday_end - es.wednesday_start)) / 3600
        WHEN EXTRACT(DOW FROM v_today) = 4 AND es.thursday_start IS NOT NULL THEN 
          EXTRACT(EPOCH FROM (es.thursday_end - es.thursday_start)) / 3600
        WHEN EXTRACT(DOW FROM v_today) = 5 AND es.friday_start IS NOT NULL THEN 
          EXTRACT(EPOCH FROM (es.friday_end - es.friday_start)) / 3600
        WHEN EXTRACT(DOW FROM v_today) = 6 AND es.saturday_start IS NOT NULL THEN 
          EXTRACT(EPOCH FROM (es.saturday_end - es.saturday_start)) / 3600
        ELSE 0
      END as horas_totales
    FROM employees e
    LEFT JOIN employee_schedules es ON es.employee_id = e.id
    WHERE e.business_id = p_business_id
      AND e.is_active = true
  ),
  analisis_empleados AS (
    SELECT 
      ea.id,
      ea.name,
      ea.horas_totales,
      -- Calcular horas ocupadas (suma de duraciones de reservas)
      COALESCE(SUM(r.duracion) / 60.0, 0) as horas_ocupadas,
      -- Calcular horas libres
      GREATEST(ea.horas_totales - COALESCE(SUM(r.duracion) / 60.0, 0), 0) as horas_libres,
      -- Porcentaje de ocupación
      CASE 
        WHEN ea.horas_totales > 0 THEN 
          ROUND((COALESCE(SUM(r.duracion) / 60.0, 0) / ea.horas_totales) * 100)
        ELSE 0
      END as ocupacion_porcentaje,
      -- Contar reservas
      COUNT(r.id) as num_reservas,
      -- Próxima cita
      MIN(CASE WHEN r.appointment_time > v_current_time THEN r.appointment_time END) as proxima_cita,
      -- 🚨 CONFLICTO: tiene reservas pero NO tiene horario
      CASE 
        WHEN COUNT(r.id) > 0 AND ea.horas_totales = 0 THEN true
        ELSE false
      END as tiene_conflicto_horario
    FROM empleados_activos ea
    LEFT JOIN reservas_hoy r ON r.employee_id = ea.id
    GROUP BY ea.id, ea.name, ea.horas_totales
  )
  SELECT jsonb_build_object(
    'total_empleados', COUNT(*),
    'empleados_trabajando', COUNT(*) FILTER (WHERE horas_totales > 0),
    'total_horas_disponibles', ROUND(SUM(horas_totales)::numeric, 1),
    'total_horas_ocupadas', ROUND(SUM(horas_ocupadas)::numeric, 1),
    'total_horas_libres', ROUND(SUM(horas_libres)::numeric, 1),
    'ocupacion_promedio', ROUND(AVG(ocupacion_porcentaje)::numeric, 0),
    -- 🚨 CONFLICTOS CRÍTICOS
    'conflictos_horario', COUNT(*) FILTER (WHERE tiene_conflicto_horario = true),
    'empleados_con_conflicto', jsonb_agg(
      jsonb_build_object(
        'nombre', name,
        'num_reservas', num_reservas,
        'proxima_cita', TO_CHAR(proxima_cita, 'HH24:MI')  -- ✅ SIN SEGUNDOS
      )
    ) FILTER (WHERE tiene_conflicto_horario = true),
    -- Detalle por empleado
    'detalle_empleados', jsonb_agg(
      jsonb_build_object(
        'nombre', name,
        'horas_totales', ROUND(horas_totales::numeric, 1),
        'horas_ocupadas', ROUND(horas_ocupadas::numeric, 1),
        'horas_libres', ROUND(horas_libres::numeric, 1),
        'ocupacion_porcentaje', ocupacion_porcentaje,
        'num_reservas', num_reservas,
        'proxima_cita', TO_CHAR(proxima_cita, 'HH24:MI'),  -- ✅ SIN SEGUNDOS
        'estado', CASE 
          WHEN ocupacion_porcentaje >= 90 THEN 'lleno'
          WHEN ocupacion_porcentaje >= 50 THEN 'ocupado'
          WHEN ocupacion_porcentaje > 0 THEN 'libre'
          ELSE 'sin_reservas'
        END
      )
      ORDER BY position_order, name
    )
  )
  INTO v_equipo
  FROM analisis_empleados;

  -- Obtener próxima cita global
  SELECT jsonb_build_object(
    'conflictos', 0,
    'proxima_cita', (
      SELECT jsonb_build_object(
        'hora', TO_CHAR(appointment_time, 'HH24:MI'),  -- ✅ SIN SEGUNDOS
        'cliente', customer_name,
        'notas', notes,
        'minutos_hasta', EXTRACT(EPOCH FROM (appointment_time - v_current_time)) / 60,
        'servicio', COALESCE(notes, 'Sin especificar')
      )
      FROM reservas_hoy
      WHERE appointment_time > v_current_time
      ORDER BY appointment_time
      LIMIT 1
    )
  )
  INTO v_reservas;

  -- =====================================================
  -- BLOQUE 2: AUSENCIAS (sin cambios, añadido para completitud)
  -- =====================================================
  SELECT jsonb_build_object(
    'ausentes_hoy', COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'empleado', e.name,
          'razon', ea.reason_label,
          'tipo_ausencia', ea.reason
        )
      ), '[]'::jsonb
    )
  )
  INTO v_equipo
  FROM employee_absences ea
  JOIN employees e ON e.id = ea.employee_id
  WHERE ea.business_id = p_business_id
    AND v_today BETWEEN ea.start_date AND ea.end_date
    AND ea.approved = true;

  -- Merge con el análisis de empleados
  v_equipo := v_equipo || jsonb_build_object('ausentes_hoy', COALESCE((v_equipo->'ausentes_hoy'), '[]'::jsonb));

  -- =====================================================
  -- OTROS BLOQUES (placeholders por ahora)
  -- =====================================================
  v_facturacion := '{}'::jsonb;
  v_comunicaciones := '{}'::jsonb;
  v_noshows := '{"en_riesgo_hoy": []}'::jsonb;
  v_clientes := '{"especiales_hoy": []}'::jsonb;

  -- =====================================================
  -- RESULTADO FINAL
  -- =====================================================
  v_result := jsonb_build_object(
    'reservas', v_reservas,
    'equipo', v_equipo,
    'horarios', v_equipo,  -- Alias para compatibilidad
    'facturacion', v_facturacion,
    'comunicaciones', v_comunicaciones,
    'noshows', v_noshows,
    'clientes', v_clientes
  );

  RETURN v_result;
END;
$$;

-- =====================================================
-- COMENTARIOS Y DOCUMENTACIÓN
-- =====================================================
COMMENT ON FUNCTION get_unified_dashboard_snapshot IS 
'Devuelve un snapshot completo del dashboard con análisis detallado por empleado.
Incluye detección de conflictos (empleados con reservas pero sin horario).
Todas las horas están en formato HH24:MI (sin segundos).';

