-- =====================================================
-- SISTEMA DE LISTA DE ESPERA (WAITLIST)
-- Fecha: 8 de Noviembre 2025
-- Funcionalidad: Lista de espera cuando el calendario está lleno
-- =====================================================

-- 📋 Tabla: waitlist
-- Almacena clientes en lista de espera para un servicio/fecha/hora específicos
CREATE TABLE IF NOT EXISTS waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    
    -- Información del cliente (si no está registrado)
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT,
    
    -- Servicio solicitado
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    service_name TEXT NOT NULL,
    
    -- Fecha/hora preferida
    preferred_date DATE NOT NULL,
    preferred_time TIME,
    flexible_time BOOLEAN DEFAULT true, -- ¿Acepta otras horas?
    
    -- Recurso preferido (opcional)
    preferred_resource_id UUID REFERENCES resources(id) ON DELETE SET NULL,
    
    -- Estado de la lista de espera
    status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'contacted', 'converted', 'cancelled', 'expired')),
    
    -- Prioridad (1 = más alta, 5 = más baja)
    priority INTEGER DEFAULT 3 CHECK (priority >= 1 AND priority <= 5),
    
    -- Notas
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    contacted_at TIMESTAMPTZ, -- Cuándo se le notificó que hay disponibilidad
    converted_at TIMESTAMPTZ, -- Cuándo se convirtió en reserva
    expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days'), -- Expira en 7 días por defecto
    
    -- Metadatos
    source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'ia_agent', 'website', 'app')),
    created_by UUID REFERENCES auth.users(id)
);

-- Índices para búsquedas eficientes
CREATE INDEX idx_waitlist_business ON waitlist(business_id);
CREATE INDEX idx_waitlist_customer ON waitlist(customer_id);
CREATE INDEX idx_waitlist_status ON waitlist(status);
CREATE INDEX idx_waitlist_date ON waitlist(preferred_date);
CREATE INDEX idx_waitlist_created ON waitlist(created_at DESC);

-- Índice compuesto para consultas comunes
CREATE INDEX idx_waitlist_active ON waitlist(business_id, status, preferred_date) 
WHERE status = 'waiting';

-- =====================================================
-- FUNCIÓN: Notificar a lista de espera cuando se libera un slot
-- =====================================================
CREATE OR REPLACE FUNCTION notify_waitlist_on_cancellation()
RETURNS TRIGGER AS $$
DECLARE
    v_waiting_count INTEGER;
    v_waitlist_record RECORD;
BEGIN
    -- Solo procesar si la reserva fue cancelada o marcada como no-show
    IF (TG_OP = 'UPDATE' AND 
        OLD.status IN ('confirmed', 'pending') AND 
        NEW.status IN ('cancelled', 'no_show')) THEN
        
        -- Buscar clientes en lista de espera para este día/servicio
        FOR v_waitlist_record IN
            SELECT w.*
            FROM waitlist w
            WHERE w.business_id = NEW.business_id
              AND w.status = 'waiting'
              AND w.preferred_date = NEW.appointment_date
              AND (w.service_id = NEW.service_id OR w.flexible_time = true)
              AND (w.preferred_resource_id IS NULL OR w.preferred_resource_id = NEW.resource_id)
            ORDER BY w.priority ASC, w.created_at ASC
            LIMIT 5
        LOOP
            -- Marcar como "contactado"
            UPDATE waitlist
            SET status = 'contacted',
                contacted_at = now()
            WHERE id = v_waitlist_record.id;
            
            -- AQUÍ SE PODRÍA INTEGRAR CON N8N PARA ENVIAR NOTIFICACIÓN
            -- Por ahora solo marcamos el registro
            
            RAISE NOTICE 'Notificando a cliente en lista de espera: % (ID: %)', 
                v_waitlist_record.customer_name, v_waitlist_record.id;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Ejecutar función cuando se cancela una reserva
DROP TRIGGER IF EXISTS trg_notify_waitlist ON appointments;
CREATE TRIGGER trg_notify_waitlist
    AFTER UPDATE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION notify_waitlist_on_cancellation();

-- =====================================================
-- FUNCIÓN: Limpiar registros expirados de waitlist
-- =====================================================
CREATE OR REPLACE FUNCTION cleanup_expired_waitlist()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    -- Marcar como expirados los registros que pasaron su fecha
    UPDATE waitlist
    SET status = 'expired'
    WHERE status = 'waiting'
      AND expires_at < now();
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- RLS (Row Level Security)
-- =====================================================
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Policy: Los usuarios solo ven su propia waitlist
CREATE POLICY waitlist_business_isolation ON waitlist
    USING (business_id IN (
        SELECT business_id FROM user_business_mapping WHERE auth_user_id = auth.uid()
    ));

-- Policy: Permitir INSERT
CREATE POLICY waitlist_insert ON waitlist
    FOR INSERT
    WITH CHECK (business_id IN (
        SELECT business_id FROM user_business_mapping WHERE auth_user_id = auth.uid()
    ));

-- Policy: Permitir UPDATE
CREATE POLICY waitlist_update ON waitlist
    FOR UPDATE
    USING (business_id IN (
        SELECT business_id FROM user_business_mapping WHERE auth_user_id = auth.uid()
    ));

-- Policy: Permitir DELETE
CREATE POLICY waitlist_delete ON waitlist
    FOR DELETE
    USING (business_id IN (
        SELECT business_id FROM user_business_mapping WHERE auth_user_id = auth.uid()
    ));

-- =====================================================
-- VISTA: Resumen de lista de espera activa
-- =====================================================
CREATE OR REPLACE VIEW waitlist_summary AS
SELECT 
    w.business_id,
    w.preferred_date,
    s.name AS service_name,
    COUNT(*) AS waiting_count,
    MIN(w.created_at) AS oldest_request,
    AVG(w.priority) AS avg_priority
FROM waitlist w
LEFT JOIN services s ON w.service_id = s.id
WHERE w.status = 'waiting'
  AND w.expires_at > now()
GROUP BY w.business_id, w.preferred_date, s.name
ORDER BY w.preferred_date ASC, waiting_count DESC;

-- =====================================================
-- COMENTARIOS
-- =====================================================
COMMENT ON TABLE waitlist IS 'Lista de espera para clientes cuando el calendario está lleno';
COMMENT ON COLUMN waitlist.priority IS '1 = VIP/urgente, 3 = normal, 5 = baja prioridad';
COMMENT ON COLUMN waitlist.flexible_time IS 'Si el cliente acepta otras horas del mismo día';
COMMENT ON FUNCTION notify_waitlist_on_cancellation() IS 'Notifica automáticamente a clientes en lista de espera cuando se cancela una cita';
COMMENT ON FUNCTION cleanup_expired_waitlist() IS 'Marca como expirados los registros viejos de waitlist';

-- =====================================================
-- DATOS DE EJEMPLO (Solo para desarrollo)
-- =====================================================
-- Descomentar para crear registros de prueba
-- INSERT INTO waitlist (business_id, customer_name, customer_phone, service_name, preferred_date, priority)
-- VALUES 
--     ('tu-business-id', 'Cliente VIP', '+34600000001', 'Corte de pelo', CURRENT_DATE + 1, 1),
--     ('tu-business-id', 'Cliente Normal', '+34600000002', 'Tinte', CURRENT_DATE + 1, 3);

