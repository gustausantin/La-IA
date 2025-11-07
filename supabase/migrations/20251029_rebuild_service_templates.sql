-- =====================================================
-- REBUILD SERVICE TEMPLATES - CLEAN & PROFESSIONAL
-- =====================================================
-- Elimina precios y duraciones (los define el usuario)
-- Mantiene categorías y descripciones cortas (para IA)
-- Basado en servicios reales del mercado español
-- =====================================================

-- 1. LIMPIAR tabla completamente
TRUNCATE service_templates CASCADE;

-- 2. INSERTAR servicios limpios y profesionales
INSERT INTO service_templates (
  vertical_type, 
  name, 
  description, 
  category, 
  is_popular, 
  sort_order
)
VALUES
  -- =====================================================
  -- FISIOTERAPIA (8 servicios)
  -- =====================================================
  ('fisioterapia', 'Primera Visita / Valoración', 'Evaluación inicial del paciente', 'Consulta', true, 1),
  ('fisioterapia', 'Sesión Seguimiento', 'Sesión de fisioterapia general', 'Traumatología', true, 2),
  ('fisioterapia', 'Tratamiento Suelo Pélvico', 'Fisioterapia uroginecológica', 'Especializada', false, 3),
  ('fisioterapia', 'Drenaje Linfático Manual', 'Masaje de drenaje terapéutico', 'Terapéutico', false, 4),
  ('fisioterapia', 'Punción Seca', 'Tratamiento con agujas en puntos gatillo', 'Traumatología', true, 5),
  ('fisioterapia', 'Terapia Manual', 'Técnicas manuales osteoarticulares', 'Traumatología', false, 6),
  ('fisioterapia', 'Masaje Descontracturante', 'Masaje terapéutico muscular', 'Terapéutico', false, 7),
  ('fisioterapia', 'Indiba / Radiofrecuencia', 'Tratamiento con tecnología Indiba', 'Tecnología', false, 8),

  -- =====================================================
  -- MASAJES / OSTEOPATÍA (7 servicios)
  -- =====================================================
  ('masajes_osteopatia', 'Sesión Osteopatía', 'Tratamiento osteopático completo', 'Osteopatía', true, 1),
  ('masajes_osteopatia', 'Masaje Descontracturante', 'Tratamiento de contracturas musculares', 'Terapéutico', true, 2),
  ('masajes_osteopatia', 'Masaje Relajante', 'Masaje corporal relajante', 'Relajante', true, 3),
  ('masajes_osteopatia', 'Masaje Deportivo', 'Masaje para deportistas', 'Deportivo', false, 4),
  ('masajes_osteopatia', 'Reflexología Podal', 'Masaje terapéutico en pies', 'Terapéutico', false, 5),
  ('masajes_osteopatia', 'Masaje Craneofacial', 'Masaje facial y craneal', 'Especializado', false, 6),
  ('masajes_osteopatia', 'Drenaje Linfático Manual', 'Masaje de drenaje', 'Terapéutico', false, 7),

  -- =====================================================
  -- CLÍNICA DENTAL (8 servicios)
  -- =====================================================
  ('clinica_dental', 'Revisión General', 'Revisión dental completa', 'Revisión', true, 1),
  ('clinica_dental', 'Limpieza Dental (Profilaxis)', 'Limpieza y profilaxis profesional', 'Higiene', true, 2),
  ('clinica_dental', 'Empaste (Obturación)', 'Restauración dental con composite', 'Tratamiento', true, 3),
  ('clinica_dental', 'Blanqueamiento Dental', 'Blanqueamiento profesional', 'Estética', false, 4),
  ('clinica_dental', 'Extracción (Simple)', 'Extracción dental simple', 'Cirugía', false, 5),
  ('clinica_dental', 'Endodoncia', 'Tratamiento de conductos', 'Tratamiento', false, 6),
  ('clinica_dental', 'Consulta Ortodoncia', 'Evaluación ortodóncica', 'Ortodoncia', false, 7),
  ('clinica_dental', 'Consulta Implantes', 'Evaluación para implantes', 'Implantología', false, 8),

  -- =====================================================
  -- PSICOLOGÍA / COACHING (7 servicios)
  -- =====================================================
  ('psicologia_coaching', 'Primera Sesión (Psicología)', 'Primera sesión de evaluación', 'Terapia Individual', true, 1),
  ('psicologia_coaching', 'Sesión Seguimiento (Psicología)', 'Sesión de terapia individual', 'Terapia Individual', true, 2),
  ('psicologia_coaching', 'Terapia de Pareja', 'Sesión de terapia de pareja', 'Terapia Pareja', false, 3),
  ('psicologia_coaching', 'Terapia Familiar', 'Sesión de terapia familiar', 'Terapia Familiar', false, 4),
  ('psicologia_coaching', 'Sesión Coaching', 'Coaching personal o profesional', 'Coaching', true, 5),
  ('psicologia_coaching', 'Sesión Online', 'Sesión de terapia online', 'Terapia Individual', false, 6),
  ('psicologia_coaching', 'Evaluación Psicológica', 'Evaluación y diagnóstico', 'Evaluación', false, 7),

  -- =====================================================
  -- CENTRO DE ESTÉTICA (9 servicios)
  -- =====================================================
  ('centro_estetica', 'Limpieza Facial Profunda', 'Limpieza facial completa', 'Facial', true, 1),
  ('centro_estetica', 'Tratamiento Hidratante', 'Tratamiento hidratante facial', 'Facial', true, 2),
  ('centro_estetica', 'Peeling Químico', 'Exfoliación química profesional', 'Facial', false, 3),
  ('centro_estetica', 'Depilación Láser', 'Sesión de depilación láser', 'Depilación', true, 4),
  ('centro_estetica', 'Radiofrecuencia Facial', 'Tratamiento antiedad facial', 'Facial', false, 5),
  ('centro_estetica', 'Maderoterapia', 'Masaje corporal con maderas', 'Corporal', false, 6),
  ('centro_estetica', 'Presoterapia', 'Tratamiento de drenaje con presión', 'Corporal', false, 7),
  ('centro_estetica', 'Masaje Facial (Kobido)', 'Masaje facial japonés', 'Facial', false, 8),
  ('centro_estetica', 'Lifting de Pestañas', 'Tratamiento de pestañas', 'Pestañas', false, 9),

  -- =====================================================
  -- PELUQUERÍA / BARBERÍA (10 servicios)
  -- =====================================================
  ('peluqueria_barberia', 'Corte y Peinado', 'Corte de pelo con peinado', 'Cabello', true, 1),
  ('peluqueria_barberia', 'Corte + Barba', 'Corte de pelo con arreglo de barba', 'Cabello', true, 2),
  ('peluqueria_barberia', 'Corte Niño/a', 'Corte de pelo infantil', 'Cabello', true, 3),
  ('peluqueria_barberia', 'Peinar (Secador)', 'Peinado con secador', 'Peinado', false, 4),
  ('peluqueria_barberia', 'Color (Tinte Raíz)', 'Tinte de raíces', 'Color', false, 5),
  ('peluqueria_barberia', 'Mechas (Balayage / Babylights)', 'Mechas californianas o balayage', 'Color', false, 6),
  ('peluqueria_barberia', 'Tratamiento Hidratación', 'Tratamiento capilar hidratante', 'Tratamiento', false, 7),
  ('peluqueria_barberia', 'Alisado Keratina', 'Alisado brasileño con keratina', 'Tratamiento', false, 8),
  ('peluqueria_barberia', 'Recogido', 'Peinado recogido o eventos', 'Peinado', false, 9),
  ('peluqueria_barberia', 'Arreglo Barba', 'Arreglo y perfilado de barba', 'Barbería', true, 10),

  -- =====================================================
  -- CENTRO DE UÑAS (8 servicios)
  -- =====================================================
  ('centro_unas', 'Manicura Semipermanente', 'Manicura con esmalte semipermanente', 'Manos', true, 1),
  ('centro_unas', 'Pedicura Semipermanente', 'Pedicura con esmalte semipermanente', 'Pies', true, 2),
  ('centro_unas', 'Uñas Acrílicas (Nuevas)', 'Aplicación completa de acrílico', 'Manos', true, 3),
  ('centro_unas', 'Uñas Acrílicas (Relleno)', 'Relleno de uñas acrílicas', 'Manos', false, 4),
  ('centro_unas', 'Uñas de Gel (Nuevas)', 'Aplicación completa de gel', 'Manos', false, 5),
  ('centro_unas', 'Uñas de Gel (Relleno)', 'Relleno de uñas de gel', 'Manos', false, 6),
  ('centro_unas', 'Quitar (Acrílico/Gel)', 'Retirada de uñas artificiales', 'Manos', false, 7),
  ('centro_unas', 'Manicura Tradicional', 'Manicura básica con esmalte', 'Manos', false, 8),

  -- =====================================================
  -- ENTRENADOR PERSONAL (7 servicios)
  -- =====================================================
  ('entrenador_personal', 'Sesión Entrenamiento Personal', 'Entrenamiento personalizado 1 a 1', 'Personal', true, 1),
  ('entrenador_personal', 'Sesión en Pareja', 'Entrenamiento para dos personas', 'Personal', false, 2),
  ('entrenador_personal', 'Sesión Grupo Reducido', 'Entrenamiento en grupo pequeño', 'Grupal', false, 3),
  ('entrenador_personal', 'Valoración Inicial / Fitness', 'Valoración física completa', 'Valoración', true, 4),
  ('entrenador_personal', 'Sesión Online', 'Entrenamiento online', 'Online', false, 5),
  ('entrenador_personal', 'Planificación (Rutina / Dieta)', 'Plan de entrenamiento y nutrición', 'Planificación', false, 6),
  ('entrenador_personal', 'Seguimiento', 'Sesión de seguimiento y ajustes', 'Seguimiento', false, 7),

  -- =====================================================
  -- YOGA / PILATES (7 servicios)
  -- =====================================================
  ('yoga_pilates', 'Clase Grupal Yoga (1 Plaza)', 'Clase de yoga en grupo', 'Yoga', true, 1),
  ('yoga_pilates', 'Clase Grupal Pilates (1 Plaza)', 'Clase de pilates en grupo', 'Pilates', true, 2),
  ('yoga_pilates', 'Clase Privada Yoga', 'Clase privada de yoga', 'Yoga Privado', false, 3),
  ('yoga_pilates', 'Clase Privada Pilates', 'Clase privada de pilates', 'Pilates Privado', false, 4),
  ('yoga_pilates', 'Pilates Máquina (Reformer)', 'Pilates con máquina reformer', 'Pilates', true, 5),
  ('yoga_pilates', 'Clase Prenatal', 'Yoga o pilates para embarazadas', 'Especializado', false, 6),
  ('yoga_pilates', 'Meditación Guiada', 'Sesión de meditación', 'Meditación', false, 7),

  -- =====================================================
  -- VETERINARIO (8 servicios)
  -- =====================================================
  ('veterinario', 'Consulta General', 'Consulta veterinaria general', 'Consulta', true, 1),
  ('veterinario', 'Vacunación', 'Vacunación animal', 'Preventivo', true, 2),
  ('veterinario', 'Desparasitación', 'Tratamiento antiparasitario', 'Preventivo', false, 3),
  ('veterinario', 'Revisión / Seguimiento', 'Revisión de control', 'Consulta', true, 4),
  ('veterinario', 'Identificación (Microchip)', 'Implantación de microchip', 'Preventivo', false, 5),
  ('veterinario', 'Analítica', 'Análisis de sangre u orina', 'Diagnóstico', false, 6),
  ('veterinario', 'Consulta Especialidad (ej. Derma)', 'Consulta de especialidad', 'Especializada', false, 7),
  ('veterinario', 'Consulta Pre-Quirúrgica', 'Evaluación pre-operatoria', 'Cirugía', false, 8);

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- Contar servicios por vertical
SELECT 
  vertical_type,
  COUNT(*) as total_servicios,
  SUM(CASE WHEN is_popular THEN 1 ELSE 0 END) as servicios_populares
FROM service_templates
GROUP BY vertical_type
ORDER BY vertical_type;



