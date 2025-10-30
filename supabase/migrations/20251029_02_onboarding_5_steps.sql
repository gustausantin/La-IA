-- =====================================================
-- MIGRACIÓN: ONBOARDING DE 5 PASOS
-- =====================================================
-- Fecha: 2025-10-29
-- Propósito: Actualizar service_templates para el nuevo onboarding
-- Elimina campos obligatorios de precio y duración
-- Los usuarios los definirán en la "Configuración Guiada" post-onboarding
-- =====================================================

-- ====================
-- PASO 1: MODIFICAR ESTRUCTURA
-- ====================
-- Hacer que duration_minutes y suggested_price sean opcionales (nullable)
-- Ya que cada usuario definirá sus propios valores en la configuración guiada

ALTER TABLE service_templates 
  ALTER COLUMN duration_minutes DROP NOT NULL,
  ALTER COLUMN suggested_price DROP NOT NULL;

-- ====================
-- PASO 2: LIMPIAR Y REPOBLAR
-- ====================
-- Eliminar todos los servicios existentes y repoblar con servicios limpios
-- Sin precios ni duraciones predefinidas

TRUNCATE service_templates CASCADE;

-- Insertar servicios limpios y profesionales
-- Solo con nombre, descripción corta (para IA), y categoría (para UI)
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
  ('fisioterapia', 'Primera Visita / Valoración', 'Evaluación inicial', 'Consulta', true, 1),
  ('fisioterapia', 'Sesión Seguimiento', 'Sesión de fisioterapia', 'Traumatología', true, 2),
  ('fisioterapia', 'Tratamiento Suelo Pélvico', 'Fisioterapia uroginecológica', 'Especializada', false, 3),
  ('fisioterapia', 'Drenaje Linfático Manual', 'Masaje de drenaje', 'Terapéutico', false, 4),
  ('fisioterapia', 'Punción Seca', 'Tratamiento con agujas', 'Traumatología', true, 5),
  ('fisioterapia', 'Terapia Manual', 'Técnicas manuales', 'Traumatología', false, 6),
  ('fisioterapia', 'Masaje Descontracturante', 'Masaje terapéutico', 'Terapéutico', false, 7),
  ('fisioterapia', 'Indiba / Radiofrecuencia', 'Tratamiento con tecnología', 'Tecnología', false, 8),

  -- =====================================================
  -- MASAJES / OSTEOPATÍA (7 servicios)
  -- =====================================================
  ('masajes_osteopatia', 'Sesión Osteopatía', 'Tratamiento osteopático', 'Osteopatía', true, 1),
  ('masajes_osteopatia', 'Masaje Descontracturante', 'Masaje terapéutico', 'Terapéutico', true, 2),
  ('masajes_osteopatia', 'Masaje Relajante', 'Masaje para relajación', 'Relajante', true, 3),
  ('masajes_osteopatia', 'Masaje Deportivo', 'Masaje para recuperación', 'Deportivo', false, 4),
  ('masajes_osteopatia', 'Reflexología Podal', 'Terapia en pies', 'Especializada', false, 5),
  ('masajes_osteopatia', 'Masaje Craneofacial', 'Masaje cabeza y cara', 'Relajante', false, 6),
  ('masajes_osteopatia', 'Drenaje Linfático Manual', 'Masaje de drenaje', 'Terapéutico', false, 7),

  -- =====================================================
  -- CLÍNICA DENTAL (8 servicios)
  -- =====================================================
  ('clinica_dental', 'Revisión General', 'Chequeo dental completo', 'Consulta', true, 1),
  ('clinica_dental', 'Limpieza Dental (Profilaxis)', 'Limpieza profesional', 'Preventivo', true, 2),
  ('clinica_dental', 'Empaste (Obturación)', 'Restauración dental', 'Tratamiento', true, 3),
  ('clinica_dental', 'Blanqueamiento Dental', 'Aclarado de dientes', 'Estética', false, 4),
  ('clinica_dental', 'Extracción (Simple)', 'Extracción de diente', 'Cirugía', false, 5),
  ('clinica_dental', 'Endodoncia', 'Tratamiento de conducto', 'Tratamiento', false, 6),
  ('clinica_dental', 'Consulta Ortodoncia', 'Evaluación de ortodoncia', 'Consulta', false, 7),
  ('clinica_dental', 'Consulta Implantes', 'Evaluación de implantes', 'Consulta', false, 8),

  -- =====================================================
  -- PSICOLOGÍA / COACHING (7 servicios)
  -- =====================================================
  ('psicologia_coaching', 'Primera Sesión (Psicología)', 'Evaluación inicial', 'Psicología', true, 1),
  ('psicologia_coaching', 'Sesión Seguimiento (Psicología)', 'Terapia individual', 'Psicología', true, 2),
  ('psicologia_coaching', 'Terapia de Pareja', 'Sesión para parejas', 'Psicología', true, 3),
  ('psicologia_coaching', 'Terapia Familiar', 'Sesión familiar', 'Psicología', false, 4),
  ('psicologia_coaching', 'Sesión Coaching', 'Sesión de coaching', 'Coaching', false, 5),
  ('psicologia_coaching', 'Sesión Online', 'Consulta online', 'Modalidad', false, 6),
  ('psicologia_coaching', 'Evaluación Psicológica', 'Test y diagnóstico', 'Evaluación', false, 7),

  -- =====================================================
  -- CENTRO ESTÉTICA (9 servicios)
  -- =====================================================
  ('centro_estetica', 'Limpieza Facial Profunda', 'Limpieza de cutis', 'Facial', true, 1),
  ('centro_estetica', 'Tratamiento Hidratante', 'Hidratación facial', 'Facial', true, 2),
  ('centro_estetica', 'Depilación Láser', 'Eliminación de vello', 'Depilación', true, 3),
  ('centro_estetica', 'Peeling Químico', 'Exfoliación profunda', 'Facial', false, 4),
  ('centro_estetica', 'Radiofrecuencia Facial', 'Rejuvenecimiento facial', 'Tecnología', false, 5),
  ('centro_estetica', 'Maderoterapia', 'Masaje reductor', 'Corporal', false, 6),
  ('centro_estetica', 'Presoterapia', 'Drenaje linfático', 'Corporal', false, 7),
  ('centro_estetica', 'Masaje Facial (Kobido)', 'Masaje lifting facial', 'Facial', false, 8),
  ('centro_estetica', 'Lifting de Pestañas', 'Tratamiento de pestañas', 'Ojos', false, 9),

  -- =====================================================
  -- PELUQUERÍA / BARBERÍA (10 servicios)
  -- =====================================================
  ('peluqueria_barberia', 'Corte Mujer', 'Corte de pelo femenino', 'Cabello', true, 1),
  ('peluqueria_barberia', 'Corte Hombre', 'Corte de pelo masculino', 'Cabello', true, 2),
  ('peluqueria_barberia', 'Corte Niño/a', 'Corte de pelo infantil', 'Cabello', false, 3),
  ('peluqueria_barberia', 'Peinar (Secador)', 'Peinado con secador', 'Cabello', true, 4),
  ('peluqueria_barberia', 'Color (Tinte Raíz)', 'Tinte de raíces', 'Color', true, 5),
  ('peluqueria_barberia', 'Mechas (Balayage / Babylights)', 'Técnicas de mechas', 'Color', false, 6),
  ('peluqueria_barberia', 'Tratamiento Hidratación', 'Tratamiento capilar', 'Cabello', false, 7),
  ('peluqueria_barberia', 'Alisado Keratina', 'Alisado permanente', 'Cabello', false, 8),
  ('peluqueria_barberia', 'Recogido', 'Peinado recogido', 'Cabello', false, 9),
  ('peluqueria_barberia', 'Arreglo Barba', 'Recorte y perfilado', 'Barbería', false, 10),

  -- =====================================================
  -- CENTRO UÑAS (8 servicios)
  -- =====================================================
  ('centro_unas', 'Manicura Semipermanente', 'Esmaltado duradero', 'Manos', true, 1),
  ('centro_unas', 'Pedicura Semipermanente', 'Esmaltado duradero pies', 'Pies', true, 2),
  ('centro_unas', 'Uñas Acrílicas (Nuevas)', 'Extensión con acrílico', 'Manos', true, 3),
  ('centro_unas', 'Uñas Acrílicas (Relleno)', 'Mantenimiento acrílicas', 'Manos', false, 4),
  ('centro_unas', 'Uñas de Gel (Nuevas)', 'Extensión con gel', 'Manos', false, 5),
  ('centro_unas', 'Uñas de Gel (Relleno)', 'Mantenimiento gel', 'Manos', false, 6),
  ('centro_unas', 'Quitar (Acrílico/Gel)', 'Retirada de extensiones', 'Manos', false, 7),
  ('centro_unas', 'Manicura Tradicional', 'Manicura básica', 'Manos', false, 8),

  -- =====================================================
  -- ENTRENADOR PERSONAL (7 servicios)
  -- =====================================================
  ('entrenador_personal', 'Sesión Entrenamiento Personal', 'Entrenamiento 1 a 1', 'Entrenamiento', true, 1),
  ('entrenador_personal', 'Sesión en Pareja', 'Entrenamiento para 2', 'Entrenamiento', true, 2),
  ('entrenador_personal', 'Sesión Grupo Reducido', 'Entrenamiento en grupo', 'Entrenamiento', false, 3),
  ('entrenador_personal', 'Valoración Inicial / Fitness', 'Evaluación y plan', 'Consulta', false, 4),
  ('entrenador_personal', 'Sesión Online', 'Entrenamiento a distancia', 'Modalidad', false, 5),
  ('entrenador_personal', 'Planificación (Rutina / Dieta)', 'Diseño de plan', 'Asesoramiento', false, 6),
  ('entrenador_personal', 'Seguimiento', 'Revisión de progreso', 'Asesoramiento', false, 7),

  -- =====================================================
  -- YOGA / PILATES (7 servicios)
  -- =====================================================
  ('yoga_pilates', 'Clase Grupal Yoga (1 Plaza)', 'Clase de yoga en grupo', 'Yoga', true, 1),
  ('yoga_pilates', 'Clase Grupal Pilates (1 Plaza)', 'Clase de pilates en grupo', 'Pilates', true, 2),
  ('yoga_pilates', 'Clase Privada Yoga', 'Sesión individual de yoga', 'Yoga', true, 3),
  ('yoga_pilates', 'Clase Privada Pilates', 'Sesión individual de pilates', 'Pilates', false, 4),
  ('yoga_pilates', 'Pilates Máquina (Reformer)', 'Clase con máquina', 'Pilates', false, 5),
  ('yoga_pilates', 'Clase Prenatal', 'Yoga/Pilates para embarazadas', 'Especializada', false, 6),
  ('yoga_pilates', 'Meditación Guiada', 'Sesión de meditación', 'Bienestar', false, 7),

  -- =====================================================
  -- VETERINARIO (8 servicios)
  -- =====================================================
  ('veterinario', 'Consulta General', 'Revisión veterinaria', 'Consulta', true, 1),
  ('veterinario', 'Vacunación', 'Administración de vacunas', 'Preventivo', true, 2),
  ('veterinario', 'Desparasitación', 'Tratamiento antiparasitario', 'Preventivo', true, 3),
  ('veterinario', 'Revisión / Seguimiento', 'Control de salud', 'Consulta', false, 4),
  ('veterinario', 'Identificación (Microchip)', 'Implantación de microchip', 'Servicio', false, 5),
  ('veterinario', 'Analítica', 'Análisis de laboratorio', 'Diagnóstico', false, 6),
  ('veterinario', 'Consulta Especialidad (ej. Derma)', 'Consulta especializada', 'Consulta', false, 7),
  ('veterinario', 'Consulta Pre-Quirúrgica', 'Evaluación pre-cirugía', 'Consulta', false, 8);

-- ====================
-- VERIFICACIÓN
-- ====================
-- Verificar que los servicios se han insertado correctamente
SELECT 
  vertical_type,
  COUNT(*) as total_servicios,
  SUM(CASE WHEN is_popular THEN 1 ELSE 0 END) as servicios_populares
FROM service_templates
GROUP BY vertical_type
ORDER BY vertical_type;

-- ====================
-- FIN DE LA MIGRACIÓN
-- ====================



