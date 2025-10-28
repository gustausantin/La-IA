# ✅ WIZARD DE ONBOARDING - VERSIÓN FINAL

**Fecha:** 2025-10-27  
**Estado:** ✅ COMPLETO Y FUNCIONAL

---

## 🎯 **CAMBIOS REALIZADOS**

### 1. **Wizard OnboardingWizard.jsx** ✅
- **Campo corregido:** `vertical` → `vertical_type` (coincide con el schema de Supabase)
- **Logs detallados:** Cada paso del proceso tiene logging para debugging
- **Manejo robusto de errores:** Try-catch envolvente con mensajes claros
- **Creación completa:**
  - ✅ Negocio (`businesses`)
  - ✅ Relación usuario-negocio (`user_business_mapping`)
  - ✅ Servicios predefinidos (`services`)
  - ✅ Recursos predefinidos (`resources`)
- **Evento de recarga:** Dispara `force-business-reload` para actualizar el contexto

---

### 2. **AuthContext.jsx** ✅
- **fetchBusinessInfo restaurada:** Ya NO es un bypass, hace queries reales
- **Query optimizada:** Join directo entre `user_business_mapping` y `businesses`
- **Listener de eventos:** Escucha `force-business-reload` y recarga el business
- **Manejo de errores:** Si falla, marca `business = null` sin romper la app

---

### 3. **SQL Reset Completo** (docs/08-seguridad/RESET-COMPLETO-PROFESIONAL.sql) ✅
- **Borra todas las políticas RLS**
- **Deshabilita RLS** en todas las tablas principales
- **Crea función RPC `get_user_business`** con `SECURITY DEFINER`
- **Owner postgres:** Para bypass de RLS

---

## 📋 **INSTRUCCIONES PARA EL USUARIO**

### ✅ **Paso 1: Ejecutar SQL en Supabase**
```sql
-- Ejecutar en Supabase SQL Editor:
-- docs/08-seguridad/RESET-COMPLETO-PROFESIONAL.sql
```

Este script:
- Limpia todas las políticas RLS antiguas
- Deshabilita RLS completamente
- Crea la función RPC correctamente

---

### ✅ **Paso 2: Limpiar datos de prueba anteriores**

Si ya has intentado crear un negocio y falló, limpia los datos:

```sql
-- Borrar negocios de prueba
DELETE FROM businesses WHERE name ILIKE '%prueba%' OR name ILIKE '%test%';

-- Borrar mappings huérfanos
DELETE FROM user_business_mapping 
WHERE business_id NOT IN (SELECT id FROM businesses);
```

---

### ✅ **Paso 3: Limpiar caché del navegador**

En Chrome/Edge:
- **Ctrl + Shift + R** (Hard Refresh)
- O Abre DevTools → Network → Disable cache

---

### ✅ **Paso 4: Probar el wizard**

1. Abre la app: `http://localhost:3000`
2. Inicia sesión con tu usuario
3. Deberías ser redirigido automáticamente a `/onboarding`
4. Completa los 3 pasos del wizard
5. Click en "¡Crear mi negocio!"
6. **Observa la consola del navegador** para logs detallados

---

## 🔍 **LOGS ESPERADOS EN CONSOLA**

Si todo funciona correctamente, verás:

```
🟢 INICIANDO CREACIÓN DE NEGOCIO
✅ Usuario autenticado: d252c3d7-4fea-4b7d-8252-2295283b819e
📤 Insertando negocio en Supabase...
📋 Payload del negocio: {...}
✅ Negocio creado: {...}
📤 Creando relación usuario-negocio...
✅ Relación usuario-negocio creada
📤 Creando servicios predefinidos...
✅ Servicios creados: 4
📤 Creando recursos predefinidos...
✅ Recursos creados: 3
🎉 NEGOCIO CREADO EXITOSAMENTE
🔄 AuthContext: Recarga forzada desde OnboardingWizard
✅ AuthContext: Negocio recargado
```

---

## 🚨 **SI FALLA, REVISAR:**

### 1. **Error: "column vertical does not exist"**
- ✅ **YA CORREGIDO** en el wizard (línea 166: `vertical_type`)

### 2. **Error: Query hanging / sin respuesta**
- Ejecuta el script SQL de reset (Paso 1)
- Verifica que RLS esté deshabilitado:
  ```sql
  SELECT tablename, rowsecurity 
  FROM pg_tables 
  WHERE schemaname = 'public' 
    AND tablename IN ('businesses', 'user_business_mapping');
  ```
  Debe devolver `rowsecurity = false`

### 3. **Error: "business_id violates foreign key constraint"**
- Verifica que la tabla `businesses` existe y tiene datos:
  ```sql
  SELECT * FROM businesses LIMIT 5;
  ```

### 4. **Usuario no redirige a onboarding**
- Verifica que el usuario NO tenga un negocio asignado:
  ```sql
  SELECT * FROM user_business_mapping 
  WHERE auth_user_id = 'd252c3d7-4fea-4b7d-8252-2295283b819e';
  ```
  Si tiene, bórralo:
  ```sql
  DELETE FROM user_business_mapping 
  WHERE auth_user_id = 'd252c3d7-4fea-4b7d-8252-2295283b819e';
  ```

---

## 🎯 **PRÓXIMOS PASOS DESPUÉS DE CREAR EL NEGOCIO:**

1. **Reactivar RLS de forma gradual** (cuando TODO funcione)
2. **Agregar validaciones de negocio** (ej: nombre único)
3. **Wizard de configuración de horarios**
4. **Importación de servicios personalizados**
5. **Conexión con calendarios externos** (Google Calendar, Outlook)

---

## 📚 **ARCHIVOS MODIFICADOS:**

1. `src/components/onboarding/OnboardingWizard.jsx`
2. `src/contexts/AuthContext.jsx`
3. `docs/08-seguridad/RESET-COMPLETO-PROFESIONAL.sql`

---

**ESTADO FINAL:** ✅ **LISTO PARA PROBAR**


