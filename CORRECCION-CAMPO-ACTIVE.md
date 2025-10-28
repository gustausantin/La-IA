# ✅ CORRECCIÓN APLICADA: Campo `active` vs `is_active`

## 🐛 Problema Detectado

La tabla `user_business_mapping` en Supabase usa el campo **`active`**, no `is_active`.

**Error original:**
```
ERROR: 42703: column "is_active" does not exist
HINT: Perhaps you meant to reference the column "user_business_mapping.active"
```

## ✅ Solución Aplicada

He corregido **TODOS** los archivos que usaban `is_active`:

### 1. Migración SQL 001 (Función RPC)
✅ `supabase/migrations/20251027_001_update_create_business_function.sql`
- Cambio: `is_active = true` → `active = true`
- Líneas afectadas: 36, 85, 153

### 2. Migración SQL 002 (Políticas RLS)
✅ `supabase/migrations/20251027_002_rls_policies_businesses.sql`
- Cambio: Todas las referencias `is_active` → `active`
- 12 ocurrencias corregidas en políticas RLS

### 3. Frontend (OnboardingWizard)
✅ `src/components/onboarding/OnboardingWizard.jsx`
- Cambio: `is_active: true` → `active: true`
- Línea 197

### 4. Documentación
✅ `docs/08-seguridad/APLICAR-MIGRACIONES-ONBOARDING-2025-10-27.md`
- Actualizado para reflejar el campo correcto

---

## 🚀 Acción Requerida

**Vuelve a ejecutar las 2 migraciones SQL en Supabase:**

Las migraciones ya están corregidas con el campo correcto (`active`).

1. **Primero limpia las políticas anteriores si las ejecutaste:**
   ```sql
   -- Solo si ya ejecutaste la migración 002 con error
   DROP POLICY IF EXISTS "Users can create their first business" ON businesses;
   DROP POLICY IF EXISTS "Users can view their own businesses" ON businesses;
   DROP POLICY IF EXISTS "Owners can update their business" ON businesses;
   DROP POLICY IF EXISTS "Users can create their own mapping" ON user_business_mapping;
   DROP POLICY IF EXISTS "Users can view their own mappings" ON user_business_mapping;
   DROP POLICY IF EXISTS "Owners can update their mapping" ON user_business_mapping;
   DROP POLICY IF EXISTS "Users can view appointments of their business" ON appointments;
   DROP POLICY IF EXISTS "Users can insert appointments in their business" ON appointments;
   DROP POLICY IF EXISTS "Users can update appointments of their business" ON appointments;
   DROP POLICY IF EXISTS "Users can manage services of their business" ON services;
   DROP POLICY IF EXISTS "Users can manage resources of their business" ON resources;
   DROP POLICY IF EXISTS "Users can manage customers of their business" ON customers;
   ```

2. **Luego ejecuta las migraciones corregidas:**
   - `supabase/migrations/20251027_001_update_create_business_function.sql`
   - `supabase/migrations/20251027_002_rls_policies_businesses.sql`

---

## ✅ Estado Actual

- ✅ Migraciones SQL corregidas
- ✅ Frontend corregido
- ✅ Documentación actualizada
- ✅ Build sigue siendo exitoso

**Ahora sí, las migraciones deberían ejecutarse sin errores.**

---

**Fecha corrección:** 27 de octubre de 2025  
**Campo correcto:** `active` (no `is_active`)




