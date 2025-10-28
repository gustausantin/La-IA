# 🚨 SOLUCIÓN DEFINITIVA: QUERIES COLGADAS

**Problema:** Las queries de Supabase **se quedan colgadas sin respuesta**

**Causa raíz:** Conexión Supabase inestable o RLS mal configurado

---

## ✅ **SOLUCIÓN 1: VERIFICAR CONEXIÓN SUPABASE**

### Paso 1: Abrir Supabase SQL Editor
```sql
-- Test simple: Ver si hay conexión
SELECT NOW();
```

Si esto NO responde → **Supabase está caído o hay problemas de red**.

---

### Paso 2: Verificar que las tablas existen
```sql
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('businesses', 'user_business_mapping', 'services', 'resources')
ORDER BY tablename;
```

**Debe devolver 4 filas.**

---

### Paso 3: Verificar RLS
```sql
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('businesses', 'user_business_mapping', 'services', 'resources')
ORDER BY tablename;
```

**TODAS deben tener `rls_enabled = false`**

---

## ✅ **SOLUCIÓN 2: SI RLS ESTÁ ACTIVO, DESACTIVARLO**

```sql
-- DESHABILITAR RLS EN TODAS LAS TABLAS
ALTER TABLE businesses DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_business_mapping DISABLE ROW LEVEL SECURITY;
ALTER TABLE services DISABLE ROW LEVEL SECURITY;
ALTER TABLE resources DISABLE ROW LEVEL SECURITY;
ALTER TABLE appointments DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;

-- BORRAR TODAS LAS POLÍTICAS
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT schemaname, tablename, policyname 
              FROM pg_policies 
              WHERE schemaname = 'public') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
                      r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- VERIFICAR
SELECT 
    tablename,
    rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
```

---

## ✅ **SOLUCIÓN 3: LIMPIAR DATOS DE PRUEBA**

```sql
-- BORRAR INTENTOS FALLIDOS
DELETE FROM user_business_mapping 
WHERE auth_user_id = 'd252c3d7-4fea-4b7d-8252-2295283b819e';

DELETE FROM businesses 
WHERE name ILIKE '%vaya pelos%' 
   OR name ILIKE '%prueba%'
   OR name ILIKE '%test%';
```

---

## ✅ **SOLUCIÓN 4: TEST MANUAL DE INSERCIÓN**

Intenta crear un negocio MANUALMENTE desde SQL:

```sql
-- Test de inserción directa
INSERT INTO businesses (
  name, 
  vertical_type, 
  phone, 
  email, 
  address, 
  city, 
  postal_code, 
  active
) VALUES (
  'Test Manual',
  'peluqueria_barberia',
  '+34600000000',
  'test@test.com',
  'Calle Test 1',
  'Madrid',
  '28001',
  true
)
RETURNING *;
```

### Si esto FALLA o se CUELGA:
- **Supabase está caído**
- **RLS sigue activo**
- **Hay un trigger o constraint bloqueante**

---

## ✅ **SOLUCIÓN 5: REGENERAR PROYECTO SUPABASE**

Si NADA funciona:

1. **Exporta el schema:**
   ```bash
   -- En Supabase SQL Editor, copia todo el schema
   ```

2. **Crea un NUEVO proyecto Supabase**

3. **Importa solo el schema limpio** (sin RLS ni políticas)

4. **Actualiza `.env` con nuevas credenciales**

---

## 🔍 **DEBUGGING: QUÉ LOGS ESPERAR**

### ✅ Logs CORRECTOS:
```
🟢 INICIANDO CREACIÓN DE NEGOCIO
📡 Obteniendo usuario con timeout de 5s...
✅ Usuario autenticado: d252c3d7-4fea-4b7d-8252-2295283b819e
📤 Insertando negocio en Supabase...
📋 Payload del negocio: {...}
✅ Negocio creado: {...}
```

### ❌ Logs INCORRECTOS (actual):
```
🟢 INICIANDO CREACIÓN DE NEGOCIO
📡 Obteniendo usuario con timeout de 5s...
(SE CUELGA AQUÍ - NO HAY MÁS LOGS)
```

---

## 📋 **CHECKLIST DE VERIFICACIÓN:**

- [ ] `SELECT NOW();` responde instantáneamente
- [ ] Las 4 tablas existen (`businesses`, `user_business_mapping`, `services`, `resources`)
- [ ] RLS está deshabilitado en todas (`rowsecurity = false`)
- [ ] No hay políticas activas (`SELECT * FROM pg_policies WHERE schemaname = 'public'` → vacío)
- [ ] Insert manual funciona sin colgarse
- [ ] Usuario NO tiene negocio previo en `user_business_mapping`

---

## 🎯 **PRÓXIMO PASO:**

Ejecuta el checklist anterior y reporta qué falla.


