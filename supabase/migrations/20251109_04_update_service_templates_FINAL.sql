-- =====================================================
-- ACTUALIZAR service_templates - AÑADIR DURACIONES Y SERVICIOS FALTANTES
-- Fecha: 2025-11-09
-- =====================================================

-- 1. Añadir columna duration_minutes si no existe
ALTER TABLE service_templates
ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;

-- 2. ACTUALIZAR servicios existentes con duraciones

-- PELUQUERÍA (12 servicios)
UPDATE service_templates SET duration_minutes = 45 WHERE name = 'Corte y Peinado';
UPDATE service_templates SET duration_minutes = 30 WHERE name = 'Corte + Barba';
UPDATE service_templates SET duration_minutes = 25 WHERE name = 'Corte Niño/a';
UPDATE service_templates SET duration_minutes = 45 WHERE name = 'Peinar (Secador)';
UPDATE service_templates SET duration_minutes = 60 WHERE name = 'Color (Tinte Raíz)';
UPDATE service_templates SET duration_minutes = 180 WHERE name LIKE '%Mechas%Balayage%';
UPDATE service_templates SET duration_minutes = 30 WHERE name = 'Tratamiento Hidratación';
UPDATE service_templates SET duration_minutes = 60 WHERE name = 'Recogido';
UPDATE service_templates SET duration_minutes = 15 WHERE name = 'Arreglo Barba';
UPDATE service_templates SET duration_minutes = 120 WHERE name = 'Alisado Keratina';

-- ESTÉTICA (9 servicios)
UPDATE service_templates SET duration_minutes = 60 WHERE name = 'Limpieza Facial Profunda';
UPDATE service_templates SET duration_minutes = 60 WHERE name = 'Tratamiento Hidratante' AND vertical_type = 'centro_estetica';
UPDATE service_templates SET duration_minutes = 30 WHERE name = 'Peeling Químico';
UPDATE service_templates SET duration_minutes = 60 WHERE name = 'Depilación Láser';
UPDATE service_templates SET duration_minutes = 60 WHERE name = 'Radiofrecuencia Facial';
UPDATE service_templates SET duration_minutes = 50 WHERE name = 'Maderoterapia';
UPDATE service_templates SET duration_minutes = 50 WHERE name = 'Presoterapia';
UPDATE service_templates SET duration_minutes = 45 WHERE name = 'Lifting de Pestañas';
UPDATE service_templates SET duration_minutes = 30 WHERE name = 'Masaje Facial (Kobido)';

-- UÑAS (8 servicios)
UPDATE service_templates SET duration_minutes = 45 WHERE name = 'Manicura Semipermanente';
UPDATE service_templates SET duration_minutes = 60 WHERE name = 'Pedicura Semipermanente';
UPDATE service_templates SET duration_minutes = 30 WHERE name = 'Manicura Tradicional';
UPDATE service_templates SET duration_minutes = 90 WHERE name = 'Uñas Acrílicas (Nuevas)';
UPDATE service_templates SET duration_minutes = 90 WHERE name = 'Uñas de Gel (Nuevas)';
UPDATE service_templates SET duration_minutes = 60 WHERE name = 'Uñas de Gel (Relleno)';
UPDATE service_templates SET duration_minutes = 60 WHERE name = 'Uñas Acrílicas (Relleno)';
UPDATE service_templates SET duration_minutes = 30 WHERE name = 'Quitar (Acrílico/Gel)';

-- FISIOTERAPIA (8 servicios)
UPDATE service_templates SET duration_minutes = 60 WHERE name = 'Primera Visita / Valoración' AND vertical_type = 'fisioterapia';
UPDATE service_templates SET duration_minutes = 50 WHERE name = 'Sesión Seguimiento' AND vertical_type = 'fisioterapia';
UPDATE service_templates SET duration_minutes = 50 WHERE name = 'Tratamiento Suelo Pélvico';
UPDATE service_templates SET duration_minutes = 60 WHERE name = 'Drenaje Linfático Manual' AND vertical_type = 'fisioterapia';
UPDATE service_templates SET duration_minutes = 30 WHERE name = 'Punción Seca';
UPDATE service_templates SET duration_minutes = 60 WHERE name = 'Terapia Manual';
UPDATE service_templates SET duration_minutes = 45 WHERE name = 'Masaje Descontracturante' AND vertical_type = 'fisioterapia';
UPDATE service_templates SET duration_minutes = 30 WHERE name = 'Indiba / Radiofrecuencia';

