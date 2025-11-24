# 🔍 Diagnóstico: Sincronización con Google Calendar

**Fecha:** 21 de Noviembre 2025  
**Problema:** Las reservas creadas en la aplicación no aparecen en Google Calendar

---

## ✅ Checklist de Verificación

### **1. Verificar que Google Calendar esté conectado:**

```sql
-- En Supabase SQL Editor
-- ✅ Esta query funciona para TODOS los negocios
SELECT 
    id,
    business_id,
    provider,
    is_active,
    config->>'calendar_ids' as calendar_ids,
    config->>'employee_calendar_mapping' as employee_mapping,
    config->>'resource_calendar_mapping' as resource_mapping,
    last_sync_at,
    created_at
FROM integrations
WHERE provider = 'google_calendar'
  AND is_active = true
ORDER BY created_at DESC;
```

**O si quieres ver solo TU negocio (reemplaza con tu business_id real):**
```sql
SELECT 
    id,
    business_id,
    provider,
    is_active,
    config->>'calendar_ids' as calendar_ids,
    config->>'employee_calendar_mapping' as employee_mapping,
    config->>'resource_calendar_mapping' as resource_mapping
FROM integrations
WHERE provider = 'google_calendar'
  AND is_active = true
  AND business_id = '3bbe9ac3-3e61-471e-822e-e159f6ad8ae2'; -- ⚠️ Reemplaza con tu business_id
```

**Debe mostrar:**
- ✅ `is_active = true`
- ✅ `calendar_ids` no vacío
- ✅ `employee_calendar_mapping` o `resource_calendar_mapping` con valores

---

### **2. Verificar que la reserva tenga `employee_id` o `resource_id`:**

```sql
-- ✅ Verificar las últimas 5 reservas creadas (para TODOS los negocios)
SELECT 
    id,
    business_id,
    customer_name,
    appointment_date,
    appointment_time,
    employee_id,
    resource_id,
    gcal_event_id,
    synced_to_gcal,
    internal_notes->>'gcal_event_id' as gcal_from_notes,
    created_at
FROM appointments
ORDER BY created_at DESC
LIMIT 5;
```

**O solo para TU negocio:**
```sql
SELECT 
    id,
    customer_name,
    appointment_date,
    appointment_time,
    employee_id,
    resource_id,
    gcal_event_id,
    synced_to_gcal,
    internal_notes->>'gcal_event_id' as gcal_from_notes,
    created_at
FROM appointments
WHERE business_id = '3bbe9ac3-3e61-471e-822e-e159f6ad8ae2' -- ⚠️ Reemplaza con tu business_id
ORDER BY created_at DESC
LIMIT 5;
```

**Debe mostrar:**
- ✅ `employee_id` o `resource_id` no nulo
- ❌ Si ambos son `null`, la sincronización fallará

---

### **3. Verificar el mapeo de calendarios:**

```sql
-- ✅ Verificar mapeo de empleados a calendarios (para TODOS los negocios)
SELECT 
    e.business_id,
    e.id as employee_id,
    e.name as employee_name,
    i.config->'employee_calendar_mapping'->>e.id::text as calendar_id,
    CASE 
        WHEN i.config->'employee_calendar_mapping'->>e.id::text IS NOT NULL THEN '✅ Mapeado'
        ELSE '❌ Sin mapear'
    END as estado
FROM employees e
INNER JOIN integrations i ON i.business_id = e.business_id
WHERE i.provider = 'google_calendar'
  AND i.is_active = true
  AND e.is_active = true
ORDER BY e.business_id, e.name;
```

**O solo para TU negocio:**
```sql
SELECT 
    e.id as employee_id,
    e.name as employee_name,
    i.config->'employee_calendar_mapping'->>e.id::text as calendar_id,
    CASE 
        WHEN i.config->'employee_calendar_mapping'->>e.id::text IS NOT NULL THEN '✅ Mapeado'
        ELSE '❌ Sin mapear'
    END as estado
FROM employees e
INNER JOIN integrations i ON i.business_id = e.business_id
WHERE i.provider = 'google_calendar'
  AND i.is_active = true
  AND e.business_id = '3bbe9ac3-3e61-471e-822e-e159f6ad8ae2' -- ⚠️ Reemplaza con tu business_id
  AND e.is_active = true;
```

**Debe mostrar:**
- ✅ Cada empleado con su `calendar_id` mapeado
- ❌ Si un empleado no tiene `calendar_id`, las reservas de ese empleado no se sincronizarán

---

### **4. Verificar logs de la Edge Function:**

**En Supabase Dashboard:**
1. Ve a **Edge Functions** → `sync-google-calendar`
2. Revisa los **Logs** más recientes
3. Busca:
   - `🔄 Sincronizando reserva...`
   - `✅ Calendario encontrado: ...`
   - `✅ Evento creado en Google Calendar: ...`
   - `⚠️ No se puede sincronizar...`

**Errores comunes:**
- `⚠️ No hay calendario mapeado` → Falta mapear el empleado a un calendario
- `❌ Error creando evento` → Problema con la API de Google Calendar
- `❌ Error refrescando token` → Token de Google expirado

