-- =====================================================
-- LIMPIAR DUPLICADOS de service_templates
-- =====================================================

-- Eliminar TODOS los servicios existentes para empezar limpio
DELETE FROM service_templates;

-- =====================================================
-- INSERTAR SERVICIOS SIN DUPLICADOS
-- =====================================================

-- CABELLO (7 únicos)
INSERT INTO service_templates (vertical_type, category, name, duration_minutes, description, is_popular, sort_order) VALUES
('peluqueria_barberia', 'Cabello', 'Corte y Peinado', 45, 'Corte de pelo con peinado', true, 1),
('peluqueria_barberia', 'Cabello', 'Corte + Barba', 30, 'Corte de pelo con arreglo de barba', true, 2),
('peluqueria_barberia', 'Cabello', 'Corte Niño/a', 25, 'Corte de pelo infantil', true, 3),
('peluqueria_barberia', 'Cabello', 'Arreglo Barba', 15, 'Arreglo y perfilado de barba', false, 4),
('peluqueria_barberia', 'Cabello', 'Corte Mujer', 45, 'Corte de cabello para mujer con lavado y secado básico', true, 5),
('peluqueria_barberia', 'Cabello', 'Corte Hombre', 30, 'Corte de cabello para hombre con lavado', true, 6),
('peluqueria_barberia', 'Cabello', 'Corte + Arreglo de Barba', 45, 'Servicio completo de corte y barba', true, 7);

-- PEINADO (8)
INSERT INTO service_templates (vertical_type, category, name, duration_minutes, description, is_popular, sort_order) VALUES
('peluqueria_barberia', 'Peinado', 'Peinar (Secador)', 45, 'Secado y peinado profesional', false, 10),
('peluqueria_barberia', 'Peinado', 'Recogido', 60, 'Peinado recogido para eventos', false, 11),
('peluqueria_barberia', 'Peinado', 'Lavar y Peinar (Pelo Corto)', 30, 'Lavado y secado para cabello corto', false, 12),
('peluqueria_barberia', 'Peinado', 'Lavar y Peinar (Pelo Medio)', 40, 'Lavado y secado para cabello medio', false, 13),
('peluqueria_barberia', 'Peinado', 'Lavar y Peinar (Pelo Largo)', 50, 'Lavado y secado para cabello largo', false, 14),
('peluqueria_barberia', 'Peinado', 'Ondas/Rizos', 60, 'Creación de ondas o rizos con plancha', false, 15),
('peluqueria_barberia', 'Peinado', 'Plancha', 45, 'Alisado con plancha profesional', false, 16),
('peluqueria_barberia', 'Peinado', 'Peinado Especial', 90, 'Peinado para bodas y eventos especiales', false, 17);

-- COLOR (7)
INSERT INTO service_templates (vertical_type, category, name, duration_minutes, description, is_popular, sort_order) VALUES
('peluqueria_barberia', 'Color', 'Tinte Raíz', 60, 'Aplicación de tinte solo en raíces', true, 20),
('peluqueria_barberia', 'Color', 'Tinte Completo', 90, 'Tinte de todo el cabello', true, 21),
('peluqueria_barberia', 'Color', 'Mechas (Balayage)', 180, 'Técnica de mechas con efecto natural', true, 22),
('peluqueria_barberia', 'Color', 'Mechas Tradicionales', 150, 'Mechas con gorro o papel aluminio', false, 23),
('peluqueria_barberia', 'Color', 'Decoloración', 120, 'Aclarado completo del cabello', false, 24),
('peluqueria_barberia', 'Color', 'Reflejos', 90, 'Aplicación de reflejos sutiles', false, 25),
('peluqueria_barberia', 'Color', 'Matización', 30, 'Tratamiento para neutralizar tonos', false, 26);

-- TRATAMIENTOS (6)
INSERT INTO service_templates (vertical_type, category, name, duration_minutes, description, is_popular, sort_order) VALUES
('peluqueria_barberia', 'Tratamientos', 'Keratina', 180, 'Tratamiento de alisado con keratina', false, 30),
('peluqueria_barberia', 'Tratamientos', 'Botox Capilar', 90, 'Tratamiento revitalizante profundo', false, 31),
('peluqueria_barberia', 'Tratamientos', 'Hidratación Profunda', 45, 'Mascarilla nutritiva intensiva', false, 32),
('peluqueria_barberia', 'Tratamientos', 'Tratamiento Anti-Caspa', 30, 'Tratamiento especializado para caspa', false, 33),
('peluqueria_barberia', 'Tratamientos', 'Tratamiento Anti-Caída', 45, 'Tratamiento fortalecedor del cuero cabelludo', false, 34),
('peluqueria_barberia', 'Tratamientos', 'Permanente', 120, 'Rizado permanente del cabello', false, 35);

-- BARBERÍA (5)
INSERT INTO service_templates (vertical_type, category, name, duration_minutes, description, is_popular, sort_order) VALUES
('peluqueria_barberia', 'Barbería', 'Afeitado Tradicional', 30, 'Afeitado clásico con navaja y toallas calientes', false, 40),
('peluqueria_barberia', 'Barbería', 'Diseño de Barba', 20, 'Diseño y perfilado artístico de barba', false, 41),
('peluqueria_barberia', 'Barbería', 'Rasurado Cabeza', 20, 'Rasurado completo de cabeza', false, 42),
('peluqueria_barberia', 'Barbería', 'Cejas', 10, 'Arreglo y perfilado de cejas', false, 43),
('peluqueria_barberia', 'Barbería', 'Limpieza Facial Barba', 25, 'Limpieza e hidratación de la zona de barba', false, 44);

-- =====================================================
-- TOTAL: 33 servicios únicos (sin duplicados)
-- =====================================================



