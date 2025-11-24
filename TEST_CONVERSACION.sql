-- ============================================================
-- TEST: Insertar conversación de prueba
-- ============================================================

-- PASO 1: Ver columnas reales de 'customers'
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'customers'
ORDER BY ordinal_position;

-- ============================================================
-- PASO 2: Insertar cliente de prueba (SIN segment)
-- ============================================================

INSERT INTO customers (business_id, name, phone)
VALUES (
    '3bbe9ac3-3e61-471e-822e-e159f6ad8ae2', 
    'Cliente Test MVP', 
    '+34600000000'
)
ON CONFLICT (business_id, phone) 
DO UPDATE SET name = 'Cliente Test MVP'
RETURNING id, name, phone;

-- ============================================================
-- PASO 3: Insertar conversación de prueba
-- ============================================================

INSERT INTO agent_conversations (
    business_id,
    customer_id,
    customer_name,
    customer_phone,
    source_channel,
    interaction_type,
    status,
    outcome,
    sentiment,
    metadata,
    created_at
)
VALUES (
    '3bbe9ac3-3e61-471e-822e-e159f6ad8ae2',
    (SELECT id FROM customers WHERE phone = '+34600000000' AND business_id = '3bbe9ac3-3e61-471e-822e-e159f6ad8ae2' LIMIT 1),
    'Cliente Test MVP',
    '+34600000000',
    'phone',
    'reservation',
    'resolved',
    'reservation_created',
    'positive',
    jsonb_build_object(
        'recording_url', 'https://www2.cs.uic.edu/~i101/SoundFiles/BabyElephantWalk60.wav',
        'conversation_summary', 'Cliente habitual. Preguntó precio del corte de pelo. Le informamos que cuesta 25€. Agendó cita para mañana a las 10:00. Tono amable y satisfecho.',
        'duration_seconds', 180,
        'vapi_call_id', 'test_call_123',
        'key_topics', json_build_array('precio', 'reserva', 'horario'),
        'resolution_quality', 5,
        'satisfaction_level', 'very_satisfied'
    ),
    NOW() - INTERVAL '2 hours'
)
RETURNING id, customer_name, outcome, metadata->>'recording_url' as audio_url;

-- ============================================================
-- PASO 4: Verificar que se insertó correctamente
-- ============================================================

SELECT 
    ac.id,
    ac.customer_name,
    ac.customer_phone,
    ac.outcome,
    ac.sentiment,
    ac.status,
    ac.created_at,
    ac.metadata->>'recording_url' as audio_url,
    ac.metadata->>'conversation_summary' as summary,
    c.name as customer_from_join,
    c.email as customer_email
FROM agent_conversations ac
LEFT JOIN customers c ON ac.customer_id = c.id
WHERE ac.business_id = '3bbe9ac3-3e61-471e-822e-e159f6ad8ae2'
ORDER BY ac.created_at DESC
LIMIT 5;

-- ============================================================
-- PASO 5 (OPCIONAL): Limpiar datos de prueba después
-- ============================================================

/*
-- Descomentar para eliminar los datos de prueba:

DELETE FROM agent_conversations 
WHERE customer_name = 'Cliente Test MVP' 
  AND business_id = '3bbe9ac3-3e61-471e-822e-e159f6ad8ae2';

DELETE FROM customers 
WHERE phone = '+34600000000' 
  AND business_id = '3bbe9ac3-3e61-471e-822e-e159f6ad8ae2';
*/


