-- =====================================================
-- RLS para service_templates - Lectura pública
-- Las plantillas son globales, todos pueden leerlas
-- =====================================================

-- Habilitar RLS si no está
ALTER TABLE service_templates ENABLE ROW LEVEL SECURITY;

-- Policy: Todos pueden leer service_templates
DROP POLICY IF EXISTS "Anyone can view service templates" ON service_templates;
CREATE POLICY "Anyone can view service templates"
    ON service_templates FOR SELECT
    USING (true);

-- Policy: Solo admins pueden modificar (futuro)
DROP POLICY IF EXISTS "Only admins can modify templates" ON service_templates;
CREATE POLICY "Only admins can modify templates"
    ON service_templates FOR ALL
    USING (false); -- Por ahora nadie puede modificar desde el app



