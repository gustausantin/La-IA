-- =====================================================
-- RESTAURAR FUNCIÓN ORIGINAL
-- =====================================================

DROP FUNCTION IF EXISTS get_unified_dashboard_snapshot(UUID, TIMESTAMP) CASCADE;
DROP FUNCTION IF EXISTS get_unified_dashboard_snapshot(UUID) CASCADE;

CREATE OR REPLACE FUNCTION get_unified_dashboard_snapshot(
  p_business_id UUID,
  p_timestamp TIMESTAMP DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_today DATE;
  v_current_time TIME;
  v_result JSONB;
  v_reservas JSONB;
  v_equipo JSONB;
  v_facturacion JSONB;
  v_comunicaciones JSONB;
  v_noshows JSONB;
  v_clientes JSONB;
BEGIN
  v_today := p_timestamp::DATE;
  v_current_time := p_timestamp::TIME;

  -- Inicializar con valores vacíos
  v_reservas := '{}'::jsonb;
  v_equipo := '{}'::jsonb;
  v_facturacion := '{}'::jsonb;
  v_comunicaciones := '{}'::jsonb;
  v_noshows := '{"en_riesgo_hoy": []}'::jsonb;
  v_clientes := '{"especiales_hoy": []}'::jsonb;
  
  v_result := jsonb_build_object(
    'reservas', v_reservas,
    'equipo', v_equipo,
    'horarios', v_equipo,
    'facturacion', v_facturacion,
    'comunicaciones', v_comunicaciones,
    'noshows', v_noshows,
    'clientes', v_clientes
  );

  RETURN v_result;
END;
$$;

