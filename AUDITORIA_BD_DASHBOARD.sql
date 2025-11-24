-- =====================================================
-- AUDITORÍA COMPLETA DE BASE DE DATOS
-- Para Dashboard Socio Virtual
-- Fecha: 2025-11-23
-- =====================================================

-- CONSULTA 1: Estructura completa de tabla APPOINTMENTS
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'appointments'
ORDER BY ordinal_position;

-- CONSULTA 2: Estructura completa de tabla EMPLOYEES
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'employees'
ORDER BY ordinal_position;

-- CONSULTA 3: Estructura completa de tabla EMPLOYEE_ABSENCES
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'employee_absences'
ORDER BY ordinal_position;

-- CONSULTA 4: Estructura completa de tabla CUSTOMERS (para no-shows)
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'customers'
ORDER BY ordinal_position;

-- CONSULTA 5: Verificar relaciones entre tablas
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name IN ('appointments', 'employees', 'employee_absences')
ORDER BY tc.table_name;

-- CONSULTA 6: Datos de ejemplo de APPOINTMENTS (últimos 5)
SELECT 
    id,
    business_id,
    customer_name,
    customer_phone,
    appointment_date,
    appointment_time,
    duration_minutes,
    status,
    employee_id,
    resource_id,
    service_name,
    created_at
FROM appointments
ORDER BY created_at DESC
LIMIT 5;

-- CONSULTA 7: Datos de ejemplo de EMPLOYEES (todos activos)
SELECT 
    id,
    business_id,
    name,
    role,
    assigned_resource_id,
    is_active,
    color,
    position_order
FROM employees
WHERE is_active = true
ORDER BY position_order;

-- CONSULTA 8: Datos de ejemplo de EMPLOYEE_ABSENCES (activas hoy o futuras)
SELECT 
    id,
    business_id,
    employee_id,
    start_date,
    end_date,
    reason,
    reason_label,
    approved
FROM employee_absences
WHERE end_date >= CURRENT_DATE
ORDER BY start_date;

-- CONSULTA 9: Verificar NO-SHOWS en appointments
SELECT 
    status,
    COUNT(*) as count
FROM appointments
GROUP BY status
ORDER BY count DESC;

-- CONSULTA 10: Verificar columna no_show_count en customers
SELECT 
    COUNT(*) as total_customers,
    SUM(CASE WHEN no_show_count > 0 THEN 1 ELSE 0 END) as customers_with_noshows,
    AVG(no_show_count) as avg_noshows_per_customer
FROM customers;


