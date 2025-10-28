-- =====================================================
-- ECOSISTEMA COMPLETO DE RESTAURANTE - DATOS REALISTAS
-- =====================================================
-- Para: gustausantin@gmail.com
-- Crea: Menú completo + Consumos reales + Reservas futuras + Dashboard funcional

-- =====================================================
-- FUNCIÓN PARA GENERAR ITEMS REALISTAS (CREAR PRIMERO)
-- =====================================================
CREATE OR REPLACE FUNCTION generate_realistic_items(target_rest_id UUID, ticket_total DECIMAL)
RETURNS JSONB AS $func$
DECLARE
    items_array JSONB := '[]'::JSONB;
    item_record RECORD;
    remaining_total DECIMAL := ticket_total;
    item_count INTEGER;
    quantity INTEGER;
    item_total DECIMAL;
BEGIN
    -- Generar entre 2 y 5 items por ticket
    item_count := (RANDOM() * 3 + 2)::INTEGER;
    
    -- Seleccionar items aleatorios del menú
    FOR item_record IN (
        SELECT name, price, category
        FROM menu_items 
        WHERE restaurant_id = target_rest_id 
        ORDER BY RANDOM() 
        LIMIT item_count
    ) LOOP
        quantity := (RANDOM() * 2 + 1)::INTEGER; -- 1-3 unidades
        item_total := item_record.price * quantity;
        
        -- Ajustar si nos pasamos del total
        IF item_total > remaining_total THEN
            quantity := GREATEST(1, (remaining_total / item_record.price)::INTEGER);
            item_total := item_record.price * quantity;
        END IF;
        
        items_array := items_array || jsonb_build_object(
            'name', item_record.name,
            'category', item_record.category,
            'quantity', quantity,
            'unit_price', item_record.price,
            'total_price', item_total
        );
        
        remaining_total := remaining_total - item_total;
        
        EXIT WHEN remaining_total <= 0;
    END LOOP;
    
    RETURN items_array;
END;
$func$ LANGUAGE plpgsql;

DO $$
DECLARE
    target_restaurant_id UUID;
    target_user_id UUID;
    customer_record RECORD;
    reservation_id UUID;
    ticket_id UUID;
    menu_items JSONB;
    
    -- Variables para generación de datos
    random_date DATE;
    random_time TIME;
    random_items JSONB;
    random_total DECIMAL(10,2);
    subtotal_calc DECIMAL(10,2);
    tax_calc DECIMAL(10,2);
    discount_calc DECIMAL(10,2);
    
    -- Contadores
    reservations_created INTEGER := 0;
    tickets_created INTEGER := 0;
    
