-- ====================================
-- TABLA TICKETS DE FACTURACIÓN 
-- Para vincular reservas ↔ consumo real
-- ====================================

-- 1. Crear tabla de tickets de facturación
CREATE TABLE IF NOT EXISTS billing_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    
    -- Referencias a sistema de reservas
    reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
    table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    
    -- Datos del ticket
    ticket_number VARCHAR(100) NOT NULL, -- Número de ticket del sistema de caja
    external_ticket_id VARCHAR(255), -- ID del ticket en el software de caja externo
    
    -- Fechas y horarios
    ticket_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    service_start TIMESTAMP WITH TIME ZONE,
    service_end TIMESTAMP WITH TIME ZONE,
    
    -- Productos y precios
    items JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array de productos: [{name, quantity, unit_price, total_price, category}]
    
    -- Totales financieros
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    
    -- Información adicional
    payment_method VARCHAR(50), -- efectivo, tarjeta, transferencia, etc.
    tip_amount DECIMAL(10,2) DEFAULT 0,
    covers_count INTEGER DEFAULT 1, -- número de comensales
    
    -- Metadatos del ticket
    waiter_name VARCHAR(255),
    kitchen_notes TEXT,
    special_requests TEXT,
    
    -- Sistema de origen
    source_system VARCHAR(100), -- 'manual', 'tpv_sistema', 'api_integration', etc.
    source_data JSONB, -- Datos raw del sistema origen para debugging
    
    -- Estados de procesamiento
    is_processed BOOLEAN DEFAULT FALSE,
    processing_errors TEXT,
    
    -- Campos de auditoría
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_totals CHECK (
        subtotal >= 0 AND 
        tax_amount >= 0 AND 
        discount_amount >= 0 AND 
        total_amount >= 0 AND
        total_amount = subtotal + tax_amount - discount_amount
    ),
    CONSTRAINT valid_dates CHECK (
        ticket_date IS NOT NULL AND
        (service_end IS NULL OR service_start IS NULL OR service_end >= service_start)
    )
);

