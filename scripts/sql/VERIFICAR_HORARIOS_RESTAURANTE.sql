-- =====================================================
-- VERIFICAR HORARIOS DEL RESTAURANTE
-- Restaurante: Casa Paco
-- ID: d6b63130-1ebf-4284-98fc-a3b31a85d9d1
-- =====================================================

-- ✅ OPCIÓN 1: Verificar tabla restaurant_operating_hours
SELECT 
  day_of_week,
  CASE day_of_week
    WHEN 0 THEN 'Domingo'
    WHEN 1 THEN 'Lunes'
    WHEN 2 THEN 'Martes'
    WHEN 3 THEN 'Miércoles'
    WHEN 4 THEN 'Jueves'
    WHEN 5 THEN 'Viernes'
    WHEN 6 THEN 'Sábado'
  END AS dia_nombre,
  is_open,
  open_time,
  close_time,
  created_at
FROM restaurant_operating_hours
WHERE restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
ORDER BY day_of_week;

-- =====================================================

-- ✅ OPCIÓN 2: Verificar settings.calendar_schedule en restaurants
SELECT 
  id,
  name,
  settings->'calendar_schedule' AS calendar_schedule,
  settings->'reservation_duration' AS reservation_duration,
  settings->'agent'->>'name' AS agent_name
FROM restaurants
WHERE id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1';

-- =====================================================

-- ✅ OPCIÓN 3: Extraer calendar_schedule formateado (si existe)
SELECT 
  jsonb_array_elements(settings->'calendar_schedule') AS day_info
FROM restaurants
WHERE id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
  AND settings ? 'calendar_schedule';

-- =====================================================

-- 🔍 VERIFICAR QUÉ CAMPO SE USA EN EL WORKFLOW
-- El nodo "🕐 Obtener Horarios" consulta:
SELECT 
  'Tabla: restaurant_operating_hours' AS fuente,
  COUNT(*) AS total_registros,
  COUNT(*) FILTER (WHERE is_open = true) AS dias_abiertos,
  COUNT(*) FILTER (WHERE is_open = false) AS dias_cerrados
FROM restaurant_operating_hours
WHERE restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'

UNION ALL

SELECT 
  'Campo: settings.calendar_schedule' AS fuente,
  jsonb_array_length(settings->'calendar_schedule') AS total_registros,
  (
    SELECT COUNT(*)
    FROM jsonb_array_elements(settings->'calendar_schedule') AS day
    WHERE (day->>'is_open')::boolean = true
  ) AS dias_abiertos,
  (
    SELECT COUNT(*)
    FROM jsonb_array_elements(settings->'calendar_schedule') AS day
    WHERE (day->>'is_open')::boolean = false
  ) AS dias_cerrados
FROM restaurants
WHERE id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
  AND settings ? 'calendar_schedule';

