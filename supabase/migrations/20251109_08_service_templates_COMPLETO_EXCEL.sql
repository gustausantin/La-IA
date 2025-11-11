-- =====================================================
-- SERVICE TEMPLATES - SEGÚN EXCEL DEL USUARIO
-- TODOS LOS VERTICALES CON DESCRIPCIÓN
-- =====================================================

-- LIMPIAR TODO
DELETE FROM service_templates;

-- =====================================================
-- PELUQUERÍA Y BARBERÍA (22 servicios)
-- =====================================================
INSERT INTO service_templates (vertical_type, category, name, duration_minutes, description, is_popular, sort_order) VALUES
('peluqueria_barberia', 'Corte', 'Corte (Mujer)', 45, 'Corte de cabello para mujer con lavado y secado', true, 1),
('peluqueria_barberia', 'Corte', 'Corte (Hombre)', 30, 'Corte de cabello para hombre con lavado', true, 2),
('peluqueria_barberia', 'Corte', 'Corte (Niño/a)', 30, 'Corte de pelo infantil', true, 3),
('peluqueria_barberia', 'Peinado', 'Lavar y Peinar (Pelo Corto)', 30, 'Lavado y secado para cabello corto', false, 4),
('peluqueria_barberia', 'Peinado', 'Lavar y Peinar (Pelo Medio)', 45, 'Lavado y secado para cabello medio', false, 5),
('peluqueria_barberia', 'Peinado', 'Lavar y Peinar (Pelo Largo)', 60, 'Lavado y secado para cabello largo', false, 6),
('peluqueria_barberia', 'Barbería', 'Corte + Arreglo de Barba', 45, 'Servicio completo de corte y barba', true, 7),
('peluqueria_barberia', 'Barbería', 'Arreglo de Barba (Perfilado)', 15, 'Arreglo y perfilado de barba', false, 8),
('peluqueria_barberia', 'Barbería', 'Afeitado (Ritual con toalla caliente)', 30, 'Afeitado clásico con navaja y toallas calientes', false, 9),
('peluqueria_barberia', 'Color', 'Tinte Raíz (Coloración)', 90, 'Aplicación de tinte solo en raíces', true, 10),
('peluqueria_barberia', 'Color', 'Tinte Completo (Coloración)', 120, 'Tinte completo del cabello', true, 11),
('peluqueria_barberia', 'Color', 'Tinte (Barba)', 15, 'Coloración de barba', false, 12),
('peluqueria_barberia', 'Color', 'Mechas (Balayage)', 180, 'Técnica de mechas con efecto natural balayage', true, 13),
('peluqueria_barberia', 'Color', 'Mechas (Babylights)', 180, 'Mechas finas y naturales estilo babylights', false, 14),
('peluqueria_barberia', 'Color', 'Mechas (Tradicionales Plata)', 120, 'Mechas tradicionales con papel de aluminio', false, 15),
('peluqueria_barberia', 'Color', 'Decoloración Global', 180, 'Aclarado completo del cabello', false, 16),
('peluqueria_barberia', 'Color', 'Matiz / Tonalizador', 30, 'Tratamiento para neutralizar tonos no deseados', false, 17),
('peluqueria_barberia', 'Tratamientos', 'Tratamiento Alisado (Keratina)', 180, 'Alisado permanente con keratina', false, 18),
('peluqueria_barberia', 'Tratamientos', 'Tratamiento Hidratante (Olaplex, etc.)', 30, 'Tratamiento de hidratación profunda', false, 19),
('peluqueria_barberia', 'Peinado', 'Recogido (Evento)', 60, 'Peinado recogido para eventos especiales', false, 20),
('peluqueria_barberia', 'Peinado', 'Semirecogido', 45, 'Peinado semirecogido', false, 21),
('peluqueria_barberia', 'Tratamientos', 'Permanente', 120, 'Rizado permanente del cabello', false, 22);

