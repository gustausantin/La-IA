-- ============================================
-- MIGRACIÓN: Tabla de Llamadas Telefónicas
-- Fecha: 2025-11-24
-- Propósito: Registrar llamadas entrantes/salientes para el dashboard
-- ============================================

-- Tabla principal de llamadas
CREATE TABLE IF NOT EXISTS phone_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  
  -- Información de la llamada
  phone_number VARCHAR(50) NOT NULL,
  direction VARCHAR(20) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status VARCHAR(50) NOT NULL CHECK (status IN ('completed', 'missed', 'rejected', 'busy', 'no_answer', 'failed')),
  
  -- Duración y tiempo
  duration_seconds INTEGER DEFAULT 0,
  call_started_at TIMESTAMPTZ,
  call_ended_at TIMESTAMPTZ,
  
  -- Metadatos
  notes TEXT,
  is_urgent BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Auditoría
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_phone_calls_business_id ON phone_calls(business_id);
CREATE INDEX IF NOT EXISTS idx_phone_calls_customer_id ON phone_calls(customer_id);
CREATE INDEX IF NOT EXISTS idx_phone_calls_call_started_at ON phone_calls(call_started_at);
CREATE INDEX IF NOT EXISTS idx_phone_calls_direction ON phone_calls(direction);
CREATE INDEX IF NOT EXISTS idx_phone_calls_status ON phone_calls(status);

-- RLS Policies
ALTER TABLE phone_calls ENABLE ROW LEVEL SECURITY;

-- Policy: Los usuarios solo pueden ver llamadas de su negocio
CREATE POLICY "Users can view phone_calls from their business"
  ON phone_calls
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 
      FROM user_business_mapping ubm
      WHERE ubm.business_id = phone_calls.business_id
        AND ubm.auth_user_id = auth.uid()
        AND ubm.active = TRUE
    )
  );

-- Policy: Los usuarios pueden insertar llamadas en su negocio
CREATE POLICY "Users can insert phone_calls in their business"
  ON phone_calls
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM user_business_mapping ubm
      WHERE ubm.business_id = phone_calls.business_id
        AND ubm.auth_user_id = auth.uid()
        AND ubm.active = TRUE
    )
  );

-- Policy: Los usuarios pueden actualizar llamadas de su negocio
CREATE POLICY "Users can update phone_calls from their business"
  ON phone_calls
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 
      FROM user_business_mapping ubm
      WHERE ubm.business_id = phone_calls.business_id
        AND ubm.auth_user_id = auth.uid()
        AND ubm.active = TRUE
    )
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_phone_calls_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER phone_calls_updated_at
  BEFORE UPDATE ON phone_calls
  FOR EACH ROW
  EXECUTE FUNCTION update_phone_calls_updated_at();

-- Comentarios
COMMENT ON TABLE phone_calls IS 'Registro de llamadas telefónicas entrantes y salientes';
COMMENT ON COLUMN phone_calls.direction IS 'Dirección: inbound (entrante) o outbound (saliente)';
COMMENT ON COLUMN phone_calls.status IS 'Estado: completed, missed, rejected, busy, no_answer, failed';
COMMENT ON COLUMN phone_calls.duration_seconds IS 'Duración de la llamada en segundos (0 si no se completó)';
COMMENT ON COLUMN phone_calls.is_urgent IS 'Marcada como urgente por el usuario o sistema';

