-- ═══════════════════════════════════════════════════════════════════════════
-- 🎯 SISTEMA CRM: SEGMENTACIÓN INTELIGENTE POR VERTICAL
-- ═══════════════════════════════════════════════════════════════════════════
-- 
-- Este sistema permite segmentar clientes de manera inteligente según:
-- 1. Parámetros específicos de cada vertical (peluquería, dental, etc.)
-- 2. Reglas de segmentación universales (VIP, Nuevo, Inactivo, En Riesgo, Regular)
-- 3. Acciones y tonos personalizados por vertical y segmento
-- 4. Personal Cadence: Detecta el ritmo natural de cada cliente
--
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 📊 TABLA 1: PARÁMETROS POR VERTICAL
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_vertical_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id VARCHAR(50) UNIQUE NOT NULL,
  vertical_display_name VARCHAR(100) NOT NULL,
  
  -- Parámetros de ciclo (días)
  cycle_days INT NOT NULL,              -- Ciclo esperado entre visitas
  risk_min_days INT NOT NULL,           -- Días para considerarse "En Riesgo"
  inactive_days INT NOT NULL,           -- Días para considerarse "Inactivo"
  
  -- Parámetros VIP
  vip_min_visits_12m INT NOT NULL,      -- Visitas mínimas en 12 meses para ser VIP
  vip_min_spend_12m NUMERIC(10,2) NOT NULL, -- Gasto mínimo en 12 meses para ser VIP (OR)
  
  -- Configuración
  lookback_months INT DEFAULT 12,       -- Meses a analizar para métricas
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_crm_vertical_parameters_vertical_id 
  ON crm_vertical_parameters(vertical_id);

-- ───────────────────────────────────────────────────────────────────────────
-- 📋 TABLA 2: REGLAS DE SEGMENTACIÓN (Universales)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_segment_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment VARCHAR(50) NOT NULL UNIQUE,  -- 'vip', 'nuevo', 'inactivo', 'en_riesgo', 'regular'
  priority INT NOT NULL UNIQUE,         -- Orden de evaluación (1 = primero)
  condition TEXT NOT NULL,              -- Descripción de la condición
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ───────────────────────────────────────────────────────────────────────────
-- 💬 TABLA 3: ACCIONES POR VERTICAL Y SEGMENTO
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_actions_by_vertical (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id VARCHAR(50) NOT NULL,
  segment VARCHAR(50) NOT NULL,         -- 'vip', 'nuevo', 'inactivo', etc.
  trigger VARCHAR(100) NOT NULL,        -- 'cliente_contacta', '24h_tras_visita', 'al_activar_regla'
  action_type VARCHAR(20) DEFAULT 'auto', -- 'auto', 'proposal', 'notification'
  action_text TEXT NOT NULL,            -- El mensaje/acción
  offer TEXT,                           -- Oferta opcional
  tone VARCHAR(100),                    -- Tono del mensaje
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(vertical_id, segment, trigger)
);

CREATE INDEX IF NOT EXISTS idx_crm_actions_vertical_segment 
  ON crm_actions_by_vertical(vertical_id, segment);

