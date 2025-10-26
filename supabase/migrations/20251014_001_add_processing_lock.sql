-- Agregar columna processing_lock para evitar procesamiento duplicado
-- Fecha: 14 de octubre de 2025

-- Agregar columna processing_since (timestamp cuando empieza a procesarse)
ALTER TABLE whatsapp_message_buffer
ADD COLUMN IF NOT EXISTS processing_since TIMESTAMPTZ DEFAULT NULL;

-- Agregar índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_whatsapp_buffer_processing 
ON whatsapp_message_buffer(processing_since) 
WHERE processing_since IS NOT NULL;

-- Comentario
COMMENT ON COLUMN whatsapp_message_buffer.processing_since IS 
'Timestamp cuando el buffer empezó a procesarse. NULL = no procesando. Si > 60s, se considera huérfano.';