-- =====================================================
-- CENTRO DE ESTÉTICA (27 servicios)
-- =====================================================
INSERT INTO service_templates (vertical_type, category, name, duration_minutes, description, is_popular, sort_order) VALUES
('centro_estetica', 'Facial', 'Limpieza Facial Profunda', 60, 'Limpieza profunda de cutis con extracción', true, 100),
('centro_estetica', 'Facial', 'Higiene Facial (Básica)', 45, 'Limpieza facial básica', false, 101),
('centro_estetica', 'Facial', 'Tratamiento Antiedad (Anti-aging)', 75, 'Tratamiento facial antienvejecimiento', true, 102),
('centro_estetica', 'Facial', 'Tratamiento Hidratante Facial', 60, 'Hidratación profunda facial', false, 103),
('centro_estetica', 'Facial', 'Tratamiento Vitamina C (Luminosidad)', 60, 'Tratamiento iluminador con vitamina C', false, 104),
('centro_estetica', 'Facial', 'Tratamiento Acné', 60, 'Tratamiento especializado para acné', false, 105),
('centro_estetica', 'Facial', 'Peeling Químico (Superficial)', 30, 'Exfoliación química superficial', false, 106),
('centro_estetica', 'Facial', 'Microneedling (Dermapen)', 60, 'Tratamiento de microagujas para regeneración', false, 107),
('centro_estetica', 'Facial', 'Radiofrecuencia Facial', 45, 'Reafirmación facial con radiofrecuencia', false, 108),
('centro_estetica', 'Corporal', 'Masaje Anticelulítico (Sesión)', 50, 'Masaje específico para reducir celulitis', false, 109),
('centro_estetica', 'Corporal', 'Maderoterapia (Sesión Corporal)', 50, 'Masaje con herramientas de madera', false, 110),
('centro_estetica', 'Corporal', 'Presoterapia (Sesión)', 30, 'Drenaje con presión neumática', false, 111),
('centro_estetica', 'Corporal', 'Radiofrecuencia Corporal', 45, 'Reafirmación corporal con radiofrecuencia', false, 112),
('centro_estetica', 'Corporal', 'Cavitación (Sesión)', 40, 'Reducción de grasa localizada con ultrasonidos', false, 113),
('centro_estetica', 'Corporal', 'Envoltura de Algas (Detox)', 60, 'Tratamiento corporal detox con algas', false, 114),
('centro_estetica', 'Depilación', 'Depilación Cera (Piernas Enteras)', 45, 'Depilación con cera de piernas completas', true, 115),
('centro_estetica', 'Depilación', 'Depilación Cera (Medias Piernas)', 20, 'Depilación con cera de medias piernas', false, 116),
('centro_estetica', 'Depilación', 'Depilación Cera (Ingles Brasileñas)', 30, 'Depilación íntima brasileña con cera', false, 117),
('centro_estetica', 'Depilación', 'Depilación Cera (Axilas)', 15, 'Depilación de axilas con cera', false, 118),
('centro_estetica', 'Depilación', 'Depilación Cera (Labio Superior)', 10, 'Depilación de labio superior con cera', false, 119),
('centro_estetica', 'Cejas y Pestañas', 'Diseño de Cejas', 20, 'Diseño y depilación de cejas', false, 120),
('centro_estetica', 'Depilación', 'Depilación Láser Diodo (Piernas)', 60, 'Depilación láser de piernas completas', false, 121),
('centro_estetica', 'Depilación', 'Depilación Láser Diodo (Ingles)', 15, 'Depilación láser zona íntima', false, 122),
('centro_estetica', 'Depilación', 'Depilación Láser Diodo (Axilas)', 15, 'Depilación láser de axilas', false, 123),
('centro_estetica', 'Cejas y Pestañas', 'Lifting de Pestañas', 45, 'Lifting y tinte de pestañas', false, 124),
('centro_estetica', 'Cejas y Pestañas', 'Tinte de Pestañas', 20, 'Tinte de pestañas', false, 125),
('centro_estetica', 'Cejas y Pestañas', 'Laminado de Cejas', 45, 'Laminado y tinte de cejas', false, 126);

