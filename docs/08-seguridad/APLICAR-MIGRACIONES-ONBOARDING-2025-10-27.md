# 🚀 APLICAR MIGRACIONES ONBOARDING - 27 OCT 2025

## 📋 Contexto

Se han realizado cambios masivos en la aplicación para migrar completamente del modelo legacy (`restaurants`, `reservations`, `tables`) al modelo definitivo (`businesses`, `appointments`, `resources`).

Estas migraciones son **CRÍTICAS** para que el onboarding funcione correctamente y los usuarios puedan crear sus negocios.

## ⚠️ IMPORTANTE - ORDEN DE EJECUCIÓN

Ejecuta las migraciones en este orden exacto:

### 1️⃣ Actualizar Función RPC (OBLIGATORIO)

```sql
-- Archivo: supabase/migrations/20251027_001_update_create_business_function.sql
-- Esta migración:
-- - Elimina create_restaurant_securely (antigua)
-- - Crea create_business_securely (nueva)
-- - Actualiza get_user_business_info para usar user_business_mapping
```

**Copiar y ejecutar** el contenido completo de:
`supabase/migrations/20251027_001_update_create_business_function.sql`

### 2️⃣ Aplicar Políticas RLS (OBLIGATORIO)

```sql
-- Archivo: supabase/migrations/20251027_002_rls_policies_businesses.sql
-- Esta migración:
-- - Habilita RLS en businesses y user_business_mapping
-- - Permite a usuarios autenticados crear su primer negocio
-- - Permite acceso seguro a appointments, services, resources, customers
```

**Copiar y ejecutar** el contenido completo de:
`supabase/migrations/20251027_002_rls_policies_businesses.sql`

## 🔍 Verificación Post-Migración

Después de aplicar ambas migraciones, verificar:

### ✅ Verificar función RPC

```sql
-- Debe retornar la función create_business_securely
SELECT 
    proname as function_name,
    pg_get_function_arguments(oid) as arguments
FROM pg_proc
WHERE proname LIKE '%business%'
AND pronamespace = 'public'::regnamespace;
```

### ✅ Verificar políticas RLS

```sql
-- Debe mostrar políticas activas en businesses
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE tablename IN ('businesses', 'user_business_mapping', 'appointments', 'services', 'resources')
ORDER BY tablename, policyname;
```

### ✅ Test funcional - Crear negocio de prueba

```sql
-- Ejecutar como usuario autenticado (en SQL Editor con auth activo)
SELECT create_business_securely(
    jsonb_build_object(
        'name', 'Test Business',
        'vertical_type', 'fisioterapia',
        'email', 'test@test.com',
        'phone', '+34 600 000 000',
        'city', 'Madrid',
        'active', true
    ),
    jsonb_build_object(
        'email', 'test@test.com',
        'full_name', 'Test User'
    )
);
```

**Resultado esperado:**
```json
{
  "success": true,
  "business_id": "uuid-generado",
  "business_name": "Test Business",
  "message": "Business created successfully"
}
```

## 🐛 Troubleshooting

### Error: "No authenticated user found"

**Causa:** La función RPC requiere un usuario autenticado con `auth.uid()`.

**Solución:** Ejecutar el test desde la aplicación (frontend) o configurar el SQL Editor con autenticación.

### Error: "User already has an active business"

**Causa:** El usuario ya tiene un negocio asociado en `user_business_mapping`.

**Solución:** Verificar mappings existentes:

```sql
SELECT * FROM user_business_mapping 
WHERE auth_user_id = auth.uid();
```

### Error: "permission denied for table businesses"

**Causa:** Las políticas RLS no se aplicaron correctamente.

**Solución:** Re-ejecutar la migración `20251027_002_rls_policies_businesses.sql`.

### Error 403 en INSERT a businesses

**Causa:** Falta la policy "Users can create their first business".

**Solución:**

```sql
-- Verificar que existe la policy
SELECT * FROM pg_policies 
WHERE tablename = 'businesses' 
AND policyname = 'Users can create their first business';

-- Si no existe, ejecutar solo esa policy desde la migración 002
```

## 📊 Cambios Realizados en el Código

### Frontend (React)

- ✅ `src/contexts/AuthContext.jsx` → usa `create_business_securely`
- ✅ `src/components/onboarding/OnboardingWizard.jsx` → campo `active` en mapping
- ✅ Todas las referencias a `restaurants` → `businesses`
- ✅ Todas las referencias a `reservations` → `appointments`
- ✅ Todas las referencias a `tables` → `resources`
- ✅ Todas las referencias a `restaurantId` → `businessId`

### Stores (Zustand)

- ✅ `src/stores/businessStore.js` → consulta `businesses`
- ✅ `src/stores/reservationStore.js` → consulta `appointments`

### Servicios

- ✅ `src/services/realtimeService.js` → escucha eventos de `businesses` y `appointments`
- ✅ `src/services/AvailabilityService.js` → parámetro `businessId`
- ✅ Todos los demás servicios actualizados

## 🎯 Resultado Final

Después de aplicar estas migraciones:

1. ✅ Los usuarios podrán **registrarse** sin errores
2. ✅ El **onboarding wizard** funcionará correctamente
3. ✅ Se crearán negocios en la tabla `businesses`
4. ✅ Se establecerá la relación en `user_business_mapping`
5. ✅ Los usuarios podrán **acceder a su dashboard** inmediatamente
6. ✅ Todas las operaciones CRUD funcionarán con RLS activo

## 📞 Soporte

Si encuentras algún problema:

1. Verificar que las dos migraciones se ejecutaron completamente
2. Revisar logs del SQL Editor de Supabase
3. Consultar la sección de Troubleshooting arriba
4. Verificar que el usuario está autenticado correctamente

---

**Última actualización:** 27 de octubre de 2025  
**Autor:** La-IA Development Team  
**Prioridad:** 🔥 CRÍTICA - Aplicar inmediatamente

