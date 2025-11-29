# 🔍 AUDITORÍA PRE-MIGRACIÓN: Sistema No-Shows
**Fecha:** 24 Noviembre 2025  
**Objetivo:** Análisis exhaustivo antes de aplicar correcciones  
**Estado:** 📋 Pre-ejecución

---

## 📊 RESUMEN EJECUTIVO

### Problemas Identificados:
1. ✅ **CORREGIDO en migración pendiente:** JOIN con tabla `services` eliminada
2. ✅ **CORREGIDO en migración pendiente:** Valores incorrectos de `message_type`

### Estado Actual:
- ❌ Sistema NO funcional (bugs bloqueantes)
- ✅ Migración correctiva YA preparada
- ⏳ Pendiente de aplicación

---

## 🔍 ANÁLISIS DETALLADO

### 1. Estructura de Tablas

#### Tabla `appointments` (✅ OK)
```sql
-- Columnas relevantes:
- id UUID PRIMARY KEY
- business_id UUID
- customer_id UUID
- appointment_date DATE          -- ✅ Correcto
- appointment_time TIME          -- ✅ Correcto
- service_id UUID                -- FK a business_services
- status TEXT                    -- 'pending', 'confirmed', 'no_show', etc.
- customer_name TEXT
- customer_phone TEXT
- duration_minutes INTEGER
```

#### Tabla `customer_confirmations` (✅ OK)
```sql
-- Creada en: 20251123_02_noshows_infrastructure_FIXED.sql
CREATE TABLE customer_confirmations (
    id UUID PRIMARY KEY,
    business_id UUID NOT NULL,
    appointment_id UUID NOT NULL,  -- ✅ Usa appointment_id
    customer_id UUID NOT NULL,
    message_type TEXT NOT NULL,    -- Valores: '24h', '4h', '2h', 'manual'
    message_channel TEXT DEFAULT 'whatsapp',
    message_sent TEXT NOT NULL,
    sent_at TIMESTAMPTZ,
    confirmed BOOLEAN DEFAULT FALSE,
    response_text TEXT,
    response_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
```

**Valores válidos de `message_type`:** `'24h'`, `'4h'`, `'2h'`, `'manual'`

#### Tabla `business_services` (✅ OK)
```sql
-- Reemplazó a la tabla 'services' eliminada
CREATE TABLE business_services (
    id UUID PRIMARY KEY,
    business_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    duration_minutes INTEGER,
    ...
);
```

---

### 2. Funciones SQL a Corregir

#### Función 1: `calculate_simple_risk_level(UUID)`

**Ubicación original:** `20251108_04_noshows_simplificado.sql` (líneas 84-92)

**Problema detectado:**
```sql
-- ❌ INCORRECTO (líneas 84-92):
WHERE message_type = 'Confirmación 24h antes'  -- La tabla usa '24h'
WHERE message_type = 'Recordatorio 4h antes'   -- La tabla usa '4h'
```

**Corrección aplicada en `20251124_02_fix_noshows_functions_services_table.sql`:**
```sql
-- ✅ CORRECTO (líneas 137-144):
WHERE message_type = '24h'  -- Coincide con la tabla
WHERE message_type = '4h'   -- Coincide con la tabla
```

**Impacto:** Sin esta corrección, el sistema NUNCA detecta confirmaciones. Todas las citas aparecen como "no confirmadas" aunque el cliente haya respondido.

---

#### Función 2: `get_risk_appointments_today(UUID)`

**Ubicación original:** `20251108_04_noshows_simplificado.sql` (línea 205)

**Problema detectado:**
```sql
-- ❌ INCORRECTO:
LEFT JOIN services s ON a.service_id = s.id  -- Tabla 'services' no existe
SELECT s.name AS service_name                -- Falla
```

**Corrección aplicada en `20251124_02_fix_noshows_functions_services_table.sql`:**
```sql
-- ✅ CORRECTO (líneas 52):
LEFT JOIN business_services bs ON a.service_id = bs.id
SELECT COALESCE(bs.name, 'Servicio') AS service_name
```

**Impacto:** Sin esta corrección, la función falla con error `relation "services" does not exist`. No se pueden cargar citas de hoy.

---

### 3. Lógica de Riesgo (Cascada de Decisión)

La lógica implementada es **CORRECTA** y sigue la arquitectura definida:

```sql
-- PASO 1: ¿Confirmó? → BAJO RIESGO
IF v_confirmed_24h OR v_confirmed_4h THEN
    return 'low';

-- PASO 2: ¿<2h sin confirmar? → ALTO RIESGO (🚨 URGENCIA)
ELSIF v_hours_until < 2 AND v_hours_until > 0 THEN
    return 'high';  -- Este es el que parpadea en calendario

-- PASO 3: ¿Historial de no-shows? → ALTO RIESGO
ELSIF v_has_noshows THEN
    return 'high';  -- Sin urgencia temporal

-- PASO 4: ¿Reserva last-minute? → MEDIO RIESGO
ELSIF v_booking_days < 1 THEN
    return 'medium';

-- PASO 5: ¿Sin confirmar pero con tiempo? → MEDIO RIESGO
ELSIF NOT v_confirmed_24h AND v_hours_until < 24 THEN
    return 'medium';

-- PASO 6: Default → BAJO RIESGO
ELSE
    return 'low';
END IF;
```

**Validación:**
- ✅ No penaliza a clientes nuevos sin motivo
- ✅ Prioriza confirmación sobre todo
- ✅ Urgencia temporal (<2h) tiene máxima prioridad visual
- ✅ Distingue entre "alto riesgo con urgencia" y "alto riesgo sin urgencia"

---

## 🎯 MIGRACIÓN A APLICAR