-- 2. Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_billing_tickets_restaurant_id ON billing_tickets(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_billing_tickets_customer_id ON billing_tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_billing_tickets_reservation_id ON billing_tickets(reservation_id);
CREATE INDEX IF NOT EXISTS idx_billing_tickets_table_id ON billing_tickets(table_id);
CREATE INDEX IF NOT EXISTS idx_billing_tickets_date ON billing_tickets(ticket_date);
CREATE INDEX IF NOT EXISTS idx_billing_tickets_ticket_number ON billing_tickets(restaurant_id, ticket_number);

-- Índice compuesto para analytics por cliente
CREATE INDEX IF NOT EXISTS idx_billing_tickets_customer_analytics 
ON billing_tickets(customer_id, ticket_date) 
WHERE customer_id IS NOT NULL;

-- 3. RLS (Row Level Security)
ALTER TABLE billing_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tickets from their restaurant" ON billing_tickets
FOR SELECT USING (
    restaurant_id IN (
        SELECT r.id FROM restaurants r 
        WHERE r.owner_id = auth.uid()
    )
);

CREATE POLICY "Users can insert tickets to their restaurant" ON billing_tickets
FOR INSERT WITH CHECK (
    restaurant_id IN (
        SELECT r.id FROM restaurants r 
        WHERE r.owner_id = auth.uid()
    )
);

CREATE POLICY "Users can update tickets from their restaurant" ON billing_tickets
FOR UPDATE USING (
    restaurant_id IN (
        SELECT r.id FROM restaurants r 
        WHERE r.owner_id = auth.uid()
    )
);

-- 4. Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_billing_tickets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_billing_tickets_updated_at
    BEFORE UPDATE ON billing_tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_billing_tickets_updated_at();

-- 5. Función para actualizar stats de cliente automáticamente
CREATE OR REPLACE FUNCTION update_customer_stats_from_ticket()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo procesar si hay customer_id y el ticket está procesado
    IF NEW.customer_id IS NOT NULL AND NEW.is_processed = TRUE THEN
        
        -- Actualizar total gastado y número de visitas
        UPDATE customers 
        SET 
            total_spent = COALESCE(
                (SELECT SUM(total_amount) 
                 FROM billing_tickets 
                 WHERE customer_id = NEW.customer_id 
                   AND is_processed = TRUE), 
                0
            ),
            total_visits = COALESCE(
                (SELECT COUNT(DISTINCT ticket_date::date) 
                 FROM billing_tickets 
                 WHERE customer_id = NEW.customer_id 
                   AND is_processed = TRUE), 
                0
            ),
            last_visit = COALESCE(
                (SELECT MAX(ticket_date) 
                 FROM billing_tickets 
                 WHERE customer_id = NEW.customer_id 
                   AND is_processed = TRUE), 
                NOW()
            ),
            updated_at = NOW()
        WHERE id = NEW.customer_id;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_customer_stats_from_ticket
    AFTER INSERT OR UPDATE ON billing_tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_customer_stats_from_ticket();

-- 6. Función RPC para crear ticket desde reserva
CREATE OR REPLACE FUNCTION create_ticket_from_reservation(
    p_reservation_id UUID,
    p_ticket_number VARCHAR(100),
    p_items JSONB,
    p_total_amount DECIMAL(10,2),
    p_payment_method VARCHAR(50) DEFAULT 'efectivo'
)
RETURNS UUID AS $$
DECLARE
    v_ticket_id UUID;
    v_reservation RECORD;
BEGIN
    -- Obtener datos de la reserva
    SELECT r.*, t.id as table_id, t.table_number, c.id as customer_id
    INTO v_reservation
    FROM reservations r
    LEFT JOIN tables t ON r.table_id = t.id
    LEFT JOIN customers c ON r.customer_id = c.id
    WHERE r.id = p_reservation_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reserva no encontrada: %', p_reservation_id;
    END IF;
    
    -- Crear el ticket
    INSERT INTO billing_tickets (
        restaurant_id,
        reservation_id,
        table_id,
        customer_id,
        ticket_number,
        ticket_date,
        items,
        subtotal,
        total_amount,
        payment_method,
        covers_count,
        source_system,
        is_processed
    ) VALUES (
        v_reservation.restaurant_id,
        p_reservation_id,
        v_reservation.table_id,
        v_reservation.customer_id,
        p_ticket_number,
        NOW(),
        p_items,
        p_total_amount, -- Sin impuestos por simplicidad
        p_total_amount,
        p_payment_method,
        v_reservation.party_size,
        'manual',
        TRUE
    ) RETURNING id INTO v_ticket_id;
    
    RETURN v_ticket_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Función RPC para obtener analytics de facturación
CREATE OR REPLACE FUNCTION get_billing_analytics(
    p_restaurant_id UUID,
    p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_build_object(
        'total_revenue', COALESCE(SUM(total_amount), 0),
        'total_tickets', COUNT(*),
        'average_ticket', COALESCE(AVG(total_amount), 0),
        'top_customers', (
            SELECT json_agg(customer_stats ORDER BY total_spent DESC)
            FROM (
                SELECT 
                    c.name,
                    c.email,
                    COUNT(bt.id) as visits,
                    SUM(bt.total_amount) as total_spent,
                    AVG(bt.total_amount) as avg_ticket
                FROM billing_tickets bt
                JOIN customers c ON bt.customer_id = c.id
                WHERE bt.restaurant_id = p_restaurant_id 
                  AND bt.ticket_date::date BETWEEN p_start_date AND p_end_date
                  AND bt.is_processed = TRUE
                GROUP BY c.id, c.name, c.email
                ORDER BY total_spent DESC
                LIMIT 10
            ) customer_stats
        ),
        'daily_revenue', (
            SELECT json_agg(daily_stats ORDER BY date)
            FROM (
                SELECT 
                    ticket_date::date as date,
                    COUNT(*) as tickets,
                    SUM(total_amount) as revenue
                FROM billing_tickets
                WHERE restaurant_id = p_restaurant_id 
                  AND ticket_date::date BETWEEN p_start_date AND p_end_date
                  AND is_processed = TRUE
                GROUP BY ticket_date::date
                ORDER BY ticket_date::date
            ) daily_stats
        )
    ) INTO v_result
    FROM billing_tickets 
    WHERE restaurant_id = p_restaurant_id 
      AND ticket_date::date BETWEEN p_start_date AND p_end_date
      AND is_processed = TRUE;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Datos de ejemplo para testing (opcional)
/*
INSERT INTO billing_tickets (
    restaurant_id,
    ticket_number,
    items,
    subtotal,
    total_amount,
    payment_method,
    source_system,
    is_processed
) VALUES (
    (SELECT id FROM restaurants LIMIT 1),
    'TICKET-001',
    '[
        {"name": "Paella Valenciana", "quantity": 2, "unit_price": 18.50, "total_price": 37.00, "category": "Principales"},
        {"name": "Sangría 1L", "quantity": 1, "unit_price": 12.00, "total_price": 12.00, "category": "Bebidas"}
    ]',
    49.00,
    49.00,
    'tarjeta',
    'manual',
    TRUE
);
*/

COMMENT ON TABLE billing_tickets IS 'Tickets de facturación para vincular reservas con consumo real';
COMMENT ON COLUMN billing_tickets.items IS 'Array JSON de productos: [{"name", "quantity", "unit_price", "total_price", "category"}]';
COMMENT ON COLUMN billing_tickets.source_system IS 'Sistema origen: manual, tpv_sistema, api_integration, etc.';
COMMENT ON COLUMN billing_tickets.is_processed IS 'Si TRUE, el ticket se incluye en stats de cliente';
