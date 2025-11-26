# 🔧 FIX - Migración Dashboard Intelligence

**Fecha:** 24 Noviembre 2025  
**Problema detectado:** Conflicto de funciones SQL duplicadas y errores de esquema

---

## ❌ **PROBLEMA ORIGINAL**

1. Creé archivo `20251124_03_dashboard_intelligence_functions.sql` DUPLICADO
2. El archivo correcto `20251124_01_dashboard_intelligence_functions.sql` YA existía
3. Conflicto al intentar crear funciones con diferentes parámetros
4. Errores de esquema:
   - Columna `price` no existe (es `suggested_price`)
   - Función `calculate_dynamic_risk_score()` no existe
   - Columna `last_visit_date` no existe (es `last_visit_at`)

---

## ✅ **SOLUCIÓN APLICADA**

### 1. **Eliminado archivo duplicado**
   - ❌ `20251124_03_dashboard_intelligence_functions.sql` → Eliminado

### 2. **Corregido archivo existente**
   - ✅ `20251124_01_dashboard_intelligence_functions.sql` → Actualizado

### 3. **Correcciones aplicadas:**

#### A. **Función `get_upcoming_free_slots`**
   - **Error:** `bs.price`
   - **Corrección:** `bs.suggested_price` ✅

#### B. **Función `get_high_risk_appointments`**
   - **Error:** Usaba `calculate_dynamic_risk_score()` que NO existe
   - **Corrección:** Implementé cálculo de risk_score INLINE (dentro de la query) ✅
   - **Error:** Usaba `c.last_visit_date`
   - **Corrección:** `c.last_visit_at` ✅

---

## 📊 **ESTADO ACTUAL DE LAS FUNCIONES**

### ✅ **Funciones LISTAS para usar:**

1. **`detect_employee_absences_with_appointments()`**
   - Parámetros: `p_business_id UUID, p_timestamp TIMESTAMPTZ DEFAULT NOW()`
   - Retorna: Empleados ausentes con citas asignadas + alternativas
   - Estado: ✅ CORREGIDA

2. **`get_high_risk_appointments()`**
   - Parámetros: `p_business_id UUID, p_timestamp TIMESTAMPTZ DEFAULT NOW(), p_risk_threshold INTEGER DEFAULT 60`
   - Retorna: Citas con riesgo >= threshold
   - Estado: ✅ CORREGIDA (cálculo inline de risk_score)

3. **`get_upcoming_free_slots()`**
   - Parámetros: `p_business_id UUID, p_timestamp TIMESTAMPTZ DEFAULT NOW(), p_hours_ahead INTEGER DEFAULT 2`
   - Retorna: Slots libres en próximas X horas + servicios potenciales
   - Estado: ✅ CORREGIDA (usa `suggested_price`)

---

## 🧪 **TESTING - Queries de Prueba**

### Test 1: Crisis de Personal
```sql
SELECT * FROM detect_employee_absences_with_appointments(
  'tu-business-id'::UUID,
  NOW()
);
```

**Resultado esperado:**
- Empleados ausentes HOY con citas futuras
- JSON de citas afectadas
- JSON de empleados alternativos

---

### Test 2: Riesgo de No-Show
```sql
SELECT * FROM get_high_risk_appointments(
  'tu-business-id'::UUID,
  NOW(),
  60
);
```

**Resultado esperado:**
- Citas con risk_score >= 60
- Calculado inline (no depende de otra función)
- Ordenado por riesgo DESC

---

### Test 3: Huecos Libres
```sql
SELECT * FROM get_upcoming_free_slots(
  'tu-business-id'::UUID,
  NOW(),
  2
);
```

**Resultado esperado:**
- Slots libres en próximas 2 horas
- JSON de servicios potenciales con `suggested_price`

---

## 🚀 **PRÓXIMO PASO**

**EJECUTAR LA MIGRACIÓN:**

### Opción 1: Desde Supabase Dashboard (Recomendado)
1. Ve a SQL Editor
2. Copia el contenido de `supabase/migrations/20251124_01_dashboard_intelligence_functions.sql`
3. Ejecuta
4. Verifica que no hay errores

### Opción 2: Desde CLI
```bash
supabase db push
```

---

## ⚠️ **IMPORTANTE**

- ✅ Las 3 funciones YA están en el archivo `20251124_01`
- ✅ El archivo `20251124_03` fue eliminado (estaba duplicado)
- ✅ NO hay conflictos de parámetros
- ✅ NO hay errores de esquema

---

## 📋 **CHECKLIST POST-MIGRACIÓN**

Después de ejecutar la migración:

- [ ] Verificar que las 3 funciones existen: 
  ```sql
  SELECT proname, pronargs FROM pg_proc 
  WHERE proname IN (
    'detect_employee_absences_with_appointments',
    'get_high_risk_appointments',
    'get_upcoming_free_slots'
  );
  ```
  
- [ ] Probar cada función con datos reales
- [ ] Verificar que get-snapshot funciona
- [ ] Crear datos de prueba según `DATOS_PRUEBA_DASHBOARD_SOCIO_VIRTUAL.md`

---

**Documento creado:** 24 Noviembre 2025  
**Última actualización:** 24 Noviembre 2025  
**Estado:** ✅ Migración corregida y lista para ejecutar