### Archivo: `20251124_02_fix_noshows_functions_services_table.sql`

**Contenido:**
- ✅ Corrige JOIN con `business_services`
- ✅ Corrige valores de `message_type`
- ✅ Mantiene lógica de cascada intacta
- ✅ Añade comentarios explicativos

**Estado:** ✅ LISTO para aplicar

**Dependencias:**
- Requiere que exista `customer_confirmations` (creada en `20251123_02`)
- Requiere que exista `business_services` (migración anterior)
- Requiere que exista `appointments` (tabla core)

---

## 🧪 PLAN DE TESTING POST-MIGRACIÓN

### Test 1: Verificar existencia de funciones
```sql
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name IN (
    'calculate_simple_risk_level',
    'get_risk_appointments_today',
    'get_simple_noshow_metrics'
)
AND routine_schema = 'public';
```

**Esperado:** 3 filas (las 3 funciones deben existir)

---

### Test 2: Probar cálculo de riesgo con cita real
```sql
-- Obtener una cita de hoy
SELECT id, customer_name, appointment_date, appointment_time 
FROM appointments 
WHERE business_id = '<TU_BUSINESS_ID>'
AND appointment_date = CURRENT_DATE
LIMIT 1;

-- Calcular su riesgo
SELECT * FROM calculate_simple_risk_level('<APPOINTMENT_ID>');
```

**Esperado:**
- Retorna 1 fila con todos los campos
- `risk_level` es 'low', 'medium' o 'high'
- `hours_until_appointment` es un número positivo o negativo
- `confirmed_24h` y `confirmed_4h` son booleanos

---

### Test 3: Listar citas de hoy con riesgo
```sql
SELECT * FROM get_risk_appointments_today('<TU_BUSINESS_ID>');
```

**Esperado:**
- Retorna N filas (una por cada cita de hoy)
- Campos incluyen: `service_name` (no null), `risk_level`, `hours_until`
- Ordenadas por riesgo (high → medium → low) y luego por hora

---

### Test 4: Simular confirmación y verificar cálculo
```sql
-- 1. Crear confirmación de prueba
INSERT INTO customer_confirmations (
    business_id,
    appointment_id,
    customer_id,
    message_type,
    message_channel,
    message_sent,
    sent_at,
    confirmed,
    response_text,
    response_at
) VALUES (
    '<BUSINESS_ID>',
    '<APPOINTMENT_ID>',
    '<CUSTOMER_ID>',
    '24h',                    -- ✅ Valor correcto
    'whatsapp',
    'Hola, ¿confirmas tu cita?',
    NOW() - INTERVAL '1 hour',
    TRUE,                     -- Cliente confirmó
    'Sí, confirmo',
    NOW() - INTERVAL '50 minutes'
);

-- 2. Recalcular riesgo
SELECT risk_level, confirmed_24h, why_risk
FROM calculate_simple_risk_level('<APPOINTMENT_ID>');
```

**Esperado:**
- `risk_level` = 'low' (porque confirmó)
- `confirmed_24h` = TRUE
- `why_risk` = 'Ha confirmado su asistencia'

---

### Test 5: Verificar detección de urgencia (<2h)
```sql
-- Crear cita ficticia en <2h sin confirmar
INSERT INTO appointments (
    business_id,
    customer_id,
    appointment_date,
    appointment_time,
    customer_name,
    customer_phone,
    status,
    duration_minutes
) VALUES (
    '<BUSINESS_ID>',
    '<CUSTOMER_ID>',
    CURRENT_DATE,
    (CURRENT_TIME + INTERVAL '1 hour 30 minutes')::TIME,  -- En 1.5h
    'Test Cliente',
    '+34666777888',
    'pending',
    60
) RETURNING id;

-- Calcular riesgo
SELECT risk_level, hours_until_appointment, why_risk
FROM calculate_simple_risk_level('<APPOINTMENT_ID_INSERTADO>');
```

**Esperado:**
- `risk_level` = 'high'
- `hours_until_appointment` ≈ 1.5
- `why_risk` = 'Faltan menos de 2 horas y no ha confirmado'

---

## 📝 CHECKLIST PRE-APLICACIÓN

Antes de aplicar la migración, verificar:

- [x] Migración existe: `20251124_02_fix_noshows_functions_services_table.sql`
- [x] Migración contiene correcciones de ambos problemas
- [x] Lógica de cascada es correcta
- [ ] **Backup de base de datos realizado** ⚠️
- [ ] Conexión a Supabase activa
- [ ] Usuario con permisos de ejecución SQL

---

## 🚀 SIGUIENTE PASO

**Aplicar la migración:**
```bash
# Opción 1: Desde Supabase Dashboard
1. Ir a SQL Editor
2. Copiar contenido de 20251124_02_fix_noshows_functions_services_table.sql
3. Ejecutar
4. Verificar: "Success. No rows returned"

# Opción 2: Desde CLI (si está configurado)
supabase db push
```

**Tiempo estimado:** 2-3 segundos  
**Impacto:** Sin downtime (solo reemplaza funciones)

---

## ✅ POST-MIGRACIÓN

Una vez aplicada, ejecutar **todos los tests** (Test 1-5) para verificar:
1. ✅ Funciones existen
2. ✅ Cálculo de riesgo funciona
3. ✅ Detección de confirmaciones funciona
4. ✅ JOIN con `business_services` funciona
5. ✅ Urgencia (<2h) se detecta correctamente

---

**Preparado por:** Sistema de Auditoría Automatizada  
**Revisado por:** CTO  
**Estado:** ✅ LISTO PARA APLICAR  
**Riesgo:** 🟢 BAJO (solo corrige bugs, no cambia estructura)










