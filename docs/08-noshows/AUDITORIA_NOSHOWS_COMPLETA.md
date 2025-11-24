# 🔍 AUDITORÍA COMPLETA: Sistema No-Shows

**Fecha:** 2025-11-24  
**Objetivo:** Identificar todos los problemas antes de hacer correcciones

---

## 📋 RESUMEN EJECUTIVO

Se han identificado **3 problemas críticos** en el sistema de no-shows que impiden su funcionamiento correcto:

1. ❌ **Función `get_risk_appointments_today` usa tabla eliminada `services`**
2. ❌ **Inconsistencia en valores de `message_type` entre tabla y función**
3. ⚠️ **Posible problema con nombres de columnas en `appointments`**

---

## 🗄️ ESTRUCTURA DE TABLAS

### **Tabla: `appointments`**

**Columnas relevantes:**
- `id` (UUID, PK)
- `business_id` (UUID, FK → businesses)
- `customer_id` (UUID, FK → customers)
- `appointment_date` (DATE) ✅
- `appointment_time` (TIME) ✅
- `service_id` (UUID, FK → **business_services**) ✅
- `status` (TEXT: 'pending', 'confirmed', 'completed', 'cancelled', 'no_show')
- `customer_name` (TEXT)
- `customer_phone` (TEXT)
- `duration_minutes` (INTEGER)

**Confirmado:** La tabla usa `appointment_date` y `appointment_time` (NO `reservation_date`/`reservation_time`)

---

### **Tabla: `customer_confirmations`**

**Estructura según `20251123_02_noshows_infrastructure_FIXED.sql`:**
```sql
CREATE TABLE customer_confirmations (
    id UUID PRIMARY KEY,
    business_id UUID NOT NULL,
    appointment_id UUID NOT NULL,  -- ✅ Usa appointment_id
    customer_id UUID NOT NULL,
    message_type TEXT NOT NULL,  -- Valores: '24h', '4h', '2h', 'manual'
    message_channel TEXT DEFAULT 'whatsapp',
    message_sent TEXT,
    sent_at TIMESTAMPTZ,
    confirmed BOOLEAN DEFAULT FALSE,
    response_text TEXT,
    response_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
```

**Valores de `message_type`:** '24h', '4h', '2h', 'manual'

---

### **Tabla: `business_services`**

**Estructura según `20251109_06_business_services.sql`:**
```sql
CREATE TABLE business_services (
    id UUID PRIMARY KEY,
    business_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    duration_minutes INTEGER,
    ...
);
```

**Estado:** ✅ Tabla existe y es la correcta (reemplazó a `services`)

---

## 🔧 FUNCIONES RPC

### **Función: `calculate_simple_risk_level(p_appointment_id UUID)`**

**Ubicación:** `supabase/migrations/20251108_04_noshows_simplificado.sql`

**Problemas identificados:**

1. ✅ **Usa columnas correctas:** `appointment_date`, `appointment_time`
2. ❌ **PROBLEMA CRÍTICO:** Busca `message_type = 'Confirmación 24h antes'` pero la tabla usa `'24h'`
3. ❌ **PROBLEMA CRÍTICO:** Busca `message_type = 'Recordatorio 4h antes'` pero la tabla usa `'4h'`

**Código problemático (líneas 82-94):**
```sql
WHERE appointment_id = p_appointment_id 
AND message_type = 'Confirmación 24h antes'  -- ❌ Debería ser '24h'
AND confirmed = true

WHERE appointment_id = p_appointment_id 
AND message_type = 'Recordatorio 4h antes'  -- ❌ Debería ser '4h'
AND confirmed = true
```

**Impacto:** La función **NUNCA** encontrará confirmaciones porque los valores no coinciden.

---

### **Función: `get_risk_appointments_today(p_business_id UUID)`**

**Ubicación:** `supabase/migrations/20251108_04_noshows_simplificado.sql`

**Problemas identificados:**

1. ❌ **PROBLEMA CRÍTICO:** Hace JOIN con tabla `services` que fue eliminada
   ```sql
   LEFT JOIN services s ON a.service_id = s.id  -- ❌ services no existe
   ```

2. ✅ **Usa columnas correctas:** `appointment_date`, `appointment_time`

3. ✅ **Usa función correcta:** `calculate_simple_risk_level(a.id)`

**Código problemático (línea 205):**
```sql
LEFT JOIN services s ON a.service_id = s.id  -- ❌
```

**Debería ser:**
```sql
LEFT JOIN business_services bs ON a.service_id = bs.id  -- ✅
```

---

### **Función: `get_simple_noshow_metrics(p_business_id UUID)`**

