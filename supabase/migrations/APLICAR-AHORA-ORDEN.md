# 🚨 APLICAR ESTAS MIGRACIONES AHORA - ORDEN ESTRICTO

**Fecha:** 27 de octubre de 2025  
**Contexto:** Limpieza completa de BBDD para app nativa React Native

---

## ✅ ORDEN DE EJECUCIÓN (NO ALTERAR)

### 1️⃣ MIGRACIÓN 001: Función RPC create_business_securely

**Archivo:** `supabase/migrations/20251027_001_update_create_business_function.sql`

**Qué hace:**
- Elimina función antigua `create_restaurant_securely`
- Crea nueva función `create_business_securely`
- Crea función auxiliar `get_user_business_info`
- Usa tabla `businesses` (no restaurants)
- Usa `user_business_mapping` con campo `active`

**Copiar y pegar TODO el contenido en SQL Editor de Supabase.**

---

### 2️⃣ MIGRACIÓN 002: RLS Policies

**Archivo:** `supabase/migrations/20251027_002_rls_policies_businesses.sql`

**Qué hace:**
- Habilita RLS en `businesses` y `user_business_mapping`
- Permite crear primer negocio
- Políticas para `appointments`, `services`, `resources`, `customers`
- TODO usa campo `active` (no `is_active`)

**Copiar y pegar TODO el contenido en SQL Editor de Supabase.**

---

### 3️⃣ MIGRACIÓN 003: Tabla integrations (Google Calendar)

**Archivo:** `supabase/migrations/20251027_003_create_integrations_table.sql`

**Qué hace:**
- Crea tabla `integrations` (OAuth tokens)
- Crea tabla `google_calendar_events` (caché)
- RLS policies
- Funciones: `get_active_integration`, `refresh_integration_token`

**Copiar y pegar TODO el contenido en SQL Editor de Supabase.**

---

## ✅ VERIFICACIÓN POST-MIGRACIÓN

Ejecuta este query para confirmar:

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

---

## ✅ TEST FUNCIONAL (Opcional pero recomendado)

Ejecuta esto para crear un negocio de prueba:

```sql
SELECT create_business_securely(
    jsonb_build_object(
        'name', 'Test Fisioterapia',
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
  "business_name": "Test Fisioterapia",
  "message": "Business created successfully"
}
```

---

## 🚨 SI HAY ERROR

**Error común:** `column "is_active" does not exist`

**Causa:** Archivo viejo en caché del editor.

**Solución:**
1. Cierra y vuelve a abrir los archivos SQL
2. Verifica que diga `active` (no `is_active`)
3. Vuelve a copiar el contenido

---

## ✅ CUANDO TERMINES

**Confirma que:**
- ✅ Las 3 migraciones se ejecutaron sin errores
- ✅ El test funcional retornó `"success": true`
- ✅ Las tablas existen y tienen policies

**Entonces aviso y continuamos con el proyecto React Native.**

---

**APLICAR AHORA. NO ESPERAR.**



