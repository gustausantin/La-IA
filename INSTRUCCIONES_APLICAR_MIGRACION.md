# 🚀 INSTRUCCIONES: Aplicar Migración No-Shows

**Archivo:** `supabase/migrations/20251124_02_fix_noshows_functions_services_table.sql`  
**Fecha:** 24 Noviembre 2025  
**Tiempo estimado:** 5 minutos  
**Riesgo:** 🟢 BAJO (solo actualiza funciones, no modifica datos)

---

## ⚠️ ANTES DE EMPEZAR

### 1. Verificar prerrequisitos

✅ **Acceso a Supabase Dashboard**
- URL: https://supabase.com/dashboard
- Proyecto: La-IA App
- Permisos: SQL Editor habilitado

✅ **Backup recomendado** (opcional pero buena práctica)
```sql
-- Ejecutar esto PRIMERO para guardar las funciones actuales
SELECT routine_name, routine_definition
FROM information_schema.routines
WHERE routine_name IN (
    'calculate_simple_risk_level',
    'get_risk_appointments_today'
)
AND routine_schema = 'public';

-- Copiar el resultado a un archivo de texto por si necesitas rollback
```

---

## 📋 PASO A PASO

### PASO 1: Abrir Supabase SQL Editor

1. Ve a https://supabase.com/dashboard
2. Selecciona tu proyecto: **La-IA**
3. En el menú lateral izquierdo, clic en **SQL Editor** 📝
4. Clic en **New query** (botón verde superior derecho)

---

### PASO 2: Copiar el contenido de la migración

1. Abre el archivo: `supabase/migrations/20251124_02_fix_noshows_functions_services_table.sql`
2. **Selecciona TODO el contenido** (Ctrl+A o Cmd+A)
3. **Copia** (Ctrl+C o Cmd+C)

---

### PASO 3: Pegar y ejecutar

1. **Pega** el contenido en el editor de Supabase (Ctrl+V o Cmd+V)
2. Revisa que se ve bien (debe tener 224 líneas)
3. Clic en el botón **▶ Run** (esquina inferior derecha)
4. **Espera 2-3 segundos**

---

### PASO 4: Verificar resultado

Deberías ver uno de estos mensajes:

✅ **ÉXITO:**
```
Success. No rows returned
```
O:
```
Success. Rows returned: 0
```

❌ **ERROR:** Si ves un error rojo, **NO CONTINÚES** y:
1. Copia el mensaje de error completo
2. Mándamelo para analizar
3. **NO ejecutes nada más**

---

## ✅ TESTING POST-MIGRACIÓN

Una vez aplicada la migración con éxito, vamos a verificar que funciona correctamente.

### TEST 1: Verificar que las funciones existen

```sql
-- Copiar y ejecutar esto en SQL Editor:
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name IN (
    'calculate_simple_risk_level',
    'get_risk_appointments_today',
    'get_simple_noshow_metrics'
)
AND routine_schema = 'public'
ORDER BY routine_name;
```

**Resultado esperado:**
```
calculate_simple_risk_level    | FUNCTION
get_risk_appointments_today    | FUNCTION
get_simple_noshow_metrics      | FUNCTION
```

✅ Si ves las 3 filas → **CORRECTO**  
❌ Si faltan funciones → **HAY PROBLEMA, contacta conmigo**

---

### TEST 2: Probar cálculo de riesgo

```sql
-- REEMPLAZA <TU_BUSINESS_ID> con tu ID real
SELECT id, customer_name, appointment_date, appointment_time, status
FROM appointments 
WHERE business_id = '<TU_BUSINESS_ID>'
AND appointment_date >= CURRENT_DATE
LIMIT 5;
```

**Resultado esperado:** Ver 5 citas (o las que tengas)

Ahora toma un `id` de la lista anterior y prueba:

```sql
-- REEMPLAZA <APPOINTMENT_ID> con uno real de la lista anterior
SELECT 
    risk_level,
    risk_emoji,
    confirmed_24h,
    confirmed_4h,
    hours_until_appointment,
    why_risk
FROM calculate_simple_risk_level('<APPOINTMENT_ID>');
```