-- MASAJES (7 servicios)
UPDATE service_templates SET duration_minutes = 60 WHERE name = 'Sesión Osteopatía';
UPDATE service_templates SET duration_minutes = 60 WHERE name = 'Masaje Descontracturante' AND vertical_type = 'masajes_osteopatia';
UPDATE service_templates SET duration_minutes = 60 WHERE name = 'Masaje Relajante';
UPDATE service_templates SET duration_minutes = 50 WHERE name = 'Masaje Deportivo';
UPDATE service_templates SET duration_minutes = 45 WHERE name = 'Reflexología Podal';
UPDATE service_templates SET duration_minutes = 30 WHERE name = 'Masaje Craneofacial';

-- PSICOLOGÍA (7 servicios)
UPDATE service_templates SET duration_minutes = 60 WHERE name = 'Primera Sesión (Psicología)';
UPDATE service_templates SET duration_minutes = 50 WHERE name = 'Sesión Seguimiento (Psicología)';
UPDATE service_templates SET duration_minutes = 75 WHERE name = 'Terapia de Pareja';
UPDATE service_templates SET duration_minutes = 90 WHERE name = 'Terapia Familiar';
UPDATE service_templates SET duration_minutes = 60 WHERE name = 'Sesión Coaching';
UPDATE service_templates SET duration_minutes = 50 WHERE name = 'Sesión Online' AND vertical_type = 'psicologia_coaching';
UPDATE service_templates SET duration_minutes = 90 WHERE name = 'Evaluación Psicológica';

-- DENTAL (8 servicios)
UPDATE service_templates SET duration_minutes = 30 WHERE name = 'Revisión General' AND vertical_type = 'clinica_dental';
UPDATE service_templates SET duration_minutes = 45 WHERE name = 'Limpieza Dental (Profilaxis)';
UPDATE service_templates SET duration_minutes = 60 WHERE name = 'Empaste (Obturación)';
UPDATE service_templates SET duration_minutes = 60 WHERE name = 'Blanqueamiento Dental';
UPDATE service_templates SET duration_minutes = 30 WHERE name = 'Extracción (Simple)';
UPDATE service_templates SET duration_minutes = 60 WHERE name = 'Endodoncia';
UPDATE service_templates SET duration_minutes = 30 WHERE name = 'Consulta Ortodoncia';
UPDATE service_templates SET duration_minutes = 30 WHERE name = 'Consulta Implantes';

-- VETERINARIO (8 servicios)
UPDATE service_templates SET duration_minutes = 30 WHERE name = 'Consulta General' AND vertical_type = 'veterinario';
UPDATE service_templates SET duration_minutes = 30 WHERE name = 'Vacunación';
UPDATE service_templates SET duration_minutes = 15 WHERE name = 'Identificación (Microchip)';
UPDATE service_templates SET duration_minutes = 15 WHERE name = 'Revisión / Seguimiento';
UPDATE service_templates SET duration_minutes = 30 WHERE name = 'Desparasitación';
UPDATE service_templates SET duration_minutes = 30 WHERE name = 'Consulta Especialidad (ej. Derma)';
UPDATE service_templates SET duration_minutes = 30 WHERE name = 'Consulta Pre-Quirúrgica';
UPDATE service_templates SET duration_minutes = 30 WHERE name = 'Analítica';

-- ENTRENADOR (7 servicios)
UPDATE service_templates SET duration_minutes = 60 WHERE name = 'Sesión Entrenamiento Personal';
UPDATE service_templates SET duration_minutes = 60 WHERE name = 'Sesión en Pareja';
UPDATE service_templates SET duration_minutes = 60 WHERE name = 'Sesión Grupo Reducido';
UPDATE service_templates SET duration_minutes = 60 WHERE name = 'Valoración Inicial / Fitness';
UPDATE service_templates SET duration_minutes = 60 WHERE name = 'Sesión Online' AND vertical_type = 'entrenador_personal';
UPDATE service_templates SET duration_minutes = 45 WHERE name = 'Seguimiento' AND vertical_type = 'entrenador_personal';
UPDATE service_templates SET duration_minutes = 45 WHERE name = 'Planificación (Rutina / Dieta)';

-- YOGA (7 servicios)
UPDATE service_templates SET duration_minutes = 60 WHERE name = 'Clase Grupal Yoga (1 Plaza)';
UPDATE service_templates SET duration_minutes = 50 WHERE name = 'Clase Grupal Pilates (1 Plaza)';
UPDATE service_templates SET duration_minutes = 60 WHERE name = 'Clase Privada Yoga';
UPDATE service_templates SET duration_minutes = 60 WHERE name = 'Clase Privada Pilates';
UPDATE service_templates SET duration_minutes = 50 WHERE name = 'Pilates Máquina (Reformer)';
UPDATE service_templates SET duration_minutes = 60 WHERE name = 'Clase Prenatal';
UPDATE service_templates SET duration_minutes = 90 WHERE name = 'Meditación Guiada';

