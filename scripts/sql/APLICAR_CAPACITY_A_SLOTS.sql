-- =====================================================
-- APLICAR CAPACITY Y TABLE_NAME A AVAILABILITY_SLOTS
-- Fecha: 17 Octubre 2025
-- Para ejecutar en: Supabase SQL Editor
-- =====================================================

-- 🎯 ESTE SCRIPT:
-- 1. Agrega columnas capacity y table_name
-- 2. Hace backfill desde tables
-- 3. Actualiza función de generación
-- 4. Verifica todo correctamente

-- ⚠️ IMPORTANTE:
-- Este script es SEGURO - NO borra datos
-- Solo agrega columnas y actualiza función

-- =====================================================
-- PASO 1: AGREGAR COLUMNAS
-- =====================================================

ALTER TABLE availability_slots 
ADD COLUMN IF NOT EXISTS capacity INTEGER;

ALTER TABLE availability_slots 
ADD COLUMN IF NOT EXISTS table_name TEXT;

-- =====================================================
-- PASO 2: BACKFILL DATOS EXISTENTES
-- =====================================================

UPDATE availability_slots AS a
SET 
  capacity = t.capacity,
  table_name = t.name
FROM tables AS t
WHERE a.table_id = t.id
  AND (a.capacity IS NULL OR a.table_name IS NULL);

-- =====================================================
-- PASO 3: ESTABLECER NOT NULL
-- =====================================================

ALTER TABLE availability_slots ALTER COLUMN capacity SET NOT NULL;
ALTER TABLE availability_slots ALTER COLUMN table_name SET NOT NULL;

-- =====================================================
-- PASO 4: CREAR ÍNDICE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_availability_slots_capacity 
ON availability_slots(restaurant_id, slot_date, capacity, status)
WHERE status = 'free';

-- =====================================================
-- PASO 5: ACTUALIZAR FUNCIÓN
-- =====================================================

