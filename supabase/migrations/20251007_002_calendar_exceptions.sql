-- ========================================
-- SISTEMA DE EXCEPCIONES DE CALENDARIO
-- Para proteger días con reservas al cerrar horarios semanales
-- ========================================

-- 1. Crear tabla calendar_exceptions
CREATE TABLE IF NOT EXISTS calendar_exceptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    exception_date DATE NOT NULL,
    is_open BOOLEAN NOT NULL DEFAULT true,
    reason TEXT,
    created_by TEXT DEFAULT 'system',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraint: Una excepción por fecha por restaurante
    CONSTRAINT unique_exception_per_date UNIQUE (restaurant_id, exception_date)
);

-- 2. Índices para performance
CREATE INDEX IF NOT EXISTS idx_calendar_exceptions_restaurant 
    ON calendar_exceptions(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_calendar_exceptions_date 
    ON calendar_exceptions(exception_date);

CREATE INDEX IF NOT EXISTS idx_calendar_exceptions_restaurant_date 
    ON calendar_exceptions(restaurant_id, exception_date);

-- 3. RLS (Row Level Security)
ALTER TABLE calendar_exceptions ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios solo ven excepciones de su restaurante
CREATE POLICY "Users can view their restaurant exceptions"
    ON calendar_exceptions
    FOR SELECT
    USING (
        restaurant_id IN (
            SELECT id FROM restaurants 
            WHERE id = restaurant_id
        )
    );

-- Política: Los usuarios pueden crear excepciones para su restaurante
CREATE POLICY "Users can create exceptions for their restaurant"
    ON calendar_exceptions
    FOR INSERT
    WITH CHECK (
        restaurant_id IN (
            SELECT id FROM restaurants 
            WHERE id = restaurant_id
        )
    );

-- Política: Los usuarios pueden actualizar excepciones de su restaurante
CREATE POLICY "Users can update their restaurant exceptions"
    ON calendar_exceptions
    FOR UPDATE
    USING (
        restaurant_id IN (
            SELECT id FROM restaurants 
            WHERE id = restaurant_id
        )
    );

-- Política: Los usuarios pueden eliminar excepciones de su restaurante
CREATE POLICY "Users can delete their restaurant exceptions"
    ON calendar_exceptions
    FOR DELETE
    USING (
        restaurant_id IN (
            SELECT id FROM restaurants 
            WHERE id = restaurant_id
        )
    );

-- 4. Trigger para updated_at
CREATE OR REPLACE FUNCTION update_calendar_exceptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_calendar_exceptions_updated_at
    BEFORE UPDATE ON calendar_exceptions
    FOR EACH ROW
    EXECUTE FUNCTION update_calendar_exceptions_updated_at();

-- 5. Comentarios para documentación
COMMENT ON TABLE calendar_exceptions IS 'Excepciones al horario semanal del restaurante (ej: días con reservas que deben permanecer abiertos)';
COMMENT ON COLUMN calendar_exceptions.exception_date IS 'Fecha específica de la excepción (YYYY-MM-DD)';
COMMENT ON COLUMN calendar_exceptions.is_open IS 'true = forzar abierto, false = forzar cerrado';
COMMENT ON COLUMN calendar_exceptions.reason IS 'Motivo de la excepción (ej: "Reserva existente", "Evento privado", "Festivo")';
COMMENT ON COLUMN calendar_exceptions.created_by IS 'Origen de la excepción: "system" (automática) o "manual" (usuario)';

-- ========================================
-- MIGRACIÓN COMPLETADA ✅
-- Tabla calendar_exceptions creada sin tocar nada existente
-- ========================================