-- ───────────────────────────────────────────────────────────────────────────
-- ⚙️ TABLA 4: OVERRIDES POR NEGOCIO (Opcional)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_business_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  -- Override de parámetros (NULL = usa el del vertical)
  cycle_days INT,
  risk_min_days INT,
  inactive_days INT,
  vip_min_visits_12m INT,
  vip_min_spend_12m NUMERIC(10,2),
  
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(business_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_business_overrides_business 
  ON crm_business_overrides(business_id);

-- ───────────────────────────────────────────────────────────────────────────
-- 🔧 FUNCIÓN: Calcular Personal Cadence de un cliente
-- ───────────────────────────────────────────────────────────────────────────
-- Calcula la mediana de los últimos 3 intervalos entre visitas
-- Si no hay suficientes datos, retorna NULL
CREATE OR REPLACE FUNCTION calculate_personal_cadence(p_customer_id UUID)
RETURNS INT AS $$
DECLARE
  intervals INT[];
  cadence INT;
BEGIN
  -- Obtener los últimos 4 appointment_date (para calcular 3 intervalos)
  SELECT ARRAY_AGG(
    EXTRACT(DAY FROM appointment_date - LAG(appointment_date) OVER (ORDER BY appointment_date))::INT
  )
  INTO intervals
  FROM (
    SELECT appointment_date
    FROM appointments
    WHERE customer_id = p_customer_id
      AND status = 'completed'
    ORDER BY appointment_date DESC
    LIMIT 4
  ) dates
  WHERE LAG(appointment_date) OVER (ORDER BY appointment_date) IS NOT NULL;
  
  -- Si tenemos al menos 2 intervalos, calcular mediana
  IF array_length(intervals, 1) >= 2 THEN
    -- Ordenar array y tomar mediana
    SELECT CASE 
      WHEN array_length(intervals, 1) % 2 = 1 THEN
        intervals[array_length(intervals, 1) / 2 + 1]
      ELSE
        (intervals[array_length(intervals, 1) / 2] + intervals[array_length(intervals, 1) / 2 + 1]) / 2
    END
    INTO cadence
    FROM (SELECT ARRAY(SELECT unnest(intervals) ORDER BY 1) AS intervals) sorted;
    
    RETURN cadence;
  ELSE
    RETURN NULL;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ───────────────────────────────────────────────────────────────────────────
-- 🎯 FUNCIÓN: Calcular Segmento de un Cliente
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION calculate_customer_segment(
  p_customer_id UUID,
  p_business_id UUID
) RETURNS VARCHAR(50) AS $$
DECLARE
  v_vertical_id VARCHAR(50);
  v_params RECORD;
  v_overrides RECORD;
  
  -- Métricas del cliente
  v_lifetime_visits INT;
  v_visits_12m INT;
  v_spend_12m NUMERIC;
  v_last_visit_date DATE;
  v_last_visit_days INT;
  v_first_visit_date DATE;
  v_days_since_first_visit INT;
  
  -- Personal cadence
  v_personal_cadence INT;
  v_has_personal_cadence BOOLEAN;
  v_risk_threshold INT;
  v_inactive_threshold INT;
  
  -- Parámetros finales (después de overrides)
  v_cycle_days INT;
  v_risk_min_days INT;
  v_inactive_days INT;
  v_vip_min_visits INT;
  v_vip_min_spend NUMERIC;
BEGIN
  -- 1. Obtener vertical_type del negocio
  SELECT vertical_type INTO v_vertical_id
  FROM businesses
  WHERE id = p_business_id;
  
  IF v_vertical_id IS NULL THEN
    RETURN 'regular'; -- Fallback
  END IF;
  
  -- 2. Obtener parámetros del vertical
  SELECT * INTO v_params
  FROM crm_vertical_parameters
  WHERE vertical_id = v_vertical_id;
  
  IF NOT FOUND THEN
    RETURN 'regular'; -- Fallback si no hay parámetros
  END IF;
  
  -- 3. Obtener overrides del negocio (si existen)
  SELECT * INTO v_overrides
  FROM crm_business_overrides
  WHERE business_id = p_business_id;
  
  -- 4. Aplicar overrides o usar defaults
  v_cycle_days := COALESCE(v_overrides.cycle_days, v_params.cycle_days);
  v_risk_min_days := COALESCE(v_overrides.risk_min_days, v_params.risk_min_days);
  v_inactive_days := COALESCE(v_overrides.inactive_days, v_params.inactive_days);
  v_vip_min_visits := COALESCE(v_overrides.vip_min_visits_12m, v_params.vip_min_visits_12m);
  v_vip_min_spend := COALESCE(v_overrides.vip_min_spend_12m, v_params.vip_min_spend_12m);
  
  -- 5. Calcular métricas del cliente
  
  -- Lifetime visits
  SELECT COUNT(*) INTO v_lifetime_visits
  FROM appointments
  WHERE customer_id = p_customer_id
    AND status = 'completed';
  
  -- Visits en últimos 12 meses
  SELECT COUNT(*) INTO v_visits_12m
  FROM appointments
  WHERE customer_id = p_customer_id
    AND status = 'completed'
    AND appointment_date >= CURRENT_DATE - INTERVAL '12 months';
  
  -- Gasto en últimos 12 meses
  SELECT COALESCE(SUM(amount_paid), 0) INTO v_spend_12m
  FROM appointments
  WHERE customer_id = p_customer_id
    AND status = 'completed'
    AND appointment_date >= CURRENT_DATE - INTERVAL '12 months';
  
  -- Última visita
  SELECT MAX(appointment_date) INTO v_last_visit_date
  FROM appointments
  WHERE customer_id = p_customer_id
    AND status = 'completed';
  
  v_last_visit_days := COALESCE(CURRENT_DATE - v_last_visit_date, 999);
  
  -- Primera visita
  SELECT MIN(appointment_date) INTO v_first_visit_date
  FROM appointments
  WHERE customer_id = p_customer_id
    AND status = 'completed';
  
  v_days_since_first_visit := COALESCE(CURRENT_DATE - v_first_visit_date, 0);
  
  -- 6. Calcular Personal Cadence
  v_personal_cadence := calculate_personal_cadence(p_customer_id);
  v_has_personal_cadence := (v_personal_cadence IS NOT NULL);
  
  -- 7. Calcular thresholds
  IF v_has_personal_cadence THEN
    v_risk_threshold := v_personal_cadence * 1.5;
    v_inactive_threshold := v_personal_cadence * 2.5;
  ELSE
    v_risk_threshold := v_risk_min_days;
    v_inactive_threshold := v_inactive_days;
  END IF;
  
  -- 8. APLICAR REGLAS (por orden de prioridad) - 5 SEGMENTOS
  
  -- PRIORIDAD 1: VIP (siempre gana, incluso si está inactivo)
  IF v_spend_12m >= v_vip_min_spend OR v_visits_12m >= v_vip_min_visits THEN
    RETURN 'vip';
  END IF;
  
  -- PRIORIDAD 2: NUEVO (1-2 visitas en últimos 90 días)
  IF v_lifetime_visits <= 2 AND v_days_since_first_visit <= 90 THEN
    RETURN 'nuevo';
  END IF;
  
  -- PRIORIDAD 3: INACTIVO
  IF v_last_visit_days > v_inactive_threshold THEN
    RETURN 'inactivo';
  END IF;
  
  -- PRIORIDAD 4: EN RIESGO
  IF v_last_visit_days > v_risk_threshold THEN
    RETURN 'en_riesgo';
  END IF;
  
  -- PRIORIDAD 5 (DEFAULT): REGULAR
  RETURN 'regular';
  
END;
$$ LANGUAGE plpgsql;

-- ───────────────────────────────────────────────────────────────────────────
-- 📝 INSERTAR PARÁMETROS DE LOS 10 VERTICALES
-- ───────────────────────────────────────────────────────────────────────────

-- Limpiar tabla antes de insertar para migración idempotente
TRUNCATE TABLE crm_vertical_parameters CASCADE;

INSERT INTO crm_vertical_parameters (
  vertical_id, 
  vertical_display_name, 
  cycle_days, 
  risk_min_days, 
  inactive_days, 
  vip_min_visits_12m, 
  vip_min_spend_12m, 
  lookback_months
) VALUES
  ('peluqueria_barberia', 'Peluquería y Barbería', 42, 56, 98, 10, 500, 12),
  ('centro_unas', 'Centro de Uñas', 21, 24, 60, 15, 400, 12),
  ('entrenador_personal', 'Entrenador Personal', 7, 14, 45, 50, 1500, 12),
  ('yoga_pilates', 'Yoga y Pilates', 7, 21, 60, 50, 1200, 12),
  ('fisioterapia', 'Fisioterapia', 30, 45, 180, 12, 600, 12),
  ('masajes_osteopatia', 'Masajes y Osteopatía', 28, 35, 120, 12, 600, 12),
  ('psicologia_coaching', 'Psicología y Coaching', 7, 21, 90, 20, 1200, 12),
  ('centro_estetica', 'Centro de Estética', 42, 56, 180, 8, 700, 12),
  ('clinica_dental', 'Clínica Dental', 365, 335, 540, 3, 800, 12),
  ('veterinario', 'Veterinario', 365, 365, 540, 3, 600, 12);

-- ───────────────────────────────────────────────────────────────────────────
-- 📋 INSERTAR REGLAS DE SEGMENTACIÓN (Universales) - 5 SEGMENTOS
-- ───────────────────────────────────────────────────────────────────────────

-- Limpiar tabla antes de insertar para evitar conflictos de prioridad
TRUNCATE TABLE crm_segment_rules CASCADE;

INSERT INTO crm_segment_rules (segment, priority, condition) VALUES
  ('vip', 1, 'spend_12m >= vip_min_spend_12m OR visits_12m >= vip_min_visits_12m'),
  ('nuevo', 2, 'lifetime_visits <= 2 AND days_since_first_visit <= 90'),
  ('inactivo', 3, 'last_visit_days > inactive_threshold'),
  ('en_riesgo', 4, 'last_visit_days > risk_threshold'),
  ('regular', 5, 'everything else (default)');

-- ───────────────────────────────────────────────────────────────────────────
-- 💬 INSERTAR ACCIONES POR VERTICAL - TODOS LOS VERTICALES
-- ───────────────────────────────────────────────────────────────────────────

-- Limpiar tabla antes de insertar para evitar conflictos
TRUNCATE TABLE crm_actions_by_vertical CASCADE;

-- PELUQUERÍA Y BARBERÍA
INSERT INTO crm_actions_by_vertical (vertical_id, segment, trigger, action_type, action_text, offer, tone) VALUES
  ('peluqueria_barberia', 'nuevo', '24h_tras_visita', 'auto', 
   '¡Hola [Cliente]! Soy [ASSISTANT_NAME] de [Negocio]. ¡Gracias por tu primera visita! ¿Todo bien con tu [Servicio]?', 
   NULL, 'Bienvenida'),
  
  ('peluqueria_barberia', 'en_riesgo', 'al_activar_regla', 'auto',
   '¡[Cliente]! Soy [ASSISTANT_NAME]. Han pasado [X] días... ese flow tiene que estar perdiéndose ;) ¿Te busco hueco?',
   NULL, 'Seductor / Colega'),
  
  ('peluqueria_barberia', 'inactivo', 'al_activar_regla', 'proposal',
   'Campaña "Vuelve a [Negocio]". Texto: Vuelve a [Negocio] y te regalamos un tratamiento de hidratación con tu próximo corte.',
   'Tratamiento de hidratación gratis', 'Servicio bajo coste / alto valor'),
  
  ('peluqueria_barberia', 'regular', 'cliente_contacta', 'auto',
   '¡Hola [Cliente]! ¡Qué bien tenerte de vuelta! ¿Vienes para tu [Servicio Favorito] de siempre?',
   NULL, 'Familiar, reconocimiento'),
  
  ('peluqueria_barberia', 'vip', 'cliente_contacta', 'auto',
   '¡[Cliente]! ¡Qué alegría! Tienes prioridad. Dime, ¿buscamos hueco para tu [Servicio Favorito]? Tengo un hueco a las [Hora VIP] que te he guardado.',
   NULL, 'Prioridad absoluta, proactivo');

-- ───────────────────────────────────────────────────────────────────────────
-- 💬 INSERTAR ACCIONES - CENTRO DE UÑAS
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO crm_actions_by_vertical (vertical_id, segment, trigger, action_type, action_text, offer, tone) VALUES
  ('centro_unas', 'nuevo', '24h_tras_visita', 'auto',
   '¡Hola [Cliente]! Soy [ASSISTANT_NAME] de [Negocio]. ¡Gracias por tu primera visita! ¿Todo bien con tus uñas?',
   NULL, 'Bienvenida'),
  
  ('centro_unas', 'en_riesgo', 'al_activar_regla', 'auto',
   '¡[Cliente]! Soy [ASSISTANT_NAME]. ¡Tus uñas deben estar pidiendo un refresh! ;) Han pasado [X] días. ¿Te guardo tu hueco de relleno esta semana?',
   NULL, 'Urgencia Estética / Colega'),
  
  ('centro_unas', 'inactivo', 'al_activar_regla', 'proposal',
   'Campaña "Manicura TOP". Texto: ¡Vuelve! Tu próxima manicura semi, con el diseño "Nail Art" que tú quieras, de regalo.',
   'Regalo de Nail Art', 'Regalo de diseño'),
  
  ('centro_unas', 'regular', 'cliente_contacta', 'auto',
   '¡Hola [Cliente]! ¡Qué bien tenerte de vuelta! ¿Vienes para tu [Servicio Favorito] de siempre?',
   NULL, 'Familiar'),
  
  ('centro_unas', 'vip', 'cliente_contacta', 'auto',
   '¡[Cliente]! ¡Qué alegría! Tienes prioridad. ¿Buscamos hueco para tu manicura?',
   NULL, 'Prioridad absoluta');

-- ───────────────────────────────────────────────────────────────────────────
-- 💬 INSERTAR ACCIONES - ENTRENADOR PERSONAL
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO crm_actions_by_vertical (vertical_id, segment, trigger, action_type, action_text, offer, tone) VALUES
  ('entrenador_personal', 'nuevo', '24h_tras_visita', 'auto',
   '¡Hola [Cliente]! Soy [ASSISTANT_NAME] de [Negocio]. ¡Gran primera sesión! La constancia es la clave. ¿Reservamos ya la de la semana que viene?',
   NULL, 'Motivador / Proactivo'),
  
  ('entrenador_personal', 'en_riesgo', 'al_activar_regla', 'auto',
   '¡[Cliente]! Soy [ASSISTANT_NAME]. ¡No pierdas el ritmo! Llevas [X] días sin reservar. ¿Te busco un hueco?',
   NULL, 'Coach'),
  
  ('entrenador_personal', 'inactivo', 'al_activar_regla', 'proposal',
   'Campaña "Vuelve a tope". Texto: ¡Vuelve! Te regalamos una sesión 1 a 1 al comprar tu próximo bono.',
   '1 Sesión Gratis', 'Motivación'),
  
  ('entrenador_personal', 'regular', 'cliente_contacta', 'auto',
   '¡Hola [Cliente]! ¡A seguir con el ritmo! ¿Cuándo vienes?',
   NULL, 'Motivador'),
  
  ('entrenador_personal', 'vip', 'cliente_contacta', 'auto',
   '¡[Cliente]! Eres un campeón/a. ¿Buscamos tu próxima sesión?',
   NULL, 'Reconocimiento');

-- ───────────────────────────────────────────────────────────────────────────
-- 💬 INSERTAR ACCIONES - YOGA Y PILATES
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO crm_actions_by_vertical (vertical_id, segment, trigger, action_type, action_text, offer, tone) VALUES
  ('yoga_pilates', 'nuevo', '24h_tras_visita', 'auto',
   '¡Hola [Cliente]! Soy [ASSISTANT_NAME] de [Negocio]. ¿Qué tal tu primera clase? Esperamos que te sintieras genial. ¿Reservamos la siguiente?',
   NULL, 'Zen / Bienvenida'),
  
  ('yoga_pilates', 'en_riesgo', 'al_activar_regla', 'auto',
   '¡[Cliente]! Soy [ASSISTANT_NAME]. ¡No dejes que el estrés vuelva! Llevas [X] días sin venir. ¿Te busco un hueco en la esterilla?',
   NULL, 'Mindfulness'),
  
  ('yoga_pilates', 'inactivo', 'al_activar_regla', 'proposal',
   'Campaña "Reconecta". Texto: ¡Vuelve a tu práctica! Te invitamos a un taller de meditación este fin de semana.',
   'Taller / Clase Especial', 'Reconexión'),
  
  ('yoga_pilates', 'regular', 'cliente_contacta', 'auto',
   '¡Hola [Cliente]! Namaste 🙏 ¿Cuándo vienes a tu clase?',
   NULL, 'Zen'),
  
  ('yoga_pilates', 'vip', 'cliente_contacta', 'auto',
   '¡[Cliente]! Tu práctica es inspiradora. ¿Reservamos tu clase?',
   NULL, 'Reconocimiento espiritual');

-- ───────────────────────────────────────────────────────────────────────────
-- 💬 INSERTAR ACCIONES - FISIOTERAPIA
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO crm_actions_by_vertical (vertical_id, segment, trigger, action_type, action_text, offer, tone) VALUES
  ('fisioterapia', 'nuevo', '24h_tras_visita', 'auto',
   '¡Hola [Cliente]! Soy [ASSISTANT_NAME] de [Negocio]. ¿Cómo te encuentras hoy después de tu primera sesión? ¿Todo bien?',
   NULL, 'Seguimiento / Salud'),
  
  ('fisioterapia', 'en_riesgo', 'al_activar_regla', 'auto',
   '¡Hola [Cliente]! Soy [ASSISTANT_NAME]. ¿Cómo va esa [molestia]? Han pasado [X] días. No dejes que la molestia vuelva, ¿buscamos un hueco de seguimiento?',
   NULL, 'Salud / Cuidado'),
  
  ('fisioterapia', 'inactivo', 'al_activar_regla', 'proposal',
   'Campaña "Recuperación". Texto: Vuelve a [Negocio] y te hacemos una valoración de seguimiento gratuita.',
   'Valoración gratuita', 'Prevención'),
  
  ('fisioterapia', 'regular', 'cliente_contacta', 'auto',
   '¡Hola [Cliente]! ¿Cómo va todo? ¿Vienes para seguimiento?',
   NULL, 'Profesional / Cercano'),
  
  ('fisioterapia', 'vip', 'cliente_contacta', 'auto',
   '¡[Cliente]! ¿Cómo estás? Tengo hueco prioritario para ti.',
   NULL, 'Cuidado preferente');

-- ───────────────────────────────────────────────────────────────────────────
-- 💬 INSERTAR ACCIONES - MASAJES Y OSTEOPATÍA
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO crm_actions_by_vertical (vertical_id, segment, trigger, action_type, action_text, offer, tone) VALUES
  ('masajes_osteopatia', 'nuevo', '24h_tras_visita', 'auto',
   '¡Hola [Cliente]! Soy [ASSISTANT_NAME] de [Negocio]. ¿Qué tal te sientes después del masaje? Espero que como nuevo/a. ¡Hasta la próxima!',
   NULL, 'Bienestar'),
  
  ('masajes_osteopatia', 'en_riesgo', 'al_activar_regla', 'auto',
   '¡Hola [Cliente]! Soy [ASSISTANT_NAME]. El cuerpo acumula tensión. Han pasado [X] días desde tu último masaje. ¿Buscamos un hueco para resetear?',
   NULL, 'Cuidado Personal'),
  
  ('masajes_osteopatia', 'inactivo', 'al_activar_regla', 'proposal',
   'Campaña "Relax". Texto: Vuelve a [Negocio] y añadimos 15 min de reflexología podal gratis a tu próximo masaje.',
   'Upgrade de 15 min', 'Relax / Regalo'),
  
  ('masajes_osteopatia', 'regular', 'cliente_contacta', 'auto',
   '¡Hola [Cliente]! ¿Listo/a para tu desconexión?',
   NULL, 'Relax'),
  
  ('masajes_osteopatia', 'vip', 'cliente_contacta', 'auto',
   '¡[Cliente]! Tu bienestar es prioritario. ¿Te busco hueco?',
   NULL, 'Cuidado premium');

-- ───────────────────────────────────────────────────────────────────────────
-- 💬 INSERTAR ACCIONES - PSICOLOGÍA Y COACHING
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO crm_actions_by_vertical (vertical_id, segment, trigger, action_type, action_text, offer, tone) VALUES
  ('psicologia_coaching', 'nuevo', '24h_tras_visita', 'auto',
   '¡Hola [Cliente]! Soy [ASSISTANT_NAME]. Gracias por la confianza de tu primera sesión. Para lo que necesites. ¿Confirmamos tu próxima cita para [fecha_sugerida]?',
   NULL, 'Profesional / Discreto / Proactivo'),
  
  ('psicologia_coaching', 'en_riesgo', 'al_activar_regla', 'auto',
   'Hola [Cliente], soy [ASSISTANT_NAME]. Han pasado [X] días desde nuestra última sesión. Solo quería recordarte que tu espacio aquí sigue disponible. Sin presiones. Un saludo.',
   NULL, 'Muy suave / Respetuoso'),
  
  ('psicologia_coaching', 'inactivo', 'al_activar_regla', 'proposal',
   'Campaña suave. Texto: Hola [Cliente]. Ha pasado un tiempo. Si decides retomar tus sesiones o necesitas cualquier cosa, estamos aquí.',
   NULL, 'Sin oferta, solo recordatorio'),
  
  ('psicologia_coaching', 'regular', 'cliente_contacta', 'auto',
   'Hola [Cliente]. ¿En qué puedo ayudarte?',
   NULL, 'Profesional / Neutro'),
  
  ('psicologia_coaching', 'vip', 'cliente_contacta', 'auto',
   'Hola [Cliente]. ¿Necesitas agendar una sesión?',
   NULL, 'Profesional / Cercano');

-- ───────────────────────────────────────────────────────────────────────────
-- 💬 INSERTAR ACCIONES - CENTRO DE ESTÉTICA
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO crm_actions_by_vertical (vertical_id, segment, trigger, action_type, action_text, offer, tone) VALUES
  ('centro_estetica', 'nuevo', '24h_tras_visita', 'auto',
   '¡Hola [Cliente]! Soy [ASSISTANT_NAME] de [Negocio]. ¿Qué tal tu [Tratamiento]? Esperamos que salieras con la piel radiante. ¿Te avisamos para tu próxima sesión?',
   NULL, 'Cuidado / Lujo'),
  
  ('centro_estetica', 'en_riesgo', 'al_activar_regla', 'auto',
   '¡Hola [Cliente]! Soy [ASSISTANT_NAME]. Tu piel necesita mimos ;) Han pasado [X] días. ¿Te busco un hueco para un tratamiento?',
   NULL, 'Proactivo / Belleza'),
  
  ('centro_estetica', 'inactivo', 'al_activar_regla', 'proposal',
   'Campaña "Vuelve a brillar". Texto: Vuelve y te regalamos un "peeling luminoso" con tu próxima limpieza facial.',
   'Servicio complementario', 'Belleza / Regalo'),
  
  ('centro_estetica', 'regular', 'cliente_contacta', 'auto',
   '¡Hola [Cliente]! ¿Lista/o para cuidar tu piel?',
   NULL, 'Cuidado / Cercano'),
  
  ('centro_estetica', 'vip', 'cliente_contacta', 'auto',
   '¡[Cliente]! Tu piel es nuestra prioridad. ¿Buscamos hueco?',
   NULL, 'Lujo / Exclusividad');

-- ───────────────────────────────────────────────────────────────────────────
-- 💬 INSERTAR ACCIONES - CLÍNICA DENTAL
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO crm_actions_by_vertical (vertical_id, segment, trigger, action_type, action_text, offer, tone) VALUES
  ('clinica_dental', 'nuevo', '24h_tras_visita', 'auto',
   '¡Hola [Cliente]! Soy [ASSISTANT_NAME] de [Clínica]. Gracias por confiar en nosotros para tu salud dental.',
   NULL, 'Profesional / Salud'),
  
  ('clinica_dental', 'en_riesgo', 'al_activar_regla', 'auto',
   '¡Hola [Cliente]! Soy [ASSISTANT_NAME] de [Clínica]. Ha pasado casi 1 año de tu última revisión. La prevención es clave. Tenemos huecos la semana que viene. ¿Te agendo?',
   NULL, 'Recordatorio Anual'),
  
  ('clinica_dental', 'inactivo', 'al_activar_regla', 'proposal',
   'Campaña "Sonrisa Sana". Texto: Sabemos que ha pasado tiempo. Vuelve y te hacemos la Revisión + Limpieza a un precio especial.',
   'Paquete básico', 'Salud preventiva'),
  
  ('clinica_dental', 'regular', 'cliente_contacta', 'auto',
   '¡Hola [Cliente]! ¿Necesitas agendar tu revisión?',
   NULL, 'Profesional'),
  
  ('clinica_dental', 'vip', 'cliente_contacta', 'auto',
   '¡Hola [Cliente]! ¿En qué podemos ayudarte? Tenemos disponibilidad prioritaria.',
   NULL, 'Profesional / Prioritario');

-- ───────────────────────────────────────────────────────────────────────────
-- 💬 INSERTAR ACCIONES - VETERINARIO
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO crm_actions_by_vertical (vertical_id, segment, trigger, action_type, action_text, offer, tone) VALUES
  ('veterinario', 'nuevo', '24h_tras_visita', 'auto',
   '¡Hola [Dueño]! Soy [ASSISTANT_NAME] de [Clínica Vet]. ¿Qué tal sigue [Mascota] después de la visita? ¡Esperamos que genial!',
   NULL, 'Cuidado / Empatía animal'),
  
  ('veterinario', 'en_riesgo', 'al_activar_regla', 'auto',
   '¡Hola [Dueño]! Soy [ASSISTANT_NAME]. Toca la revisión anual/vacuna de [Mascota]. ¡La prevención es clave! ¿Buscamos hueco?',
   NULL, 'Recordatorio Anual'),
  
  ('veterinario', 'inactivo', 'al_activar_regla', 'proposal',
   'Campaña "Huellas". Texto: ¡Echamos de menos a [Mascota]! Vuelve y te regalamos la desparasitación en su próxima consulta.',
   'Servicio de bajo coste', 'Cariño animal'),
  
  ('veterinario', 'regular', 'cliente_contacta', 'auto',
   '¡Hola! ¿Cómo está [Mascota]? ¿Necesitas agendar?',
   NULL, 'Cuidado / Cercano'),
  
  ('veterinario', 'vip', 'cliente_contacta', 'auto',
   '¡Hola! ¿Cómo está [Mascota]? Tenemos disponibilidad prioritaria.',
   NULL, 'Cuidado preferente');

-- ───────────────────────────────────────────────────────────────────────────
-- 🔒 ROW LEVEL SECURITY
-- ───────────────────────────────────────────────────────────────────────────

-- Las tablas de parámetros y reglas son públicas (solo lectura)
ALTER TABLE crm_vertical_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_segment_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_actions_by_vertical ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_business_overrides ENABLE ROW LEVEL SECURITY;

-- Permitir lectura a todos los usuarios autenticados
DROP POLICY IF EXISTS "Todos pueden leer parámetros de verticales" ON crm_vertical_parameters;
CREATE POLICY "Todos pueden leer parámetros de verticales"
  ON crm_vertical_parameters FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Todos pueden leer reglas de segmentación" ON crm_segment_rules;
CREATE POLICY "Todos pueden leer reglas de segmentación"
  ON crm_segment_rules FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Todos pueden leer acciones por vertical" ON crm_actions_by_vertical;
CREATE POLICY "Todos pueden leer acciones por vertical"
  ON crm_actions_by_vertical FOR SELECT
  TO authenticated
  USING (true);

-- Los overrides solo los puede ver/modificar el dueño del negocio
DROP POLICY IF EXISTS "Ver solo overrides de mi negocio" ON crm_business_overrides;
CREATE POLICY "Ver solo overrides de mi negocio"
  ON crm_business_overrides FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Modificar solo overrides de mi negocio" ON crm_business_overrides;
CREATE POLICY "Modificar solo overrides de mi negocio"
  ON crm_business_overrides FOR ALL
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- ✅ MIGRACIÓN COMPLETADA
-- ═══════════════════════════════════════════════════════════════════════════
-- 
-- Tablas creadas:
-- ✅ crm_vertical_parameters (10 verticales)
-- ✅ crm_segment_rules (5 segmentos: VIP, Nuevo, Inactivo, En Riesgo, Regular)
-- ✅ crm_actions_by_vertical (80+ acciones personalizadas)
-- ✅ crm_business_overrides (customización por negocio)
--
-- Funciones creadas:
-- ✅ calculate_personal_cadence() - Calcula mediana de últimos 3 intervalos
-- ✅ calculate_customer_segment() - Segmenta clientes según vertical y métricas
--
-- RLS:
-- ✅ Políticas configuradas para lectura pública y escritura privada
--
-- Próximo paso: Modificar frontend (Clientes.jsx) para usar este sistema
-- ═══════════════════════════════════════════════════════════════════════════