BEGIN
    RAISE NOTICE '🚀 INICIANDO GENERACIÓN COMPLETA DEL ECOSISTEMA...';
    
    -- 1. BUSCAR RESTAURANT Y USER ID
    SELECT u.id, r.id 
    INTO target_user_id, target_restaurant_id
    FROM auth.users u
    INNER JOIN businesses r ON r.owner_id = u.id
    WHERE u.email = 'gustausantin@gmail.com'
    LIMIT 1;
    
    IF target_restaurant_id IS NULL THEN
        RAISE EXCEPTION 'No se encontró restaurante para gustausantin@gmail.com';
    END IF;
    
    RAISE NOTICE '✅ Restaurante encontrado: %', target_restaurant_id;
    
    -- =====================================================
    -- 2. CREAR TABLA DE PRODUCTOS DEL MENÚ
    -- =====================================================
    
    CREATE TABLE IF NOT EXISTS menu_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        restaurant_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100) NOT NULL, -- 'primeros', 'segundos', 'postres', 'bebidas', 'extras'
        price DECIMAL(8,2) NOT NULL,
        cost DECIMAL(8,2), -- Coste para calcular margen
        is_available BOOLEAN DEFAULT TRUE,
        allergens TEXT[], -- Array de alérgenos
        preparation_time INTEGER, -- Minutos de preparación
        popularity_score INTEGER DEFAULT 0, -- Para ordenar por popularidad
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        
        CONSTRAINT valid_price CHECK (price > 0),
        CONSTRAINT valid_cost CHECK (cost IS NULL OR cost >= 0)
    );
    
    -- Índices para menu_items
    CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant ON menu_items(restaurant_id);
    CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(restaurant_id, category);
    CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items(restaurant_id, is_available);
    
    -- RLS para menu_items
    ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
    
    -- Crear política solo si no existe
    DO $policy$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'menu_items' 
            AND policyname = 'Users can manage menu items from their restaurant'
        ) THEN
            CREATE POLICY "Users can manage menu items from their restaurant" ON menu_items
            FOR ALL USING (
                restaurant_id IN (
                    SELECT r.id FROM businesses r 
                    WHERE r.owner_id = auth.uid()
                )
            );
        END IF;
    END;
    $policy$;
    
    RAISE NOTICE '✅ Tabla menu_items creada correctamente';
    
    -- =====================================================
    -- 3. INSERTAR MENÚ COMPLETO Y REALISTA
    -- =====================================================
    
    -- PRIMEROS PLATOS
    INSERT INTO menu_items (restaurant_id, name, description, category, price, cost, preparation_time, popularity_score) VALUES
    (target_restaurant_id, 'Ensalada César', 'Lechuga romana, pollo a la plancha, parmesano, picatostes y salsa césar', 'primeros', 12.50, 4.20, 8, 85),
    (target_restaurant_id, 'Crema de Calabaza', 'Crema suave de calabaza con jengibre y coco', 'primeros', 9.80, 2.10, 5, 70),
    (target_restaurant_id, 'Carpaccio de Ternera', 'Láminas finas de ternera con rúcula, parmesano y aceite de trufa', 'primeros', 16.90, 8.50, 10, 75),
    (target_restaurant_id, 'Hummus con Verduras', 'Hummus casero con crudités de temporada', 'primeros', 8.50, 2.80, 5, 60),
    (target_restaurant_id, 'Tabla de Jamón Ibérico', 'Selección de jamón ibérico con pan tostado', 'primeros', 18.50, 12.20, 3, 90);
    
    -- SEGUNDOS PLATOS
    INSERT INTO menu_items (restaurant_id, name, description, category, price, cost, preparation_time, popularity_score) VALUES
    (target_restaurant_id, 'Salmón a la Plancha', 'Salmón fresco con verduras salteadas y salsa de eneldo', 'segundos', 22.90, 12.50, 15, 88),
    (target_restaurant_id, 'Entrecot de Ternera', 'Entrecot a la parrilla con patatas confitadas', 'segundos', 26.50, 16.80, 20, 92),
    (target_restaurant_id, 'Risotto de Setas', 'Risotto cremoso con setas de temporada y trufa', 'segundos', 18.90, 6.20, 18, 78),
    (target_restaurant_id, 'Pollo al Curry', 'Pollo con curry suave, arroz basmati y verduras', 'segundos', 17.50, 7.90, 16, 82),
    (target_restaurant_id, 'Paella Valenciana', 'Paella tradicional con pollo, conejo, garrofó y judía verde', 'segundos', 19.90, 8.50, 25, 95);
    
    -- POSTRES
    INSERT INTO menu_items (restaurant_id, name, description, category, price, cost, preparation_time, popularity_score) VALUES
    (target_restaurant_id, 'Tiramisú Casero', 'Tiramisú tradicional italiano', 'postres', 7.50, 2.10, 5, 85),
    (target_restaurant_id, 'Tarta de Queso', 'Tarta de queso con coulis de frutos rojos', 'postres', 6.90, 1.80, 3, 80),
    (target_restaurant_id, 'Crema Catalana', 'Crema catalana tradicional con azúcar quemado', 'postres', 5.50, 1.20, 8, 75),
    (target_restaurant_id, 'Helado Artesanal', 'Helado casero (vainilla, chocolate o fresa)', 'postres', 4.50, 1.50, 2, 70);
    
    -- BEBIDAS
    INSERT INTO menu_items (restaurant_id, name, description, category, price, cost, preparation_time, popularity_score) VALUES
    (target_restaurant_id, 'Agua Mineral', 'Agua mineral natural 50cl', 'bebidas', 2.50, 0.40, 1, 95),
    (target_restaurant_id, 'Refresco', 'Coca Cola, Fanta o Sprite 33cl', 'bebidas', 3.20, 0.80, 1, 88),
    (target_restaurant_id, 'Cerveza Estrella', 'Cerveza Estrella Galicia 33cl', 'bebidas', 3.80, 1.20, 1, 92),
    (target_restaurant_id, 'Vino Tinto Crianza', 'Vino tinto crianza D.O. Rioja (copa)', 'bebidas', 4.50, 2.20, 1, 78),
    (target_restaurant_id, 'Vino Blanco', 'Vino blanco Albariño (copa)', 'bebidas', 4.20, 2.00, 1, 72),
    (target_restaurant_id, 'Sangría (1L)', 'Sangría casera con frutas naturales', 'bebidas', 12.00, 4.50, 3, 85),
    (target_restaurant_id, 'Café Solo', 'Café expreso', 'bebidas', 1.80, 0.30, 2, 90),
    (target_restaurant_id, 'Café con Leche', 'Café con leche cremoso', 'bebidas', 2.20, 0.45, 2, 88);
    
    RAISE NOTICE '✅ Menú completo insertado: % items', (SELECT COUNT(*) FROM menu_items WHERE restaurant_id = target_restaurant_id);
    
    -- =====================================================
    -- 4. ACTUALIZAR BILLING_TICKETS EXISTENTES CON ITEMS REALISTAS
    -- =====================================================
    -- La función se creará fuera del bloque DO
    
    -- Actualizar todos los billing_tickets existentes
    UPDATE billing_tickets 
    SET items = generate_realistic_items(restaurant_id, total_amount)
    WHERE restaurant_id = target_restaurant_id;
    
    RAISE NOTICE '✅ Items realistas actualizados en billing_tickets existentes';
    
    -- =====================================================
    -- 5. GENERAR RESERVAS FUTURAS (HOY, MAÑANA, ESTA SEMANA)
    -- =====================================================
    
    -- Reservas para HOY
    FOR i IN 1..3 LOOP
        SELECT id INTO customer_record FROM customers 
        WHERE restaurant_id = target_restaurant_id 
        ORDER BY RANDOM() LIMIT 1;
        
        INSERT INTO reservations (
            restaurant_id,
            customer_id,
            customer_name,
            customer_phone,
            customer_email,
            party_size,
            reservation_date,
            reservation_time,
            status,
            table_id,
            special_requests,
            created_at
        ) VALUES (
            target_restaurant_id,
            customer_record.id,
            (SELECT name FROM customers WHERE id = customer_record.id),
            (SELECT phone FROM customers WHERE id = customer_record.id),
            (SELECT email FROM customers WHERE id = customer_record.id),
            (RANDOM() * 4 + 2)::INTEGER, -- 2-6 personas
            CURRENT_DATE,
            (ARRAY['19:00', '19:30', '20:00', '20:30', '21:00'])[ceil(random()*5)]::TIME,
            CASE 
                WHEN RANDOM() > 0.7 THEN 'confirmed'
                ELSE 'pending'
            END,
            (SELECT id FROM tables WHERE restaurant_id = target_restaurant_id ORDER BY RANDOM() LIMIT 1),
            CASE 
                WHEN RANDOM() > 0.8 THEN 'Cumpleaños - tarta especial'
                WHEN RANDOM() > 0.9 THEN 'Alergia a frutos secos'
                ELSE NULL
            END,
            NOW() - (RANDOM() * INTERVAL '2 hours')
        );
        
        reservations_created := reservations_created + 1;
    END LOOP;
    
    -- Reservas para MAÑANA
    FOR i IN 1..4 LOOP
        SELECT id INTO customer_record FROM customers 
        WHERE restaurant_id = target_restaurant_id 
        ORDER BY RANDOM() LIMIT 1;
        
        INSERT INTO reservations (
            restaurant_id,
            customer_id,
            customer_name,
            customer_phone,
            customer_email,
            party_size,
            reservation_date,
            reservation_time,
            status,
            table_id,
            special_requests,
            created_at
        ) VALUES (
            target_restaurant_id,
            customer_record.id,
            (SELECT name FROM customers WHERE id = customer_record.id),
            (SELECT phone FROM customers WHERE id = customer_record.id),
            (SELECT email FROM customers WHERE id = customer_record.id),
            (RANDOM() * 4 + 2)::INTEGER,
            CURRENT_DATE + 1,
            (ARRAY['12:30', '13:00', '19:00', '19:30', '20:00', '20:30', '21:00'])[ceil(random()*7)]::TIME,
            CASE 
                WHEN RANDOM() > 0.5 THEN 'confirmed'
                ELSE 'pending'
            END,
            (SELECT id FROM tables WHERE restaurant_id = target_restaurant_id ORDER BY RANDOM() LIMIT 1),
            NULL,
            NOW() - (RANDOM() * INTERVAL '6 hours')
        );
        
        reservations_created := reservations_created + 1;
    END LOOP;
    
    -- Reservas para ESTA SEMANA (próximos 5 días)
    FOR i IN 1..8 LOOP
        SELECT id INTO customer_record FROM customers 
        WHERE restaurant_id = target_restaurant_id 
        ORDER BY RANDOM() LIMIT 1;
        
        random_date := CURRENT_DATE + (RANDOM() * 5 + 2)::INTEGER; -- 2-7 días en el futuro
        
        INSERT INTO reservations (
            restaurant_id,
            customer_id,
            customer_name,
            customer_phone,
            customer_email,
            party_size,
            reservation_date,
            reservation_time,
            status,
            table_id,
            special_requests,
            created_at
        ) VALUES (
            target_restaurant_id,
            customer_record.id,
            (SELECT name FROM customers WHERE id = customer_record.id),
            (SELECT phone FROM customers WHERE id = customer_record.id),
            (SELECT email FROM customers WHERE id = customer_record.id),
            (RANDOM() * 6 + 2)::INTEGER,
            random_date,
            (ARRAY['12:00', '12:30', '13:00', '13:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30'])[ceil(random()*10)]::TIME,
            CASE 
                WHEN RANDOM() > 0.6 THEN 'confirmed'
                WHEN RANDOM() > 0.9 THEN 'cancelled'
                ELSE 'pending'
            END,
            (SELECT id FROM tables WHERE restaurant_id = target_restaurant_id ORDER BY RANDOM() LIMIT 1),
            CASE 
                WHEN RANDOM() > 0.85 THEN 'Mesa junto a ventana'
                WHEN RANDOM() > 0.92 THEN 'Vegetariano estricto'
                ELSE NULL
            END,
            NOW() - (RANDOM() * INTERVAL '24 hours')
        );
        
        reservations_created := reservations_created + 1;
    END LOOP;
    
    RAISE NOTICE '✅ Reservas futuras creadas: %', reservations_created;
    
    -- =====================================================
    -- 6. GENERAR TICKETS ADICIONALES PARA CONSUMOS RECIENTES
    -- =====================================================
    
    -- Generar tickets adicionales sin reserva (walk-ins) para los últimos 7 días
    FOR i IN 1..12 LOOP
        SELECT id INTO customer_record FROM customers 
        WHERE restaurant_id = target_restaurant_id 
        ORDER BY RANDOM() LIMIT 1;
        
        random_date := CURRENT_DATE - (RANDOM() * 7)::INTEGER;
        
        -- Calcular totales realistas
        subtotal_calc := (RANDOM() * 60 + 15)::DECIMAL(10,2); -- Entre 15€ y 75€
        tax_calc := ROUND(subtotal_calc * 0.10, 2); -- 10% IVA
        discount_calc := CASE 
            WHEN RANDOM() > 0.8 THEN ROUND(subtotal_calc * 0.05, 2) -- 5% descuento ocasional
            ELSE 0
        END;
        random_total := subtotal_calc + tax_calc - discount_calc;
        
        INSERT INTO billing_tickets (
            restaurant_id,
            customer_id,
            ticket_number,
            ticket_date,
            items,
            subtotal,
            tax_amount,
            discount_amount,
            total_amount,
            payment_method,
            covers_count,
            tip_amount,
            waiter_name,
            source_system,
            is_processed,
            created_at
        ) VALUES (
            target_restaurant_id,
            customer_record.id,
            'TK-' || TO_CHAR(random_date, 'YYYYMMDD') || '-' || LPAD((RANDOM() * 999)::TEXT, 3, '0'),
            random_date + (RANDOM() * INTERVAL '12 hours' + INTERVAL '11 hours'), -- Entre 11:00 y 23:00
            generate_realistic_items(target_restaurant_id, random_total),
            subtotal_calc,
            tax_calc,
            discount_calc,
            random_total,
            (ARRAY['efectivo', 'tarjeta', 'tarjeta', 'tarjeta', 'transferencia'])[ceil(random()*5)], -- Más tarjetas
            (RANDOM() * 4 + 1)::INTEGER, -- 1-5 comensales
            CASE 
                WHEN RANDOM() > 0.7 THEN ROUND(random_total * 0.08, 2) -- 8% propina ocasional
                ELSE 0
            END,
            (ARRAY['Ana', 'Carlos', 'María', 'David', 'Laura'])[ceil(random()*5)],
            'manual',
            TRUE,
            random_date + (RANDOM() * INTERVAL '12 hours' + INTERVAL '11 hours')
        );
        
        tickets_created := tickets_created + 1;
    END LOOP;
    
    RAISE NOTICE '✅ Tickets adicionales creados: %', tickets_created;
    
    -- =====================================================
    -- 7. ACTUALIZAR ESTADÍSTICAS DE CLIENTES
    -- =====================================================
    
    -- Recalcular todas las estadísticas CRM v2
    UPDATE customers SET
        -- Visitas en los últimos 12 meses
        visits_12m = (
            SELECT COUNT(DISTINCT bt.ticket_date::date)
            FROM billing_tickets bt
            WHERE bt.customer_id = customers.id 
              AND bt.ticket_date >= NOW() - INTERVAL '12 months'
              AND bt.is_processed = TRUE
        ),
        -- Total gastado en 12 meses
        total_spent_12m = (
            SELECT COALESCE(SUM(bt.total_amount), 0)
            FROM billing_tickets bt
            WHERE bt.customer_id = customers.id 
              AND bt.ticket_date >= NOW() - INTERVAL '12 months'
              AND bt.is_processed = TRUE
        ),
        -- Recencia actualizada
        recency_days = (
            SELECT COALESCE(
                DATE_PART('day', NOW() - MAX(bt.ticket_date)),
                999
            )::INTEGER
            FROM billing_tickets bt
            WHERE bt.customer_id = customers.id AND bt.is_processed = TRUE
        ),
        -- AIVI recalculado
        aivi_days = (
            SELECT COALESCE(
                CASE 
                    WHEN COUNT(*) > 1 THEN
                        DATE_PART('day', MAX(bt.ticket_date) - MIN(bt.ticket_date)) / NULLIF(COUNT(*) - 1, 0)
                    ELSE 30.0
                END,
                30.0
            )
            FROM billing_tickets bt
            WHERE bt.customer_id = customers.id AND bt.is_processed = TRUE
        ),
        -- Platos favoritos
        top_dishes = (
            SELECT jsonb_agg(dish_stats ORDER BY total_quantity DESC)
            FROM (
                SELECT 
                    item->>'name' as dish_name,
                    SUM((item->>'quantity')::INTEGER) as total_quantity
                FROM billing_tickets bt,
                     jsonb_array_elements(bt.items) as item
                WHERE bt.customer_id = customers.id 
                  AND bt.is_processed = TRUE
                GROUP BY item->>'name'
                ORDER BY total_quantity DESC
                LIMIT 3
            ) dish_stats
        ),
        -- Día de la semana favorito
        fav_weekday = (
            SELECT EXTRACT(DOW FROM bt.ticket_date)::INTEGER
            FROM billing_tickets bt
            WHERE bt.customer_id = customers.id AND bt.is_processed = TRUE
            GROUP BY EXTRACT(DOW FROM bt.ticket_date)
            ORDER BY COUNT(*) DESC
            LIMIT 1
        ),
        -- Bloque horario favorito (como INTEGER: 12=almuerzo, 19=cena, 0=otro)
        fav_hour_block = (
            SELECT 
                CASE 
                    WHEN EXTRACT(HOUR FROM bt.ticket_date) BETWEEN 12 AND 16 THEN 12
                    WHEN EXTRACT(HOUR FROM bt.ticket_date) BETWEEN 19 AND 23 THEN 19
                    ELSE 0
                END
            FROM billing_tickets bt
            WHERE bt.customer_id = customers.id AND bt.is_processed = TRUE
            GROUP BY 
                CASE 
                    WHEN EXTRACT(HOUR FROM bt.ticket_date) BETWEEN 12 AND 16 THEN 12
                    WHEN EXTRACT(HOUR FROM bt.ticket_date) BETWEEN 19 AND 23 THEN 19
                    ELSE 0
                END
            ORDER BY COUNT(*) DESC
            LIMIT 1
        ),
        features_updated_at = NOW()
    WHERE restaurant_id = target_restaurant_id;
    
    -- Recalcular segmentación automática
    UPDATE customers SET
        segment_auto_v2 = (
            CASE 
                WHEN visits_12m <= 1 THEN 'nuevo'
                WHEN recency_days <= 30 AND visits_12m >= 3 THEN 'activo'
                WHEN total_spent_12m >= 300 THEN 'vip'
                WHEN recency_days <= 60 THEN 'riesgo'
                ELSE 'inactivo'
            END
        ),
        is_vip_calculated = (total_spent_12m >= 300 OR visits_12m >= 8)
    WHERE restaurant_id = target_restaurant_id;
    
    RAISE NOTICE '✅ Estadísticas de clientes actualizadas';
    
    -- =====================================================
    -- 8. GENERAR DATOS PARA EL DASHBOARD
    -- =====================================================
    
    -- Crear algunas reservas "de agente" para mostrar estadísticas
    UPDATE reservations 
    SET 
        source = 'agent',
        notes = 'Reserva gestionada por IA - ' || 
                CASE 
                    WHEN RANDOM() > 0.5 THEN 'Cliente preguntó por mesa cerca de ventana'
                    ELSE 'Cliente pidió recomendación de vinos'
                END
    WHERE restaurant_id = target_restaurant_id 
      AND created_at >= CURRENT_DATE - INTERVAL '7 days'
      AND RANDOM() > 0.6; -- ~40% de reservas serán "de agente"
    
    RAISE NOTICE '✅ Datos de agente IA configurados para dashboard';
    
    -- =====================================================
    -- 9. NO LIMPIAR FUNCIONES - Se creará fuera del bloque
    -- =====================================================
    
    -- =====================================================
    -- 10. RESUMEN FINAL
    -- =====================================================
    
    RAISE NOTICE '';
    RAISE NOTICE '🎉 ¡ECOSISTEMA COMPLETO GENERADO!';
    RAISE NOTICE '================================';
    RAISE NOTICE '📋 Menú: % productos', (SELECT COUNT(*) FROM menu_items WHERE restaurant_id = target_restaurant_id);
    RAISE NOTICE '📅 Reservas futuras: %', reservations_created;
    RAISE NOTICE '🧾 Tickets adicionales: %', tickets_created;
    RAISE NOTICE '📊 Tickets totales: %', (SELECT COUNT(*) FROM billing_tickets WHERE restaurant_id = target_restaurant_id);
    RAISE NOTICE '👥 Clientes con estadísticas: %', (SELECT COUNT(*) FROM customers WHERE restaurant_id = target_restaurant_id AND features_updated_at IS NOT NULL);
    RAISE NOTICE '';
    RAISE NOTICE '✅ DASHBOARD TENDRÁ DATOS REALES';
    RAISE NOTICE '✅ CRM v2 COMPLETAMENTE FUNCIONAL';
    RAISE NOTICE '✅ CONSUMOS CON ANÁLISIS DETALLADO';
    RAISE NOTICE '✅ RESERVAS FUTURAS VISIBLES';
    RAISE NOTICE '';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error generando ecosistema completo: %', SQLERRM;
END;
$$;