---

### **5. Verificar en la consola del navegador:**

**Al crear una reserva, busca estos logs:**

```javascript
// ✅ Debe aparecer:
🔄 Sincronizando reserva con Google Calendar...
✅ Reserva sincronizada con Google Calendar: { success: true, event_id: "..." }

// ❌ Si aparece esto:
⚠️ Reserva creada pero no sincronizada: No hay calendario mapeado...
```

---

## 🔧 Soluciones Comunes

### **Problema 1: "No hay calendario mapeado"**

**Solución:**
1. Ve a **Configuración** → **Integraciones** → **Google Calendar**
2. Haz clic en **"Vincular Calendarios"** o **"Seleccionar Calendarios"**
3. Vincula cada empleado a su calendario de Google Calendar
4. Guarda los cambios
5. Intenta crear una nueva reserva

---

### **Problema 2: La reserva no tiene `employee_id`**

**Solución:**
1. Verifica que el slot de disponibilidad tenga `employee_id`
2. Verifica que el recurso esté asignado a un empleado:
   ```sql
   SELECT e.id, e.name, e.assigned_resource_id
   FROM employees e
   WHERE e.business_id = 'TU_BUSINESS_ID'
     AND e.is_active = true;
   ```

---

### **Problema 3: Token de Google Calendar expirado**

**Solución:**
1. Ve a **Configuración** → **Integraciones** → **Google Calendar**
2. Desconecta y vuelve a conectar Google Calendar
3. Esto refrescará el token

---

### **Problema 4: Error 401/403 de Google Calendar API**

**Solución:**
1. Verifica que los permisos de Google Calendar estén correctos
2. Verifica que el calendario no esté eliminado
3. Re-conecta Google Calendar

---

## 📊 Query de Diagnóstico Completo

```sql
-- ✅ Diagnóstico completo de sincronización (últimas 5 reservas de TODOS los negocios)
WITH last_appointments AS (
    SELECT 
        a.*,
        e.name as employee_name,
        i.config->'employee_calendar_mapping'->>a.employee_id::text as mapped_calendar
    FROM appointments a
    LEFT JOIN employees e ON e.id = a.employee_id
    LEFT JOIN integrations i ON i.business_id = a.business_id 
        AND i.provider = 'google_calendar'
        AND i.is_active = true
    ORDER BY a.created_at DESC
    LIMIT 5
)
SELECT 
    business_id,
    id,
    customer_name,
    appointment_date,
    appointment_time,
    employee_id,
    employee_name,
    resource_id,
    mapped_calendar,
    CASE 
        WHEN mapped_calendar IS NOT NULL THEN '✅ Calendario mapeado'
        WHEN employee_id IS NULL AND resource_id IS NULL THEN '❌ Sin employee_id ni resource_id'
        WHEN employee_id IS NOT NULL AND mapped_calendar IS NULL THEN '❌ Sin calendario mapeado para este empleado'
        WHEN resource_id IS NOT NULL THEN '⚠️ Solo tiene resource_id (verificar mapeo de recursos)'
        ELSE '❓ Estado desconocido'
    END as estado_sincronizacion,
    gcal_event_id,
    synced_to_gcal,
    created_at
FROM last_appointments;
```

**O solo para TU negocio (reemplaza el business_id):**
```sql
WITH last_appointments AS (
    SELECT 
        a.*,
        e.name as employee_name,
        i.config->'employee_calendar_mapping'->>a.employee_id::text as mapped_calendar
    FROM appointments a
    LEFT JOIN employees e ON e.id = a.employee_id
    LEFT JOIN integrations i ON i.business_id = a.business_id 
        AND i.provider = 'google_calendar'
        AND i.is_active = true
    WHERE a.business_id = '3bbe9ac3-3e61-471e-822e-e159f6ad8ae2' -- ⚠️ Reemplaza con tu business_id
    ORDER BY a.created_at DESC
    LIMIT 5
)
SELECT 
    id,
    customer_name,
    appointment_date,
    appointment_time,
    employee_id,
    employee_name,
    resource_id,
    mapped_calendar,
    CASE 
        WHEN mapped_calendar IS NOT NULL THEN '✅ Calendario mapeado'
        WHEN employee_id IS NULL AND resource_id IS NULL THEN '❌ Sin employee_id ni resource_id'
        WHEN employee_id IS NOT NULL AND mapped_calendar IS NULL THEN '❌ Sin calendario mapeado para este empleado'
        WHEN resource_id IS NOT NULL THEN '⚠️ Solo tiene resource_id (verificar mapeo de recursos)'
        ELSE '❓ Estado desconocido'
    END as estado_sincronizacion,
    gcal_event_id,
    synced_to_gcal,
    created_at
FROM last_appointments;
```

---

## 🚀 Próximos Pasos

1. **Ejecuta las queries de diagnóstico** arriba
2. **Revisa los logs** en Supabase Dashboard
3. **Revisa la consola del navegador** al crear una reserva
4. **Comparte los resultados** para diagnóstico más específico

---

**Última actualización:** 21 de Noviembre 2025

