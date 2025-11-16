# 📋 CÓMO EXTRAER EL ESQUEMA REAL DE SUPABASE

## 🎯 Objetivo
Crear un archivo **ÚNICO** con el esquema REAL de todas las tablas de Supabase para tenerlo como **fuente de verdad**.

---

## 🔧 Método 1: SQL Editor (RECOMENDADO)

### Paso 1: Ir a Supabase SQL Editor
1. Abre tu proyecto en Supabase Dashboard
2. Ve a **SQL Editor** (icono de rayito ⚡ en el menú izquierdo)
3. Crea una nueva query

### Paso 2: Ejecutar este query

```sql
-- EXTRAER TODAS LAS TABLAS Y SUS COLUMNAS
SELECT 
    t.table_name,
    c.column_name,
    c.data_type,
    c.character_maximum_length,
    c.is_nullable,
    c.column_default,
    c.ordinal_position
FROM information_schema.tables t
JOIN information_schema.columns c 
    ON t.table_name = c.table_name 
    AND t.table_schema = c.table_schema
WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name, c.ordinal_position;
```

### Paso 3: Copiar resultados
1. Ejecuta el query (botón "Run" o F5)
2. Copia todos los resultados
3. Guárdalos en un archivo `SCHEMA-REAL-SUPABASE.csv` o en un Excel

### Paso 4: Generar CREATE TABLE statements

```sql
-- Para cada tabla, ejecuta esto (cambia 'customers' por el nombre de tu tabla):
SELECT 
    'CREATE TABLE ' || table_name || ' (' || 
    string_agg(
        column_name || ' ' || 
        data_type || 
        CASE WHEN character_maximum_length IS NOT NULL 
            THEN '(' || character_maximum_length || ')' 
            ELSE '' 
        END ||
        CASE WHEN is_nullable = 'NO' 
            THEN ' NOT NULL' 
            ELSE '' 
        END ||
        CASE WHEN column_default IS NOT NULL 
            THEN ' DEFAULT ' || column_default 
            ELSE '' 
        END,
        ', '
    ) || 
    ');'
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name = 'customers'  -- CAMBIA ESTO POR CADA TABLA
GROUP BY table_name;
```

---

## 🔧 Método 2: Desde la UI de Supabase

### Paso 1: Table Editor
1. Ve a **Table Editor** en Supabase Dashboard
2. Selecciona cada tabla una por una

### Paso 2: Ver estructura
1. Haz clic en cualquier tabla (ej: `customers`)
2. Los nombres de las columnas aparecen en la parte superior
3. Anota todas las columnas en un documento

### Paso 3: Ver tipos de datos
1. En el menú de la tabla, haz clic en el icono de configuración (⚙️)
2. Ahí verás:
   - Nombre de columna
   - Tipo de dato
   - Si es nullable
   - Valor por defecto

---

## 🔧 Método 3: Usar psql (Avanzado)

Si tienes acceso al cliente `psql`:

```bash
# Conectar a Supabase
psql "postgresql://postgres:[TU_PASSWORD]@[TU_HOST]:5432/postgres"

# Una vez conectado:
\dt public.*                    # Lista todas las tablas
\d public.customers             # Describe tabla customers
\d public.appointments          # Describe tabla appointments
\d public.businesses            # etc...
```

---

## 📋 Tablas que debes extraer

Según tu código, estas son las tablas principales:

1. ✅ `businesses` - Negocios/restaurantes
2. ✅ `customers` - Clientes
3. ✅ `appointments` - Citas/reservas
4. ✅ `services` - Servicios del negocio
5. ✅ `resources` - Recursos (mesas, camillas, etc)
6. ✅ `availability_slots` - Slots de disponibilidad
7. ✅ `user_business_mapping` - Relación usuario-negocio
8. ✅ `service_templates` - Plantillas de servicios
9. ✅ `business_schedules` - Horarios del negocio
10. ✅ `notifications` - Notificaciones
11. ✅ `demo_sessions` - Sesiones demo
12. ✅ `demo_phone_pool` - Pool de teléfonos demo

---

## 📝 Formato del archivo resultante

Guarda el esquema en: `docs/01-arquitectura/SCHEMA-REAL-SUPABASE-2025.sql`

```sql
-- =====================================================
-- ESQUEMA REAL DE SUPABASE
-- Fecha: [FECHA ACTUAL]
-- Fuente: Extraído directamente de Supabase
-- ESTE ES EL ESQUEMA DE VERDAD - NO MODIFICAR
-- =====================================================

-- TABLA: businesses
CREATE TABLE businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    -- ... resto de columnas
);

-- TABLA: customers
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id),
    name VARCHAR NOT NULL,
    -- ... resto de columnas
);

-- ... etc para todas las tablas
```

---

## ✅ Una vez que tengas el esquema

1. **Guárdalo en**: `docs/01-arquitectura/SCHEMA-REAL-SUPABASE-2025.sql`
2. **Borra** todos los esquemas contradictorios de la documentación
3. **Actualiza** `Clientes.jsx` y todos los archivos para usar este esquema
4. **Referencia SIEMPRE** este archivo cuando tengas dudas sobre columnas

---

## 🚨 IMPORTANTE

**ESTE SERÁ EL ÚNICO ESQUEMA VÁLIDO**

Si hay diferencias entre:
- Lo que dice la documentación ❌
- Lo que está en este archivo ✅

**SIEMPRE prevalece este archivo SQL extraído de Supabase**.

