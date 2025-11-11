-- =====================================================
-- MIGRACIÓN: SISTEMA DE EMPLEADOS Y CALENDARIO DINÁMICO
-- Fecha: 2025-11-09
-- Objetivo: Gestión de empleados con horarios individuales, ausencias y bloqueos
-- Arquitectura: 1 Empleado = 1 Columna en el calendario
-- =====================================================

-- =====================================================
-- TABLA 1: employees (EMPLEADOS)
-- =====================================================
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    
    -- Datos personales
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    role VARCHAR(50) DEFAULT 'staff', -- 'owner', 'manager', 'staff', 'freelance'
    
    -- Asignación de recurso físico (silla, mesa, camilla, box)
    assigned_resource_id UUID REFERENCES resources(id),
    
    -- Configuración visual
    color VARCHAR(7) DEFAULT '#6366f1', -- Color en calendario
    avatar_url TEXT,
    position_order INTEGER DEFAULT 0, -- Orden de izquierda a derecha en calendario
    
    -- Estado
    is_active BOOLEAN DEFAULT true,
    is_owner BOOLEAN DEFAULT false,
    
    -- Metadatos
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Constraints
    CONSTRAINT unique_email_per_business UNIQUE(business_id, email)
);

-- Índices
CREATE INDEX idx_employees_business ON employees(business_id);
CREATE INDEX idx_employees_resource ON employees(assigned_resource_id);
CREATE INDEX idx_employees_active ON employees(is_active);
CREATE INDEX idx_employees_order ON employees(position_order);

-- RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees are viewable by business members"
    ON employees FOR SELECT
    USING (
        business_id IN (
            SELECT business_id 
            FROM user_business_mapping 
            WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Employees are insertable by business owners"
    ON employees FOR INSERT
    WITH CHECK (
        business_id IN (
            SELECT business_id 
            FROM user_business_mapping 
            WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Employees are updatable by business members"
    ON employees FOR UPDATE
    USING (
        business_id IN (
            SELECT business_id 
            FROM user_business_mapping 
            WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Employees are deletable by business owners"
    ON employees FOR DELETE
    USING (
        business_id IN (
            SELECT business_id 
            FROM user_business_mapping 
            WHERE auth_user_id = auth.uid()
        )
    );

-- =====================================================
-- TABLA 2: employee_schedules (HORARIOS BASE)
-- =====================================================
-- Horarios recurrentes por día de la semana (Lun-Dom)
-- Cada empleado tiene 7 filas (una por día de la semana)
-- =====================================================

CREATE TABLE IF NOT EXISTS employee_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    
    -- Día de la semana (0=domingo, 1=lunes, ..., 6=sábado)
    -- Compatible con JavaScript: new Date().getDay()
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    
    -- Horario del día
    is_working BOOLEAN DEFAULT true,
    start_time TIME,
    end_time TIME,
    
    -- Descansos dentro del turno (JSONB array)
    -- Ejemplo: [{ "start": "11:00", "end": "11:15", "reason": "Café" }, { "start": "14:00", "end": "15:00", "reason": "Comida" }]
    breaks JSONB DEFAULT '[]'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Un empleado solo puede tener un horario por día de la semana
    CONSTRAINT unique_employee_day UNIQUE(employee_id, day_of_week)
);

-- Índices
CREATE INDEX idx_employee_schedules_business ON employee_schedules(business_id);
CREATE INDEX idx_employee_schedules_employee ON employee_schedules(employee_id);
CREATE INDEX idx_employee_schedules_day ON employee_schedules(day_of_week);

-- RLS
ALTER TABLE employee_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Schedules are viewable by business members"
    ON employee_schedules FOR SELECT
    USING (
        business_id IN (
            SELECT business_id 
            FROM user_business_mapping 
            WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Schedules are manageable by business members"
    ON employee_schedules FOR ALL
    USING (
        business_id IN (
            SELECT business_id 
            FROM user_business_mapping 
            WHERE auth_user_id = auth.uid()
        )
    );

-- =====================================================
-- TABLA 3: employee_absences (AUSENCIAS)
-- =====================================================
-- Ausencias individuales: vacaciones, médico, baja, etc.
-- El empleado NO está en el negocio
-- =====================================================

CREATE TABLE IF NOT EXISTS employee_absences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    
    -- Fechas
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    all_day BOOLEAN DEFAULT true,
    start_time TIME, -- Solo si all_day = false
    end_time TIME,   -- Solo si all_day = false
    
    -- Motivo
    reason VARCHAR(50) NOT NULL, -- 'vacation', 'medical', 'sick_leave', 'personal', 'other'
    reason_label VARCHAR(100), -- "Vacaciones en la playa", "Cita médico", etc.
    notes TEXT,
    
    -- Aprobación
    approved BOOLEAN DEFAULT false,
    approved_by UUID REFERENCES employees(id),
    approved_at TIMESTAMPTZ,
    
    -- Recurrencia (ej: todos los lunes por la tarde)
    is_recurring BOOLEAN DEFAULT false,
    recurrence_pattern JSONB, -- { type: 'weekly', days: [1,3,5], end_date: '2025-12-31' }
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_employee_absences_business ON employee_absences(business_id);
CREATE INDEX idx_employee_absences_employee ON employee_absences(employee_id);
CREATE INDEX idx_employee_absences_dates ON employee_absences(start_date, end_date);
CREATE INDEX idx_employee_absences_recurring ON employee_absences(is_recurring);

-- RLS
ALTER TABLE employee_absences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Absences are viewable by business members"
    ON employee_absences FOR SELECT
    USING (
        business_id IN (
            SELECT business_id 
            FROM user_business_mapping 
            WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Absences are manageable by business members"
    ON employee_absences FOR ALL
    USING (
        business_id IN (
            SELECT business_id 
            FROM user_business_mapping 
            WHERE auth_user_id = auth.uid()
        )
    );

-- =====================================================
-- TABLA 4: employee_blocks (BLOQUEOS/FALTA DE DISPONIBILIDAD)
-- =====================================================
-- Bloqueos temporales: comida, reunión, limpieza, etc.
-- El empleado SÍ está pero NO puede atender clientes
-- =====================================================

CREATE TABLE IF NOT EXISTS employee_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    
    -- Fecha y hora específica
    block_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    
    -- Motivo
    reason VARCHAR(100), -- "Comida", "Reunión", "Limpieza sala", "Descanso", etc.
    color VARCHAR(7) DEFAULT '#94a3b8', -- Gris por defecto
    
    -- Recurrencia (ej: comida todos los días 14:00-15:00)
    is_recurring BOOLEAN DEFAULT false,
    recurrence_pattern JSONB, -- { type: 'daily', days: [1,2,3,4,5], end_date: '2025-12-31' }
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_employee_blocks_business ON employee_blocks(business_id);
CREATE INDEX idx_employee_blocks_employee ON employee_blocks(employee_id);
CREATE INDEX idx_employee_blocks_date ON employee_blocks(block_date);
CREATE INDEX idx_employee_blocks_recurring ON employee_blocks(is_recurring);

-- RLS
ALTER TABLE employee_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Blocks are viewable by business members"
    ON employee_blocks FOR SELECT
    USING (
        business_id IN (
            SELECT business_id 
            FROM user_business_mapping 
            WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Blocks are manageable by business members"
    ON employee_blocks FOR ALL
    USING (
        business_id IN (
            SELECT business_id 
            FROM user_business_mapping 
            WHERE auth_user_id = auth.uid()
        )
    );

-- =====================================================
-- FUNCIONES HELPER
-- =====================================================

-- Función: Crear horario por defecto para un empleado
-- Copia el horario del propietario o usa un horario estándar
-- =====================================================
CREATE OR REPLACE FUNCTION create_default_schedule_for_employee(
    p_employee_id UUID,
    p_business_id UUID
) RETURNS VOID AS $$
DECLARE
    v_day INTEGER;
BEGIN
    -- Crear 7 días de la semana (0-6)
    FOR v_day IN 0..6 LOOP
        INSERT INTO employee_schedules (
            business_id,
            employee_id,
            day_of_week,
            is_working,
            start_time,
            end_time,
            breaks
        ) VALUES (
            p_business_id,
            p_employee_id,
            v_day,
            CASE WHEN v_day IN (1,2,3,4,5) THEN true ELSE false END, -- Lun-Vie trabajando, Sáb-Dom no
            CASE WHEN v_day IN (1,2,3,4,5) THEN '09:00'::TIME ELSE NULL END,
            CASE WHEN v_day IN (1,2,3,4,5) THEN '18:00'::TIME ELSE NULL END,
            '[]'::jsonb
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGER: Auto-crear horario al crear empleado
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_create_employee_schedule()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM create_default_schedule_for_employee(NEW.id, NEW.business_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_employee_insert_create_schedule
    AFTER INSERT ON employees
    FOR EACH ROW
    EXECUTE FUNCTION trigger_create_employee_schedule();

-- =====================================================
-- FUNCIÓN RPC: Obtener disponibilidad de empleado en fecha específica
-- =====================================================
CREATE OR REPLACE FUNCTION get_employee_availability(
    p_employee_id UUID,
    p_date DATE
) RETURNS TABLE (
    is_available BOOLEAN,
    working_hours JSONB, -- { start: "09:00", end: "18:00" }
    blocks JSONB,        -- [{ start: "11:00", end: "11:15", reason: "Café" }]
    absences JSONB       -- [{ start_date: "2025-11-09", end_date: "2025-11-09", reason: "Médico" }]
) AS $$
DECLARE
    v_day_of_week INTEGER;
    v_schedule RECORD;
    v_has_absence BOOLEAN;
BEGIN
    -- Obtener día de la semana (0=domingo, 6=sábado)
    v_day_of_week := EXTRACT(DOW FROM p_date);
    
    -- Obtener horario base del día
    SELECT * INTO v_schedule
    FROM employee_schedules
    WHERE employee_id = p_employee_id
    AND day_of_week = v_day_of_week;
    
    -- Verificar si tiene ausencia ese día
    SELECT EXISTS (
        SELECT 1
        FROM employee_absences
        WHERE employee_id = p_employee_id
        AND start_date <= p_date
        AND end_date >= p_date
    ) INTO v_has_absence;
    
    -- Si tiene ausencia, no está disponible
    IF v_has_absence THEN
        RETURN QUERY SELECT 
            false AS is_available,
            NULL::JSONB AS working_hours,
            NULL::JSONB AS blocks,
            (SELECT jsonb_agg(jsonb_build_object(
                'start_date', start_date,
                'end_date', end_date,
                'reason', reason,
                'reason_label', reason_label
            ))
            FROM employee_absences
            WHERE employee_id = p_employee_id
            AND start_date <= p_date
            AND end_date >= p_date) AS absences;
        RETURN;
    END IF;
    
    -- Si no trabaja ese día
    IF NOT v_schedule.is_working THEN
        RETURN QUERY SELECT 
            false AS is_available,
            NULL::JSONB AS working_hours,
            NULL::JSONB AS blocks,
            NULL::JSONB AS absences;
        RETURN;
    END IF;
    
    -- Empleado disponible: devolver horario y bloqueos
    RETURN QUERY SELECT 
        true AS is_available,
        jsonb_build_object(
            'start', v_schedule.start_time,
            'end', v_schedule.end_time
        ) AS working_hours,
        (SELECT jsonb_agg(jsonb_build_object(
            'start_time', start_time,
            'end_time', end_time,
            'reason', reason
        ))
        FROM employee_blocks
        WHERE employee_id = p_employee_id
        AND block_date = p_date) AS blocks,
        NULL::JSONB AS absences;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCIÓN RPC: Obtener todos los empleados activos con su disponibilidad
-- =====================================================
CREATE OR REPLACE FUNCTION get_employees_for_calendar(
    p_business_id UUID,
    p_date DATE
) RETURNS TABLE (
    employee_id UUID,
    employee_name VARCHAR,
    employee_color VARCHAR,
    position_order INTEGER,
    is_available BOOLEAN,
    working_hours JSONB,
    blocks JSONB,
    absences JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id AS employee_id,
        e.name AS employee_name,
        e.color AS employee_color,
        e.position_order,
        (get_employee_availability(e.id, p_date)).is_available,
        (get_employee_availability(e.id, p_date)).working_hours,
        (get_employee_availability(e.id, p_date)).blocks,
        (get_employee_availability(e.id, p_date)).absences
    FROM employees e
    WHERE e.business_id = p_business_id
    AND e.is_active = true
    ORDER BY e.position_order ASC, e.name ASC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGER: Updated_at automático
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_employees_updated_at
    BEFORE UPDATE ON employees
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employee_schedules_updated_at
    BEFORE UPDATE ON employee_schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employee_absences_updated_at
    BEFORE UPDATE ON employee_absences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employee_blocks_updated_at
    BEFORE UPDATE ON employee_blocks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SEED DATA: Crear empleado propietario por defecto
-- =====================================================
-- Para cada negocio existente sin empleados, crear un empleado "Propietario"
-- usando el nombre del negocio o el email del owner
-- =====================================================

DO $$
DECLARE
    v_business RECORD;
    v_owner_name VARCHAR;
    v_employee_id UUID;
BEGIN
    FOR v_business IN 
        SELECT b.id, b.name, b.owner_id, u.email
        FROM businesses b
        LEFT JOIN auth.users u ON b.owner_id = u.id
        WHERE NOT EXISTS (
            SELECT 1 FROM employees e WHERE e.business_id = b.id
        )
    LOOP
        -- Determinar nombre del propietario (del email o del nombre del negocio)
        v_owner_name := COALESCE(
            SPLIT_PART(v_business.email, '@', 1),
            v_business.name || ' (Propietario)',
            'Propietario'
        );
        
        -- Crear empleado propietario
        INSERT INTO employees (
            business_id,
            name,
            email,
            role,
            is_owner,
            is_active,
            position_order,
            color
        ) VALUES (
            v_business.id,
            v_owner_name,
            v_business.email,
            'owner',
            true,
            true,
            0,
            '#6366f1' -- Índigo
        ) RETURNING id INTO v_employee_id;
        
        -- El trigger ya creará el horario por defecto
        RAISE NOTICE 'Empleado propietario creado para negocio %: % (ID: %)', 
            v_business.name, v_owner_name, v_employee_id;
    END LOOP;
END $$;

-- =====================================================
-- COMENTARIOS EN TABLAS
-- =====================================================
COMMENT ON TABLE employees IS 'Empleados/Profesionales del negocio. 1 empleado = 1 columna en el calendario';
COMMENT ON TABLE employee_schedules IS 'Horarios base por día de la semana (Lun-Dom) para cada empleado';
COMMENT ON TABLE employee_absences IS 'Ausencias individuales (vacaciones, médico, baja). El empleado NO está.';
COMMENT ON TABLE employee_blocks IS 'Bloqueos temporales (comida, reunión). El empleado SÍ está pero NO puede atender.';

COMMENT ON COLUMN employees.assigned_resource_id IS 'Recurso físico asignado (silla, mesa, camilla). NULL si no aplica.';
COMMENT ON COLUMN employees.position_order IS 'Orden de izquierda a derecha en el calendario (0=primero)';
COMMENT ON COLUMN employee_schedules.day_of_week IS '0=domingo, 1=lunes, 2=martes, 3=miércoles, 4=jueves, 5=viernes, 6=sábado';
COMMENT ON COLUMN employee_schedules.breaks IS 'Array JSON de descansos: [{"start":"11:00","end":"11:15","reason":"Café"}]';
COMMENT ON COLUMN employee_absences.reason IS 'Tipo de ausencia: vacation, medical, sick_leave, personal, other';
COMMENT ON COLUMN employee_blocks.reason IS 'Motivo del bloqueo: Comida, Reunión, Limpieza, etc.';



