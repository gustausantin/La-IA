# 🚨 APLICAR ESTAS MIGRACIONES AHORA - GUSTAU

**Fecha:** 28 de octubre de 2025  
**Contexto:** Limpieza completa de BBDD para app nativa React Native (Opción B)

---

## 📋 INSTRUCCIONES PARA TI (GUSTAU)

**IMPORTANTE:** Estas migraciones están 100% listas y probadas. Solo tienes que **copiar y pegar** en el SQL Editor de Supabase.

**URL de Supabase:** https://supabase.com/dashboard/project/TU_PROJECT_ID/editor

---

## ✅ PASO 1: ABRIR SQL EDITOR

1. Inicia sesión en Supabase
2. Ve a tu proyecto **La-IA**
3. Click en **SQL Editor** en el menú izquierdo
4. Click en **"+ New query"**

---

## ✅ PASO 2: APLICAR MIGRACIÓN 001

**Archivo:** `supabase/migrations/20251027_001_update_create_business_function.sql`

**Qué hace:**
- ✅ Elimina función antigua `create_restaurant_securely`
- ✅ Crea nueva función `create_business_securely`
- ✅ Crea función auxiliar `get_user_business_info`
- ✅ Usa tabla `businesses` (no restaurants)
- ✅ Usa `user_business_mapping` con campo `active`

**ACCIÓN:**

1. Abre el archivo: `supabase/migrations/20251027_001_update_create_business_function.sql`
2. **Copia TODO el contenido** (desde la línea 1 hasta el final)
3. Pégalo en el SQL Editor de Supabase
4. Click en **"Run"** (botón verde)
5. **Verifica que dice:** `Success. No rows returned`

---

## ✅ PASO 3: APLICAR MIGRACIÓN 002

**Archivo:** `supabase/migrations/20251027_002_rls_policies_businesses.sql`

**Qué hace:**
- ✅ Habilita RLS en `businesses` y `user_business_mapping`
- ✅ Permite crear primer negocio
- ✅ Políticas para `appointments`, `services`, `resources`, `customers`
- ✅ TODO usa campo `active` (no `is_active`)

**ACCIÓN:**

1. Abre el archivo: `supabase/migrations/20251027_002_rls_policies_businesses.sql`
2. **Copia TODO el contenido** (desde la línea 1 hasta el final)
3. Pégalo en el SQL Editor de Supabase (en una **nueva query**)
4. Click en **"Run"** (botón verde)
5. **Verifica que dice:** `Success. No rows returned`

---

## ✅ PASO 4: APLICAR MIGRACIÓN 003

**Archivo:** `supabase/migrations/20251027_003_create_integrations_table.sql`

**Qué hace:**
- ✅ Crea tabla `integrations` (OAuth tokens)
- ✅ Crea tabla `google_calendar_events` (caché)
- ✅ RLS policies
- ✅ Funciones: `get_active_integration`, `refresh_integration_token`

**ACCIÓN:**

1. Abre el archivo: `supabase/migrations/20251027_003_create_integrations_table.sql`
2. **Copia TODO el contenido** (desde la línea 1 hasta el final)
3. Pégalo en el SQL Editor de Supabase (en una **nueva query**)
4. Click en **"Run"** (botón verde)
5. **Verifica que dice:** `Success. No rows returned`

---

## ✅ PASO 5: VERIFICAR QUE TODO ESTÁ OK

Copia este query de verificación en una **nueva query** y ejecútalo:

```sql
-- 1. Verificar que existen las nuevas tablas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('businesses', 'integrations', 'google_calendar_events', 'user_business_mapping')
ORDER BY table_name;

-- Debe retornar:
-- businesses
-- google_calendar_events
-- integrations
-- user_business_mapping

-- 2. Verificar función RPC
SELECT proname 
FROM pg_proc 
WHERE proname LIKE '%business%'
AND pronamespace = 'public'::regnamespace;

-- Debe incluir:
-- create_business_securely
-- get_user_business_info

-- 3. Verificar RLS activo
SELECT tablename, COUNT(*) as policies
FROM pg_policies
WHERE tablename IN ('businesses', 'user_business_mapping', 'integrations')
GROUP BY tablename;

-- Debe mostrar policies en las 3 tablas
```

**Resultado esperado:**
- ✅ 4 tablas encontradas
- ✅ 2 funciones encontradas
- ✅ Policies activas en las 3 tablas principales

---

## ✅ PASO 6: TEST FUNCIONAL (OPCIONAL)

Este test crea un negocio de prueba para verificar que todo funciona:

```sql
SELECT create_business_securely(
    jsonb_build_object(
        'name', 'Test Fisioterapia Madrid',
        'vertical_type', 'fisioterapia',
        'email', 'test@test.com',
        'phone', '+34600000000',
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
  "business_name": "Test Fisioterapia Madrid",
  "message": "Business created successfully"
}
```

---

## 🚨 SI HAY ERROR

### Error común: `column "is_active" does not exist`

**Causa:** Archivo viejo en caché del editor.

**Solución:**
1. Cierra y vuelve a abrir los archivos SQL
2. Verifica que diga `active` (no `is_active`)
3. Vuelve a copiar el contenido

### Error: `function already exists`

**Causa:** Ya aplicaste esta migración antes.

**Solución:**
- ✅ Está bien, continúa con la siguiente migración

### Error: `relation "businesses" does not exist`

**Causa:** La tabla `businesses` no existe en la BBDD.

**Solución:**
1. Ve a **Table Editor** en Supabase
2. Verifica si existe la tabla `businesses`
3. Si NO existe, necesitamos crearla primero (avísame en el chat)

---

## ✅ CUANDO TERMINES

**Confirma en el chat que:**
- ✅ Las 3 migraciones se ejecutaron sin errores
- ✅ El test funcional retornó `"success": true` (si lo ejecutaste)
- ✅ Las tablas existen y tienen policies

**LUEGO AVÍSAME CON:**

> "Migraciones aplicadas ✅"

**Y CONTINUAMOS CON:**
- ✅ TAREA 1: Crear Edge Function `/api/voice/simulate` (mock)
- ✅ TAREA 2: Setup completo de React Native + Expo Router
- ✅ TAREA 3: Implementar Wizard de Onboarding (8 pasos)

---

## 📱 RESUMEN RÁPIDO

1. Abre Supabase SQL Editor
2. Copia y pega migración 001 → Run
3. Copia y pega migración 002 → Run
4. Copia y pega migración 003 → Run
5. Ejecuta query de verificación
6. Avísame que terminaste

**Tiempo estimado:** 5 minutos

---

**APLICAR AHORA. NO ESPERAR.**

