# ⚠️ NOTAS IMPORTANTES - MIGRACIÓN NO-SHOWS

**Fecha**: 2025-11-23  
**Estado**: ✅ Corregido

---

## 🚨 PROBLEMA DETECTADO

Las migraciones originales (`20251123_02` y `20251123_03`) **FALLABAN** porque:

1. ❌ Intentaban crear columnas que NO existen en el schema real:
   - `message_cost_cents` (no existe)
   - `provider` (no existe)
   - `provider_message_id` (no existe)
   - `metadata` (no existe)

2. ❌ Usaban nombres incorrectos de tablas:
   - Usaban `reservations` → **INCORRECTO**
   - El nombre real es `appointments` → **CORRECTO**

3. ❌ No verificaban si la tabla `customer_confirmations` ya existía

---

## ✅ SOLUCIÓN APLICADA

He creado **versiones corregidas** de las migraciones:

### Archivos CORRECTOS (usar estos):
- ✅ `supabase/migrations/20251123_02_noshows_infrastructure_FIXED.sql`
- ✅ `supabase/migrations/20251123_03_noshows_risk_intelligence_FIXED.sql`

### Archivos INCORRECTOS (eliminados):
- ❌ `supabase/migrations/20251123_02_noshows_infrastructure.sql` (eliminado)
- ❌ `supabase/migrations/20251123_03_noshows_risk_intelligence.sql` (eliminado)

---

## 🔧 CAMBIOS REALIZADOS

### Migración 02 (Infraestructura):

**✅ ANTES (incorrecto)**:
```sql
CREATE TABLE customer_confirmations (
    ...
    message_cost_cents INTEGER DEFAULT 0,  -- ❌ No existe
    provider TEXT,  -- ❌ No existe
    provider_message_id TEXT,  -- ❌ No existe
    metadata JSONB DEFAULT '{}'::JSONB  -- ❌ No existe
);
```

**✅ AHORA (correcto)**:
```sql
-- Verifica si la tabla existe antes de crearla
DO $$
BEGIN
    IF NOT EXISTS (...) THEN
        CREATE TABLE customer_confirmations (
            id UUID,
            business_id UUID,
            appointment_id UUID,
            customer_id UUID,
            message_type TEXT,
            message_channel TEXT,
            message_sent TEXT,  -- ✅ Nombre correcto
            sent_at TIMESTAMPTZ,
            confirmed BOOLEAN,
            response_text TEXT,  -- ✅ Nombre correcto
            response_at TIMESTAMPTZ,  -- ✅ Nombre correcto
            created_at TIMESTAMPTZ,
            updated_at TIMESTAMPTZ
        );
    ELSE
        -- Si existe, verificar y añadir columnas faltantes
        ...
    END IF;
END $$;
```

### Migración 03 (Risk Intelligence):

**✅ ANTES (incorrecto)**:
```sql
FROM reservations r  -- ❌ Tabla incorrecta
JOIN customers c ON r.customer_id = c.id
```

**✅ AHORA (correcto)**:
```sql
FROM appointments a  -- ✅ Tabla correcta
LEFT JOIN customers c ON a.customer_id = c.id
```

---

## 📋 ESTRUCTURA VERIFICADA

### Tabla: `appointments` (REAL)

**Columnas confirmadas**:
- ✅ `id` (UUID)
- ✅ `business_id` (UUID) ← **NO `restaurant_id`**
- ✅ `customer_id` (UUID)
- ✅ `customer_name` (TEXT) ← Copia del nombre del cliente
- ✅ `customer_phone` (TEXT) ← Copia del teléfono del cliente
- ✅ `appointment_date` (DATE)
- ✅ `appointment_time` (TIME)
- ✅ `status` (TEXT) → `'pending'`, `'confirmed'`, `'completed'`, `'cancelled'`, `'no_show'`
- ✅ `service_id` (UUID)
- ✅ `employee_id` (UUID)
- ✅ `resource_id` (UUID)
- ✅ `duration_minutes` (INTEGER)
- ✅ `created_at` (TIMESTAMPTZ)
- ✅ `updated_at` (TIMESTAMPTZ)

### Tabla: `customers` (REAL)

**Columnas confirmadas**:
- ✅ `id` (UUID)
- ✅ `business_id` (UUID) ← **NO `restaurant_id`**
- ✅ `name` (TEXT)
- ✅ `phone` (TEXT)
- ✅ `email` (TEXT)
- ✅ `created_at` (TIMESTAMPTZ)
- ⚠️ `no_show_count` (INTEGER) ← **Se añadirá con la migración**

### Tabla: `availability_slots` (REAL)

**Columnas confirmadas**:
- ✅ `id` (UUID)
- ✅ `business_id` (UUID) ← **NO `restaurant_id`**
- ✅ `slot_date` (DATE)
- ✅ `start_time` (TIME)
- ✅ `end_time` (TIME)
- ✅ `status` (TEXT) → `'free'`, `'reserved'`, `'occupied'`, `'blocked'`
- ✅ `is_available` (BOOLEAN)
- ✅ `employee_id` (UUID)
- ✅ `resource_id` (UUID)
- ✅ `created_at` (TIMESTAMPTZ)
- ✅ `updated_at` (TIMESTAMPTZ)

---

## 🧪 VALIDACIÓN PRE-MIGRACIÓN

Antes de ejecutar las migraciones, verifica la estructura con:

```sql
-- 1. Verificar que appointments existe
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'appointments' 
ORDER BY ordinal_position;

-- 2. Verificar que customers existe
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'customers' 
ORDER BY ordinal_position;

-- 3. Verificar si customer_confirmations YA existe
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'customer_confirmations'
);

-- 4. Si existe, ver su estructura
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'customer_confirmations' 
ORDER BY ordinal_position;
```

---

## ✅ GARANTÍAS DE LAS MIGRACIONES CORREGIDAS

1. ✅ **Idempotentes**: Se pueden ejecutar múltiples veces sin errores
2. ✅ **No destructivas**: NO eliminan datos existentes
3. ✅ **Adaptativas**: Detectan qué ya existe y solo añaden lo faltante
4. ✅ **Seguras**: Validan columnas antes de renombrarlas/crearlas
5. ✅ **Schema-aware**: Usan `information_schema` para verificar estructura

---

## 🚀 CÓMO EJECUTAR (SEGURO)

```bash
# Conectar a Supabase
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"

# Ejecutar migraciones CORREGIDAS
\i supabase/migrations/20251123_02_noshows_infrastructure_FIXED.sql
\i supabase/migrations/20251123_03_noshows_risk_intelligence_FIXED.sql
```

**Si hay errores**:
1. Copia el error completo
2. Ejecuta las queries de validación de arriba
3. Ajusta la migración según la estructura real

---

## 📞 SOPORTE

Si encuentras más errores de estructura:
1. Ejecuta: `\d+ appointments` (describe tabla completa)
2. Ejecuta: `\d+ customers`
3. Ejecuta: `\d+ customer_confirmations` (si existe)
4. Envía el output para ajustar las migraciones

---

**Autor**: LA-IA Development Team  
**Versión**: 1.0 (Corregida)  
**Última actualización**: 2025-11-23


