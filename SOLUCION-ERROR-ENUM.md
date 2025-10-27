# 🔧 SOLUCIÓN AL ERROR: type "zone_type" does not exist

## ❌ Error Encontrado:
```sql
ERROR: 42704: type "zone_type" does not exist
LINE 245: zone zone_type NOT NULL DEFAULT 'interior'
```

---

## ✅ SOLUCIÓN: Crear ENUMs Primero

### **OPCIÓN 1: SQL Completo en Orden Correcto** (RECOMENDADA)

#### Ejecuta estos comandos EN ORDEN:

**PRIMERO - Crear los tipos ENUM:**

```sql
-- 1. Tipos ENUM
CREATE TYPE zone_type AS ENUM ('interior', 'terraza', 'barra', 'privado', 'exterior');

CREATE TYPE channel_type AS ENUM ('whatsapp', 'vapi', 'phone', 'email', 'web', 'instagram', 'facebook', 'google');

CREATE TYPE user_role AS ENUM ('owner', 'admin', 'manager', 'staff', 'viewer');

CREATE TYPE reservation_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed', 'no_show', 'pending_approval');

CREATE TYPE table_status AS ENUM ('available', 'occupied', 'reserved', 'maintenance', 'disabled');

-- 2. Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
```

**SEGUNDO - Ejecutar el resto del SQL:**

Ahora SÍ puedes ejecutar todo el contenido de:
`docs/01-arquitectura/DATABASE-SCHEMA-ESTRUCTURA-COMPLETA-2025-10-17.sql`

---

### **OPCIÓN 2: Usar SQL Sin ENUMs** (MÁS RÁPIDO)

Si quieres evitar problemas, usa VARCHAR en lugar de ENUMs:

```sql
-- En lugar de:
zone zone_type NOT NULL DEFAULT 'interior'

-- Usar:
zone VARCHAR(50) NOT NULL DEFAULT 'interior'
```

Pero esto es menos seguro. **Recomiendo OPCIÓN 1**.

---

## 📋 PASOS EXACTOS A SEGUIR:

### 1. **Limpiar SQL Editor** (si ya ejecutaste algo):

```sql
-- Solo si necesitas limpiar tablas creadas a medias:
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
```

⚠️ **CUIDADO**: Esto borra TODO. Solo si necesitas empezar de cero.

---

### 2. **Ejecutar en este orden:**

**Paso A: Crear ENUMs (copiar y pegar esto primero):**

```sql
CREATE TYPE zone_type AS ENUM ('interior', 'terraza', 'barra', 'privado', 'exterior');
CREATE TYPE channel_type AS ENUM ('whatsapp', 'vapi', 'phone', 'email', 'web', 'instagram', 'facebook', 'google');
CREATE TYPE user_role AS ENUM ('owner', 'admin', 'manager', 'staff', 'viewer');
CREATE TYPE reservation_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed', 'no_show', 'pending_approval');
CREATE TYPE table_status AS ENUM ('available', 'occupied', 'reserved', 'maintenance', 'disabled');
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
```

Click **RUN** → Espera confirmación ✅

---

**Paso B: Ejecutar el resto del esquema:**

Ahora copia TODO el contenido de:
`docs/01-arquitectura/DATABASE-SCHEMA-ESTRUCTURA-COMPLETA-2025-10-17.sql`

Click **RUN** → Espera 2-3 minutos ⏳

---

### 3. **Verificar:**

```sql
-- Verificar que los tipos existen:
SELECT typname FROM pg_type WHERE typname LIKE '%_type';

-- Debería mostrar:
-- zone_type
-- channel_type
-- table_status
-- reservation_status
-- user_role
```

```sql
-- Verificar tablas creadas:
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Debería mostrar las 61 tablas
```

---

## 🎯 SI SIGUES TENIENDO PROBLEMAS

### **Plan B: SQL Simplificado**

Si los ENUMs dan problemas, puedo generar una versión del esquema que use VARCHAR en lugar de ENUMs. Dime si quieres esta opción.

---

## ✅ DESPUÉS DE SOLUCIONAR

Una vez ejecutado correctamente:

1. Ve a **Table Editor**
2. Deberías ver **61 tablas**
3. Sigue con: `TESTING-POST-MIGRACION.md`

---

**¿Ya probaste el Paso A (crear ENUMs primero)?** 

Si sigue dando error, dime qué mensaje aparece y genero una versión sin ENUMs. 🔧

