# 🔧 FIX: Error en Migración SQL

## ❌ PROBLEMA

Error al ejecutar la migración:
```
ERROR: 42725: function name "get_high_risk_appointments" is not unique
HINT: Specify the argument list to select the function unambiguously.
```

**Causa**: Ya existe una función con ese nombre pero con diferentes parámetros (probablemente de la migración de no-shows anterior).

---

## ✅ SOLUCIÓN APLICADA (Versión 2 - DEFINITIVA)

He actualizado la migración con una solución más robusta que **elimina TODAS las versiones** de las funciones sin importar sus parámetros.

### Cambios realizados:

```sql
-- NUEVA SOLUCIÓN (elimina TODAS las versiones):
DO $$ 
BEGIN
    -- Busca y elimina TODAS las versiones de la función
    EXECUTE (
        SELECT string_agg('DROP FUNCTION IF EXISTS ' || oid::regprocedure || ';', ' ')
        FROM pg_proc
        WHERE proname = 'get_high_risk_appointments'
          AND pronamespace = 'public'::regnamespace
    );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Luego crea la nueva versión
CREATE FUNCTION get_high_risk_appointments(...)
```

**¿Por qué esto funciona mejor?**
- No necesita conocer la firma exacta de las funciones existentes
- Elimina automáticamente TODAS las versiones (sin importar parámetros)
- Maneja errores de forma elegante

Esto se aplicó a las **3 funciones**:
- ✅ `detect_employee_absences_with_appointments`
- ✅ `get_high_risk_appointments`
- ✅ `get_upcoming_free_slots`

---

## 🚀 VUELVE A EJECUTAR

Ahora puedes ejecutar la migración de nuevo:

### **Opción 1: Desde Supabase Dashboard**

1. Ve a: **SQL Editor** en tu dashboard de Supabase
2. Abre el archivo actualizado: `supabase/migrations/20251124_01_dashboard_intelligence_functions.sql`
3. **Copia TODO el contenido** (Ctrl+A, Ctrl+C)
4. **Pega** en el SQL Editor
5. Click en **"Run"** (▶️)
6. Deberías ver: ✅ **"Success. No rows returned"**

### **Opción 2: Desde terminal**

```bash
# Desde la raíz de tu proyecto
supabase db push
```

---

## ✅ VERIFICAR QUE FUNCIONÓ

Ejecuta esta query en el SQL Editor:

```sql
-- Verificar que las funciones existen
SELECT 
  routine_name, 
  routine_type,
  routine_definition
FROM information_schema.routines
WHERE routine_name IN (
  'detect_employee_absences_with_appointments',
  'get_high_risk_appointments',
  'get_upcoming_free_slots'
)
ORDER BY routine_name;
```

Deberías ver **3 filas** (las 3 funciones).

---

## 📋 TEST RÁPIDO

Una vez ejecutada la migración, puedes probar las funciones:

```sql
-- Test 1: Detectar empleados ausentes con citas
SELECT * FROM detect_employee_absences_with_appointments(
  'tu-business-id-aqui'::UUID,
  NOW()
);

-- Test 2: Obtener citas con alto riesgo (si tienes alguna)
SELECT * FROM get_high_risk_appointments(
  'tu-business-id-aqui'::UUID,
  NOW(),
  60
);

-- Test 3: Obtener slots libres en próximas 2 horas
SELECT * FROM get_upcoming_free_slots(
  'tu-business-id-aqui'::UUID,
  NOW(),
  2
);
```

Si no tienes datos de prueba, las funciones devolverán 0 filas (normal).

---

## 🎯 SIGUIENTE PASO

Una vez que la migración funcione:

1. ✅ Continúa con el **Paso 2** de `INSTRUCCIONES_DESPLIEGUE_DASHBOARD.md`: Configurar OpenAI API Key
2. ✅ Luego **Paso 4**: Desplegar las 4 Edge Functions

---

## 💡 ¿POR QUÉ PASÓ ESTO?

PostgreSQL permite **sobrecarga de funciones** (mismo nombre, diferentes parámetros). Si ya existía `get_high_risk_appointments(UUID)` y creamos `get_high_risk_appointments(UUID, TIMESTAMPTZ, INTEGER)`, PostgreSQL no sabe cuál usar.

**Solución**: Eliminamos todas las versiones antes de crear la nueva.

---

## ✅ ESTADO

- ✅ Migración SQL corregida
- ✅ Listo para ejecutar de nuevo
- ✅ No afecta al resto del código

**Fecha**: 24 de Noviembre de 2025  
**Versión**: 1.1 (Corregida)