-- =====================================================
-- CENTRO DE UÑAS (19 servicios)
-- =====================================================
INSERT INTO service_templates (vertical_type, category, name, duration_minutes, description, is_popular, sort_order) VALUES
('centro_unas', 'Manicura', 'Manicura Semipermanente', 45, 'Manicura con esmalte semipermanente', true, 200),
('centro_unas', 'Manicura', 'Manicura Rusa (Combinada)', 60, 'Manicura rusa con técnica de precisión', true, 201),
('centro_unas', 'Manicura', 'Manicura (Tradicional + Esmalte Normal)', 30, 'Manicura clásica con esmalte normal', false, 202),
('centro_unas', 'Manicura', 'Manicura SPA (Exfoliación + Masaje)', 50, 'Manicura con tratamiento spa completo', false, 203),
('centro_unas', 'Pedicura', 'Pedicura Semipermanente', 60, 'Pedicura con esmalte semipermanente', true, 204),
('centro_unas', 'Pedicura', 'Pedicura (Tradicional + Esmalte Normal)', 45, 'Pedicura clásica con esmalte normal', false, 205),
('centro_unas', 'Pedicura', 'Pedicura SPA (Exfoliación + Masaje)', 75, 'Pedicura con tratamiento spa completo', false, 206),
('centro_unas', 'Esculpidas', 'Uñas Acrílicas (Puesta Nueva)', 90, 'Aplicación completa de uñas acrílicas', false, 207),
('centro_unas', 'Esculpidas', 'Uñas de Gel (Puesta Nueva)', 90, 'Aplicación completa de uñas de gel', false, 208),
('centro_unas', 'Esculpidas', 'Uñas (Polygel / Acrygel)', 90, 'Aplicación de uñas polygel', false, 209),
('centro_unas', 'Mantenimiento', 'Relleno Acrílico (Hasta 3 sem)', 60, 'Relleno de uñas acrílicas', false, 210),
('centro_unas', 'Mantenimiento', 'Relleno Gel (Hasta 3 sem)', 60, 'Relleno de uñas de gel', false, 211),
('centro_unas', 'Mantenimiento', 'Nivelación (Refuerzo uña natural)', 60, 'Nivelación y refuerzo de uña natural', false, 212),
('centro_unas', 'Retirada', 'Quitar Semipermanente (Manos)', 15, 'Retirada de esmalte semipermanente de manos', false, 213),
('centro_unas', 'Retirada', 'Quitar Semipermanente (Pies)', 15, 'Retirada de esmalte semipermanente de pies', false, 214),
('centro_unas', 'Retirada', 'Quitar Acrílico/Gel', 30, 'Retirada de uñas acrílicas o gel', false, 215),
('centro_unas', 'Extras', 'Extra: Nail Art (Simple / Por uña)', 5, 'Decoración simple por uña', false, 216),
('centro_unas', 'Extras', 'Extra: Nail Art (Avanzado)', 15, 'Decoración avanzada de uñas', false, 217),
('centro_unas', 'Extras', 'Extra: Uña Rota (Reparación)', 10, 'Reparación de uña rota', false, 218);

