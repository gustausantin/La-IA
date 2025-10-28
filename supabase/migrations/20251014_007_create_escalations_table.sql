-- Migración para crear la tabla escalations
-- Registra todos los casos donde el agente escala a un humano

CREATE TABLE IF NOT EXISTS escalations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    customer_phone VARCHAR NOT NULL,
    customer_name VARCHAR,
    customer_message TEXT,
    reason VARCHAR NOT NULL CHECK (reason IN (
        'cliente_solicita',
        'situacion_compleja',
        'queja_grave',
        'informacion_no_disponible',
        'error_sistema'
    )),
    urgency VARCHAR NOT NULL CHECK (urgency IN ('high', 'medium', 'low')) DEFAULT 'medium',
    status VARCHAR NOT NULL CHECK (status IN ('pending', 'contacted', 'resolved', 'ignored')) DEFAULT 'pending',
    escalated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    contacted_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_escalations_restaurant_id ON escalations(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_escalations_customer_phone ON escalations(customer_phone);
CREATE INDEX IF NOT EXISTS idx_escalations_status ON escalations(status);
CREATE INDEX IF NOT EXISTS idx_escalations_urgency ON escalations(urgency);
CREATE INDEX IF NOT EXISTS idx_escalations_escalated_at ON escalations(escalated_at);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_escalations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_escalations_updated_at_trigger
BEFORE UPDATE ON escalations
FOR EACH ROW
EXECUTE FUNCTION update_escalations_updated_at();

-- Comentarios
COMMENT ON TABLE escalations IS 'Registro de casos escalados del agente IA a humanos';
COMMENT ON COLUMN escalations.reason IS 'Razón del escalado: cliente_solicita, situacion_compleja, queja_grave, etc.';
COMMENT ON COLUMN escalations.urgency IS 'Nivel de urgencia: high, medium, low';
COMMENT ON COLUMN escalations.status IS 'Estado del escalado: pending, contacted, resolved, ignored';