**Resultado esperado:**
```
risk_level | risk_emoji | confirmed_24h | confirmed_4h | hours_until_appointment | why_risk
-----------|------------|---------------|--------------|------------------------|----------
low        | 🟢         | false         | false        | 48.5                   | Cliente confiable sin señales de riesgo
```

✅ Si retorna 1 fila con datos → **FUNCIONA CORRECTAMENTE**  
❌ Si retorna 0 filas o error → **HAY PROBLEMA**

---

### TEST 3: Listar citas de hoy con riesgo

```sql
-- REEMPLAZA <TU_BUSINESS_ID> con tu ID real
SELECT 
    customer_name,
    appointment_time,
    service_name,          -- ← Esta columna debe tener valor (no null)
    risk_level,
    risk_emoji,
    hours_until
FROM get_risk_appointments_today('<TU_BUSINESS_ID>')
ORDER BY risk_level, appointment_time;
```

**Resultado esperado:**
- Lista de citas de HOY
- Columna `service_name` tiene valor (ej: "Corte de pelo", "Servicio")
- Ordenadas por riesgo (high → medium → low)

✅ Si `service_name` NO es null → **JOIN CORREGIDO**  
❌ Si `service_name` es null o error → **HAY PROBLEMA**

---

### TEST 4: Verificar detección de confirmaciones

Si tienes alguna cita con confirmación en `customer_confirmations`:

```sql
-- Ver si hay confirmaciones registradas
SELECT 
    cc.appointment_id,
    cc.message_type,      -- ← Debe ser '24h' o '4h'
    cc.confirmed,
    a.customer_name,
    a.appointment_date
FROM customer_confirmations cc
JOIN appointments a ON cc.appointment_id = a.id
WHERE cc.business_id = '<TU_BUSINESS_ID>'
AND cc.confirmed = TRUE
LIMIT 5;
```

Si hay resultados, toma un `appointment_id` y verifica:

```sql
SELECT risk_level, confirmed_24h, confirmed_4h, why_risk
FROM calculate_simple_risk_level('<APPOINTMENT_ID_CONFIRMADO>');
```

**Resultado esperado:**
- `risk_level` = 'low'
- `confirmed_24h` o `confirmed_4h` = TRUE
- `why_risk` = 'Ha confirmado su asistencia'

✅ Si detecta la confirmación → **PERFECTO**  
❌ Si no la detecta → **Revisar valores de message_type**

---

## 🎯 RESUMEN DE VALIDACIÓN

Marca cada test cuando lo completes:

- [ ] TEST 1: Funciones existen ✅
- [ ] TEST 2: Cálculo de riesgo funciona ✅
- [ ] TEST 3: Lista de hoy funciona + `service_name` no es null ✅
- [ ] TEST 4: Detecta confirmaciones (si hay datos) ✅

**Si todos los tests pasan → MIGRACIÓN EXITOSA** 🎉

---

## 🔧 SI ALGO SALE MAL

### Error: "relation services does not exist"
**Causa:** La migración no se aplicó correctamente  
**Solución:** Vuelve a ejecutar la migración completa

### Error: "function does not exist"
**Causa:** La función no se creó  
**Solución:** Verifica que ejecutaste TODO el archivo (224 líneas)

### Las confirmaciones no se detectan
**Causa:** Los valores de `message_type` no coinciden  
**Solución:** Verifica con esta query:
```sql
SELECT DISTINCT message_type 
FROM customer_confirmations 
WHERE business_id = '<TU_BUSINESS_ID>';
```
Si ves `'Confirmación 24h antes'` en lugar de `'24h'`, hay un problema de datos.

---

## 📞 CONTACTO

Si encuentras **cualquier error**, envíame:
1. ✅ Captura de pantalla del error
2. ✅ Query que ejecutaste
3. ✅ Resultado del TEST 1 (verificar funciones)

**NO sigas adelante si hay errores. Mejor paramos y revisamos.**

---

**Preparado por:** Sistema de Migración Controlada  
**Nivel de confianza:** 95%  
**Tiempo total estimado:** 5-10 minutos  
**Riesgo:** 🟢 BAJO









