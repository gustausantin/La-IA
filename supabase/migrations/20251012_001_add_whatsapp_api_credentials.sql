-- =====================================================
-- MIGRACIÓN: Añadir credenciales de WhatsApp Business API
-- Fecha: 2025-10-12
-- Descripción: Permite que cada restaurante use su propio número de WhatsApp vía Meta Business API
-- =====================================================

-- 1. Añadir columnas a la tabla restaurants
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS whatsapp_phone_number_id TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_access_token TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_waba_id TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_business_account_id TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS whatsapp_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS whatsapp_provider TEXT DEFAULT 'meta' CHECK (whatsapp_provider IN ('meta', 'twilio'));

-- 2. Comentarios para documentación
COMMENT ON COLUMN restaurants.whatsapp_phone_number_id IS 'Phone Number ID de WhatsApp Business API (Meta)';
COMMENT ON COLUMN restaurants.whatsapp_access_token IS 'Access Token permanente de Meta para enviar mensajes (ENCRIPTADO en producción)';
COMMENT ON COLUMN restaurants.whatsapp_waba_id IS 'WhatsApp Business Account ID';
COMMENT ON COLUMN restaurants.whatsapp_business_account_id IS 'ID de la cuenta de negocio en Meta';
COMMENT ON COLUMN restaurants.whatsapp_enabled IS 'Si el restaurante tiene WhatsApp habilitado';
COMMENT ON COLUMN restaurants.whatsapp_verified IS 'Si el número de WhatsApp está verificado por Meta';
COMMENT ON COLUMN restaurants.whatsapp_provider IS 'Proveedor de WhatsApp: meta (directo) o twilio';

-- 3. Índices para optimización
CREATE INDEX IF NOT EXISTS idx_restaurants_whatsapp_enabled 
ON restaurants(whatsapp_enabled) 
WHERE whatsapp_enabled = TRUE;

-- 4. Función para validar credenciales de WhatsApp
CREATE OR REPLACE FUNCTION validate_whatsapp_credentials(
  p_restaurant_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_has_credentials BOOLEAN;
BEGIN
  SELECT 
    whatsapp_phone_number_id IS NOT NULL 
    AND whatsapp_access_token IS NOT NULL 
    AND whatsapp_enabled = TRUE
  INTO v_has_credentials
  FROM restaurants
  WHERE id = p_restaurant_id;
  
  RETURN COALESCE(v_has_credentials, FALSE);
END;
$$;

-- 5. Grant permissions
GRANT EXECUTE ON FUNCTION validate_whatsapp_credentials TO authenticated;
GRANT EXECUTE ON FUNCTION validate_whatsapp_credentials TO service_role;

-- =====================================================
-- EJEMPLO DE USO:
-- =====================================================
-- Para configurar WhatsApp para un restaurante:
/*
UPDATE restaurants
SET 
  whatsapp_phone_number_id = '123456789012345',
  whatsapp_access_token = 'EAAxxxxxxxxxx',
  whatsapp_waba_id = '987654321098765',
  whatsapp_enabled = TRUE,
  whatsapp_verified = TRUE,
  whatsapp_provider = 'meta'
WHERE id = 'restaurant-uuid-here';
*/

-- Para verificar si un restaurante tiene WhatsApp configurado:
/*
SELECT validate_whatsapp_credentials('restaurant-uuid-here');
*/

