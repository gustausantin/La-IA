-- =====================================================
-- MIGRACIÓN: Sistema de Bloqueos por Recurso Individual
-- Fecha: 2025-11-08
-- Propósito: Permitir bloquear sillones/camillas individuales
-- =====================================================

-- =====================================================
-- TABLA: resource_blockages
-- =====================================================
-- Permite bloquear un recurso específico (Sillón 1, Camilla A, etc.)
-- sin afectar a los demás recursos del negocio
-- =====================================================

CREATE TABLE IF NOT EXISTS resource_blockages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    
    -- Fecha y horario del bloqueo
    blocked_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    
    -- Información adicional
    reason TEXT, -- "Médico", "Descanso", "Mantenimiento"
    
    -- Auditoría
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Constraint: start_time debe ser antes de end_time
    CONSTRAINT valid_time_range CHECK (start_time < end_time)
);

-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================

-- Búsqueda por recurso y fecha (query más común)
CREATE INDEX idx_resource_blockages_resource_date 
ON resource_blockages(resource_id, blocked_date);

-- Búsqueda por negocio
CREATE INDEX idx_resource_blockages_business 
ON resource_blockages(business_id, blocked_date);

-- Búsqueda por rango de fechas
CREATE INDEX idx_resource_blockages_date_range 
ON resource_blockages(blocked_date);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE resource_blockages ENABLE ROW LEVEL SECURITY;

-- Policy: Los usuarios solo pueden ver bloqueos de sus negocios
CREATE POLICY "Users can view their business resource blockages"
ON resource_blockages
FOR SELECT
USING (
    business_id IN (
        SELECT business_id 
        FROM user_business_mapping 
        WHERE auth_user_id = auth.uid() AND active = true
    )
);

-- Policy: Los usuarios pueden crear bloqueos en sus negocios
CREATE POLICY "Users can create resource blockages"
ON resource_blockages
FOR INSERT
WITH CHECK (
    business_id IN (
        SELECT business_id 
        FROM user_business_mapping 
        WHERE auth_user_id = auth.uid() AND active = true
    )
);

-- Policy: Los usuarios pueden actualizar bloqueos de sus negocios
CREATE POLICY "Users can update their business resource blockages"
ON resource_blockages
FOR UPDATE
USING (
    business_id IN (
        SELECT business_id 
        FROM user_business_mapping 
        WHERE auth_user_id = auth.uid() AND active = true
    )
);

-- Policy: Los usuarios pueden eliminar bloqueos de sus negocios
CREATE POLICY "Users can delete their business resource blockages"
ON resource_blockages
FOR DELETE
USING (
    business_id IN (
        SELECT business_id 
        FROM user_business_mapping 
        WHERE auth_user_id = auth.uid() AND active = true
    )
);

-- =====================================================
-- FUNCIÓN: Validar bloqueos antes de crear
-- =====================================================
-- Verifica que no haya citas confirmadas en el rango

CREATE OR REPLACE FUNCTION validate_resource_blockage()
RETURNS TRIGGER AS $$
DECLARE
    conflicting_count INTEGER;
BEGIN
    -- Contar citas confirmadas en el mismo recurso, fecha y rango horario
    SELECT COUNT(*)
    INTO conflicting_count
    FROM appointments
    WHERE resource_id = NEW.resource_id
      AND appointment_date = NEW.blocked_date
      AND status IN ('confirmed', 'pending')
      AND (
          -- La cita empieza durante el bloqueo
          (appointment_time >= NEW.start_time AND appointment_time < NEW.end_time)
          OR
          -- La cita termina durante el bloqueo
          (end_time > NEW.start_time AND end_time <= NEW.end_time)
      );
    
    -- Si hay conflictos, rechazar el bloqueo
    IF conflicting_count > 0 THEN
        RAISE EXCEPTION 'No se puede bloquear: hay % cita(s) confirmada(s) en este horario', conflicting_count
            USING HINT = 'Cancela las citas manualmente primero';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Validar antes de insertar
CREATE TRIGGER validate_blockage_before_insert
    BEFORE INSERT ON resource_blockages
    FOR EACH ROW
    EXECUTE FUNCTION validate_resource_blockage();

-- =====================================================
-- FUNCIÓN: Trigger para regenerar slots automáticamente
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_slot_regeneration_on_blockage()
RETURNS TRIGGER AS $$
BEGIN
    -- Insertar notificación para regenerar slots
    INSERT INTO notifications (
        business_id,
        user_id,
        title,
        message,
        type,
        priority,
        metadata
    ) VALUES (
        NEW.business_id,
        NEW.created_by,
        'Regeneración de slots requerida',
        'Se ha creado/modificado un bloqueo de recurso',
        'system',
        'high',
        jsonb_build_object(
            'trigger', 'resource_blockage',
            'resource_id', NEW.resource_id,
            'blocked_date', NEW.blocked_date,
            'action', TG_OP
        )
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Después de insertar/actualizar/eliminar bloqueo
CREATE TRIGGER notify_slot_regeneration_after_blockage
    AFTER INSERT OR UPDATE OR DELETE ON resource_blockages
    FOR EACH ROW
    EXECUTE FUNCTION trigger_slot_regeneration_on_blockage();

-- =====================================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- =====================================================

COMMENT ON TABLE resource_blockages IS 
'Bloqueos de recursos individuales (ej: Sillón 1 cerrado por médico). 
Para cerrar TODO el negocio usar calendar_exceptions.';

COMMENT ON COLUMN resource_blockages.resource_id IS 
'Recurso específico bloqueado. NOT NULL porque siempre es un recurso individual.';

COMMENT ON COLUMN resource_blockages.reason IS 
'Motivo del bloqueo: Médico, Descanso, Mantenimiento, etc.';

-- =====================================================
-- DATOS DE PRUEBA (OPCIONAL - Comentar en producción)
-- =====================================================

-- Insertar bloqueo de ejemplo (comentar si no es necesario)
-- INSERT INTO resource_blockages (business_id, resource_id, blocked_date, start_time, end_time, reason)
-- SELECT 
--     b.id,
--     r.id,
--     CURRENT_DATE + INTERVAL '7 days',
--     '11:00:00',
--     '13:00:00',
--     'Prueba de bloqueo'
-- FROM businesses b
-- CROSS JOIN resources r
-- WHERE b.vertical_type = 'peluqueria_barberia'
-- LIMIT 1;



