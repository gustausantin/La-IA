-- =====================================================
-- MIGRACIÓN: SISTEMA DE SERVICIOS (LIMPIA Y CORRECTA)
-- Fecha: 2025-11-09
-- Schema verificado: service_templates solo tiene (vertical_type, name, description, category, is_popular, sort_order, suggested_price, duration_minutes, metadata)
-- =====================================================

-- =====================================================
-- 1. AÑADIR COLUMNA 'color' A service_templates
-- =====================================================
ALTER TABLE service_templates
ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#6366f1';

COMMENT ON COLUMN service_templates.color IS 'Color para el calendario (hex)';

-- NOTE: duration_minutes ya existe (pero es nullable)
-- NOTE: description ya existe
-- NOTE: suggested_price ya existe

-- =====================================================
-- 2. CREAR TABLA services (servicios del negocio)
-- =====================================================
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    template_id UUID REFERENCES service_templates(id) ON DELETE SET NULL,
    
    -- Información básica
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    description TEXT,
    
    -- Duración
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    
    -- Precio
    price_type VARCHAR(20) NOT NULL DEFAULT 'fixed',
    price DECIMAL(10,2),
    
    -- Visual
    color VARCHAR(7) DEFAULT '#6366f1',
    
    -- Estado y orden
    is_active BOOLEAN DEFAULT true,
    position_order INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Constraints
    CONSTRAINT valid_price_type CHECK (price_type IN ('fixed', 'variable', 'free', 'from', 'hidden')),
    CONSTRAINT duration_positive CHECK (duration_minutes > 0),
    CONSTRAINT price_positive CHECK (price IS NULL OR price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_services_business ON services(business_id);
CREATE INDEX IF NOT EXISTS idx_services_active ON services(business_id, is_active);
CREATE INDEX IF NOT EXISTS idx_services_category ON services(business_id, category);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their business services" ON services;
CREATE POLICY "Users can view their business services"
    ON services FOR SELECT
    USING (business_id IN (SELECT business_id FROM user_business_mapping WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage their business services" ON services;
CREATE POLICY "Users can manage their business services"
    ON services FOR ALL
    USING (business_id IN (SELECT business_id FROM user_business_mapping WHERE auth_user_id = auth.uid()));

-- =====================================================
-- 3. ACTUALIZAR SERVICIOS EXISTENTES (duration + color)
-- =====================================================

-- PELUQUERÍA
UPDATE service_templates SET duration_minutes = 45, color = '#ec4899' WHERE name = 'Corte y Peinado';
UPDATE service_templates SET duration_minutes = 30, color = '#3b82f6' WHERE name = 'Corte + Barba';
UPDATE service_templates SET duration_minutes = 25, color = '#eab308' WHERE name = 'Corte Niño/a';
UPDATE service_templates SET duration_minutes = 45, color = '#06b6d4' WHERE name = 'Peinar (Secador)';
UPDATE service_templates SET duration_minutes = 60, color = '#f59e0b' WHERE name = 'Color (Tinte Raíz)';
UPDATE service_templates SET duration_minutes = 180, color = '#f97316' WHERE name LIKE '%Mechas%Balayage%';
UPDATE service_templates SET duration_minutes = 30, color = '#10b981' WHERE name = 'Tratamiento Hidratación';
UPDATE service_templates SET duration_minutes = 60, color = '#d946ef' WHERE name = 'Recogido';
UPDATE service_templates SET duration_minutes = 15, color = '#8b5cf6' WHERE name = 'Arreglo Barba';
UPDATE service_templates SET duration_minutes = 120, color = '#a855f7' WHERE name = 'Alisado Keratina';

-- ESTÉTICA
UPDATE service_templates SET duration_minutes = 60, color = '#ec4899' WHERE name = 'Limpieza Facial Profunda';
UPDATE service_templates SET duration_minutes = 60, color = '#06b6d4' WHERE name = 'Tratamiento Hidratante' AND vertical_type = 'centro_estetica';
UPDATE service_templates SET duration_minutes = 30, color = '#f59e0b' WHERE name = 'Peeling Químico';
UPDATE service_templates SET duration_minutes = 60, color = '#8b5cf6' WHERE name = 'Depilación Láser';
UPDATE service_templates SET duration_minutes = 60, color = '#6366f1' WHERE name = 'Radiofrecuencia Facial';
UPDATE service_templates SET duration_minutes = 50, color = '#92400e' WHERE name = 'Maderoterapia';
UPDATE service_templates SET duration_minutes = 50, color = '#14b8a6' WHERE name = 'Presoterapia';
UPDATE service_templates SET duration_minutes = 45, color = '#ec4899' WHERE name = 'Lifting de Pestañas';

-- UÑAS
UPDATE service_templates SET duration_minutes = 45, color = '#ec4899' WHERE name = 'Manicura Semipermanente';
UPDATE service_templates SET duration_minutes = 60, color = '#f472b6' WHERE name = 'Pedicura Semipermanente';
UPDATE service_templates SET duration_minutes = 30, color = '#a855f7' WHERE name = 'Manicura Tradicional';
UPDATE service_templates SET duration_minutes = 90, color = '#d946ef' WHERE name = 'Uñas Acrílicas (Nuevas)';
UPDATE service_templates SET duration_minutes = 90, color = '#c084fc' WHERE name = 'Uñas de Gel (Nuevas)';
UPDATE service_templates SET duration_minutes = 60, color = '#e879f9' WHERE name = 'Uñas de Gel (Relleno)';
UPDATE service_templates SET duration_minutes = 60, color = '#f0abfc' WHERE name = 'Uñas Acrílicas (Relleno)';
UPDATE service_templates SET duration_minutes = 30, color = '#f97316' WHERE name = 'Quitar (Acrílico/Gel)';

-- FISIOTERAPIA
UPDATE service_templates SET duration_minutes = 60, color = '#10b981' WHERE name = 'Primera Visita / Valoración' AND vertical_type = 'fisioterapia';
UPDATE service_templates SET duration_minutes = 50, color = '#14b8a6' WHERE name = 'Sesión Seguimiento' AND vertical_type = 'fisioterapia';
UPDATE service_templates SET duration_minutes = 50, color = '#ec4899' WHERE name = 'Tratamiento Suelo Pélvico';
UPDATE service_templates SET duration_minutes = 60, color = '#8b5cf6' WHERE name = 'Drenaje Linfático Manual' AND vertical_type = 'fisioterapia';
UPDATE service_templates SET duration_minutes = 30, color = '#0891b2' WHERE name = 'Punción Seca';
UPDATE service_templates SET duration_minutes = 60, color = '#6366f1' WHERE name = 'Terapia Manual';
UPDATE service_templates SET duration_minutes = 45, color = '#06b6d4' WHERE name = 'Masaje Descontracturante' AND vertical_type = 'fisioterapia';
UPDATE service_templates SET duration_minutes = 30, color = '#8b5cf6' WHERE name = 'Indiba / Radiofrecuencia';

-- MASAJES
UPDATE service_templates SET duration_minutes = 60, color = '#6366f1' WHERE name = 'Sesión Osteopatía';
UPDATE service_templates SET duration_minutes = 60, color = '#14b8a6' WHERE name = 'Masaje Descontracturante' AND vertical_type = 'masajes_osteopatia';
UPDATE service_templates SET duration_minutes = 60, color = '#10b981' WHERE name = 'Masaje Relajante';
UPDATE service_templates SET duration_minutes = 50, color = '#f97316' WHERE name = 'Masaje Deportivo';
UPDATE service_templates SET duration_minutes = 45, color = '#06b6d4' WHERE name = 'Reflexología Podal';
UPDATE service_templates SET duration_minutes = 30, color = '#ec4899' WHERE name = 'Masaje Craneofacial';

-- PSICOLOGÍA
UPDATE service_templates SET duration_minutes = 60, color = '#8b5cf6' WHERE name = 'Primera Sesión (Psicología)';
UPDATE service_templates SET duration_minutes = 50, color = '#6366f1' WHERE name = 'Sesión Seguimiento (Psicología)';
UPDATE service_templates SET duration_minutes = 75, color = '#ec4899' WHERE name = 'Terapia de Pareja';
UPDATE service_templates SET duration_minutes = 90, color = '#f59e0b' WHERE name = 'Terapia Familiar';
UPDATE service_templates SET duration_minutes = 60, color = '#10b981' WHERE name = 'Sesión Coaching';
UPDATE service_templates SET duration_minutes = 50, color = '#06b6d4' WHERE name = 'Sesión Online' AND vertical_type = 'psicologia_coaching';
UPDATE service_templates SET duration_minutes = 90, color = '#8b5cf6' WHERE name = 'Evaluación Psicológica';

-- DENTAL
UPDATE service_templates SET duration_minutes = 30, color = '#06b6d4' WHERE name = 'Revisión General' AND vertical_type = 'clinica_dental';
UPDATE service_templates SET duration_minutes = 45, color = '#10b981' WHERE name = 'Limpieza Dental (Profilaxis)';
UPDATE service_templates SET duration_minutes = 60, color = '#3b82f6' WHERE name = 'Empaste (Obturación)';
UPDATE service_templates SET duration_minutes = 60, color = '#f8fafc' WHERE name = 'Blanqueamiento Dental';
UPDATE service_templates SET duration_minutes = 30, color = '#ef4444' WHERE name = 'Extracción (Simple)';
UPDATE service_templates SET duration_minutes = 60, color = '#dc2626' WHERE name = 'Endodoncia';
UPDATE service_templates SET duration_minutes = 30, color = '#8b5cf6' WHERE name = 'Consulta Ortodoncia';
UPDATE service_templates SET duration_minutes = 30, color = '#6366f1' WHERE name = 'Consulta Implantes';

-- VETERINARIO
UPDATE service_templates SET duration_minutes = 30, color = '#10b981' WHERE name = 'Consulta General' AND vertical_type = 'veterinario';
UPDATE service_templates SET duration_minutes = 30, color = '#3b82f6' WHERE name = 'Vacunación';
UPDATE service_templates SET duration_minutes = 15, color = '#8b5cf6' WHERE name = 'Identificación (Microchip)';
UPDATE service_templates SET duration_minutes = 15, color = '#06b6d4' WHERE name = 'Revisión / Seguimiento';
UPDATE service_templates SET duration_minutes = 30, color = '#f59e0b' WHERE name = 'Desparasitación';
UPDATE service_templates SET duration_minutes = 30, color = '#ef4444' WHERE name = 'Consulta Especialidad (ej. Derma)';
UPDATE service_templates SET duration_minutes = 30, color = '#f59e0b' WHERE name = 'Consulta Pre-Quirúrgica';
UPDATE service_templates SET duration_minutes = 30, color = '#14b8a6' WHERE name = 'Analítica';

-- ENTRENADOR
UPDATE service_templates SET duration_minutes = 60, color = '#f97316' WHERE name = 'Sesión Entrenamiento Personal';
UPDATE service_templates SET duration_minutes = 60, color = '#ec4899' WHERE name = 'Sesión en Pareja';
UPDATE service_templates SET duration_minutes = 60, color = '#8b5cf6' WHERE name = 'Sesión Grupo Reducido';
UPDATE service_templates SET duration_minutes = 60, color = '#10b981' WHERE name = 'Valoración Inicial / Fitness';
UPDATE service_templates SET duration_minutes = 60, color = '#06b6d4' WHERE name = 'Sesión Online' AND vertical_type = 'entrenador_personal';
UPDATE service_templates SET duration_minutes = 45, color = '#14b8a6' WHERE name = 'Seguimiento' AND vertical_type = 'entrenador_personal';
UPDATE service_templates SET duration_minutes = 45, color = '#f59e0b' WHERE name = 'Planificación (Rutina / Dieta)';

-- YOGA
UPDATE service_templates SET duration_minutes = 60, color = '#8b5cf6' WHERE name = 'Clase Grupal Yoga (1 Plaza)';
UPDATE service_templates SET duration_minutes = 50, color = '#a855f7' WHERE name = 'Clase Grupal Pilates (1 Plaza)';
UPDATE service_templates SET duration_minutes = 60, color = '#ec4899' WHERE name = 'Clase Privada Yoga';
UPDATE service_templates SET duration_minutes = 60, color = '#ec4899' WHERE name = 'Clase Privada Pilates';
UPDATE service_templates SET duration_minutes = 50, color = '#6366f1' WHERE name = 'Pilates Máquina (Reformer)';
UPDATE service_templates SET duration_minutes = 60, color = '#f472b6' WHERE name = 'Clase Prenatal';
UPDATE service_templates SET duration_minutes = 90, color = '#10b981' WHERE name = 'Meditación Guiada';

-- =====================================================
-- 4. INSERTAR SERVICIOS NUEVOS (sin color, se añade con UPDATE después)
-- =====================================================

-- Peluquería
INSERT INTO service_templates (vertical_type, name, category, duration_minutes, description, is_popular, sort_order)
VALUES 
('peluqueria_barberia', 'Corte (Mujer)', 'Cabello', 45, 'Corte de cabello para mujer con lavado y secado básico', true, 100),
('peluqueria_barberia', 'Corte (Hombre)', 'Cabello', 30, 'Corte de cabello para hombre con lavado', true, 101),
('peluqueria_barberia', 'Lavar y Peinar (Pelo Corto)', 'Peinado', 30, 'Lavado y peinado con secador para cabello corto', false, 102),
('peluqueria_barberia', 'Lavar y Peinar (Pelo Largo)', 'Peinado', 45, 'Lavado y peinado con secador para cabello largo', false, 103),
('peluqueria_barberia', 'Corte + Arreglo de Barba', 'Barbería', 45, 'Corte de pelo con arreglo completo de barba', true, 104),
('peluqueria_barberia', 'Tinte Raíz', 'Color', 60, 'Tinte de raíces hasta 3cm de crecimiento', true, 105),
('peluqueria_barberia', 'Tinte Completo', 'Color', 90, 'Tinte completo de todo el cabello', true, 106),
('peluqueria_barberia', 'Mechas (Balayage)', 'Color', 180, 'Mechas estilo balayage o babylights', true, 107),
('peluqueria_barberia', 'Mechas (Tradicionales)', 'Color', 120, 'Mechas tradicionales con gorro o papel', false, 108),
('peluqueria_barberia', 'Tratamiento Hidratante', 'Tratamiento', 30, 'Tratamiento capilar hidratante con mascarilla', false, 109),
('peluqueria_barberia', 'Recogido (Evento)', 'Peinado', 60, 'Peinado recogido para eventos especiales', false, 110)
ON CONFLICT DO NOTHING;

UPDATE service_templates SET color = '#ec4899' WHERE name = 'Corte (Mujer)';
UPDATE service_templates SET color = '#3b82f6' WHERE name = 'Corte (Hombre)';
UPDATE service_templates SET color = '#8b5cf6' WHERE name = 'Corte + Arreglo de Barba';
UPDATE service_templates SET color = '#f59e0b' WHERE name = 'Tinte Raíz';
UPDATE service_templates SET color = '#fb923c' WHERE name = 'Tinte Completo';
UPDATE service_templates SET color = '#f97316' WHERE name = 'Mechas (Balayage)';
UPDATE service_templates SET color = '#fb7185' WHERE name = 'Mechas (Tradicionales)';

-- Estética
INSERT INTO service_templates (vertical_type, name, category, duration_minutes, description, is_popular, sort_order)
VALUES 
('centro_estetica', 'Tratamiento Antiedad', 'Facial', 75, 'Tratamiento facial antiedad completo', true, 200),
('centro_estetica', 'Microneedling', 'Facial', 60, 'Tratamiento con microagujas para regeneración', false, 201),
('centro_estetica', 'Masaje Anticelulítico', 'Corporal', 50, 'Masaje reductor anticelulítico', false, 202),
('centro_estetica', 'Depilación Láser (Piernas)', 'Depilación', 60, 'Depilación láser en piernas completas', true, 203),
('centro_estetica', 'Depilación Láser (Axilas)', 'Depilación', 15, 'Depilación láser en axilas', false, 204),
('centro_estetica', 'Depilación Láser (Ingles)', 'Depilación', 15, 'Depilación láser en zona de ingles', false, 205)
ON CONFLICT DO NOTHING;

UPDATE service_templates SET color = '#a855f7' WHERE name = 'Tratamiento Antiedad';
UPDATE service_templates SET color = '#8b5cf6' WHERE name = 'Microneedling';
UPDATE service_templates SET color = '#ec4899' WHERE name = 'Masaje Anticelulítico';

-- Uñas
INSERT INTO service_templates (vertical_type, name, category, duration_minutes, description, is_popular, sort_order)
VALUES 
('centro_unas', 'Manicura Rusa (Combinada)', 'Manos', 60, 'Manicura rusa combinada con aparato eléctrico', true, 300),
('centro_unas', 'Pedicura (Tradicional)', 'Pies', 45, 'Pedicura tradicional con esmalte normal', false, 301),
('centro_unas', 'Quitar Semipermanente', 'Manos', 15, 'Retirada de esmalte semipermanente', false, 302),
('centro_unas', 'Extra: Nail Art (por uña)', 'Extras', 5, 'Decoración artística por uña', false, 303)
ON CONFLICT DO NOTHING;

UPDATE service_templates SET color = '#ec4899' WHERE name = 'Manicura Rusa (Combinada)';
UPDATE service_templates SET color = '#f472b6' WHERE name = 'Pedicura (Tradicional)';

-- Fisioterapia
INSERT INTO service_templates (vertical_type, name, category, duration_minutes, description, is_popular, sort_order)
VALUES 
('fisioterapia', 'Tratamiento Lesión Deportiva', 'Deportivo', 50, 'Tratamiento especializado en lesiones deportivas', true, 400),
('fisioterapia', 'Rehabilitación Suelo Pélvico', 'Especializada', 50, 'Rehabilitación uroginecológica del suelo pélvico', false, 401),
('fisioterapia', 'Sesión Osteopatía (Estructural)', 'Osteopatía', 60, 'Osteopatía estructural y articular', true, 402)
ON CONFLICT DO NOTHING;

UPDATE service_templates SET color = '#f97316' WHERE name = 'Tratamiento Lesión Deportiva';

-- Masajes
INSERT INTO service_templates (vertical_type, name, category, duration_minutes, description, is_popular, sort_order)
VALUES 
('masajes_osteopatia', 'Masaje Relajante (90 min)', 'Relajante', 90, 'Masaje corporal relajante de 90 minutos', true, 500),
('masajes_osteopatia', 'Masaje Prenatal', 'Especializado', 50, 'Masaje para embarazadas con técnicas seguras', false, 501)
ON CONFLICT DO NOTHING;

-- Psicología
INSERT INTO service_templates (vertical_type, name, category, duration_minutes, description, is_popular, sort_order)
VALUES 
('psicologia_coaching', 'Sesión Individual (Online)', 'Terapia Individual', 50, 'Sesión de terapia individual por videollamada', false, 600)
ON CONFLICT DO NOTHING;

-- Dental
INSERT INTO service_templates (vertical_type, name, category, duration_minutes, description, is_popular, sort_order)
VALUES 
('clinica_dental', 'Primera Visita (Revisión y Diag.)', 'Revisión', 30, 'Primera visita con revisión completa y diagnóstico', true, 700),
('clinica_dental', 'Urgencia Dental', 'Urgencia', 30, 'Atención dental de urgencia', false, 701),
('clinica_dental', 'Revisión Infantil', 'Infantil', 30, 'Revisión dental para niños', false, 702)
ON CONFLICT DO NOTHING;

-- Veterinario
INSERT INTO service_templates (vertical_type, name, category, duration_minutes, description, is_popular, sort_order)
VALUES 
('veterinario', 'Consulta Vacunación (Perro)', 'Preventivo', 30, 'Vacunación para perros según calendario', true, 800),
('veterinario', 'Consulta Vacunación (Gato)', 'Preventivo', 30, 'Vacunación para gatos según calendario', true, 801),
('veterinario', 'Consulta Exóticos', 'Especializada', 30, 'Consulta para animales exóticos', false, 802),
('veterinario', 'Peluquería Canina (Baño y Corte)', 'Estética', 90, 'Baño completo y corte de pelo para perros', true, 803),
('veterinario', 'Corte de Uñas', 'Estética', 10, 'Corte de uñas para perros o gatos', false, 804),
('veterinario', 'Consulta Urgencia', 'Urgencia', 30, 'Atención veterinaria de urgencia', true, 805)
ON CONFLICT DO NOTHING;

-- Entrenador
INSERT INTO service_templates (vertical_type, name, category, duration_minutes, description, is_popular, sort_order)
VALUES 
('entrenador_personal', 'Entrenamiento en Pareja (Dúo)', 'Personal', 60, 'Sesión de entrenamiento para dos personas', false, 900),
('entrenador_personal', 'Entrenamiento Grupo Reducido', 'Grupal', 60, 'Sesión en grupo reducido de 3-5 personas', false, 901),
('entrenador_personal', 'Consulta Nutricional', 'Nutrición', 45, 'Consulta de nutrición deportiva', false, 902),
('entrenador_personal', 'Evaluación Inicial (Física + Dieta)', 'Valoración', 60, 'Evaluación física completa y plan nutricional', true, 903)
ON CONFLICT DO NOTHING;

-- Yoga
INSERT INTO service_templates (vertical_type, name, category, duration_minutes, description, is_popular, sort_order)
VALUES 
('yoga_pilates', 'Clase de Yoga (Grupal)', 'Yoga', 60, 'Clase grupal de yoga para todos los niveles', true, 1000),
('yoga_pilates', 'Clase de Pilates Mat (Grupal)', 'Pilates', 50, 'Clase grupal de pilates en colchoneta', true, 1001),
('yoga_pilates', 'Clase Privada (Yoga o Pilates)', 'Privado', 60, 'Clase privada 1 a 1 de yoga o pilates', false, 1002),
('yoga_pilates', 'Taller de Meditación', 'Meditación', 90, 'Taller de meditación y mindfulness', false, 1003),
('yoga_pilates', 'Primera Clase (Prueba)', 'Prueba', 60, 'Primera clase gratuita o de prueba', true, 1004)
ON CONFLICT DO NOTHING;

-- =====================================================
-- 5. TRIGGER: Actualizar updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_services_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS services_updated_at ON services;
CREATE TRIGGER services_updated_at
    BEFORE UPDATE ON services
    FOR EACH ROW
    EXECUTE FUNCTION update_services_updated_at();