-- 3. INSERTAR SERVICIOS NUEVOS DE TU EXCEL

-- Peluquería (11 nuevos)
INSERT INTO service_templates (vertical_type, name, category, duration_minutes, description, is_popular, sort_order)
VALUES 
('peluqueria_barberia', 'Corte (Mujer)', 'Cabello', 45, 'Corte de cabello para mujer con lavado y secado básico', true, 100),
('peluqueria_barberia', 'Corte (Hombre)', 'Cabello', 30, 'Corte de cabello para hombre con lavado', true, 101),
('peluqueria_barberia', 'Lavar y Peinar (Pelo Corto)', 'Peinado', 30, 'Lavado y peinado para cabello corto', false, 102),
('peluqueria_barberia', 'Lavar y Peinar (Pelo Largo)', 'Peinado', 45, 'Lavado y peinado para cabello largo', false, 103),
('peluqueria_barberia', 'Corte + Arreglo de Barba', 'Barbería', 45, 'Corte con arreglo completo de barba', true, 104),
('peluqueria_barberia', 'Tinte Raíz', 'Color', 60, 'Tinte de raíces', true, 105),
('peluqueria_barberia', 'Tinte Completo', 'Color', 90, 'Tinte completo', true, 106),
('peluqueria_barberia', 'Mechas (Balayage)', 'Color', 180, 'Mechas balayage', true, 107),
('peluqueria_barberia', 'Mechas (Tradicionales)', 'Color', 120, 'Mechas tradicionales', false, 108),
('peluqueria_barberia', 'Tratamiento Hidratante', 'Tratamiento', 30, 'Tratamiento hidratante capilar', false, 109),
('peluqueria_barberia', 'Recogido (Evento)', 'Peinado', 60, 'Recogido para eventos', false, 110);

-- Estética (7 nuevos)
INSERT INTO service_templates (vertical_type, name, category, duration_minutes, description, is_popular, sort_order)
VALUES 
('centro_estetica', 'Tratamiento Antiedad', 'Facial', 75, 'Tratamiento facial antiedad', true, 200),
('centro_estetica', 'Microneedling', 'Facial', 60, 'Microagujas regeneración', false, 201),
('centro_estetica', 'Masaje Anticelulítico', 'Corporal', 50, 'Masaje reductor', false, 202),
('centro_estetica', 'Depilación Láser (Piernas)', 'Depilación', 60, 'Láser piernas completas', true, 203),
('centro_estetica', 'Depilación Láser (Axilas)', 'Depilación', 15, 'Láser axilas', false, 204),
('centro_estetica', 'Depilación Láser (Ingles)', 'Depilación', 15, 'Láser ingles', false, 205),
('centro_estetica', 'Masaje Facial (Kobido)', 'Facial', 30, 'Masaje facial japonés', false, 206);

-- Uñas (4 nuevos)
INSERT INTO service_templates (vertical_type, name, category, duration_minutes, description, is_popular, sort_order)
VALUES 
('centro_unas', 'Manicura Rusa (Combinada)', 'Manos', 60, 'Manicura rusa combinada', true, 300),
('centro_unas', 'Pedicura (Tradicional)', 'Pies', 45, 'Pedicura tradicional', false, 301),
('centro_unas', 'Quitar Semipermanente', 'Manos', 15, 'Retirada semipermanente', false, 302),
('centro_unas', 'Extra: Nail Art (por uña)', 'Extras', 5, 'Decoración por uña', false, 303);

-- Fisioterapia (4 nuevos)
INSERT INTO service_templates (vertical_type, name, category, duration_minutes, description, is_popular, sort_order)
VALUES 
('fisioterapia', 'Tratamiento Lesión Deportiva', 'Deportivo', 50, 'Lesiones deportivas', true, 400),
('fisioterapia', 'Rehabilitación Suelo Pélvico', 'Especializada', 50, 'Rehabilitación suelo pélvico', false, 401),
('fisioterapia', 'Sesión Osteopatía (Estructural)', 'Osteopatía', 60, 'Osteopatía estructural', true, 402),
('fisioterapia', 'Sesión Fisioterapia', 'Traumatología', 50, 'Sesión fisioterapia general', true, 403);

