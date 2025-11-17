# 🔍 Verificar Estructura de la Tabla integrations

## Problema

Error: `column "is_active" does not exist`

Esto significa que la tabla `integrations` no tiene la estructura correcta.

## Solución

### Paso 1: Aplicar la Migración de Corrección

Ejecuta en Supabase SQL Editor:

```sql
-- Copia y pega TODO el contenido de:
-- supabase/migrations/20251117_02_fix_integrations_table.sql
```

Esta migración:
- ✅ Verifica qué columnas faltan
- ✅ Agrega las columnas necesarias
- ✅ No afecta datos existentes
- ✅ Es segura de ejecutar múltiples veces

### Paso 2: Verificar la Estructura

Después de aplicar la migración, ejecuta:

```sql
-- Ver todas las columnas de la tabla integrations
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'integrations'
ORDER BY ordinal_position;
```

Deberías ver estas columnas:
- `id` (uuid)
- `business_id` (uuid)
- `provider` (text)
- `is_active` (boolean) ← **Esta es la que faltaba**
- `access_token` (text)
- `refresh_token` (text)
- `token_expires_at` (timestamptz)
- `config` (jsonb)
- `connected_at` (timestamptz)
- `last_sync_at` (timestamptz)
- `disconnected_at` (timestamptz)
- `error_log` (jsonb)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### Paso 3: Verificar Datos (Después de Conectar)

```sql
-- Ver integraciones guardadas
SELECT 
    id, 
    business_id, 
    provider, 
    is_active,
    connected_at, 
    config->>'calendar_name' as calendar_name,
    CASE 
        WHEN token_expires_at > NOW() THEN 'Válido'
        ELSE 'Expirado'
    END as token_status
FROM integrations 
WHERE provider = 'google_calendar'
ORDER BY connected_at DESC;
```

## Si la Migración Falla

Si la migración falla, ejecuta manualmente:

```sql
-- Agregar columna is_active
ALTER TABLE public.integrations 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Agregar otras columnas si faltan
ALTER TABLE public.integrations 
ADD COLUMN IF NOT EXISTS access_token TEXT,
ADD COLUMN IF NOT EXISTS refresh_token TEXT,
ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS connected_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS disconnected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS error_log JSONB DEFAULT '[]'::jsonb;
```

## Después de Corregir

1. ✅ Aplica la migración `20251117_02_fix_integrations_table.sql`
2. ✅ Verifica que todas las columnas existan
3. ✅ Prueba conectar Google Calendar de nuevo
4. ✅ Verifica que los datos se guarden correctamente