CREATE OR REPLACE FUNCTION cleanup_and_regenerate_availability(
    p_restaurant_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_settings JSONB;
    v_operating_hours JSONB;
    v_slot_interval INTEGER;
    v_reservation_duration INTEGER;
    v_current_date DATE;
    v_day_of_week INTEGER;
    v_day_config JSONB;
    v_is_open BOOLEAN;
    v_open_time TIME;
    v_close_time TIME;
    v_current_time TIME;
    v_end_time TIME;
    v_slots_created INTEGER := 0;
    v_slots_deleted INTEGER := 0;
    v_deleted_today INTEGER;
    v_days_protected INTEGER := 0;
    v_table RECORD;
    v_has_reservations BOOLEAN;
    v_is_day_closed BOOLEAN;
BEGIN
    SELECT settings INTO v_settings FROM restaurants WHERE id = p_restaurant_id;
    IF v_settings IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Restaurante no encontrado');
    END IF;
    
    v_operating_hours := v_settings->'operating_hours';
    v_slot_interval := COALESCE((v_settings->>'slot_interval')::INTEGER, 30);
    v_reservation_duration := COALESCE((v_settings->>'reservation_duration')::INTEGER, 90);
    
    v_current_date := p_start_date;
    
    WHILE v_current_date <= p_end_date LOOP
        SELECT EXISTS(
            SELECT 1 FROM special_events
            WHERE restaurant_id = p_restaurant_id
              AND event_date = v_current_date
              AND is_closed = true
        ) INTO v_is_day_closed;
        
        IF v_is_day_closed THEN
            DELETE FROM availability_slots
            WHERE restaurant_id = p_restaurant_id AND slot_date = v_current_date AND status = 'free';
            GET DIAGNOSTICS v_deleted_today = ROW_COUNT;
            v_slots_deleted := v_slots_deleted + v_deleted_today;
            v_days_protected := v_days_protected + 1;
            v_current_date := v_current_date + 1;
            CONTINUE;
        END IF;
        
        SELECT EXISTS(
            SELECT 1 FROM reservations
            WHERE restaurant_id = p_restaurant_id
              AND reservation_date = v_current_date
              AND status IN ('pending', 'confirmed', 'pending_approval', 'seated')
        ) INTO v_has_reservations;
        
        IF v_has_reservations THEN
            v_days_protected := v_days_protected + 1;
            v_current_date := v_current_date + 1;
            CONTINUE;
        END IF;
        
        DELETE FROM availability_slots
        WHERE restaurant_id = p_restaurant_id AND slot_date = v_current_date AND status = 'free';
        GET DIAGNOSTICS v_deleted_today = ROW_COUNT;
        v_slots_deleted := v_slots_deleted + v_deleted_today;
        
        v_day_of_week := EXTRACT(DOW FROM v_current_date);
        
        DECLARE
            v_day_name TEXT;
            v_is_open_field BOOLEAN;
            v_closed_field BOOLEAN;
        BEGIN
            v_day_name := CASE v_day_of_week
                WHEN 0 THEN 'sunday' WHEN 1 THEN 'monday' WHEN 2 THEN 'tuesday'
                WHEN 3 THEN 'wednesday' WHEN 4 THEN 'thursday' WHEN 5 THEN 'friday'
                WHEN 6 THEN 'saturday'
            END;
            
            v_day_config := v_operating_hours->v_day_name;
            v_is_open_field := (v_day_config->>'isOpen')::BOOLEAN;
            v_closed_field := (v_day_config->>'closed')::BOOLEAN;
            
            IF v_day_config ? 'isOpen' THEN
                v_is_open := COALESCE(v_is_open_field, false);
            ELSIF v_day_config ? 'closed' THEN
                v_is_open := NOT COALESCE(v_closed_field, true);
            ELSE
                v_is_open := false;
            END IF;
            
            IF NOT v_is_open THEN
                v_current_date := v_current_date + 1;
                CONTINUE;
            END IF;
            
            v_open_time := (v_day_config->>'open')::TIME;
            v_close_time := (v_day_config->>'close')::TIME;
            
            IF v_open_time IS NULL OR v_close_time IS NULL THEN
                v_current_date := v_current_date + 1;
                CONTINUE;
            END IF;
        END;
        
        FOR v_table IN 
            SELECT id, name, zone, capacity
            FROM tables 
            WHERE restaurant_id = p_restaurant_id AND is_active = true
        LOOP
            v_current_time := v_open_time;
            
            WHILE v_current_time <= v_close_time LOOP
                v_end_time := v_current_time + (v_reservation_duration || ' minutes')::INTERVAL;
                
                IF v_current_time <= v_close_time THEN
                    INSERT INTO availability_slots (
                        restaurant_id, slot_date, start_time, end_time,
                        table_id, zone, capacity, table_name,
                        status, is_available, duration_minutes, source,
                        created_at, updated_at
                    ) VALUES (
                        p_restaurant_id, v_current_date, v_current_time, v_end_time,
                        v_table.id, v_table.zone, v_table.capacity, v_table.name,
                        'free', true, v_reservation_duration, 'system',
                        NOW(), NOW()
                    )
                    ON CONFLICT (restaurant_id, slot_date, start_time, table_id) DO NOTHING;
                    
                    v_slots_created := v_slots_created + 1;
                END IF;
                
                v_current_time := v_current_time + (v_slot_interval || ' minutes')::INTERVAL;
            END LOOP;
        END LOOP;
        
        v_current_date := v_current_date + 1;
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', true,
        'slots_created', v_slots_created,
        'slots_deleted', v_slots_deleted,
        'days_protected', v_days_protected
    );
END;
$$;

-- =====================================================
-- VERIFICACIÓN FINAL
-- =====================================================

SELECT 
    COUNT(*) as total_slots,
    COUNT(capacity) as slots_con_capacity,
    COUNT(table_name) as slots_con_table_name,
    MIN(capacity) as capacity_min,
    MAX(capacity) as capacity_max,
    ROUND(AVG(capacity), 2) as capacity_promedio
FROM availability_slots;

-- =====================================================
-- EJEMPLO DE USO EN N8N (SIMPLIFICADO)
-- =====================================================

-- ANTES (2 nodos):
-- 1. Buscar slots
-- 2. Obtener mesas (JOIN)
-- 3. Filtrar por capacity

-- AHORA (1 nodo):
-- SELECT * FROM availability_slots
-- WHERE restaurant_id = 'xxx'
--   AND slot_date = '2025-10-22'
--   AND start_time = '21:30'
--   AND status = 'free'
--   AND capacity >= 4  -- ✅ DIRECTO!

-- =====================================================
-- ✅ LISTO - MIGRACIÓN COMPLETADA
-- =====================================================