-- Masajes (3 nuevos)
INSERT INTO service_templates (vertical_type, name, category, duration_minutes, description, is_popular, sort_order)
VALUES 
('masajes_osteopatia', 'Masaje Relajante (60 min)', 'Relajante', 60, 'Masaje relajante 60min', true, 500),
('masajes_osteopatia', 'Masaje Relajante (90 min)', 'Relajante', 90, 'Masaje relajante 90min', true, 501),
('masajes_osteopatia', 'Masaje Prenatal', 'Especializado', 50, 'Masaje para embarazadas', false, 502);

-- Psicología (2 nuevos)
INSERT INTO service_templates (vertical_type, name, category, duration_minutes, description, is_popular, sort_order)
VALUES 
('psicologia_coaching', 'Sesión Individual (Online)', 'Terapia Individual', 50, 'Terapia online', false, 600),
('psicologia_coaching', 'Primera Visita (Evaluación)', 'Evaluación', 60, 'Primera sesión evaluación', true, 601);

-- Dental (4 nuevos)
INSERT INTO service_templates (vertical_type, name, category, duration_minutes, description, is_popular, sort_order)
VALUES 
('clinica_dental', 'Primera Visita (Revisión y Diag.)', 'Revisión', 30, 'Primera visita diagnóstico', true, 700),
('clinica_dental', 'Urgencia Dental', 'Urgencia', 30, 'Urgencia dental', false, 701),
('clinica_dental', 'Revisión Infantil', 'Infantil', 30, 'Revisión niños', false, 702),
('clinica_dental', 'Consulta Implantes', 'Implantología', 30, 'Evaluación implantes', false, 703);

-- Veterinario (9 nuevos)
INSERT INTO service_templates (vertical_type, name, category, duration_minutes, description, is_popular, sort_order)
VALUES 
('veterinario', 'Consulta Vacunación (Perro)', 'Preventivo', 30, 'Vacunación perros', true, 800),
('veterinario', 'Consulta Vacunación (Gato)', 'Preventivo', 30, 'Vacunación gatos', true, 801),
('veterinario', 'Consulta Exóticos', 'Especializada', 30, 'Animales exóticos', false, 802),
('veterinario', 'Peluquería Canina (Baño y Corte)', 'Estética', 90, 'Baño y corte perros', true, 803),
('veterinario', 'Corte de Uñas', 'Estética', 10, 'Corte uñas', false, 804),
('veterinario', 'Consulta Urgencia', 'Urgencia', 30, 'Urgencia veterinaria', true, 805),
('veterinario', 'Consulta Pre-Quirúrgica', 'Cirugía', 30, 'Pre-operatorio', false, 806),
('veterinario', 'Analítica', 'Diagnóstico', 30, 'Análisis sangre/orina', false, 807),
('veterinario', 'Revisión (Post-operatoria)', 'Cirugía', 15, 'Post-operatorio', true, 808);

-- Entrenador (5 nuevos)
INSERT INTO service_templates (vertical_type, name, category, duration_minutes, description, is_popular, sort_order)
VALUES 
('entrenador_personal', 'Entrenamiento en Pareja (Dúo)', 'Personal', 60, 'Entrenamiento pareja', false, 900),
('entrenador_personal', 'Entrenamiento Grupo Reducido', 'Grupal', 60, 'Grupo reducido', false, 901),
('entrenador_personal', 'Consulta Nutricional', 'Nutrición', 45, 'Nutrición deportiva', false, 902),
('entrenador_personal', 'Evaluación Inicial (Física + Dieta)', 'Valoración', 60, 'Evaluación completa', true, 903),
('entrenador_personal', 'Sesión Online', 'Online', 60, 'Entrenamiento online', false, 904);

-- Yoga (5 nuevos)
INSERT INTO service_templates (vertical_type, name, category, duration_minutes, description, is_popular, sort_order)
VALUES 
('yoga_pilates', 'Clase de Yoga (Grupal)', 'Yoga', 60, 'Yoga grupal', true, 1000),
('yoga_pilates', 'Clase de Pilates Mat (Grupal)', 'Pilates', 50, 'Pilates grupal', true, 1001),
('yoga_pilates', 'Clase Privada (Yoga o Pilates)', 'Privado', 60, 'Clase privada', false, 1002),
('yoga_pilates', 'Taller de Meditación', 'Meditación', 90, 'Meditación mindfulness', false, 1003),
('yoga_pilates', 'Primera Clase (Prueba)', 'Prueba', 60, 'Clase de prueba', true, 1004);