-- =====================================================
-- FISIOTERAPIA (18 servicios)
-- =====================================================
INSERT INTO service_templates (vertical_type, category, name, duration_minutes, description, is_popular, sort_order) VALUES
('fisioterapia', 'General', 'Sesión Fisioterapia (General)', 50, 'Sesión estándar de fisioterapia', true, 300),
('fisioterapia', 'General', 'Primera Visita (Evaluación + Tratamiento)', 60, 'Primera consulta con evaluación y tratamiento', true, 301),
('fisioterapia', 'General', 'Sesión Fisioterapia (Corta)', 30, 'Sesión de fisioterapia de corta duración', false, 302),
('fisioterapia', 'Masajes', 'Masaje Descontracturante (Espalda)', 45, 'Masaje descontracturante de espalda', true, 303),
('fisioterapia', 'Masajes', 'Masaje Descontracturante (Piernas)', 45, 'Masaje descontracturante de piernas', false, 304),
('fisioterapia', 'Deportiva', 'Tratamiento Lesión Deportiva', 50, 'Tratamiento de lesiones deportivas', false, 305),
('fisioterapia', 'Técnicas', 'Punción Seca (Puntos Gatillo)', 30, 'Tratamiento con punción seca de puntos gatillo', false, 306),
('fisioterapia', 'Rehabilitación', 'Rehabilitación (Post-cirugía)', 45, 'Rehabilitación post-operatoria', false, 307),
('fisioterapia', 'Suelo Pélvico', 'Rehabilitación Suelo Pélvico (Valoración)', 60, 'Primera valoración de suelo pélvico', false, 308),
('fisioterapia', 'Suelo Pélvico', 'Rehabilitación Suelo Pélvico (Sesión)', 50, 'Sesión de rehabilitación de suelo pélvico', false, 309),
('fisioterapia', 'Drenaje', 'Drenaje Linfático Manual (Sesión)', 60, 'Drenaje linfático manual completo', false, 310),
('fisioterapia', 'Neurológica', 'Fisioterapia Neurológica', 60, 'Tratamiento de fisioterapia neurológica', false, 311),
('fisioterapia', 'Respiratoria', 'Fisioterapia Respiratoria (Adulto)', 45, 'Fisioterapia respiratoria para adultos', false, 312),
('fisioterapia', 'Respiratoria', 'Fisioterapia Respiratoria (Pediátrica)', 30, 'Fisioterapia respiratoria pediátrica', false, 313),
('fisioterapia', 'Osteopatía', 'Sesión Osteopatía (Estructural)', 60, 'Sesión de osteopatía estructural', false, 314),
('fisioterapia', 'Técnicas', 'Ondas de Choque', 15, 'Tratamiento con ondas de choque', false, 315),
('fisioterapia', 'Técnicas', 'Electrólisis (EPI / EPTE)', 30, 'Electrólisis percutánea intratisular', false, 316),
('fisioterapia', 'Bonos', 'Bono 5 Sesiones (Fisioterapia)', 50, 'Bono de 5 sesiones de fisioterapia', false, 317);

-- =====================================================
-- MASAJES Y OSTEOPATÍA (14 servicios)
-- =====================================================
INSERT INTO service_templates (vertical_type, category, name, duration_minutes, description, is_popular, sort_order) VALUES
('masajes_osteopatia', 'Osteopatía', 'Sesión Osteopatía (1ª Visita)', 60, 'Primera consulta de osteopatía con valoración', true, 400),
('masajes_osteopatia', 'Osteopatía', 'Sesión Osteopatía (Seguimiento)', 50, 'Sesión de seguimiento de osteopatía', true, 401),
('masajes_osteopatia', 'Relajante', 'Masaje Relajante (30 min)', 30, 'Masaje relajante de media hora', false, 402),
('masajes_osteopatia', 'Relajante', 'Masaje Relajante (60 min)', 60, 'Masaje relajante de una hora', true, 403),
('masajes_osteopatia', 'Relajante', 'Masaje Relajante (90 min)', 90, 'Masaje relajante de hora y media', false, 404),
('masajes_osteopatia', 'Descontracturante', 'Masaje Descontracturante (Localizado)', 30, 'Masaje descontracturante localizado', false, 405),
('masajes_osteopatia', 'Descontracturante', 'Masaje Descontracturante (Completo)', 60, 'Masaje descontracturante de cuerpo completo', true, 406),
('masajes_osteopatia', 'Deportivo', 'Masaje Deportivo (Pre/Post)', 50, 'Masaje deportivo pre o post entrenamiento', false, 407),
('masajes_osteopatia', 'Especiales', 'Masaje Cráneo-facial', 30, 'Masaje de cráneo y facial', false, 408),
('masajes_osteopatia', 'Especiales', 'Reflexología Podal', 45, 'Reflexología de pies', false, 409),
('masajes_osteopatia', 'Especiales', 'Masaje Prenatal (Embarazadas)', 50, 'Masaje para mujeres embarazadas', false, 410),
('masajes_osteopatia', 'Especiales', 'Masaje Ayurvédico', 75, 'Masaje ayurvédico tradicional', false, 411),
('masajes_osteopatia', 'Especiales', 'Masaje con Piedras Calientes', 75, 'Masaje con piedras volcánicas calientes', false, 412),
('masajes_osteopatia', 'Circulatorio', 'Masaje Circulatorio (Piernas Cansadas)', 45, 'Masaje para piernas cansadas y circulación', false, 413);

