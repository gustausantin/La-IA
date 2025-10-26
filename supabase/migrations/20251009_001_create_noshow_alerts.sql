-- ========================================
-- NOSHOW ALERTS - Sistema de Alarmas para Control de No-Shows
-- Fecha: 09 Octubre 2025
-- Descripción: Tabla para gestionar alarmas activas de no-shows (T-2h 15min)
-- ========================================

-- 1. CREAR TABLA noshow_alerts
CREATE TABLE IF NOT EXISTS noshow_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    
    -- Datos de la reserva (desnormalizados para rendimiento)
    customer_name VARCHAR NOT NULL,
    customer_phone VARCHAR,
    reservation_date DATE NOT NULL,
    reservation_time TIME NOT NULL,
    party_size INT NOT NULL,
    risk_score INT NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
    
    -- Control de alarma
    alert_type VARCHAR NOT NULL DEFAULT 'needs_call' CHECK (alert_type IN ('needs_call', 'auto_release_warning')),
    status VARCHAR NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'expired', 'auto_released')),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    auto_release_at TIMESTAMPTZ NOT NULL, -- Hora de liberación automática (T-2h)
    resolved_at TIMESTAMPTZ,
    resolved_by UUID,
    resolution_notes TEXT,
    resolution_method VARCHAR CHECK (resolution_method IN ('call_successful', 'call_failed', 'manual_confirm', 'auto_released')),
    
    -- Auditoría
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- 2. ÍNDICES para rendimiento
CREATE INDEX idx_noshow_alerts_restaurant_date 
    ON noshow_alerts(restaurant_id, reservation_date) 
    WHERE status = 'active';

CREATE INDEX idx_noshow_alerts_status 
    ON noshow_alerts(status, auto_release_at) 
    WHERE status = 'active';

CREATE INDEX idx_noshow_alerts_reservation 
    ON noshow_alerts(reservation_id);

-- 3. TRIGGER para updated_at
CREATE OR REPLACE FUNCTION update_noshow_alerts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_noshow_alerts_updated_at
    BEFORE UPDATE ON noshow_alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_noshow_alerts_updated_at();

-- 4. RLS (Row Level Security)
ALTER TABLE noshow_alerts ENABLE ROW LEVEL SECURITY;

-- Policy: Permitir SELECT a todos los usuarios autenticados (filtrado por restaurant_id)
CREATE POLICY "Users see all alerts"
    ON noshow_alerts FOR SELECT
    TO authenticated
    USING (true);

-- Policy: Permitir INSERT a todos los usuarios autenticados
CREATE POLICY "Users insert alerts"
    ON noshow_alerts FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Policy: Permitir UPDATE a todos los usuarios autenticados
CREATE POLICY "Users update alerts"
    ON noshow_alerts FOR UPDATE
    TO authenticated
    USING (true);

-- 5. FUNCIÓN HELPER: Crear alarma automática
CREATE OR REPLACE FUNCTION create_noshow_alert(
    p_reservation_id UUID,
    p_minutes_before_release INT DEFAULT 15
)
RETURNS UUID AS $$
DECLARE
    v_alert_id UUID;
    v_reservation RECORD;
    v_auto_release_time TIMESTAMPTZ;
BEGIN
    -- Obtener datos de la reserva
    SELECT 
        r.id,
        r.restaurant_id,
        r.customer_id,
        r.reservation_date,
        r.reservation_time,
        r.party_size,
        c.name as customer_name,
        c.phone as customer_phone,
        COALESCE(na.risk_score, 50) as risk_score
    INTO v_reservation
    FROM reservations r
    LEFT JOIN customers c ON r.customer_id = c.id
    LEFT JOIN noshow_actions na ON na.reservation_id = r.id
    WHERE r.id = p_reservation_id
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reservation not found: %', p_reservation_id;
    END IF;

    -- Calcular hora de auto-liberación (T-2h)
    v_auto_release_time := (v_reservation.reservation_date || ' ' || v_reservation.reservation_time)::TIMESTAMPTZ 
                          - INTERVAL '2 hours';

    -- Crear alarma
    INSERT INTO noshow_alerts (
        reservation_id,
        restaurant_id,
        customer_id,
        customer_name,
        customer_phone,
        reservation_date,
        reservation_time,
        party_size,
        risk_score,
        alert_type,
        status,
        auto_release_at
    ) VALUES (
        p_reservation_id,
        v_reservation.restaurant_id,
        v_reservation.customer_id,
        COALESCE(v_reservation.customer_name, 'Sin nombre'),
        v_reservation.customer_phone,
        v_reservation.reservation_date,
        v_reservation.reservation_time,
        v_reservation.party_size,
        v_reservation.risk_score,
        'needs_call',
        'active',
        v_auto_release_time
    )
    RETURNING id INTO v_alert_id;

    RETURN v_alert_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. FUNCIÓN HELPER: Resolver alarma
CREATE OR REPLACE FUNCTION resolve_noshow_alert(
    p_alert_id UUID,
    p_resolution_method VARCHAR,
    p_resolution_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE noshow_alerts
    SET 
        status = 'resolved',
        resolved_at = timezone('utc', now()),
        resolved_by = auth.uid(),
        resolution_method = p_resolution_method,
        resolution_notes = p_resolution_notes
    WHERE id = p_alert_id
    AND status = 'active';

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. FUNCIÓN HELPER: Auto-liberar reservas vencidas
CREATE OR REPLACE FUNCTION auto_release_expired_alerts()
RETURNS TABLE(released_count INT, released_reservations UUID[]) AS $$
DECLARE
    v_released_ids UUID[];
    v_count INT;
BEGIN
    -- Actualizar alarmas vencidas
    UPDATE noshow_alerts
    SET 
        status = 'auto_released',
        resolved_at = timezone('utc', now()),
        resolution_method = 'auto_released'
    WHERE status = 'active'
    AND auto_release_at <= timezone('utc', now())
    RETURNING reservation_id INTO v_released_ids;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- Actualizar estado de reservas
    IF v_count > 0 THEN
        UPDATE reservations
        SET status = 'cancelled_noshow'
        WHERE id = ANY(v_released_ids);
    END IF;

    RETURN QUERY SELECT v_count, v_released_ids;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. COMENTARIOS
COMMENT ON TABLE noshow_alerts IS 'Alarmas activas para control de no-shows (T-2h 15min)';
COMMENT ON COLUMN noshow_alerts.alert_type IS 'needs_call: Requiere llamada del personal | auto_release_warning: Advertencia próxima liberación';
COMMENT ON COLUMN noshow_alerts.status IS 'active: Activa | resolved: Resuelta | expired: Expirada | auto_released: Liberada automáticamente';
COMMENT ON COLUMN noshow_alerts.auto_release_at IS 'Timestamp de liberación automática (T-2h)';
COMMENT ON FUNCTION create_noshow_alert IS 'Crea una alarma automática para una reserva en riesgo';
COMMENT ON FUNCTION resolve_noshow_alert IS 'Marca una alarma como resuelta después de llamada/confirmación';
COMMENT ON FUNCTION auto_release_expired_alerts IS 'Libera automáticamente reservas con alarmas vencidas (ejecutar cada minuto desde N8n)';

-- ========================================
-- FIN DE MIGRACIÓN
-- ========================================