**Ubicación:** `supabase/migrations/20251108_04_noshows_simplificado.sql`

**Estado:** ✅ **NO tiene problemas** - No hace JOIN con `services`

---

## 🎯 FRONTEND

### **Archivo: `src/pages/NoShowsSimple.jsx`**

**Funciones que llama:**
1. `get_simple_noshow_metrics(p_business_id)` - ✅ OK
2. `get_risk_appointments_today(p_business_id)` - ❌ Falla por JOIN con `services`

**Campos que espera recibir:**
- `appointment_id`
- `customer_name`
- `customer_phone`
- `appointment_date`
- `appointment_time`
- `service_name`
- `duration_minutes`
- `risk_level`
- `risk_color`
- `risk_emoji`
- `why_risk`
- `what_to_do`
- `confirmed_24h`
- `confirmed_4h`
- `hours_until`

---

## 📊 PROBLEMAS IDENTIFICADOS

### **Problema 1: JOIN con tabla eliminada** 🔴 CRÍTICO

**Función:** `get_risk_appointments_today`  
**Línea:** 205 en `20251108_04_noshows_simplificado.sql`  
**Error:** `relation "services" does not exist`

**Solución:**
```sql
-- Cambiar de:
LEFT JOIN services s ON a.service_id = s.id

-- A:
LEFT JOIN business_services bs ON a.service_id = bs.id
-- Y cambiar s.name a bs.name
```

---

### **Problema 2: Valores incorrectos de message_type** 🔴 CRÍTICO

**Función:** `calculate_simple_risk_level`  
**Líneas:** 84 y 91 en `20251108_04_noshows_simplificado.sql`  
**Error:** Nunca encuentra confirmaciones porque los valores no coinciden

**Solución:**
```sql
-- Cambiar de:
message_type = 'Confirmación 24h antes'  -- ❌
message_type = 'Recordatorio 4h antes'   -- ❌

-- A:
message_type = '24h'  -- ✅
message_type = '4h'   -- ✅
```

---

### **Problema 3: Migración ya creada pero incompleta** ⚠️

**Archivo:** `supabase/migrations/20251124_02_fix_noshows_functions_services_table.sql`

**Estado:** 
- ✅ Corrige el Problema 1 (JOIN con services)
- ❌ NO corrige el Problema 2 (message_type)

---

## ✅ PLAN DE CORRECCIÓN

### **Paso 1: Actualizar migración existente**

Actualizar `20251124_02_fix_noshows_functions_services_table.sql` para incluir:
1. ✅ Corrección del JOIN con `business_services` (ya está)
2. ❌ Corrección de valores de `message_type` en `calculate_simple_risk_level`

### **Paso 2: Verificar dependencias**

- ✅ `get_risk_appointments_today` depende de `calculate_simple_risk_level` → OK
- ✅ `get_simple_noshow_metrics` depende de `calculate_simple_risk_level` → OK

### **Paso 3: Testing**

Después de aplicar la migración, verificar:
1. ✅ `get_risk_appointments_today` retorna datos sin error
2. ✅ `calculate_simple_risk_level` encuentra confirmaciones correctamente
3. ✅ Frontend muestra citas con riesgo correctamente

---

## 📝 NOTAS ADICIONALES

### **Sistemas de No-Shows en el código:**

1. **Sistema Simplificado (V3.0):**
   - Funciones: `calculate_simple_risk_level`, `get_risk_appointments_today`, `get_simple_noshow_metrics`
   - Frontend: `NoShowsSimple.jsx`
   - Estado: ❌ Roto (problemas identificados)

2. **Sistema Inteligente (V2.0):**
   - Funciones: `calculate_smart_risk_score`, `get_high_risk_appointments`
   - Frontend: `NoShowControlNuevo.jsx`
   - Estado: ⚠️ No verificado en esta auditoría

### **Migraciones relacionadas:**

- `20251108_04_noshows_simplificado.sql` - Sistema simplificado (tiene bugs)
- `20251123_02_noshows_infrastructure_FIXED.sql` - Infraestructura (OK)
- `20251123_03_noshows_risk_intelligence_FIXED.sql` - Sistema inteligente (no verificado)
- `20251124_02_fix_noshows_functions_services_table.sql` - Corrección parcial (incompleta)

---

## 🎯 CONCLUSIÓN

**Problemas críticos encontrados:** 2  
**Problemas menores:** 1  
**Estado general:** ❌ Sistema no funcional

**Acción requerida:** Actualizar la migración `20251124_02_fix_noshows_functions_services_table.sql` para corregir AMBOS problemas antes de aplicarla.