-- =====================================================
-- PSICOLOGÍA Y COACHING (9 servicios)
-- =====================================================
INSERT INTO service_templates (vertical_type, category, name, duration_minutes, description, is_popular, sort_order) VALUES
('psicologia_coaching', 'Adultos', 'Primera Visita (Evaluación Adultos)', 60, 'Primera consulta con evaluación para adultos', true, 500),
('psicologia_coaching', 'Adultos', 'Sesión Individual (Psicología)', 50, 'Sesión individual de psicología', true, 501),
('psicologia_coaching', 'Online', 'Sesión Individual (Online)', 50, 'Sesión individual online por videollamada', true, 502),
('psicologia_coaching', 'Pareja', 'Terapia de Pareja', 75, 'Sesión de terapia de pareja', false, 503),
('psicologia_coaching', 'Familiar', 'Terapia Familiar', 90, 'Sesión de terapia familiar', false, 504),
('psicologia_coaching', 'Infantil', 'Primera Visita (Infantil/Adolescente)', 60, 'Primera consulta infantil o adolescente', false, 505),
('psicologia_coaching', 'Infantil', 'Sesión Seguimiento (Infantil)', 45, 'Sesión de seguimiento infantil', false, 506),
('psicologia_coaching', 'Coaching', 'Sesión de Coaching (Personal)', 60, 'Sesión de coaching personal', false, 507),
('psicologia_coaching', 'Coaching', 'Sesión de Coaching (Ejecutivo)', 60, 'Sesión de coaching ejecutivo', false, 508);

-- =====================================================
-- CLÍNICA DENTAL (20 servicios)
-- =====================================================
INSERT INTO service_templates (vertical_type, category, name, duration_minutes, description, is_popular, sort_order) VALUES
('clinica_dental', 'Revisión', 'Primera Visita (Revisión y Diag.)', 30, 'Primera visita con revisión y diagnóstico', true, 600),
('clinica_dental', 'Prevención', 'Limpieza Dental (Profilaxis)', 45, 'Limpieza dental profesional', true, 601),
('clinica_dental', 'Urgencias', 'Urgencia Dental (Visita)', 30, 'Consulta de urgencia dental', false, 602),
('clinica_dental', 'Conservadora', 'Empaste (Obturación Simple)', 60, 'Empaste dental simple', true, 603),
('clinica_dental', 'Conservadora', 'Empaste (Obturación Compuesta)', 75, 'Empaste dental compuesto', false, 604),
('clinica_dental', 'Conservadora', 'Reconstrucción Dental', 90, 'Reconstrucción completa de pieza dental', false, 605),
('clinica_dental', 'Endodoncia', 'Endodoncia (1 conducto)', 60, 'Endodoncia de un conducto', false, 606),
('clinica_dental', 'Endodoncia', 'Endodoncia (Multirradicular)', 90, 'Endodoncia de múltiples conductos', false, 607),
('clinica_dental', 'Estética', 'Blanqueamiento Dental (Clínica)', 60, 'Blanqueamiento dental en clínica', false, 608),
('clinica_dental', 'Estética', 'Blanqueamiento (Ambulatorio)', 30, 'Entrega de kit de blanqueamiento ambulatorio', false, 609),
('clinica_dental', 'Estética', 'Carilla Composite (por diente)', 60, 'Carilla dental de composite por pieza', false, 610),
('clinica_dental', 'Estética', 'Carilla Porcelana (por diente)', 60, 'Carilla dental de porcelana por pieza', false, 611),
('clinica_dental', 'Cirugía', 'Extracción Dental (Simple)', 30, 'Extracción dental simple', false, 612),
('clinica_dental', 'Cirugía', 'Extracción Muela del Juicio', 60, 'Extracción de muela del juicio', false, 613),
('clinica_dental', 'Implantes', 'Estudio Implantología', 30, 'Estudio y planificación de implantes', false, 614),
('clinica_dental', 'Implantes', 'Cirugía Implante (por implante)', 60, 'Colocación quirúrgica de implante dental', false, 615),
('clinica_dental', 'Ortodoncia', 'Estudio Ortodoncia', 30, 'Estudio y planificación de ortodoncia', false, 616),
('clinica_dental', 'Ortodoncia', 'Revisión Ortodoncia', 20, 'Revisión de ortodoncia y ajuste', false, 617),
('clinica_dental', 'Infantil', 'Odontopediatría (Revisión Infantil)', 30, 'Revisión dental infantil', false, 618),
('clinica_dental', 'ATM', 'Férula de Descarga (Bruxismo)', 30, 'Toma de medidas para férula de bruxismo', false, 619);

