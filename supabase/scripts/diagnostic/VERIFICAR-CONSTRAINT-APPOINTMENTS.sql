-- =====================================================
-- SCRIPT DE VERIFICACIÓN: Constraint en appointments
-- =====================================================

-- 1. Verificar si la constraint existe
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'appointments'::regclass
  AND conname = 'check_employee_id_with_resource';

-- 2. Verificar appointments que violan la regla (deberían ser 0 si la constraint funciona)
SELECT 
    id,
    resource_id,
    employee_id,
    status,
    customer_name,
    appointment_date
FROM appointments
WHERE resource_id IS NOT NULL
  AND employee_id IS NULL
  AND status NOT IN ('cancelled', 'completed', 'no_show');

-- 3. Verificar el recurso problemático
SELECT 
    r.id,
    r.name,
    r.business_id,
    COUNT(e.id) as employees_assigned
FROM resources r
LEFT JOIN employees e ON e.assigned_resource_id = r.id AND e.is_active = true
WHERE r.id = 'd77d3557-b166-4052-a2b8-98feeb619e51'
GROUP BY r.id, r.name, r.business_id;

-- 4. Verificar empleados que tienen este recurso asignado
SELECT 
    id,
    name,
    assigned_resource_id,
    is_active
FROM employees
WHERE assigned_resource_id = 'd77d3557-b166-4052-a2b8-98feeb619e51'
  AND business_id = '3bbe9ac3-3e61-471e-822e-e159f6ad8ae2';

