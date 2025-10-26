-- =====================================================
-- ACTUALIZAR MIME TYPES DEL BUCKET restaurant-knowledge
-- Para soportar: PDF, TXT, HTML, Excel, Google Docs/Sheets
-- =====================================================

-- Actualizar el bucket con los nuevos MIME types permitidos
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',                                                      -- PDF
  'text/plain',                                                           -- TXT
  'text/html',                                                            -- HTML
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',  -- Excel (.xlsx)
  'application/vnd.ms-excel',                                            -- Excel (.xls)
  'application/vnd.google-apps.document',                                -- Google Docs
  'application/vnd.google-apps.spreadsheet'                              -- Google Sheets
]
WHERE id = 'restaurant-knowledge';

-- Verificar la actualización
SELECT 
  id, 
  name, 
  allowed_mime_types,
  file_size_limit
FROM storage.buckets
WHERE id = 'restaurant-knowledge';