-- =====================================================
-- VETERINARIO (22 servicios)
-- =====================================================
INSERT INTO service_templates (vertical_type, category, name, duration_minutes, description, is_popular, sort_order) VALUES
('veterinario', 'Consulta', 'Consulta General (Perro/Gato)', 30, 'Consulta veterinaria general', true, 700),
('veterinario', 'Vacunación', 'Consulta Vacunación (Cachorro)', 30, 'Consulta de vacunación para cachorros', true, 701),
('veterinario', 'Vacunación', 'Consulta Vacunación (Adulto)', 30, 'Consulta de vacunación para adultos', false, 702),
('veterinario', 'Vacunación', 'Vacuna Rabia', 15, 'Vacunación antirrábica', false, 703),
('veterinario', 'Vacunación', 'Vacuna Polivalente (Perro)', 15, 'Vacuna polivalente para perros', false, 704),
('veterinario', 'Vacunación', 'Vacuna Trivalente (Gato)', 15, 'Vacuna trivalente para gatos', false, 705),
('veterinario', 'Identificación', 'Identificación (Microchip + Alta)', 15, 'Colocación de microchip y alta oficial', false, 706),
('veterinario', 'Exóticos', 'Consulta Exóticos (1ª vez)', 45, 'Primera consulta para animales exóticos', false, 707),
('veterinario', 'Exóticos', 'Consulta Exóticos (Revisión)', 30, 'Revisión de animales exóticos', false, 708),
('veterinario', 'Seguimiento', 'Revisión (Post-operatoria / Seguimiento)', 15, 'Revisión post-operatoria o seguimiento', false, 709),
('veterinario', 'Urgencias', 'Consulta Urgencia (Diurna)', 30, 'Consulta de urgencia en horario diurno', false, 710),
('veterinario', 'Prevención', 'Desparasitación (Interna)', 10, 'Desparasitación interna', false, 711),
('veterinario', 'Diagnóstico', 'Test (Leishmania, Felv/Fiv)', 15, 'Test diagnóstico de enfermedades', false, 712),
('veterinario', 'Odontología', 'Limpieza de Boca (Tartrectomía)', 60, 'Limpieza dental con anestesia', false, 713),
('veterinario', 'Cirugía', 'Esterilización Gata', 60, 'Esterilización de gata', false, 714),
('veterinario', 'Cirugía', 'Esterilización Perra', 90, 'Esterilización de perra', false, 715),
('veterinario', 'Cirugía', 'Castración Gato', 45, 'Castración de gato', false, 716),
('veterinario', 'Cirugía', 'Castración Perro', 60, 'Castración de perro', false, 717),
('veterinario', 'Peluquería', 'Peluquería Canina (Baño y Corte)', 90, 'Baño completo y corte de pelo', false, 718),
('veterinario', 'Peluquería', 'Peluquería Canina (Baño)', 60, 'Baño completo sin corte', false, 719),
('veterinario', 'Peluquería', 'Corte de Uñas', 10, 'Corte de uñas', false, 720);

