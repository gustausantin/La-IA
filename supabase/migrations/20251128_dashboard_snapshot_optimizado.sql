-- =====================================================
-- MIGRACIÓN OPTIMIZADA: Dashboard Snapshot
-- Fecha: 2025-11-28
-- Objetivo: MÁXIMA VELOCIDAD + Información esencial
-- =====================================================

-- =====================================================
-- LIMPIAR VERSIONES ANTERIORES SI EXISTEN
-- =====================================================
DROP FUNCTION IF EXISTS get_unified_dashboard_snapshot(UUID, TIMESTAMP);
DROP FUNCTION IF EXISTS get_unified_dashboard_snapshot(UUID);
DROP FUNCTION IF EXISTS get_unified_dashboard_snapshot();

-- =====================================================
-- FUNCIÓN OPTIMIZADA: get_unified_dashboard_snapshot
-- Solo 1 query con CTEs, sin subqueries anidadas
-- =====================================================
CREATE FUNCTION get_unified_dashboard_snapshot(
  p_business_id UUID,
  p_timestamp TIMESTAMP DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_today DATE := p_timestamp::DATE;
  v_current_time TIME := p_timestamp::TIME;
  v_result JSONB;
BEGIN
  -- =====================================================
  -- 🚀 UNA SOLA QUERY CON TODOS LOS DATOS
  -- =====================================================
  WITH 
  -- Reservas de hoy (filtro rápido con índices)
  reservas_hoy AS (
    SELECT 
      a.employee_id,
      a.customer_name,
      a.appointment_time,
      COALESCE(a.duration_minutes, 60) as duracion,
      a.notes
    FROM appointments a
    WHERE a.business_id = p_business_id
      AND a.appointment_date = v_today
      AND a.status IN ('confirmed', 'pending')
  ),
  -- Empleados con horarios (solo columnas necesarias)
  empleados_hoy AS (
    SELECT 
      e.id,
      e.name,
      -- Horario según día de la semana (solo inicio y fin)
      CASE EXTRACT(DOW FROM v_today)
        WHEN 0 THEN es.sunday_start
        WHEN 1 THEN es.monday_start
        WHEN 2 THEN es.tuesday_start
        WHEN 3 THEN es.wednesday_start
        WHEN 4 THEN es.thursday_start
        WHEN 5 THEN es.friday_start
        WHEN 6 THEN es.saturday_start
      END as horario_inicio,
      CASE EXTRACT(DOW FROM v_today)
        WHEN 0 THEN es.sunday_end
        WHEN 1 THEN es.monday_end
        WHEN 2 THEN es.tuesday_end
        WHEN 3 THEN es.wednesday_end
        WHEN 4 THEN es.thursday_end
        WHEN 5 THEN es.friday_end
        WHEN 6 THEN es.saturday_end
      END as horario_fin
    FROM employees e
    LEFT JOIN employee_schedules es ON es.employee_id = e.id
    WHERE e.business_id = p_business_id
      AND e.is_active = true
  ),
  -- Análisis compacto por empleado
  analisis AS (
    SELECT 
      COUNT(DISTINCT e.id) as total_empleados,
      -- Horas totales del equipo
      SUM(EXTRACT(EPOCH FROM (e.horario_fin - e.horario_inicio)) / 3600) FILTER (WHERE e.horario_inicio IS NOT NULL) as total_horas,
      -- Horas ocupadas (suma de duraciones)
      SUM(r.duracion) / 60.0 as horas_ocupadas,
      -- 🚨 CONFLICTOS: empleados con reservas SIN horario
      COUNT(DISTINCT r.employee_id) FILTER (WHERE e.horario_inicio IS NULL) as conflictos,
      -- Empleados con conflicto
      jsonb_agg(DISTINCT jsonb_build_object(
        'nombre', e.name,
        'reservas', (SELECT COUNT(*) FROM reservas_hoy WHERE employee_id = e.id)
      )) FILTER (WHERE e.horario_inicio IS NULL AND r.employee_id IS NOT NULL) as empleados_conflicto
    FROM empleados_hoy e
    LEFT JOIN reservas_hoy r ON r.employee_id = e.id
  ),
  -- Próxima cita (solo la más cercana)
  proxima AS (
    SELECT 
      TO_CHAR(appointment_time, 'HH24:MI') as hora,
      customer_name as cliente,
      EXTRACT(EPOCH FROM (appointment_time - v_current_time)) / 60 as minutos_hasta
    FROM reservas_hoy
    WHERE appointment_time > v_current_time
    ORDER BY appointment_time
    LIMIT 1
  ),
  -- Ausencias (rápido si no hay ausencias)
  ausencias AS (
    SELECT 
      jsonb_agg(jsonb_build_object(
        'empleado', e.name,
        'razon', ea.reason_label
      )) as ausentes
    FROM employee_absences ea
    JOIN employees e ON e.id = ea.employee_id
    WHERE ea.business_id = p_business_id
      AND v_today BETWEEN ea.start_date AND ea.end_date
      AND ea.approved = true
  )
  -- ✅ Construir resultado final
  SELECT jsonb_build_object(
    'reservas', jsonb_build_object(
      'conflictos', COALESCE(a.conflictos, 0),
      'proxima_cita', CASE 
        WHEN p.hora IS NOT NULL THEN
          jsonb_build_object(
            'hora', p.hora,
            'cliente', p.cliente,
            'minutos_hasta', ROUND(p.minutos_hasta)
          )
        ELSE NULL
      END
    ),
    'equipo', jsonb_build_object(
      'total_empleados', COALESCE(a.total_empleados, 0),
      'total_horas', ROUND(COALESCE(a.total_horas, 0)::numeric, 1),
      'horas_ocupadas', ROUND(COALESCE(a.horas_ocupadas, 0)::numeric, 1),
      'horas_libres', ROUND(COALESCE(a.total_horas - a.horas_ocupadas, 0)::numeric, 1),
      'ocupacion_porcentaje', CASE 
        WHEN a.total_horas > 0 THEN ROUND((a.horas_ocupadas / a.total_horas * 100)::numeric)
        ELSE 0
      END,
      'conflictos_horario', COALESCE(a.conflictos, 0),
      'empleados_con_conflicto', COALESCE(a.empleados_conflicto, '[]'::jsonb)
    ),
    'horarios', jsonb_build_object(
      'ausentes_hoy', COALESCE(au.ausentes, '[]'::jsonb)
    ),
    'noshows', '{"en_riesgo_hoy": []}'::jsonb,
    'clientes', '{"especiales_hoy": []}'::jsonb,
    'facturacion', '{}'::jsonb,
    'comunicaciones', '{}'::jsonb
  )
  INTO v_result
  FROM analisis a
  LEFT JOIN proxima p ON true
  LEFT JOIN ausencias au ON true;

  RETURN v_result;
END;
$$;

-- =====================================================
-- ÍNDICES PARA MÁXIMA VELOCIDAD
-- =====================================================

-- Índice para appointments (si no existe)
CREATE INDEX IF NOT EXISTS idx_appointments_business_date_status 
ON appointments(business_id, appointment_date, status) 
WHERE status IN ('confirmed', 'pending');

-- Índice para employee_absences
CREATE INDEX IF NOT EXISTS idx_absences_business_date 
ON employee_absences(business_id, start_date, end_date) 
WHERE approved = true;

-- =====================================================
-- COMENTARIOS
-- =====================================================
COMMENT ON FUNCTION get_unified_dashboard_snapshot IS 
'Versión OPTIMIZADA para máxima velocidad.
- 1 sola query con CTEs
- Solo datos esenciales
- Índices para filtros comunes
- Target: <100ms en producción';