-- =====================================================
-- ENTRENADOR PERSONAL (10 servicios)
-- =====================================================
INSERT INTO service_templates (vertical_type, category, name, duration_minutes, description, is_popular, sort_order) VALUES
('entrenador_personal', 'Individual', 'Sesión Entrenamiento Personal (1 a 1)', 60, 'Sesión de entrenamiento personalizado individual', true, 800),
('entrenador_personal', 'Pareja', 'Entrenamiento en Pareja (Dúo)', 60, 'Sesión de entrenamiento en pareja', false, 801),
('entrenador_personal', 'Grupo', 'Entrenamiento Grupo Reducido (3-5 pers)', 60, 'Sesión de entrenamiento en grupo pequeño', false, 802),
('entrenador_personal', 'Online', 'Sesión Online (Videollamada)', 50, 'Sesión de entrenamiento online', true, 803),
('entrenador_personal', 'Evaluación', 'Evaluación Inicial (Consulta)', 45, 'Primera evaluación física y objetivos', true, 804),
('entrenador_personal', 'Nutrición', 'Consulta Nutricional (1ª vez)', 60, 'Primera consulta nutricional', false, 805),
('entrenador_personal', 'Nutrición', 'Consulta Nutricional (Seguimiento)', 30, 'Seguimiento nutricional', false, 806),
('entrenador_personal', 'Planificación', 'Planificación Entrenamiento (Mensual)', 30, 'Planificación mensual de entrenamientos', false, 807),
('entrenador_personal', 'Bonos', 'Bono 5 Sesiones Personales', 60, 'Bono de 5 sesiones personales', false, 808),
('entrenador_personal', 'Bonos', 'Bono 10 Sesiones Personales', 60, 'Bono de 10 sesiones personales', false, 809);

-- =====================================================
-- YOGA Y PILATES (11 servicios)
-- =====================================================
INSERT INTO service_templates (vertical_type, category, name, duration_minutes, description, is_popular, sort_order) VALUES
('yoga_pilates', 'Grupal', 'Clase de Yoga (Grupal)', 60, 'Clase grupal de yoga', true, 900),
('yoga_pilates', 'Grupal', 'Clase de Pilates Mat (Grupal)', 50, 'Clase grupal de pilates en colchoneta', true, 901),
('yoga_pilates', 'Máquina', 'Clase de Pilates Máquina (Reformer)', 50, 'Clase de pilates con máquina reformer', false, 902),
('yoga_pilates', 'Privada', 'Clase Privada (Yoga o Pilates)', 60, 'Clase privada individual de yoga o pilates', false, 903),
('yoga_pilates', 'Suelta', 'Clase Suelta (Grupal)', 60, 'Clase suelta sin abono', false, 904),
('yoga_pilates', 'Prueba', 'Primera Clase (Prueba)', 60, 'Primera clase de prueba gratuita o reducida', true, 905),
('yoga_pilates', 'Bonos', 'Bono 5 Clases Grupales', 60, 'Bono de 5 clases grupales', false, 906),
('yoga_pilates', 'Bonos', 'Bono 10 Clases Grupales', 60, 'Bono de 10 clases grupales', false, 907),
('yoga_pilates', 'Talleres', 'Taller Especial (Fin de semana)', 120, 'Taller intensivo de fin de semana', false, 908),
('yoga_pilates', 'Prenatal', 'Clase Prenatal (Yoga/Pilates)', 60, 'Clase específica para embarazadas', false, 909),
('yoga_pilates', 'Meditación', 'Meditación Guiada (Grupal)', 30, 'Sesión de meditación guiada', false, 910);

-- =====================================================
-- TOTAL: 174 SERVICIOS
-- =====================================================

